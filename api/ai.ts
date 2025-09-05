// /api/ai.ts - TruckTalk Connect: Google Sheets Analysis API (stable)
// Vercel Serverless (Node runtime, NOT Edge)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import OpenAI from 'openai';

// Ensure Node runtime (Edge would break 'crypto' createHmac)
export const runtime = 'nodejs';
// Give a bit more time if needed
export const config = { maxDuration: 30 };

// ---------- Data Model ----------
export type Load = {
  loadId: string;
  fromAddress: string;
  fromAppointmentDateTimeUTC: string; // ISO 8601
  toAddress: string;
  toAppointmentDateTimeUTC: string;   // ISO 8601
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
  rows?: number[];   // 1-based
  column?: string;   // header name
  suggestion?: string;
};

export type AnalysisResult = {
  ok: boolean;
  issues: Issue[];
  loads?: Load[]; // only present when ok===true
  mapping: Record<string, string>; // original header -> canonical field
  meta: { analyzedRows: number; analyzedAt: string; [k: string]: any };
};

// ---------- Header Synonym Mapping ----------
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

// Required fields (all except driverPhone)
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
];

const ALLOWED_MODELS = new Set([
  'gpt-4o-mini',
  'gpt-4o-mini-latest',
  'gpt-4o-mini-2024-07-18',
]);

// ---------- Utilities ----------
function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature');
}

function verifyHmac(secret: string, raw: string, sigHeader: string | undefined): boolean {
  if (!sigHeader) return false;
  const digest = createHmac('sha256', secret).update(raw).digest('hex');
  // Expect "sha256=<hex>"
  return sigHeader === `sha256=${digest}`;
}

function extractJson(txt: string): any | null {
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try { return JSON.parse(fenced[1]); } catch {}
    }
    const start = txt.indexOf('{');
    const end = txt.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try { return JSON.parse(txt.slice(start, end + 1)); } catch {}
    }
    return null;
  }
}

const SYSTEM_PROMPT = (() => {
  const synonymsText = Object
    .entries(KNOWN_SYNONYMS)
    .map(([field, synonyms]) => `${field}: ${synonyms.join(', ')}`)
    .join('\n');

  return `You are the TruckTalk Connect analysis engine. You analyze 2D trucking loads data from Google Sheets and return structured results.

CRITICAL REQUIREMENTS:
1. Never invent or fabricate data — unknowns must stay empty and be flagged as issues.
2. Normalize ALL datetimes to ISO 8601 UTC format (YYYY-MM-DDTHH:mm:ssZ).
3. For naive datetimes (no timezone), assume environment.sheetTimezone and convert to UTC.
4. Return mapping as header→field (original header text → canonical field name).
5. One row = one load (header row excluded from data).

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
  "meta": { "analyzedRows": number, "analyzedAt": string }
}

If ANY errors exist, set ok=false and omit loads array.
If there are only warnings, set ok=true and include loads array.`;
})();

// ---------- Main Handler ----------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  // Preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health check for GET (no params needed) — useful for "Test connection"
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, service: 'TruckTalk AI', runtime, version: '2025-09-05' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Secrets
  const apiKey = process.env.OPENAI_API_KEY;

  // Optional HMAC
  const rawBody = JSON.stringify(req.body || {});
  const hmacSecret = process.env.HMAC_SECRET;
  if (hmacSecret) {
    const sig = (req.headers['x-signature'] as string | undefined) || undefined;
    if (!sig || !verifyHmac(hmacSecret, rawBody, sig)) {
      return res.status(401).json({
        error: 'Invalid or missing signature',
        hint: 'When HMAC_SECRET is set, sign raw JSON body and send header X-Signature: sha256=<digest>',
      });
    }
  }

  // Extract & validate payload
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
    mode,            // 'dry-run' to skip OpenAI (for test connection)
    skipModel,       // boolean alias for dry-run
  } = (req.body || {}) as Record<string, any>;

  // DRY-RUN: return fast without calling OpenAI (great for probes)
  if (mode === 'dry-run' || skipModel === true) {
    const hasHeaders = Array.isArray(headers) && headers.length > 0;
    return res.status(200).json({
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
        mode: 'dry-run',
      },
    } satisfies AnalysisResult);
  }

  // Normal validation (non-dry-run)
  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    return res.status(400).json({
      error: 'Invalid payload',
      detail: 'headers and rows must be arrays',
    });
  }

  if (headers.length === 0) {
    return res.status(400).json({
      error: 'No headers provided',
      detail: 'Sheet must have a header row',
    });
  }

  // If OpenAI key missing, fail clearly (but 500 is fine here)
  if (!apiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY not configured',
      hint: 'Set OPENAI_API_KEY in your Vercel project Environment Variables.',
    });
  }

  const selectedModel = ALLOWED_MODELS.has(model) ? model : 'gpt-4o-mini';
  const temp = typeof temperature === 'number' && temperature >= 0 && temperature <= 1 ? temperature : 0;

  // Limit rows sent to the model to protect tokens
  const ROW_LIMIT = 200;
  const limitedRows = rows.slice(0, ROW_LIMIT);

  // Build user message (the analyzable payload)
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
    console.log(`🚛 TruckTalk Analysis start: model=${selectedModel}, rows_in=${rows.length}, headers=${headers.length}`);

    // Use Responses API with JSON mode (strict)
    const response = await client.responses.create({
      model: selectedModel,
      temperature: temp,
      response_format: { type: 'json_object' },
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      max_output_tokens: 2000,
    });

    const content = (response as any).output_text ?? '';
    const parsed = extractJson(content);

    if (!parsed || typeof parsed !== 'object') {
      console.error('❌ Invalid AI JSON (first 300 chars):', String(content).substring(0, 300));
      return res.status(500).json({
        error: 'AI analysis failed',
        detail: 'Model did not return valid JSON format',
        sample: String(content).substring(0, 200),
      });
    }

    const result: AnalysisResult = {
      ok: Boolean(parsed.ok),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      loads: parsed.ok && Array.isArray(parsed.loads) ? parsed.loads : undefined,
      mapping: parsed.mapping && typeof parsed.mapping === 'object' ? parsed.mapping : {},
      meta: {
        analyzedRows: rows.length,
        analyzedAt: new Date().toISOString(),
        ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}),
      },
    };

    if (result.loads) {
      result.loads = result.loads.filter(
        (load: any) =>
          load &&
          typeof load === 'object' &&
          typeof load.loadId === 'string' &&
          typeof load.fromAddress === 'string' &&
          typeof load.toAddress === 'string',
      );
    }

    console.log(`✅ Analysis complete: ok=${result.ok}, issues=${result.issues.length}, loads=${result.loads?.length || 0}`);
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (err: any) {
    const message = err?.message || 'OpenAI request failed';
    const type = err?.type || 'unknown_error';
    const status = err?.status || 500;

    console.error('🚨 TruckTalk Analysis Error:', { message, type, status });
    return res.status(500).json({
      error: 'Analysis service failure',
      detail: message,
      type,
      hint:
        type === 'insufficient_quota'
          ? 'Your OpenAI plan/quota may be exhausted. Check billing/quota in the OpenAI dashboard.'
          : undefined,
    });
  }
}
