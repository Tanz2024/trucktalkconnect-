// /api/ai.ts - TruckTalk Connect: Google Sheets Analysis API
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
const OpenAI = require('openai');

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
  const systemPrompt = `You are an expert data analyst for trucking logistics. Analyze spreadsheet data and return ONLY valid JSON.

REQUIRED OUTPUT FORMAT (return only this JSON, no other text):
{
  "ok": boolean,
  "issues": [{"code": string, "severity": "error"|"warn", "message": string, "suggestion": string}],
  "loads": [{"loadId": string, "fromAddress": string, "toAddress": string, "status": string, "driverName": string, "unitNumber": string, "broker": string}],
  "mapping": {"original_header": "field_name"},
  "meta": {"analyzedRows": number, "analyzedAt": string}
}

RULES:
- If ANY errors exist, set ok=false and omit "loads" array
- Map headers to fields: loadId, fromAddress, toAddress, status, driverName, unitNumber, broker
- Never invent data
- Return ONLY the JSON object, no explanations

INPUT: You'll receive headers and rows from a logistics spreadsheet.`;

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
    console.log('🤖 Raw AI Response Length:', content.length);
    console.log('🤖 Raw AI Response (first 500 chars):', content.substring(0, 500));
    console.log('🤖 Raw AI Response (last 200 chars):', content.slice(-200));
    
    const parsed = extractJson(content);
    
    if (!parsed || typeof parsed !== 'object') {
      console.error('❌ JSON Extraction Failed');
      console.error('Raw content:', content);
      
      // Try manual JSON fix for common issues
      let fixedContent = content.trim();
      
      // If it starts with text before JSON, find the JSON
      const jsonStart = fixedContent.indexOf('{');
      if (jsonStart > 0) {
        fixedContent = fixedContent.substring(jsonStart);
      }
      
      // If it's truncated, try to close it properly
      if (fixedContent.endsWith(',') || fixedContent.endsWith(',\n')) {
        fixedContent = fixedContent.replace(/,\s*$/, '');
      }
      
      // Try to close incomplete JSON
      const openBraces = (fixedContent.match(/\{/g) || []).length;
      const closeBraces = (fixedContent.match(/\}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixedContent += '}';
      }
      
      try {
        const fixedParsed = JSON.parse(fixedContent);
        console.log('✅ Fixed JSON successfully');
        const fixedResult = sanitizeAndReturnResult(fixedParsed, rows.length);
        return res.status(200).json(fixedResult);
      } catch (fixError) {
        console.error('❌ JSON fix failed:', fixError.message);
      }
      
      return res.status(502).json({ 
        error: 'AI analysis failed', 
        detail: 'Model did not return valid JSON format',
        sample: content.substring(0, 500),
        rawLength: content.length,
        suggestions: [
          'OpenAI response may be truncated',
          'Model may need different prompt',
          'Token limit may be insufficient'
        ]
      });
    }

    // Success path
    const result = sanitizeAndReturnResult(parsed, rows.length);
    console.log(`✅ Analysis complete: ok=${result.ok}, issues=${result.issues.length}, loads=${result.loads?.length || 0}`);
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

// Helper function to sanitize and return consistent result
function sanitizeAndReturnResult(parsed: any, analyzedRows: number) {
  const result: AnalysisResult = {
    ok: Boolean(parsed.ok),
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    loads: parsed.ok && Array.isArray(parsed.loads) ? parsed.loads : undefined,
    mapping: parsed.mapping && typeof parsed.mapping === 'object' ? parsed.mapping : {},
    meta: {
      analyzedRows: analyzedRows,
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

  return result;
}
