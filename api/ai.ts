

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const config = { maxDuration: 30 };

//Sections
export type Load = {
  loadId: string;
  fromAddress: string;
  fromAppointmentDateTimeUTC: string; 
  toAddress: string;
  toAppointmentDateTimeUTC: string;   
  status: string;
  driverName: string;
  driverPhone?: string;
  unitNumber: string;
  broker: string;
};

export type Issue = {
  code:
    | 'MISSING_COLUMN'
    | 'BAD_DATE_FORMAT'
    | 'DUPLICATE_ID'
    | 'EMPTY_REQUIRED_CELL'
    | 'NON_ISO_OUTPUT'
    | 'INCONSISTENT_STATUS'
    | string;
  severity: 'error' | 'warn';
  message: string;
  rows?: number[];
  column?: string;   
  suggestion?: string;
};

export type AnalysisResult = {
  ok: boolean;
  issues: Issue[];
  loads?: Load[]; 
  mapping: Record<string, string>; 
  meta: {
    analyzedRows: number;
    analyzedAt: string;
    assumptions?: string[];
    normalizationNotes?: string[];
    [k: string]: any;
  };
};


const KNOWN_SYNONYMS: Record<string, string[]> = {
  loadId: ['Load ID', 'Ref', 'VRID', 'Reference', 'Ref #'],
  fromAddress: ['From', 'PU', 'Pickup', 'Origin', 'Pickup Address'],
  fromAppointmentDateTimeUTC: ['PU Time', 'Pickup Appt', 'Pickup Date/Time'],
  toAddress: ['To', 'Drop', 'Delivery', 'Destination', 'Delivery Address'],
  toAppointmentDateTimeUTC: ['DEL Time', 'Delivery Appt', 'Delivery Date/Time'],
  status: ['Status', 'Load Status', 'Stage'],
  driverName: ['Driver', 'Driver Name'],
  driverPhone: ['Phone', 'Driver Phone', 'Contact'],
  unitNumber: ['Unit', 'Truck', 'Truck #', 'Tractor', 'Unit Number'],
  broker: ['Broker', 'Customer', 'Shipper'],
};

const REQUIRED_FIELDS = [
  'loadId',
  'fromAddress',
  'fromAppointmentDateTimeUTC',
  'toAddress',
  'toAppointmentDateTimeUTC',
  'status',
  'driverName',
  'unitNumber',
  'broker',
] as const;

const ALLOWED_MODELS = new Set([
  'gpt-4o-mini',
  'gpt-4o-mini-latest',
  'gpt-4o-mini-2024-07-18',
]);

const ROW_LIMIT = 200;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;


function setCors(res: VercelResponse, req?: VercelRequest) {
  const allowed = new Set([
    'https://script.google.com',
    'https://docs.google.com',
    'https://sheets.google.com',
    'null', 
  ]);

  const originHdr = (req?.headers?.origin as string | undefined) ?? '';
  const isDev = process.env.NODE_ENV === 'development';

  const allowOrigin =
    isDev ? '*' :
    (originHdr && allowed.has(originHdr)) ? originHdr :
    '';
  if (allowOrigin) res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin'); // ensure proper caching behavior
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature');
}

function verifyHmac(secret: string, raw: string, sigHeader?: string): boolean {
  if (!sigHeader) return false;
  const digest = createHmac('sha256', secret).update(raw).digest('hex');
  return sigHeader === `sha256=${digest}`;
}

function extractJson(txt: string): any | null {
  if (!txt) return null;
  try { return JSON.parse(txt); } catch {}
  const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) { try { return JSON.parse(fenced[1]); } catch {} }
  const s = txt.indexOf('{'); const e = txt.lastIndexOf('}');
  if (s !== -1 && e > s) { try { return JSON.parse(txt.slice(s, e + 1)); } catch {} }
  return null;
}


function pickOutputText(resp: any): string {
  if (!resp) return '';
  if (typeof resp.output_text === 'string') return resp.output_text;

  // Common fallbacks
  const tryPaths = [
    () => resp.output?.[0]?.content?.[0]?.text,
    () => resp.output?.[0]?.content?.find?.((c: any) => typeof c?.text === 'string')?.text,
    () => resp.choices?.[0]?.message?.content,
    () => (Array.isArray(resp.output) ? resp.output.map((o: any) => o?.content?.map?.((c: any) => c?.text).filter(Boolean).join('\n')).filter(Boolean).join('\n') : ''),
  ];

  for (const f of tryPaths) {
    try {
      const val = f();
      if (typeof val === 'string' && val.trim()) return val;
    } catch {}
  }


  return typeof resp === 'string' ? resp : JSON.stringify(resp);
}


function looksLikePlaceholder(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const t = v.trim();
  return /^(unknown|n\/a|na|none|null|no data|not provided|tbd|pending|-)$/i.test(t);
}

const SYSTEM_PROMPT = (() => {
  const synonymsText = Object.entries(KNOWN_SYNONYMS)
    .map(([field, synonyms]) => `${field}: ${synonyms.join(', ')}`)
    .join('\n');

  return `You are the TruckTalk Connect analysis engine. You analyze 2D trucking loads data from Google Sheets and return structured results.

CRITICAL REQUIREMENTS:
1. Never invent or fabricate data — unknowns must stay empty ("") and be flagged as issues.
2. Normalize ALL datetimes to ISO 8601 UTC format (YYYY-MM-DDTHH:mm:ssZ).
3. For naive datetimes (no timezone), assume environment.sheetTimezone and convert to UTC.
4. Return mapping as header→field (original header text → canonical field name).
5. One row = one load (header row excluded from data).
6. Load IDs will be automatically sorted for better organization.

LOAD SCHEMA - Required fields (driverPhone is optional):
- loadId: unique identifier
- fromAddress: pickup location
- fromAppointmentDateTimeUTC: pickup datetime (ISO 8601 UTC)
- toAddress: delivery location
- toAppointmentDateTimeUTC: delivery datetime (ISO 8601 UTC)
- status: load status/stage
- driverName: driver full name
- unitNumber: truck/vehicle identifier
- broker: broker/customer name
- driverPhone: (optional) driver contact

HEADER MAPPING - Use these synonyms for field detection:
${synonymsText}

VALIDATION CODES - Use ONLY these codes:
- MISSING_COLUMN (error): required field has no mapped column
- DUPLICATE_ID (error): loadId appears multiple times
- BAD_DATE_FORMAT (error): datetime unparseable or invalid
- EMPTY_REQUIRED_CELL (error): required field is empty
- NON_ISO_OUTPUT (warn): datetime converted from non-ISO format
- INCONSISTENT_STATUS (warn): status values need normalization

ISSUE FORMAT:
{ code, severity, message, rows?, column?, suggestion? }
- rows: 1-based sheet row numbers (header is row 1, data starts row 2)
- suggestion: actionable fix recommendation

OUTPUT FORMAT — Return ONLY this JSON structure:
{
  "ok": boolean,
  "issues": Issue[],
  "loads": Load[] | undefined,
  "mapping": Record<string,string>,
  "meta": {
    "analyzedRows": number,
    "analyzedAt": string,
    "assumptions": string[],         // e.g., timezone defaults, ambiguous header decisions
    "normalizationNotes": string[]   // e.g., "Converted MST→UTC", "Trimmed whitespace"
  }
}

If ANY errors exist, set ok=false and omit loads array.
If there are only warnings, set ok=true and include loads array.`;
})();

//header
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);


  if (req.method === 'OPTIONS') return res.status(200).end();


  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'TruckTalk AI', runtime, version: '2025-09-06' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

 
  const isEmptyPostProbe =
    !req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0);
  if (isEmptyPostProbe) {
    return res.status(200).json({
      ok: true,
      service: 'TruckTalk AI',
      mode: 'probe',
      note: 'POST with empty body accepted for connection test.',
    });
  }

  
  const rawBody = JSON.stringify(req.body || {});
  const hmacSecret = process.env.HMAC_SECRET;
  if (hmacSecret) {
    const sig = (req.headers['x-signature'] as string | undefined) || undefined;
    if (!sig || !verifyHmac(hmacSecret, rawBody, sig)) {
      return res.status(401).json({
        error: 'Invalid or missing signature',
        hint:
          'Sign EXACT JSON string of the request body: sha256=<hex>(JSON.stringify(payload)) and send header X-Signature: sha256=<digest>.',
      });
    }
  }

  // Extract payload
  const {
    headers = [],
    rows = [],
    knownSynonyms = KNOWN_SYNONYMS,
    headerOverrides = {},
    environment = {},
    expectations = {},
    note = '',
    model = 'gpt-4o-mini',
    temperature = 0,
    mode,            
    skipModel,       
  } = (req.body || {}) as Record<string, any>;

  // Dry-run: skip OpenAI (nice for quick checks)
  if (mode === 'dry-run' || skipModel === true) {
    const hasHeaders = Array.isArray(headers) && headers.length > 0;
    const resp: AnalysisResult = {
      ok: false,
      issues: hasHeaders ? [] : [{
        code: 'NO_HEADERS',
        severity: 'error',
        message: 'No headers provided',
        suggestion: 'Send the first row of your Sheet as "headers".',
      }],
      mapping: {},
      meta: {
        analyzedRows: Array.isArray(rows) ? rows.length : 0,
        analyzedAt: new Date().toISOString(),
        assumptions: [],
        normalizationNotes: [],
        mode: 'dry-run',
      },
    };
    return res.status(200).json(resp);
  }

  // Validate payload
  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Invalid payload', detail: 'headers and rows must be arrays' });
  }
  if (headers.length === 0) {
    return res.status(400).json({ error: 'No headers provided', detail: 'Sheet must have a header row' });
  }

  // OpenAI key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY not configured',
      hint: 'Set OPENAI_API_KEY in your Vercel project Environment Variables.',
    });
  }

  const selectedModel = ALLOWED_MODELS.has(model) ? model : 'gpt-4o-mini';
  const temp = typeof temperature === 'number' && temperature >= 0 && temperature <= 1 ? temperature : 0;

  // Limit rows to protect tokens
  const limitedRows = rows.slice(0, ROW_LIMIT);
  const limitedCount = limitedRows.length;

  // Build user payload for the model
  const userPayload = {
    headers,
    rows: limitedRows,
    knownSynonyms,
    headerOverrides,
    environment: {
      sheetTimezone: environment.sheetTimezone || 'UTC',
      ...environment,
    },
    expectations: {
      oneRowPerLoad: true,
      hasHeaderRow: true,
      requireAllFields: REQUIRED_FIELDS,
      ...expectations,
    },
    note: note || 'Analyze this trucking loads spreadsheet and validate data quality',
    instructions: 'Map headers using synonyms, validate all data, normalize datetimes to UTC, return AnalysisResult JSON',
  };

  const client = new OpenAI({ apiKey });

  try {
    console.log(` TruckTalk Analysis start: model=${selectedModel}, rows_in=${rows.length}, headers=${headers.length}`);

    // Responses API — strict JSON via text.format.type
    const response = await client.responses.create({
      model: selectedModel,
      temperature: temp,
      text: { format: { type: 'json_object' } },
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      max_output_tokens: 2000,
    });

    const content = pickOutputText(response);
    const parsed = extractJson(content);

    if (!parsed || typeof parsed !== 'object') {
      console.error(' Invalid AI JSON (first 300 chars):', String(content).substring(0, 300));
      return res.status(500).json({
        error: 'AI analysis failed',
        detail: 'Model did not return valid JSON format',
        sample: String(content).substring(0, 200),
      });
    }

    // Shape base result
    const result: AnalysisResult = {
      ok: Boolean(parsed.ok),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      loads: parsed.ok && Array.isArray(parsed.loads) ? parsed.loads : undefined,
      mapping: parsed.mapping && typeof parsed.mapping === 'object' ? parsed.mapping : {},
      meta: {
        analyzedRows: limitedCount, // report actual analyzed count, not input count
        analyzedAt: new Date().toISOString(),
        ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}),
      },
    };

    // Ensure arrays exist in meta
    if (!Array.isArray(result.meta.assumptions)) result.meta.assumptions = [];
    if (!Array.isArray(result.meta.normalizationNotes)) result.meta.normalizationNotes = [];

    // Structural guardrails on loads (basic shape)
    if (result.loads) {
      result.loads = result.loads.filter(
        (load: any) =>
          load &&
          typeof load === 'object' &&
          typeof load.loadId === 'string' &&
          typeof load.fromAddress === 'string' &&
          typeof load.toAddress === 'string',
      );
      
      // Sort loads by loadId for better organization
      // Handle mixed numeric/alphanumeric IDs intelligently
      result.loads.sort((a: any, b: any) => {
        const idA = String(a.loadId || '');
        const idB = String(b.loadId || '');
        
        // Extract numeric parts for smart sorting
        const numA = idA.match(/\d+/);
        const numB = idB.match(/\d+/);
        
        // If both have numbers, sort numerically by the first number found
        if (numA && numB) {
          const nA = parseInt(numA[0], 10);
          const nB = parseInt(numB[0], 10);
          if (nA !== nB) return nA - nB;
        }
        
        // Fall back to alphabetical sorting
        return idA.localeCompare(idB, 'en', { numeric: true, sensitivity: 'base' });
      });
      
      // Add sorting note to meta
      if (result.loads.length > 1) {
        result.meta.normalizationNotes = result.meta.normalizationNotes || [];
        result.meta.normalizationNotes.push('Loads sorted by Load ID for better organization');
      }
    }

    // ---- Server-side guardrails ----

    // A) Baseline missing-column detection (deterministic check)
    const mappedCanon = new Set(Object.values(result.mapping || {}));
    for (const req of REQUIRED_FIELDS as readonly string[]) {
      if (!mappedCanon.has(req)) {
        result.issues.push({
          code: 'MISSING_COLUMN',
          severity: 'error',
          message: `Missing required column for "${req}"`,
          column: req,
          suggestion: `Add a column for "${req}" or map an existing header to it (see synonyms).`,
        });
      }
    }

    // B) Server-side duplicate loadId check (cheap and reliable)
    if (result.loads && Array.isArray(result.loads)) {
      const seen = new Map<string, number[]>(); // loadId -> sheet rows (1-based)
      result.loads.forEach((l, idx) => {
        const id = String(l.loadId || '');
        if (!id) return; // will be caught by EMPTY_REQUIRED_CELL
        const arr = seen.get(id) ?? [];
        arr.push(idx + 2);
        seen.set(id, arr);
      });
      for (const [id, rows1b] of seen) {
        if (rows1b.length > 1) {
          result.issues.push({
            code: 'DUPLICATE_ID',
            severity: 'error',
            message: `loadId "${id}" appears ${rows1b.length} times`,
            rows: rows1b,
            column: 'loadId',
            suggestion: 'Ensure each loadId is unique.',
          });
        }
      }
    }

    // C) Recompute ok based on issues; strip loads if any error exists
    const hasErrors = Array.isArray(result.issues) && result.issues.some(i => i?.severity === 'error');
    if (hasErrors) {
      result.ok = false;
      delete result.loads;
    } else {
      result.ok = true;
    }

    // D) Ensure ISO-8601 UTC for the two datetime fields; warn if not
    if (result.loads && Array.isArray(result.loads)) {
      result.loads.forEach((load, idx) => {
        (['fromAppointmentDateTimeUTC','toAppointmentDateTimeUTC'] as const).forEach(col => {
          const v = (load as any)[col];
          if (typeof v === 'string' && v) {
            if (!ISO_UTC.test(v)) {
              result.issues.push({
                code: 'NON_ISO_OUTPUT',
                severity: 'warn',
                message: `Non-ISO datetime returned in ${col} (row ${idx + 2})`,
                rows: [idx + 2],
                column: col,
                suggestion: 'Return YYYY-MM-DDTHH:mm:ssZ (UTC).',
              });
            }
          } else if (v !== '') {
            // If not string and not empty string, it's malformed
            result.issues.push({
              code: 'BAD_DATE_FORMAT',
              severity: 'error',
              message: `Invalid datetime type in ${col} (row ${idx + 2})`,
              rows: [idx + 2],
              column: col,
              suggestion: 'Return a string in ISO-8601 UTC (YYYY-MM-DDTHH:mm:ssZ) or empty string if unknown.',
            });
          }
        });
      });
    }

    // E) Flag suspicious placeholders for required fields as EMPTY_REQUIRED_CELL
    if (result.loads && Array.isArray(result.loads)) {
      result.loads.forEach((load, idx) => {
        (REQUIRED_FIELDS as readonly string[]).forEach((f) => {
          const v = (load as any)[f];
          if (v === '' || v === undefined || v === null || looksLikePlaceholder(v)) {
            result.issues.push({
              code: 'EMPTY_REQUIRED_CELL',
              severity: 'error',
              message: `Required field "${f}" is empty or placeholder (row ${idx + 2})`,
              rows: [idx + 2],
              column: f,
              suggestion: 'Provide a real value or leave "" and correct in the source sheet.',
            });
          }
        });
      });
    }

    // If guardrails created errors after the model's output, recompute ok & loads again
    const nowHasErrors = result.issues.some(i => i.severity === 'error');
    if (nowHasErrors) {
      result.ok = false;
      delete result.loads;
    }

    console.log(` Analysis complete: ok=${result.ok}, issues=${result.issues.length}, loads=${result.loads?.length || 0}`);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (err: any) {
    const message = err?.message || 'OpenAI request failed';
    const type = err?.type || 'unknown_error';
    const status = err?.status || 500;

    console.error(' TruckTalk Analysis Error:', { message, type, status });
    return res.status(status).json({
      error: 'Analysis service failure',
      detail: message,
      type,
      hint:
        type === 'insufficient_quota'
          ? 'Your OpenAI plan/quota may be exhausted. Check billing/quota in the OpenAI dashboard.'
          : type === 'invalid_request_error'
          ? 'Double-check model name and parameters (Responses API uses text.format.type = "json_object").'
          : undefined,
    });
  }
}
