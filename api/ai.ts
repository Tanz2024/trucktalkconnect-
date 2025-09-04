// /api/ai.ts - TruckTalk Connect: Google Sheets Analysis API (hardened)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import OpenAI from 'openai';

// ---------- Types ----------
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
  code: string;
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
  mapping: Record<string, string>; // header -> field
  meta: {
    analyzedRows: number;
    analyzedAt: string;
    engine?: string;
    model?: string;
    headerCount?: number;
    summary?: string;
    assumptions?: string[];
    [key: string]: any;
  };
};

// ---------- Config ----------
const CANONICAL_FIELDS = [
  'loadId',
  'fromAddress',
  'fromAppointmentDateTimeUTC',
  'toAddress',
  'toAppointmentDateTimeUTC',
  'status',
  'driverName',
  'driverPhone',
  'unitNumber',
  'broker',
];

const KNOWN_SYNONYMS: Record<string, string[]> = {
  loadId: ['Load ID', 'Ref', 'VRID', 'Reference', 'Ref #', 'Load #', 'Load Number'],
  fromAddress: ['From', 'PU', 'Pickup', 'Origin', 'Pickup Address', 'From Address', 'PU Address'],
  fromAppointmentDateTimeUTC: ['PU Time', 'Pickup Appt', 'Pickup Date/Time', 'Pickup Date', 'PU Date', 'From Date'],
  toAddress: ['To', 'Drop', 'Delivery', 'Destination', 'Delivery Address', 'To Address', 'Drop Address'],
  toAppointmentDateTimeUTC: ['DEL Time', 'Delivery Appt', 'Delivery Date/Time', 'Delivery Date', 'DEL Date', 'To Date'],
  status: ['Status', 'Load Status', 'Stage', 'State'],
  driverName: ['Driver', 'Driver Name', 'Driver Full Name'],
  driverPhone: ['Phone', 'Driver Phone', 'Contact', 'Driver Contact', 'Mobile'],
  unitNumber: ['Unit', 'Truck', 'Truck #', 'Tractor', 'Unit Number', 'Truck Number', 'Vehicle'],
  broker: ['Broker', 'Customer', 'Shipper', 'Client'],
};

const ALLOWED_MODELS = new Set([
  'gpt-4o-mini',
  'gpt-4o-mini-latest',
  'gpt-4o-mini-2024-07-18',
]);

// ---------- Helpers ----------
function verifyHmac(secret: string, raw: string, sig: string | undefined): boolean {
  if (!sig) return false;
  const h = createHmac('sha256', secret).update(raw).digest('hex');
  return sig === `sha256=${h}`;
}

function looksLikeFieldToHeader(mapping: Record<string, string>, headers: string[]) {
  const keys = Object.keys(mapping);
  if (!keys.length) return false;
  const keyAreFields = keys.every(k => CANONICAL_FIELDS.includes(k));
  const valuesAreHeaders = Object.values(mapping).every(v => headers.includes(v));
  return keyAreFields && valuesAreHeaders;
}

function flipMapping(fieldToHeader: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [field, header] of Object.entries(fieldToHeader)) {
    out[header] = field;
  }
  return out;
}

function normalizeAssumptions(x: any): string[] {
  if (!x) return [];
  if (Array.isArray(x)) return x.map(s => String(s));
  return [String(x)];
}

// Force-severity table
const ERROR_CODES = new Set([
  'MISSING_COLUMN',
  'EMPTY_REQUIRED',
  'EMPTY_REQUIRED_CELL',
  'DUPLICATE_ID',
  'BAD_DATE_FORMAT',
]);

function normalizeIssue(i: any): Issue | null {
  if (!i || typeof i !== 'object') return null;

  const rawCode = (typeof i.code === 'string' ? i.code : 'ISSUE').toUpperCase();
  let code = rawCode;

  // Coerce rows -> number[]
  const rows = Array.isArray(i.rows)
    ? i.rows.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n))
    : undefined;

  const column = typeof i.column === 'string' ? i.column : undefined;
  const message = typeof i.message === 'string' ? i.message : String(i.message || rawCode);
  const suggestion = typeof i.suggestion === 'string' ? i.suggestion : undefined;

  // If the message indicates "naive/non-ISO" but the code is BAD_DATE_FORMAT, downgrade to NON_ISO_INPUT (warn)
  const looksNaive = /naive|non[-\s]?iso|no\s*time\s*zone|timezone\s*missing/i.test(message);
  if (rawCode === 'BAD_DATE_FORMAT' && looksNaive) {
    return {
      code: 'NON_ISO_INPUT',
      severity: 'warn',
      message,
      rows,
      column,
      suggestion: suggestion || 'Prefer ISO 8601 with explicit timezone or offset.',
    };
  }

  // Severity normalization
  let severity: 'error' | 'warn';
  if (ERROR_CODES.has(code)) {
    severity = 'error';
  } else {
    severity = (i.severity === 'error' || i.severity === 'warn') ? i.severity : 'warn';
  }

  return { code, severity, message, rows, column, suggestion };
}

function coerceAnalysisResult(parsed: any, headers: string[], rowsCount: number): AnalysisResult {
  const ok = !!parsed?.ok;

  // mapping: ensure header -> field
  let mapping: Record<string, string> =
    parsed?.mapping && typeof parsed.mapping === 'object' ? parsed.mapping : {};

  if (looksLikeFieldToHeader(mapping, headers)) {
    mapping = flipMapping(mapping);
  }

  // issues
  const issues: Issue[] = Array.isArray(parsed?.issues)
    ? (parsed.issues.map(normalizeIssue).filter(Boolean) as Issue[])
    : [];

  // meta
  const metaObj = (parsed?.meta && typeof parsed.meta === 'object') ? parsed.meta : {};
  const meta = {
    analyzedRows: rowsCount,
    analyzedAt: new Date().toISOString(),
    summary: metaObj.summary ? String(metaObj.summary) : '',
    assumptions: normalizeAssumptions(metaObj.assumptions),
    ...metaObj,
  };

  // loads only when ok===true
  const loads: Load[] | undefined = ok && Array.isArray(parsed?.loads) ? parsed.loads : undefined;

  return { ok, issues, loads, mapping, meta };
}

// ---------- Handler ----------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  // Optional HMAC (be careful with raw vs parsed body)
  const hmacSecret = process.env.HMAC_SECRET;
  if (hmacSecret) {
    const rawBody = JSON.stringify(req.body || {});
    const sig = req.headers['x-signature'] as string | undefined;
    if (!sig || !verifyHmac(hmacSecret, rawBody, sig)) {
      return res.status(401).json({ error: 'Invalid or missing signature' });
    }
  }

  const {
    headers = [],
    rows = [],
    knownSynonyms = KNOWN_SYNONYMS,
    headerOverrides = {},
    environment = {},
    expectations = {},
    returnContract = 'AnalysisResult',
    note = '',
    model = 'gpt-4o-mini',
    temperature = 0,
    rowBase = 2,
  } = req.body || {};

  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'Invalid payload: headers and rows must be arrays' });
  }
  if (!headers.length) {
    return res.status(400).json({ error: 'No headers provided' });
  }

  const mdl = ALLOWED_MODELS.has(model) ? model : 'gpt-4o-mini';
  const temp = typeof temperature === 'number' && temperature >= 0 && temperature <= 1 ? temperature : 0;

  // ————— Prompts —————
  const systemPrompt =
`You are a logistics data analyst for TruckTalk Connect. You convert a 2D table of trucking loads into a typed JSON array and report validation issues.

HARD RULES:
- Never invent or guess data; unknowns stay empty and are flagged.
- Normalize ALL datetimes to strict ISO 8601 UTC: YYYY-MM-DDTHH:mm:ssZ.
- If a datetime has an explicit offset or 'Z', parse and convert to UTC.
- If a datetime includes a timezone word/abbr (e.g., MST), parse and convert to UTC and add a WARN issue (NON_ISO_INPUT) about normalization.
- If a datetime is NAIVE (no zone/offset), ASSUME environment.sheetTimezone and convert to UTC, and add a WARN issue (NON_ISO_INPUT) about the assumption.
- Only when a datetime is truly UNPARSEABLE, use BAD_DATE_FORMAT (ERROR).
- One row = one load.

MAPPING:
- Return mapping as "header -> field" (original header text as key; canonical field as value).
- Canonical fields: ${CANONICAL_FIELDS.join(', ')}.

ISSUES:
Return issues as objects: { code, severity, message, rows?, column?, suggestion? }.
Use these codes when applicable: MISSING_COLUMN, EMPTY_REQUIRED, DUPLICATE_ID, BAD_DATE_FORMAT, NON_ISO_INPUT, STATUS_VOCAB, UNKNOWN_HEADER, EXTRA_DATA, NORMALIZED_VALUE.

ROW NUMBERS:
- rows[] must be 1-based SHEET row numbers (header row is 1). The first data row index is rowBase.

OUTPUT:
Return ONLY JSON exactly as { ok, issues[], loads[], mapping, meta }.
- loads is present ONLY if ok === true.
- meta must include analyzedRows, analyzedAt, and may include summary and assumptions.`;

  const userObj = {
    headers,
    rows: rows.slice(0, 200), // cap for safety
    knownSynonyms,
    headerOverrides,
    environment: {
      sheetTimezone: environment.sheetTimezone || 'UTC',
      ...environment,
    },
    expectations: {
      oneRowPerLoad: true,
      hasHeaderRow: true,
      ...expectations,
    },
    rowBase, // first data row index for the sheet (usually 2)
    returnContract,
    note: note || 'Analyze this trucking loads spreadsheet data',
  };

  try {
    const client = new OpenAI({ apiKey });

    const chat = await client.chat.completions.create({
      model: mdl,
      temperature: temp,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userObj) },
      ],
      response_format: { type: 'json_object' }, // force pure JSON
      max_tokens: 4000,
    });

    const content = chat.choices?.[0]?.message?.content || '';
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({
        error: 'AI analysis failed',
        detail: 'Model did not return valid JSON',
        content: content.slice(0, 500),
      });
    }

    const result: AnalysisResult = coerceAnalysisResult(parsed, headers, rows.length);

    // metadata
    result.meta.engine = 'openai-proxy';
    result.meta.model = mdl;
    result.meta.headerCount = headers.length;

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('OpenAI API error:', err?.message || err);
    return res.status(500).json({
      error: 'Analysis service failure',
      detail: err?.message || 'Unknown error',
      type: err?.type || 'unknown',
    });
  }
}
