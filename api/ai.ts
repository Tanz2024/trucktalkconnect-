// /api/ai.ts - TruckTalk Connect: Google Sheets Analysis API
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import OpenAI from 'openai';

// ---------- TruckTalk Connect Data Model ----------
export type Load = {
  loadId: string;
  fromAddress: string;
  fromAppointmentDateTimeUTC: string; // ISO 8601
  toAddress: string;
  toAppointmentDateTimeUTC: string;   // ISO 8601
  status: string;
  driverName: string;
  driverPhone?: string;                // optional
  unitNumber: string;                  // vehicle/truck id
  broker: string;
};

export type Issue = {
  code: string;              // e.g., MISSING_COLUMN, BAD_DATE_FORMAT, DUPLICATE_ID
  severity: 'error'|'warn';
  message: string;           // user‑friendly
  rows?: number[];           // affected rows (1‑based)
  column?: string;           // header name
  suggestion?: string;       // how to fix
};

export type AnalysisResult = {
  ok: boolean;
  issues: Issue[];
  loads?: Load[];              // present only when ok===true
  mapping: Record<string,string>; // header→field mapping used
  meta: { analyzedRows: number; analyzedAt: string };
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
  broker: ['Broker', 'Customer', 'Shipper']
};

// Required fields (all except driverPhone)
const REQUIRED_FIELDS = [
  'loadId', 'fromAddress', 'fromAppointmentDateTimeUTC',
  'toAddress', 'toAppointmentDateTimeUTC', 'status', 
  'driverName', 'unitNumber', 'broker'
];

const ALLOWED_MODELS = new Set([
  'gpt-4o-mini',
  'gpt-4o-mini-latest',
  'gpt-4o-mini-2024-07-18',
]);

// ---------- Security & Validation ----------
function verifyHmac(secret: string, raw: string, sig: string | undefined): boolean {
  if (!sig) return false;
  const h = createHmac('sha256', secret).update(raw).digest('hex');
  return sig === `sha256=${h}`;
}

function extractJson(txt: string): any | null {
  if (!txt) return null;
  
  // Try to find JSON in code blocks first
  const fencedMatch = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    try { return JSON.parse(fencedMatch[1]); } catch {}
  }
  
  // Try to parse the whole response as JSON
  try { return JSON.parse(txt); } catch {}
  
  // Try to find JSON object in text
  const objStart = txt.indexOf('{');
  const objEnd = txt.lastIndexOf('}');
  if (objStart !== -1 && objEnd > objStart) {
    try { return JSON.parse(txt.slice(objStart, objEnd + 1)); } catch {}
  }
  
  return null;
}

// ---------- Main Handler ----------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Check API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  // Optional HMAC verification
  const hmacSecret = process.env.HMAC_SECRET;
  if (hmacSecret) {
    const rawBody = JSON.stringify(req.body || {});
    const sig = req.headers['x-signature'] as string | undefined;
    if (!sig || !verifyHmac(hmacSecret, rawBody, sig)) {
      return res.status(401).json({ error: 'Invalid or missing signature' });
    }
  }

  // Extract payload from Google Apps Script
  const {
    headers = [],
    rows = [],
    knownSynonyms = KNOWN_SYNONYMS,
    headerOverrides = {},
    environment = {},
    expectations = {},
    note = '',
    model = 'gpt-4o-mini',
    temperature = 0
  } = req.body || {};

  // Validate input
  if (!Array.isArray(headers) || !Array.isArray(rows)) {
    return res.status(400).json({ 
      error: 'Invalid payload', 
      detail: 'headers and rows must be arrays' 
    });
  }

  if (headers.length === 0) {
    return res.status(400).json({ 
      error: 'No headers provided', 
      detail: 'Sheet must have a header row' 
    });
  }

  // Model selection and temperature validation
  const selectedModel = ALLOWED_MODELS.has(model) ? model : 'gpt-4o-mini';
  const temp = typeof temperature === 'number' && temperature >= 0 && temperature <= 1 ? temperature : 0;

  // Build comprehensive system prompt for TruckTalk Connect
  const systemPrompt = `You are the TruckTalk Connect analysis engine. You analyze 2D trucking loads data from Google Sheets and return structured results.

CRITICAL REQUIREMENTS:
1. Never invent or fabricate data - unknowns must stay empty and be flagged as issues
2. Normalize ALL datetimes to ISO 8601 UTC format (YYYY-MM-DDTHH:mm:ssZ)
3. For naive datetimes (no timezone), assume environment.sheetTimezone and convert to UTC
4. Return mapping as header→field (original header text → canonical field name)
5. One row = one load (header row excluded from data)

LOAD SCHEMA - Required fields (except driverPhone):
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
${Object.entries(KNOWN_SYNONYMS).map(([field, synonyms]) => 
  `${field}: ${synonyms.join(', ')}`
).join('\n')}

VALIDATION CODES - Use these specific issue codes:
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

OUTPUT FORMAT - Return ONLY this JSON structure:
{
  "ok": boolean,
  "issues": Issue[],
  "loads": Load[] | undefined,  // only present when ok===true
  "mapping": Record<string,string>,
  "meta": { "analyzedRows": number, "analyzedAt": string }
}

If ANY errors exist, set ok=false and omit loads array.
If no errors (only warnings ok), set ok=true and include loads array.`;

  // Build user message with sheet data
  const userMessage = JSON.stringify({
    headers,
    rows: rows.slice(0, 200), // Limit for API payload size
    knownSynonyms,
    headerOverrides,
    environment: {
      sheetTimezone: environment.sheetTimezone || 'UTC',
      ...environment
    },
    expectations: {
      oneRowPerLoad: true,
      hasHeaderRow: true,
      requireAllFields: REQUIRED_FIELDS,
      ...expectations
    },
    note: note || 'Analyze this trucking loads spreadsheet and validate data quality',
    instructions: 'Map headers using synonyms, validate all data, normalize datetimes to UTC, return AnalysisResult JSON'
  });

  try {
    const client = new OpenAI({ apiKey });

    console.log(`🚛 TruckTalk Analysis: ${rows.length} rows, ${headers.length} headers, model: ${selectedModel}`);

    const response = await client.chat.completions.create({
      model: selectedModel,
      temperature: temp,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 4000
    });

    const content = response.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    
    if (!parsed || typeof parsed !== 'object') {
      console.error('Invalid AI response:', content.substring(0, 300));
      return res.status(502).json({ 
        error: 'AI analysis failed', 
        detail: 'Model did not return valid JSON format',
        sample: content.substring(0, 200)
      });
    }

    // Ensure result matches AnalysisResult structure exactly
    const result: AnalysisResult = {
      ok: Boolean(parsed.ok),
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      loads: parsed.ok && Array.isArray(parsed.loads) ? parsed.loads : undefined,
      mapping: parsed.mapping && typeof parsed.mapping === 'object' ? parsed.mapping : {},
      meta: {
        analyzedRows: rows.length,
        analyzedAt: new Date().toISOString(),
        ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {})
      }
    };

    // Validate loads structure if present
    if (result.loads) {
      result.loads = result.loads.filter((load: any) => 
        load && typeof load === 'object' && 
        typeof load.loadId === 'string' &&
        typeof load.fromAddress === 'string' &&
        typeof load.toAddress === 'string'
      );
    }

    console.log(`✅ Analysis complete: ok=${result.ok}, issues=${result.issues.length}, loads=${result.loads?.length || 0}`);

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);

  } catch (err: any) {
    console.error('🚨 TruckTalk Analysis Error:', err?.message || err);
    return res.status(500).json({ 
      error: 'Analysis service failure', 
      detail: err?.message || 'OpenAI API request failed',
      type: err?.type || 'unknown_error'
    });
  }
}
