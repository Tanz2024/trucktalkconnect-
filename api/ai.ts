// /api/ai.ts — TruckTalk Connect: Google Sheets Analysis API (stable, hardened)
// Vercel Serverless (Node runtime)

import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const config = { maxDuration: 30 };

// ---------- Environment Configuration ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const HMAC_SECRET = process.env.HMAC_SECRET || '';
// PRODUCTION: Set ALLOWED_ORIGINS in Vercel environment variables
// Format: "https://sheets.googleapis.com,https://script.google.com"
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '10');
const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024; // 2MB

// ---------- Types ----------
export type Load = {
  loadId: string;
  fromAddress: string;
  fromAppointmentDateTimeUTC: string; // ISO 8601 (UTC)
  toAddress: string;
  toAppointmentDateTimeUTC: string;   // ISO 8601 (UTC)
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
    | 'VOCAB_STATUS'
    | string;
  severity: 'error' | 'warn';
  message: string;
  rows?: number[];       // 1-based
  column?: string;       // header name
  suggestion?: string;
};

// Enhanced AI types with confidence and alternatives
export type AIMapping = {
  header: string;
  field: string;
  confidence: number; // 0-1
  alternatives?: string[];
};

export type AIAutoFix = {
  type: 'fix';
  description: string;
  field: string;
  rowsAffected: number;
  preview: string;
  rule?: string; // Pattern/rule description instead of specific values
};

export type AIChange = {
  type: 'mapping' | 'data' | 'format';
  field: string;
  from: string;
  to: string;
  reason: string;
  row?: number;
};

export type AIResponse = {
  mapping: AIMapping[];
  issues: Issue[];
  autoFixes?: AIAutoFix[];
  changes?: AIChange[];
  aiExplanation: string; // Max 280 chars
  service: 'AI-Powered';
  statusMap?: Record<string, string>; // Proposed status mappings
  dateRules?: Record<string, string>; // Proposed date parsing rules
  columnQuality?: Record<string, { nullPercent: number; uniquePercent: number; parseSuccess: number }>;
};

// Simplified AI metadata for UI display
export type AIMetadata = {
  service: 'AI-Powered';
  aiExplanation: string;
  statusMap?: Record<string, string>;
  dateRules?: Record<string, string>;
  columnQuality?: Record<string, any>;
};

export type AnalysisResult = {
  ok: boolean;
  issues: Issue[];
  loads?: Load[];
  mapping: Record<string, string>;
  mappingMeta?: {
    split?: Record<string, { date: string; time?: string }>;
    ambiguities?: Array<{field: string; candidates: string[]}>;
    hmacEnabled?: boolean;
    aiGenerated?: boolean;
    aiMappings?: AIMapping[]; // Store original AI mappings with confidence
  };
  changes?: AIChange[];
  autoFixes?: AIAutoFix[];
  // Enhanced AI fields for UI display
  aiMappings?: AIMapping[];
  aiAutoFixes?: AIAutoFix[];
  aiChanges?: AIChange[];
  aiResponse?: AIMetadata;
  meta: { 
    analyzedRows: number; 
    analyzedAt: string;
    modelLatencyMs?: number;
    totalLatencyMs?: number;
    requestId?: string;
    modelSampleRows?: number;
    statusValues?: string[];
    hmacDisabled?: boolean; // Observability flag for monitoring
    aiExplanation?: string;
    service?: 'AI-Powered' | 'Manual';
    statusMap?: Record<string, string>;
    dateRules?: Record<string, string>;
    confidence?: number; // Average AI confidence score (0-1)
    mappingMeta?: {
      aiMappings?: AIMapping[];
      changes?: AIChange[];
      autoFixes?: AIAutoFix[];
    };
  };
};

// Request contract types
export type AnalysisRequest = {
  headers: string[];
  rows: Array<Array<string | number | null>>;
  knownSynonyms?: Record<string, string[]>;
  options?: {
    rowLimit?: number;
    assumeTimezone?: string;
    locale?: string;
  };
  headerOverrides?: Record<string, string>;
};

// ---------- Env guards ----------
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ---------- Logging & Request ID generation ----------
function generateRequestId(): string {
  return crypto.randomBytes(4).toString('hex');
}

function logInfo(requestId: string, msg: string, data?: any) {
  if (LOG_LEVEL === 'DEBUG' || LOG_LEVEL === 'INFO') {
    console.log(`[${requestId}] INFO: ${msg}`, data ? JSON.stringify(data) : '');
  }
}

function logDebug(requestId: string, msg: string, data?: any) {
  if (LOG_LEVEL === 'DEBUG') {
    console.log(`[${requestId}] DEBUG: ${msg}`, data ? JSON.stringify(data) : '');
  }
}

function scrubPII(obj: any): any {
  if (typeof obj === 'string') {
    // Simple scrubbing - replace phone patterns and common name patterns
    return obj.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
              .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]');
  }
  if (Array.isArray(obj)) {
    return obj.map(scrubPII);
  }
  if (obj && typeof obj === 'object') {
    const scrubbed: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.toLowerCase().includes('phone') || key.toLowerCase().includes('driver')) {
        scrubbed[key] = '[SCRUBBED]';
      } else {
        scrubbed[key] = scrubPII(value);
      }
    }
    return scrubbed;
  }
  return obj;
}

// ---------- Enhanced rate limiter ----------
type Bucket = { tokens: number; updatedAt: number };
const BUCKETS: Map<string, Bucket> = new Map();
const RL_CAPACITY = RATE_LIMIT_RPM;
const RL_REFILL_MS = 60_000; // per minute

function rateLimitOk(key: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = BUCKETS.get(key) ?? { tokens: RL_CAPACITY, updatedAt: now };
  
  // Refill tokens linearly
  const elapsed = now - b.updatedAt;
  const refill = (elapsed / RL_REFILL_MS) * RL_CAPACITY;
  b.tokens = Math.min(RL_CAPACITY, b.tokens + refill);
  b.updatedAt = now;
  
  if (b.tokens >= 1) {
    b.tokens -= 1;
    BUCKETS.set(key, b);
    return { allowed: true };
  }
  
  BUCKETS.set(key, b);
  const retryAfter = Math.ceil((1 - b.tokens) / RL_CAPACITY * RL_REFILL_MS / 1000);
  return { allowed: false, retryAfter };
}

// ---------- Enhanced Utils ----------
function json(data: unknown, res: VercelResponse, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(data));
}

function cors(res: VercelResponse, allowedOrigin?: string) {
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ttc-timestamp, x-ttc-signature');
  res.setHeader('Access-Control-Max-Age', '600'); // Cache preflight for 10 minutes
  // Security hardening headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // Allow Google domains
  // Note: Add Strict-Transport-Security if using custom HTTPS domain
}

function validateOrigin(req: VercelRequest): { allowed: boolean; origin?: string } {
  if (ALLOWED_ORIGINS.length === 0) return { allowed: true }; // No restriction
  
  const origin = req.headers.origin;
  if (!origin) return { allowed: false };
  
  // Normalize origin (ensure protocol and no trailing slash)
  const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '');
  
  for (const allowed of ALLOWED_ORIGINS) {
    const normalizedAllowed = allowed.toLowerCase().replace(/\/$/, '');
    if (normalizedOrigin === normalizedAllowed) {
      return { allowed: true, origin };
    }
  }
  
  return { allowed: false };
}

/**
 * Stable JSON stringification for consistent HMAC computation.
 * Sorts object keys and handles arrays to ensure identical output
 * across client and server for HMAC signature validation.
 * 
 * Client usage:
 * ```typescript
 * const timestamp = Date.now().toString();
 * const stableBody = stableStringify(requestBody);
 * const signature = crypto.createHmac('sha256', secret)
 *   .update(`${timestamp}.${stableBody}`)
 *   .digest('hex');
 * ```
 */
function stableStringify(obj: any): string {
  const seen = new WeakSet();
  const helper = (x: any): any => {
    if (x && typeof x === 'object') {
      if (seen.has(x)) throw new Error('Circular reference detected in object');
      seen.add(x);
      if (Array.isArray(x)) return x.map(helper);
      return Object.keys(x).sort().reduce((acc: any, k) => {
        acc[k] = helper(x[k]);
        return acc;
      }, {});
    }
    return x;
  };
  return JSON.stringify(helper(obj));
}

function hmacValid(rawBody: string, timestamp: string | undefined, signature: string | undefined): boolean {
  if (!HMAC_SECRET) return true; // disabled
  if (!timestamp || !signature) return false;
  
  // Reject old replays (>5 min)
  const skew = Math.abs(Date.now() - Number(timestamp));
  if (Number.isFinite(skew) && skew > 5 * 60_000) return false;

  const mac = crypto.createHmac('sha256', HMAC_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

function validateRequestBody(body: any): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }
  
  if (!Array.isArray(body.headers)) {
    return { valid: false, error: 'headers must be an array of strings' };
  }
  
  if (!Array.isArray(body.rows)) {
    return { valid: false, error: 'rows must be an array of arrays' };
  }
  
  // Check for invalid cell types (objects not allowed)
  for (const row of body.rows) {
    if (!Array.isArray(row)) {
      return { valid: false, error: 'Each row must be an array' };
    }
    for (const cell of row) {
      if (cell !== null && typeof cell !== 'string' && typeof cell !== 'number' && cell !== '') {
        return { valid: false, error: 'Cells must be strings, numbers, null, or empty strings only' };
      }
    }
  }
  
  return { valid: true };
}

function safeString(x: any): string {
  if (typeof x === 'string') return x;
  if (x == null) return '';
  return String(x);
}

function truncateCell(s: string, max = 300): string {
  return s.length > max ? s.slice(0, max) : s;
}

function nowIso(): string {
  return new Date().toISOString();
}

// Enhanced AI response schema for structured outputs
const aiResponseSchema = {
  name: 'AIAnalysisResponse',
  schema: {
    type: 'object',
    required: ['mapping', 'issues', 'aiExplanation', 'service'],
    additionalProperties: false,
    properties: {
      mapping: {
        type: 'array',
        items: {
          type: 'object',
          required: ['header', 'field', 'confidence'],
          additionalProperties: false,
          properties: {
            header: { type: 'string' },
            field: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            alternatives: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['code', 'severity', 'message'],
          additionalProperties: false,
          properties: {
            code: { type: 'string' },
            severity: { type: 'string', enum: ['error', 'warn'] },
            message: { type: 'string' },
            rows: { type: 'array', items: { type: 'number' } },
            column: { type: 'string' },
            suggestion: { type: 'string' }
          }
        }
      },
      autoFixes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'description', 'field', 'rowsAffected', 'preview'],
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['fix'] },
            description: { type: 'string' },
            field: { type: 'string' },
            rowsAffected: { type: 'number' },
            preview: { type: 'string' },
            rule: { type: 'string' }
          }
        }
      },
      changes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['type', 'field', 'from', 'to', 'reason'],
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['mapping', 'data', 'format'] },
            field: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' },
            reason: { type: 'string' },
            row: { type: 'number' }
          }
        }
      },
      aiExplanation: { type: 'string', maxLength: 280 },
      service: { type: 'string', enum: ['AI-Powered'] },
      statusMap: {
        type: 'object',
        additionalProperties: { type: 'string' }
      },
      dateRules: {
        type: 'object',
        additionalProperties: { type: 'string' }
      },
      columnQuality: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            nullPercent: { type: 'number' },
            uniquePercent: { type: 'number' },
            parseSuccess: { type: 'number' }
          }
        }
      }
    }
  }
} as const;

// Enhanced known synonyms with more comprehensive mapping
const KNOWN_SYNONYMS: Record<string, string[]> = {
  loadId: ['load id', 'loadid', 'ref', 'reference', 'ref #', 'vrid', 'load number', 'id', 'load ref'],
  fromAddress: ['from', 'pu', 'pickup', 'origin', 'pickup address', 'origin address', 'pickup location', 'from address'],
  fromAppointmentDateTimeUTC: ['pu time', 'pickup appt', 'pickup date/time', 'pickup datetime', 'pu datetime', 'pu date', 'pickup time', 'from date', 'from time', 'pickup appointment'],
  toAddress: ['to', 'drop', 'delivery', 'destination', 'delivery address', 'destination address', 'delivery location', 'to address'],
  toAppointmentDateTimeUTC: ['del time', 'delivery appt', 'delivery date/time', 'delivery datetime', 'drop time', 'del date', 'delivery time', 'to date', 'to time', 'delivery appointment'],
  status: ['status', 'load status', 'stage', 'state', 'condition'],
  driverName: ['driver', 'driver name', 'driver/carrier', 'carrier'],
  driverPhone: ['phone', 'driver phone', 'contact', 'driver contact', 'driver cell', 'mobile'],
  unitNumber: ['unit', 'truck', 'truck #', 'tractor', 'unit number', 'equipment', 'truck number'],
  broker: ['broker', 'customer', 'shipper', 'client', 'company']
};

// ---------- Header Mapping Logic ----------
function createHeaderMapping(
  headers: string[],
  headerOverrides: Record<string, string> = {},
  knownSynonyms: Record<string, string[]> = KNOWN_SYNONYMS
): { mapping: Record<string, string>; ambiguities: Array<{field: string; candidates: string[]}> } {
  const mapping: Record<string, string> = {};
  const ambiguities: Array<{field: string; candidates: string[]}> = [];
  const usedHeaders = new Set<string>();
  
  // Step 1: Apply header overrides first (they win)
  for (const [header, field] of Object.entries(headerOverrides)) {
    if (headers.includes(header)) {
      mapping[header] = field;
      usedHeaders.add(header);
    }
  }
  
  // Step 2: Exact matches
  for (const [field, synonyms] of Object.entries(knownSynonyms)) {
    if (Object.values(mapping).includes(field)) continue; // Already mapped
    
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      const headerLower = header.toLowerCase().trim();
      if (synonyms.some(syn => syn.toLowerCase() === headerLower)) {
        mapping[header] = field;
        usedHeaders.add(header);
        break;
      }
    }
  }
  
  // Step 3: Partial matches (detect ambiguities)
  for (const [field, synonyms] of Object.entries(knownSynonyms)) {
    if (Object.values(mapping).includes(field)) continue; // Already mapped
    
    const candidates: string[] = [];
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      const headerLower = header.toLowerCase().trim();
      if (synonyms.some(syn => headerLower.includes(syn.toLowerCase()) || syn.toLowerCase().includes(headerLower))) {
        candidates.push(header);
      }
    }
    
    if (candidates.length === 1) {
      mapping[candidates[0]] = field;
      usedHeaders.add(candidates[0]);
    } else if (candidates.length > 1) {
      ambiguities.push({ field, candidates });
      // Pick the best match for now (shortest name usually most specific)
      const best = candidates.sort((a, b) => a.length - b.length)[0];
      mapping[best] = field;
      usedHeaders.add(best);
    }
  }
  
  return { mapping, ambiguities };
}

// ---------- Date Normalization Functions ----------
const TZ_ABBR_OFFSETS: Record<string,string> = {
  PST: '-08:00', PDT: '-07:00',
  MST: '-07:00', MDT: '-06:00',
  CST: '-06:00', CDT: '-05:00',
  EST: '-05:00', EDT: '-04:00'
};

function parseAndNormalizeDate(
  dateStr: string, 
  timeStr?: string, 
  assumeTimezone: string = 'UTC'
): { success: boolean; isoString?: string; wasNormalized?: boolean; error?: string } {
  if (!dateStr || dateStr.toLowerCase() === 'tbd' || dateStr.toLowerCase().includes('tbd')) {
    return { success: false, error: 'Cannot parse TBD or similar placeholders' };
  }
  
  let combinedStr = dateStr;
  
  // Combine date and time if separate
  if (timeStr && timeStr.trim()) {
    combinedStr = `${dateStr.trim()} ${timeStr.trim()}`;
  }
  
  // Replace trailing US timezone abbreviation with a numeric offset if present
  const abbrMatch = combinedStr.match(/\b([A-Z]{2,4})\s*$/);
  if (abbrMatch && TZ_ABBR_OFFSETS[abbrMatch[1]]) {
    combinedStr = combinedStr.replace(/\b([A-Z]{2,4})\s*$/, TZ_ABBR_OFFSETS[abbrMatch[1]]);
  }
  
  // Check if already valid ISO UTC (accept both with and without milliseconds)
  if (isValidISODateTime(combinedStr)) {
    return { 
      success: true, 
      isoString: normalizeToCanonicalISO(combinedStr), 
      wasNormalized: normalizeToCanonicalISO(combinedStr) !== combinedStr 
    };
  }
  
  // Check if it's a relaxed ISO format (accept variants)
  const relaxedIsoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?Z?$/;
  if (relaxedIsoRegex.test(combinedStr)) {
    try {
      const date = new Date(combinedStr);
      if (!isNaN(date.getTime())) {
        const canonical = normalizeToCanonicalISO(date.toISOString());
        return { 
          success: true, 
          isoString: canonical, 
          wasNormalized: combinedStr !== canonical
        };
      }
    } catch (e) {
      // Fall through to more parsing
    }
  }
  
  // Try to parse and add timezone if missing
  let parseStr = combinedStr;
  
  // If no timezone info detected, add assumed timezone
  if (!/[+-]\d{2}:?\d{2}|Z|UTC|GMT/i.test(parseStr)) {
    if (assumeTimezone === 'UTC') {
      parseStr += ' UTC';
    } else if (/^[+-]\d{2}:\d{2}$/.test(assumeTimezone)) {
      // Support numeric offsets like +05:30, -07:00
      parseStr += ` ${assumeTimezone}`;
    } else {
      // Convert timezone name to offset (simplified)
      const timezoneOffsets: Record<string, string> = {
        'Asia/Kuala_Lumpur': '+08:00',
        'Asia/Singapore': '+08:00',
        'America/New_York': '-05:00',
        'America/Los_Angeles': '-08:00',
        'Europe/London': '+00:00'
      };
      
      const offset = timezoneOffsets[assumeTimezone] || '+00:00';
      parseStr += ` ${offset}`;
    }
  }
  
  try {
    const date = new Date(parseStr);
    if (!isNaN(date.getTime())) {
      return { 
        success: true, 
        isoString: normalizeToCanonicalISO(date.toISOString()), 
        wasNormalized: true 
      };
    }
  } catch (e) {
    return { success: false, error: `Cannot parse date: ${combinedStr}` };
  }
  
  return { success: false, error: `Invalid date format: ${combinedStr}` };
}

// Normalize to canonical ISO format: YYYY-MM-DDTHH:mm:ssZ (no milliseconds)
function normalizeToCanonicalISO(isoString: string): string {
  if (!isoString) return isoString;
  // Remove milliseconds if present
  return isoString.replace(/\.\d{3}Z$/, 'Z');
}

function isValidISODateTime(dateStr: string): boolean {
  if (!dateStr) return false;
  // Accept both with and without milliseconds
  const isoRegexWithMs = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const isoRegexNoMs = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  
  if (!isoRegexWithMs.test(dateStr) && !isoRegexNoMs.test(dateStr)) {
    return false;
  }
  
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// ---------- Status Canonicalization ----------
const CANON_STATUS = new Map<string, string>([
  ['in transit','IN_TRANSIT'], ['rolling','IN_TRANSIT'], ['en route','IN_TRANSIT'],
  ['delivered','DELIVERED'], ['complete','DELIVERED'],
  ['canceled','CANCELLED'], ['cancelled','CANCELLED'],
  ['pending','PENDING'], ['loading','LOADING'], ['unloading','UNLOADING']
]);

function canonicalizeStatus(s: string): string {
  const key = s.trim().toLowerCase();
  return CANON_STATUS.get(key) ?? s;
}

// ---------- Enhanced Header Mapping with Split Column Support ----------
function createEnhancedHeaderMapping(
  headers: string[],
  headerOverrides: Record<string, string> = {},
  knownSynonyms: Record<string, string[]> = KNOWN_SYNONYMS
): { 
  mapping: Record<string, string>; 
  splitMappings: Record<string, { date: string; time?: string }>; 
  ambiguities: Array<{field: string; candidates: string[]}> 
} {
  const mapping: Record<string, string> = {};
  const splitMappings: Record<string, { date: string; time?: string }> = {};
  const ambiguities: Array<{field: string; candidates: string[]}> = [];
  const usedHeaders = new Set<string>();
  
  // Step 1: Apply header overrides first (they win)
  for (const [header, field] of Object.entries(headerOverrides)) {
    if (headers.includes(header)) {
      mapping[header] = field;
      usedHeaders.add(header);
    }
  }
  
  // Step 2: Exact matches
  for (const [field, synonyms] of Object.entries(knownSynonyms)) {
    if (Object.values(mapping).includes(field)) continue; // Already mapped
    
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      const headerLower = header.toLowerCase().trim();
      if (synonyms.some(syn => syn.toLowerCase() === headerLower)) {
        mapping[header] = field;
        usedHeaders.add(header);
        break;
      }
    }
  }
  
  // Step 3: Look for split date/time columns
  const dateTimeFields = ['fromAppointmentDateTimeUTC', 'toAppointmentDateTimeUTC'];
  for (const field of dateTimeFields) {
    if (Object.values(mapping).includes(field)) continue; // Already mapped as single column
    
    // Look for separate date and time columns
    const dateSynonyms = field === 'fromAppointmentDateTimeUTC' 
      ? ['pu date', 'pickup date', 'from date', 'origin date']
      : ['del date', 'delivery date', 'to date', 'destination date'];
    
    const timeSynonyms = field === 'fromAppointmentDateTimeUTC'
      ? ['pu time', 'pickup time', 'from time', 'origin time'] 
      : ['del time', 'delivery time', 'to time', 'destination time'];
    
    let dateHeader: string | undefined;
    let timeHeader: string | undefined;
    
    // Find date column
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const headerLower = header.toLowerCase().trim();
      if (dateSynonyms.some(syn => headerLower.includes(syn) || syn.includes(headerLower))) {
        dateHeader = header;
        break;
      }
    }
    
    // Find time column
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const headerLower = header.toLowerCase().trim();
      if (timeSynonyms.some(syn => headerLower.includes(syn) || syn.includes(headerLower))) {
        timeHeader = header;
        break;
      }
    }
    
    // If we found at least a date column, create split mapping
    if (dateHeader) {
      splitMappings[field] = { date: dateHeader, time: timeHeader };
      usedHeaders.add(dateHeader);
      if (timeHeader) {
        usedHeaders.add(timeHeader);
      }
      
      // Add synthetic key to main mapping for UI visibility
      const syntheticKey = timeHeader ? `${dateHeader} + ${timeHeader}` : dateHeader;
      mapping[syntheticKey] = field;
    }
  }
  
  // Step 4: Partial matches for remaining fields
  for (const [field, synonyms] of Object.entries(knownSynonyms)) {
    if (Object.values(mapping).includes(field) || splitMappings[field]) continue; // Already mapped
    
    const candidates: string[] = [];
    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      
      const headerLower = header.toLowerCase().trim();
      if (synonyms.some(syn => headerLower.includes(syn.toLowerCase()) || syn.toLowerCase().includes(headerLower))) {
        candidates.push(header);
      }
    }
    
    if (candidates.length === 1) {
      mapping[candidates[0]] = field;
      usedHeaders.add(candidates[0]);
    } else if (candidates.length > 1) {
      ambiguities.push({ field, candidates });
      // Pick the best match for now (shortest name usually most specific)
      const best = candidates.sort((a, b) => a.length - b.length)[0];
      mapping[best] = field;
      usedHeaders.add(best);
    }
  }
  
  return { mapping, splitMappings, ambiguities };
}

function validateRequiredColumns(
  mapping: Record<string, string>, 
  splitMappings: Record<string, { date: string; time?: string }>
): Issue[] {
  const issues: Issue[] = [];
  const requiredFields = [
    'loadId', 'fromAddress', 'fromAppointmentDateTimeUTC',
    'toAddress', 'toAppointmentDateTimeUTC', 'status',
    'driverName', 'unitNumber', 'broker'
  ];
  
  const mappedFields = new Set(Object.values(mapping));
  
  for (const field of requiredFields) {
    const isMapped = mappedFields.has(field);
    const hasSplitMapping = splitMappings[field]?.date;
    
    if (!isMapped && !hasSplitMapping) {
      issues.push({
        code: 'MISSING_COLUMN',
        severity: 'error',
        message: `Missing required column for '${field}'.`,
        column: field,
        suggestion: `Ensure the column for ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} is present, or use separate date/time columns.`
      });
    }
  }
  
  return issues;
}

function validateAndNormalizeAllRows(
  headers: string[],
  rows: string[][],
  mapping: Record<string, string>,
  splitMappings: Record<string, { date: string; time?: string }>,
  assumeTimezone: string = 'UTC'
): { loads: Load[]; issues: Issue[]; originalValues: Map<string, { [key: string]: string }>; statusValues: Set<string> } {
  const loads: Load[] = [];
  const issues: Issue[] = [];
  const seenLoadIds = new Set<string>();
  const statusValues = new Set<string>();
  
  // Build quick lookup sets
  const mappedHeaderSet = new Set(Object.keys(mapping));
  const splitHeaderSet = new Set(
    Object.values(splitMappings).flatMap(s => [s.date, ...(s.time ? [s.time] : [])])
  );

  // Headers that are neither directly mapped nor used by split date/time
  const nonSchemaHeaders = headers.filter(
    h => !mappedHeaderSet.has(h) && !splitHeaderSet.has(h)
  );
  
  const originalValues = new Map<string, { [key: string]: string }>();
  
  // Warn about non-schema columns with examples
  if (nonSchemaHeaders.length > 0) {
    issues.push({
      code: 'NON_SCHEMA_FIELD',
      severity: 'warn',
      message: `Found ${nonSchemaHeaders.length} non-schema columns: ${nonSchemaHeaders.slice(0, 3).join(', ')}${nonSchemaHeaders.length > 3 ? '...' : ''}`,
      suggestion: 'These columns will be ignored during analysis.'
    });
  }
  
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowNumber = rowIndex + 2; // +2 because header is row 1 and arrays are 0-based
    const load: Partial<Load> = {};
    const rowIssues: Issue[] = [];
    const rowOriginalValues: { [key: string]: string } = {};
    
    // Extract data using direct mapping
    for (let colIndex = 0; colIndex < headers.length && colIndex < row.length; colIndex++) {
      const header = headers[colIndex];
      const raw = row[colIndex];
      const value = (raw === null || raw === '') ? '' : String(raw).trim(); // <= force string safely
      const field = mapping[header];
      
      if (field) {
        (load as any)[field] = value;
        rowOriginalValues[field] = value;
      }
    }
    
    // Handle split date/time mappings with normalization
    for (const [field, splitMapping] of Object.entries(splitMappings)) {
      const dateIndex = headers.indexOf(splitMapping.date);
      const timeIndex = splitMapping.time ? headers.indexOf(splitMapping.time) : -1;
      
      const dateValue = dateIndex >= 0 ? row[dateIndex]?.trim() || '' : '';
      const timeValue = timeIndex >= 0 ? row[timeIndex]?.trim() || '' : '';
      
      if (dateValue) {
        rowOriginalValues[field] = `${dateValue}${timeValue ? ` ${timeValue}` : ''}`;
        
        const normalizeResult = parseAndNormalizeDate(dateValue, timeValue, assumeTimezone);
        if (normalizeResult.success && normalizeResult.isoString) {
          load[field as keyof Load] = normalizeResult.isoString;
          
          if (normalizeResult.wasNormalized) {
            rowIssues.push({
              code: 'NON_ISO_OUTPUT',
              severity: 'warn',
              message: `Date normalized from ${rowOriginalValues[field]} to ${normalizeResult.isoString}`,
              rows: [rowNumber],
              column: field,
              suggestion: 'Use ISO 8601 format for consistency.'
            });
          }
        } else {
          rowIssues.push({
            code: 'BAD_DATE_FORMAT',
            severity: 'error',
            message: `Invalid date format: ${rowOriginalValues[field]} (${normalizeResult.error})`,
            rows: [rowNumber],
            column: field,
            suggestion: 'Use ISO 8601 UTC format: YYYY-MM-DDTHH:mm:ssZ or provide valid date/time values.'
          });
        }
      }
    }
    
    // Normalize single datetime columns that were directly mapped
    for (const field of ['fromAppointmentDateTimeUTC', 'toAppointmentDateTimeUTC']) {
      if (load[field as keyof Load] && !splitMappings[field]) {
        const originalValue = load[field as keyof Load] as string;
        const normalizeResult = parseAndNormalizeDate(originalValue, undefined, assumeTimezone);
        
        if (normalizeResult.success && normalizeResult.isoString) {
          load[field as keyof Load] = normalizeResult.isoString;
          
          if (normalizeResult.wasNormalized) {
            rowIssues.push({
              code: 'NON_ISO_OUTPUT',
              severity: 'warn',
              message: `Date normalized from ${originalValue} to ${normalizeResult.isoString}`,
              rows: [rowNumber],
              column: field,
              suggestion: 'Use ISO 8601 format for consistency.'
            });
          }
        } else if (originalValue) {
          rowIssues.push({
            code: 'BAD_DATE_FORMAT',
            severity: 'error',
            message: `Invalid date format: ${originalValue} (${normalizeResult.error})`,
            rows: [rowNumber],
            column: field,
            suggestion: 'Use ISO 8601 UTC format: YYYY-MM-DDTHH:mm:ssZ'
          });
        }
      }
    }
    
    // Check for empty required fields
    const requiredFields = ['loadId', 'fromAddress', 'toAddress', 'status', 'driverName', 'unitNumber', 'broker'];
    for (const field of requiredFields) {
      if (!load[field as keyof Load] || load[field as keyof Load] === '') {
        rowIssues.push({
          code: 'EMPTY_REQUIRED_CELL',
          severity: 'error',
          message: `Required field '${field}' is empty`,
          rows: [rowNumber],
          column: field,
          suggestion: `Provide a value for ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}.`
        });
      }
    }
    
    // Check loadId uniqueness
    if (load.loadId) {
      if (seenLoadIds.has(load.loadId)) {
        rowIssues.push({
          code: 'DUPLICATE_ID',
          severity: 'error',
          message: `Duplicate load ID: ${load.loadId}`,
          rows: [rowNumber],
          column: 'loadId',
          suggestion: 'Each load must have a unique identifier.'
        });
      } else {
        seenLoadIds.add(load.loadId);
      }
    }
    
    // Collect status values for vocabulary check
    if (load.status) {
      load.status = canonicalizeStatus(String(load.status));
      statusValues.add(String(load.status).toLowerCase());
    }
    
    // Add row issues to main issues list
    issues.push(...rowIssues);
    
    // Store original values for this row
    if (load.loadId) {
      originalValues.set(load.loadId, rowOriginalValues);
    }
    
    // Add valid load if no errors in this row
    const hasErrors = rowIssues.some(issue => issue.severity === 'error');
    if (!hasErrors && load.loadId) {
      loads.push(load as Load);
    }
  }
  
  // Enhanced status vocabulary check - always show unique values
  if (statusValues.size > 1) {
    const statusArray = Array.from(statusValues);
    const canonicalStatuses = ['in_transit', 'delivered', 'cancelled', 'pending', 'loading', 'unloading'];
    const hasNonCanonical = statusArray.some(s => !canonicalStatuses.includes(s));
    
    if (hasNonCanonical || statusValues.size > 5) {
      issues.push({
        code: 'VOCAB_STATUS',
        severity: 'warn',
        message: `Found ${statusValues.size} different status values: ${statusArray.slice(0, 8).join(', ')}${statusArray.length > 8 ? '...' : ''}`,
        suggestion: 'Consider standardizing status values (e.g., "IN_TRANSIT", "DELIVERED", "CANCELLED").'
      });
    }
  }
  
  return { loads, issues, originalValues, statusValues };
}

// Final validation pass on normalized loads
function validateFinalLoads(loads: Load[]): Issue[] {
  const issues: Issue[] = [];
  const seenIds = new Set<string>();
  
  for (let i = 0; i < loads.length; i++) {
    const load = loads[i];
    const rowNumber = i + 2; // Approximate row number
    
    // Check for duplicates in final result
    if (seenIds.has(load.loadId)) {
      issues.push({
        code: 'DUPLICATE_ID',
        severity: 'error',
        message: `Duplicate load ID in final result: ${load.loadId}`,
        rows: [rowNumber],
        column: 'loadId',
        suggestion: 'Each load must have a unique identifier.'
      });
    } else {
      seenIds.add(load.loadId);
    }
    
    // Check required fields are still present after normalization
    const requiredFields: (keyof Load)[] = ['loadId', 'fromAddress', 'toAddress', 'status', 'driverName', 'unitNumber', 'broker'];
    for (const field of requiredFields) {
      if (!load[field] || load[field] === '') {
        issues.push({
          code: 'EMPTY_REQUIRED_CELL',
          severity: 'error',
          message: `Required field '${field}' is empty after normalization`,
          rows: [rowNumber],
          column: field,
          suggestion: `Provide a value for ${field}.`
        });
      }
    }
    
    // Validate final ISO dates (canonical format)
    if (load.fromAppointmentDateTimeUTC && !isValidISODateTime(load.fromAppointmentDateTimeUTC)) {
      issues.push({
        code: 'NON_ISO_OUTPUT',
        severity: 'error',
        message: `Pickup date not in ISO format: ${load.fromAppointmentDateTimeUTC}`,
        rows: [rowNumber],
        column: 'fromAppointmentDateTimeUTC',
        suggestion: 'Date should be normalized to YYYY-MM-DDTHH:mm:ssZ format.'
      });
    }
    
    if (load.toAppointmentDateTimeUTC && !isValidISODateTime(load.toAppointmentDateTimeUTC)) {
      issues.push({
        code: 'NON_ISO_OUTPUT',
        severity: 'error',
        message: `Delivery date not in ISO format: ${load.toAppointmentDateTimeUTC}`,
        rows: [rowNumber],
        column: 'toAppointmentDateTimeUTC',
        suggestion: 'Date should be normalized to YYYY-MM-DDTHH:mm:ssZ format.'
      });
    }
  }
  
  return issues;
}

// ---------- Enhanced Handler ----------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  
  // Check origin and set CORS
  const originCheck = validateOrigin(req);
  cors(res, originCheck.origin);
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    logInfo(requestId, 'Method not allowed', scrubPII({ method: req.method }));
    return json({ error: 'Method not allowed', requestId }, res, 405);
  }
  
  // Check origin if restricted
  if (!originCheck.allowed) {
    logInfo(requestId, 'Origin not allowed', scrubPII({ origin: req.headers.origin }));
    return json({ error: 'Origin not allowed', requestId }, res, 403);
  }
  
  // Rate limiting
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'anon';
  const rateLimitResult = rateLimitOk(ip);
  if (!rateLimitResult.allowed) {
    logInfo(requestId, 'Rate limit exceeded', scrubPII({ ip: ip.substring(0, 8) + '...', retryAfter: rateLimitResult.retryAfter }));
    res.setHeader('Retry-After', rateLimitResult.retryAfter?.toString() || '60');
    return json({ 
      error: 'Rate limit exceeded. Try again in a moment.', 
      retryAfter: rateLimitResult.retryAfter,
      requestId 
    }, res, 429);
  }
  
  // Check payload size (both content-length header and computed size)
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const bodySize = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
  const effectiveSize = Math.max(contentLength, bodySize);
  
  if (effectiveSize > MAX_PAYLOAD_SIZE) {
    logInfo(requestId, 'Payload too large', scrubPII({ contentLength, bodySize, effectiveSize }));
    return json({ 
      error: 'Payload too large. Please reduce the number of rows.',
      maxSize: MAX_PAYLOAD_SIZE,
      actualSize: effectiveSize,
      requestId 
    }, res, 413);
  }
  
  // HMAC validation using stable JSON serialization
  let hmacValidationResult = true; // Default: allow when disabled
  if (HMAC_SECRET) {
    try {
      // Use stable JSON serialization to ensure client and server sign the same string
      const rawBodyStable = stableStringify(req.body);
      hmacValidationResult = hmacValid(
        rawBodyStable,
        req.headers['x-ttc-timestamp'] as string | undefined,
        req.headers['x-ttc-signature'] as string | undefined
      );
      logDebug(requestId, 'HMAC validation performed with stable JSON serialization');
    } catch (error: any) {
      logInfo(requestId, 'HMAC validation failed due to serialization error', scrubPII({ error: error.message }));
      hmacValidationResult = false;
    }
    
    // Enforce HMAC validation when secret is configured
    if (!hmacValidationResult) {
      logInfo(requestId, 'HMAC validation failed');
      return json({ error: 'Invalid signature', requestId }, res, 401);
    }
  } else {
    logDebug(requestId, 'HMAC validation disabled (no secret configured)');
  }
  
  // ---------- Validate & sanitize input ----------
  const bodyValidation = validateRequestBody(req.body);
  if (!bodyValidation.valid) {
    logInfo(requestId, 'Invalid request body', scrubPII({ error: bodyValidation.error }));
    return json({ 
      error: `Bad body: ${bodyValidation.error}`,
      requestId 
    }, res, 400);
  }
  
  const {
    headers,
    rows,
    knownSynonyms = {},
    options = {},
    headerOverrides = {}
  }: AnalysisRequest = req.body;
  
  // Sanitize and limit data
  const MAX_COLS = 50;
  const MAX_ROWS = Math.min(200, options.rowLimit || 200);
  
  if (headers.length > MAX_COLS) {
    logInfo(requestId, 'Too many headers, truncating', scrubPII({ original: headers.length, truncated: MAX_COLS }));
  }
  
  const headersSafe: string[] = headers
    .slice(0, MAX_COLS)
    .map((h) => truncateCell(safeString(h), 120));
  
  const rowsSafe: string[][] = rows
    .slice(0, MAX_ROWS)
    .map((r: any) =>
      Array.isArray(r)
        ? r.slice(0, MAX_COLS).map((c) => c === null ? '' : truncateCell(safeString(c)))
        : []
    );
  
  logInfo(requestId, 'Processing analysis', scrubPII({
    headerCount: headersSafe.length,
    rowCount: rowsSafe.length,
    hasOverrides: Object.keys(headerOverrides).length > 0,
    assumeTimezone: options.assumeTimezone
  }));
  
  logDebug(requestId, 'Headers preview', scrubPII(headersSafe.slice(0, 3)));
  
  if (rowsSafe.length === 0) {
    return json({
      ok: false,
      issues: [{
        code: 'NO_DATA',
        severity: 'error' as const,
        message: 'No data rows found to analyze',
        suggestion: 'Ensure your spreadsheet has data below the header row'
      }],
      mapping: {},
      mappingMeta: {
        hmacEnabled: !!HMAC_SECRET && hmacValidationResult
      },
      meta: {
        analyzedRows: 0,
        analyzedAt: nowIso(),
        requestId,
        totalLatencyMs: Date.now() - startTime,
        hmacDisabled: !HMAC_SECRET || !hmacValidationResult
      }
    }, res, 200);
  }
  
  // ---------- Header mapping ----------
  const mergedSynonyms = { ...KNOWN_SYNONYMS, ...knownSynonyms };
  const { mapping, splitMappings, ambiguities } = createEnhancedHeaderMapping(headersSafe, headerOverrides, mergedSynonyms);
  
  logDebug(requestId, 'Header mapping', scrubPII({ 
    mapping, 
    splitMappings, 
    ambiguities: ambiguities.length 
  }));
  
  // Check for missing required columns after considering split mappings
  const columnIssues = validateRequiredColumns(mapping, splitMappings);
  if (columnIssues.length > 0) {
    return json({
      ok: false,
      issues: columnIssues,
      mapping,
      mappingMeta: {
        split: Object.keys(splitMappings).length > 0 ? splitMappings : undefined,
        hmacEnabled: !!HMAC_SECRET && hmacValidationResult
      },
      meta: {
        analyzedRows: rowsSafe.length,
        analyzedAt: nowIso(),
        requestId,
        totalLatencyMs: Date.now() - startTime,
        hmacDisabled: !HMAC_SECRET || !hmacValidationResult
      }
    }, res, 200);
  }
  
  // Add ambiguity warnings if any
  const ambiguityIssues: Issue[] = ambiguities.map(amb => ({
    code: 'HEADER_AMBIGUITY',
    severity: 'warn' as const,
    message: `Multiple columns could match '${amb.field}': ${amb.candidates.join(', ')}`,
    suggestion: 'Use header overrides to specify exact mapping if needed.'
  }));
  
  // ---------- Deterministic validation and normalization on all rows ----------
  const { 
    loads: validatedLoads, 
    issues: validationIssues, 
    originalValues,
    statusValues: detectedStatusValues
  } = validateAndNormalizeAllRows(
    headersSafe, 
    rowsSafe, 
    mapping, 
    splitMappings, 
    options.assumeTimezone || 'UTC'
  );
  
  // ---------- PRODUCTION-LEVEL AI ANALYSIS WITH INTELLIGENT AUTO-MAPPING ----------
  const modelStartTime = Date.now();
  let modelIssues: Issue[] = [];
  let normalizedLoads: Load[] = validatedLoads;
  let aiGeneratedMapping: Record<string, string> = {};
  let trackedChanges: Array<any> = [];
  let autoFixes: Array<any> = [];
  let aiExplanation = '';
  let aiMappingsData: AIMapping[] = [];
  let aiStatusMap: Record<string, string> = {};
  let aiDateRules: Record<string, string> = {};
  let aiColumnQuality: Record<string, any> = {};
  
  // Create abort controller for request timeout (prevent burning full 30s)
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 25000); // 25s timeout
  
  try {
    const system = [
      'You are an expert logistics data analyst with advanced change tracking capabilities. Your job is to:',
      '1. INTELLIGENTLY MAP HEADERS: Analyze column headers and automatically map them to the required Load schema fields',
      '2. TRACK ALL CHANGES: Record every transformation, mapping decision, and data modification with before/after states',
      '3. COMPREHENSIVE VALIDATION: Find ALL data quality issues, patterns, and inconsistencies',
      '4. AUTO-FIX CAPABILITIES: Provide automatic fixes for common data issues with clear previews',
      '5. SMART NORMALIZATION: Clean and standardize addresses, dates, status values, and driver information',
      '6. PRODUCTION-READY OUTPUT: Return clean, validated loads with detailed change tracking and issue reporting',
      '',
      'REQUIRED LOAD SCHEMA:',
      '- loadId: string (unique identifier)',
      '- fromAddress: string (pickup location)', 
      '- fromAppointmentDateTimeUTC: string (ISO 8601 UTC)',
      '- toAddress: string (delivery location)',
      '- toAppointmentDateTimeUTC: string (ISO 8601 UTC)', 
      '- status: string (standardized status)',
      '- driverName: string',
      '- driverPhone?: string (optional)',
      '- unitNumber: string (truck/vehicle ID)',
      '- broker: string',
      '',
      'CHANGE TRACKING REQUIREMENTS:',
      'For every modification, record in "changes" array:',
      '- type: "mapping" | "data" | "format"',
      '- field: affected field name',
      '- from: original value',
      '- to: new value', 
      '- reason: explanation for the change',
      '- row: row number (if applicable)',
      '',
      'AUTO-FIX CAPABILITIES:',
      'Provide "autoFixes" array for common issues:',
      '- Date format corrections',
      '- Address standardization',
      '- Status value normalization',
      '- Phone number formatting',
      '- Duplicate removal suggestions',
      '',
      'HEADER MAPPING INTELLIGENCE:',
      'Use semantic understanding to map headers. Common patterns:',
      '- Load ID: "Load", "Ref", "VRID", "Load Number", "Reference"',
      '- Pickup: "From", "PU", "Pickup", "Origin", "Pickup Address"', 
      '- Delivery: "To", "Drop", "Delivery", "Destination", "Del"',
      '- Dates: "PU Time", "DEL Time", "Pickup Date", "Delivery Date"',
      '- Status: "Status", "Load Status", "Stage", "State"',
      '- Driver: "Driver", "Driver Name", "Carrier"',
      '- Unit: "Unit", "Truck", "Tractor", "Equipment"',
      '- Broker: "Broker", "Customer", "Shipper", "Client"',
      '',
      'VALIDATION & NORMALIZATION:',
      '- Convert all dates to ISO 8601 UTC format',
      '- Standardize addresses (full, readable format)',
      '- Normalize status values (IN_TRANSIT, DELIVERED, CANCELLED, etc.)',
      '- Validate phone numbers and format consistently',
      '- Check for duplicates, missing data, format issues',
      '',
      'NEVER INVENT DATA. Flag unknowns and missing information clearly.',
      'Return comprehensive analysis with mapped loads, detailed issues, tracked changes, and auto-fix suggestions.'
    ].join(' ');
    
    const analysisPayload = {
      task: 'COMPREHENSIVE_LOGISTICS_ANALYSIS',
      headers: headersSafe,
      allRows: rowsSafe, // Send all rows for complete analysis
      totalRows: rowsSafe.length,
      options: {
        assumeTimezone: options.assumeTimezone || 'UTC',
        locale: options.locale || 'en-US',
        enableSmartMapping: true,
        enableAddressNormalization: true,
        enableStatusStandardization: true,
        enableDateNormalization: true
      },
      instructions: [
        'Perform intelligent header-to-field mapping using semantic analysis',
        'Validate ALL rows for data quality issues', 
        'Normalize addresses, dates, and status values',
        'Generate production-ready loads with comprehensive issue reporting',
        'Provide clear explanations for all mappings and transformations'
      ]
    };
    
    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.1, // Low temperature for consistent, deterministic outputs
      max_tokens: 8000,
      response_format: {
        type: 'json_schema',
        json_schema: aiResponseSchema
      },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: 
            'COMPREHENSIVE LOGISTICS DATA ANALYSIS WITH CONFIDENCE SCORING\n\n' +
            'Analyze this dataset and provide structured output with:\n\n' +
            '1. INTELLIGENT HEADER MAPPING with confidence scores (0-1 scale):\n' +
            '   - Confidence ≥0.9: Auto-apply mapping (high confidence)\n' +
            '   - Confidence 0.6-0.89: Show alternatives for user review\n' +
            '   - Confidence <0.6: Flag as unclear, require manual mapping\n\n' +
            '2. COMPREHENSIVE DATA VALIDATION:\n' +
            '   - Find ALL data quality issues with clear descriptions\n' +
            '   - Provide actionable suggestions for each issue\n' +
            '   - Include row numbers and affected columns\n\n' +
            '3. AUTO-FIX SUGGESTIONS:\n' +
            '   - Date format standardization rules\n' +
            '   - Address normalization patterns\n' +
            '   - Status value mappings\n' +
            '   - Phone number formatting rules\n\n' +
            '4. CHANGE TRACKING:\n' +
            '   - Document all transformations (mapping changes, data normalization)\n' +
            '   - Show before/after states with clear reasons\n\n' +
            '5. METADATA:\n' +
            '   - Column quality metrics (null%, unique%, parse success%)\n' +
            '   - Status value mappings discovered\n' +
            '   - Date format patterns found\n\n' +
            'SAMPLE STRATEGY: Analyze 20 high-quality rows + 20 problematic rows for pattern detection.\n' +
            'CONFIDENCE REQUIREMENTS: Only map headers with semantic clarity. Flag ambiguous cases.\n' +
            'OUTPUT FORMAT: Use the AIAnalysisResponse schema with structured arrays.\n\n' +
            'DATA PAYLOAD:\n' +
            JSON.stringify(analysisPayload, null, 2)
        }
      ]
    }, {
      signal: abortController.signal,
      timeout: 25000
    });
    
    clearTimeout(timeoutId);
    
    const modelLatencyMs = Date.now() - modelStartTime;
    logInfo(requestId, 'OpenAI response received', scrubPII({ modelLatencyMs, model: OPENAI_MODEL }));
    
    const outText = resp.choices[0]?.message?.content ?? '';
    if (outText) {
      try {
        // Parse structured AI response using new schema
        const aiResponse = JSON.parse(outText) as {
          mapping: AIMapping[];
          issues: Issue[];
          autoFixes?: AIAutoFix[];
          changes?: AIChange[];
          aiExplanation: string;
          service: string;
          statusMap?: Record<string, string>;
          dateRules?: Record<string, string>;
          columnQuality?: Record<string, any>;
        };
        
        if (aiResponse && typeof aiResponse === 'object') {
          // Process AI issues
          modelIssues = Array.isArray(aiResponse.issues) ? aiResponse.issues : [];
          
          // Process structured changes and auto-fixes
          if (aiResponse.changes && Array.isArray(aiResponse.changes)) {
            trackedChanges = aiResponse.changes;
          }
          
          if (aiResponse.autoFixes && Array.isArray(aiResponse.autoFixes)) {
            autoFixes = aiResponse.autoFixes;
          }
          
          // Store AI explanation
          if (aiResponse.aiExplanation && typeof aiResponse.aiExplanation === 'string') {
            aiExplanation = aiResponse.aiExplanation;
          }
          
          // Process confidence-based mapping
          if (aiResponse.mapping && Array.isArray(aiResponse.mapping)) {
            const highConfidenceMappings = aiResponse.mapping.filter((m: AIMapping) => m.confidence >= 0.9);
            const mediumConfidenceMappings = aiResponse.mapping.filter((m: AIMapping) => m.confidence >= 0.6 && m.confidence < 0.9);
            const lowConfidenceMappings = aiResponse.mapping.filter((m: AIMapping) => m.confidence < 0.6);
            
            // Auto-apply high confidence mappings
            aiGeneratedMapping = {};
            highConfidenceMappings.forEach((m: AIMapping) => {
              aiGeneratedMapping[m.header] = m.field;
              trackedChanges.push({
                type: 'mapping',
                field: m.field,
                from: 'unmapped',
                to: m.header,
                reason: `AI auto-mapped with ${(m.confidence * 100).toFixed(1)}% confidence`
              });
            });
            
            // Add warnings for medium confidence mappings
            mediumConfidenceMappings.forEach((m: AIMapping) => {
              modelIssues.push({
                code: 'MAPPING_AMBIGUOUS',
                severity: 'warn',
                message: `Header "${m.header}" has moderate confidence (${(m.confidence * 100).toFixed(1)}%) for field "${m.field}"`,
                suggestion: m.alternatives && m.alternatives.length > 0 
                  ? `Consider alternatives: ${m.alternatives.join(', ')}`
                  : 'Review mapping accuracy',
                column: m.header
              });
            });
            
            // Add errors for low confidence mappings
            lowConfidenceMappings.forEach((m: AIMapping) => {
              modelIssues.push({
                code: 'MAPPING_UNCLEAR',
                severity: 'error',
                message: `Header "${m.header}" has low confidence (${(m.confidence * 100).toFixed(1)}%) for field "${m.field}"`,
                suggestion: 'Manual mapping required - header meaning is unclear',
                column: m.header
              });
            });
            
            logInfo(requestId, 'AI confidence-based mapping processed', scrubPII({ 
              highConfidence: highConfidenceMappings.length,
              mediumConfidence: mediumConfidenceMappings.length,
              lowConfidence: lowConfidenceMappings.length,
              autoApplied: Object.keys(aiGeneratedMapping).length
            }));
          }
          
          // Store AI analysis results for enhanced UI display
          aiMappingsData = aiResponse.mapping || [];
          aiStatusMap = aiResponse.statusMap || {};
          aiDateRules = aiResponse.dateRules || {};
          aiColumnQuality = aiResponse.columnQuality || {};
        }
      } catch (e) {
        logInfo(requestId, 'Failed to parse model JSON, continuing with deterministic analysis', scrubPII({ 
          error: e, 
          rawOutput: outText.slice(0, 200) 
        }));
        modelIssues.push({
          code: 'MODEL_PARSE_ERROR',
          severity: 'warn',
          message: 'AI analysis failed, using basic validation only',
          suggestion: 'Reduce data complexity or try again.'
        });
      }
    }
    
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError' || err.code === 'ABORT_ERR';
    
    logInfo(requestId, 'OpenAI call failed, continuing with deterministic analysis', scrubPII({ 
      error: err.message,
      status: err?.status,
      isTimeout
    }));
    modelIssues.push({
      code: isTimeout ? 'MODEL_TIMEOUT' : 'MODEL_ERROR',
      severity: 'warn',
      message: isTimeout ? 'AI analysis timed out, using basic validation' : 'AI analysis unavailable, using basic validation',
      suggestion: 'Check your data format and try again.'
    });
  }
  
  // ---------- Final validation pass on normalized loads ----------
  const finalValidationIssues = validateFinalLoads(normalizedLoads);
  
  // ---------- Combine all issues ----------
  const allIssues = [...columnIssues, ...ambiguityIssues, ...validationIssues, ...modelIssues, ...finalValidationIssues];
  const errorCount = allIssues.filter(i => i.severity === 'error').length;
  const totalLatencyMs = Date.now() - startTime;
  
  // Apply PII scrubbing to logs
  logDebug(requestId, 'Sample analysis completed', {
    rowsAnalyzed: rowsSafe.length,
    modelSampleSize: Math.min(3, rowsSafe.length),
    issues: scrubPII(allIssues.slice(0, 2).map(i => ({ code: i.code, severity: i.severity })))
  });
  
  // Determine final result
  const hasErrors = errorCount > 0;
  const hasLoads = normalizedLoads.length > 0;
  
  // If no errors but no loads, that's still a failure
  const finalOk = !hasErrors && hasLoads;
  
  if (!hasErrors && !hasLoads) {
    allIssues.push({
      code: 'NO_VALID_LOADS',
      severity: 'error',
      message: 'No valid loads found after validation',
      suggestion: 'Check your data for required fields and correct formats.'
    });
  }
  
  // Include status values for UI filter chips when VOCAB_STATUS warning is present
  const hasVocabStatusWarning = allIssues.some(issue => issue.code === 'VOCAB_STATUS');
  const statusValuesArray = hasVocabStatusWarning ? Array.from(detectedStatusValues) : undefined;

  // Changes and auto-fixes are extracted during AI response processing above

  const result: AnalysisResult = {
    ok: finalOk,
    issues: allIssues.slice(0, 100), // Cap issues
    loads: finalOk ? normalizedLoads : undefined,
    mapping: Object.keys(aiGeneratedMapping).length > 0 ? aiGeneratedMapping : mapping,
    mappingMeta: {
      split: Object.keys(splitMappings).length > 0 ? splitMappings : undefined,
      ambiguities: ambiguities.length ? ambiguities : undefined,
      hmacEnabled: !!HMAC_SECRET && hmacValidationResult,
      aiGenerated: Object.keys(aiGeneratedMapping).length > 0
    },
    changes: trackedChanges.length > 0 ? trackedChanges : undefined,
    autoFixes: autoFixes.length > 0 ? autoFixes : undefined,
    // Enhanced AI fields for UI display  
    aiMappings: aiMappingsData.length > 0 ? aiMappingsData : undefined,
    aiAutoFixes: autoFixes.length > 0 ? autoFixes.map(fix => ({
      type: 'fix' as const,
      description: fix.description || fix.rule || 'Data normalization',
      field: fix.field,
      rowsAffected: fix.rowsAffected || 0,
      preview: fix.preview || fix.to || 'See changes',
      rule: fix.rule
    })) : undefined,
    aiChanges: trackedChanges.length > 0 ? trackedChanges.map(change => ({
      type: change.type || 'data' as const,
      field: change.field,
      from: change.from || change.original || '',
      to: change.to || change.transformed || '',
      reason: change.reason || change.explanation || 'Data transformation',
      row: change.row
    })) : undefined,
    aiResponse: Object.keys(aiGeneratedMapping).length > 0 ? {
      service: 'AI-Powered' as const,
      aiExplanation: aiExplanation || 'AI automatically mapped columns using semantic analysis',
      statusMap: aiStatusMap,
      dateRules: aiDateRules,  
      columnQuality: aiColumnQuality
    } : undefined,
    meta: {
      analyzedRows: rowsSafe.length,
      analyzedAt: nowIso(),
      modelLatencyMs: Date.now() - modelStartTime,
      totalLatencyMs,
      requestId,
      modelSampleRows: rowsSafe.length,
      statusValues: statusValuesArray,
      hmacDisabled: !HMAC_SECRET || !hmacValidationResult,
      aiExplanation: aiExplanation || (Object.keys(aiGeneratedMapping).length > 0 ? 'AI automatically mapped columns using semantic analysis' : undefined),
      service: Object.keys(aiGeneratedMapping).length > 0 ? 'AI-Powered' : 'Manual',
      // Enhanced meta for AI analysis
      confidence: aiMappingsData.length > 0 ? 
        aiMappingsData.reduce((sum, m) => sum + m.confidence, 0) / aiMappingsData.length 
        : undefined,
      mappingMeta: Object.keys(aiGeneratedMapping).length > 0 ? {
        aiMappings: aiMappingsData,
        changes: trackedChanges,
        autoFixes: autoFixes
      } : undefined
    }
  };
  
  // Only include loads if ok=true
  if (result.ok) {
    result.loads = normalizedLoads;
  }
  
  logInfo(requestId, 'Analysis completed', scrubPII({
    ok: result.ok,
    issueCount: result.issues.length,
    errorCount: result.issues.filter(i => i.severity === 'error').length,
    loadCount: normalizedLoads.length,
    modelSampleRows: Math.min(3, rowsSafe.length),
    totalLatencyMs,
    hasHMACValidation: !!HMAC_SECRET,
    hmacValidationPassed: hmacValidationResult
  }));
  
  // Log first few issue codes for debugging (with PII scrubbing)
  if (result.issues.length > 0) {
    const issueCodes = result.issues.slice(0, 2).map(i => ({ code: i.code, severity: i.severity }));
    logDebug(requestId, 'Issue codes sample', scrubPII(issueCodes));
  }
  
  return json(result, res, 200);
}

// ---------- Helper for UI Preview Payload ----------
function buildPreviewPayload(loads: Load[]) {
  return { source: 'sheets-addon', version: 1, loads };
}

// ---------- Exported Helpers for Unit Testing (CI) ----------
// Export key functions for comprehensive unit testing and client HMAC generation
export {
  parseAndNormalizeDate,
  isValidISODateTime,
  canonicalizeStatus,
  normalizeToCanonicalISO,
  buildPreviewPayload,
  stableStringify // For clients to generate consistent HMAC signatures
};

// Note: Types Load, Issue, AnalysisRequest, AnalysisResult already exported above