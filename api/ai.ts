// /api/ai.ts (Vercel serverless) – accepts Sheets snapshot payload and returns strict JSON
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import OpenAI from 'openai';

const ALLOWED_MODELS = new Set([
  'gpt-4o-mini',
  'gpt-4o-mini-latest',
  'gpt-4o-mini-2024-07-18',
]);

function verifyHmac(secret: string, raw: string, sig: string | undefined) {
  if (!sig) return false;
  const h = createHmac('sha256', secret).update(raw).digest('hex');
  return sig === `sha256=${h}`;
}

function extractJson(txt: string): any | null {
  if (!txt) return null;
  // fenced
  const m = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m?.[1]) { try { return JSON.parse(m[1]); } catch {} }
  // object
  const s1 = txt.indexOf('{'), e1 = txt.lastIndexOf('}');
  if (s1 !== -1 && e1 > s1) { try { return JSON.parse(txt.slice(s1, e1 + 1)); } catch {} }
  // array
  const s2 = txt.indexOf('['), e2 = txt.lastIndexOf(']');
  if (s2 !== -1 && e2 > s2) { try { return JSON.parse(txt.slice(s2, e2 + 1)); } catch {} }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  // Raw body for HMAC (Vercel already parsed req.body; rebuild raw)
  const rawBody = JSON.stringify(req.body || {});
  const hmacSecret = process.env.HMAC_SECRET;
  if (hmacSecret) {
    const sig = req.headers['x-signature'] as string | undefined;
    if (!sig) return res.status(401).json({ error: 'Missing signature' });
    if (!verifyHmac(hmacSecret, rawBody, sig)) return res.status(401).json({ error: 'Invalid signature' });
  }

  // Snapshot payload from Apps Script
  const {
    // app payload
    headers,
    rows,
    knownSynonyms,
    headerOverrides,
    environment,
    expectations,
    returnContract,
    note,
    __system,
    // (optional) override model/temperature
    model,
    temperature,
  } = req.body || {};

  // Build the system prompt
  const systemPrompt =
    __system ||
    [
      'You convert a 2D table of logistics loads into a typed JSON array and a list of validation issues.',
      'Never invent data. Unknowns stay empty and are flagged.',
      'Normalize all datetimes to ISO 8601 UTC.',
      'If a datetime is naive (no zone/offset), ASSUME sheetTimezone from environment and convert to UTC.',
      'Return ONLY JSON strictly as { ok, issues[], loads[], mapping, meta }.',
    ].join(' ');

  // Extra guardrail so naive times become warnings, not errors
  const guardrails =
    'If a datetime lacks timezone/offset, assume environment.sheetTimezone and convert to UTC. ' +
    'Do NOT mark BAD_DATE_FORMAT only because tz is missing; instead add NON_ISO_INPUT warn and an assumption.';

  const userMsg = JSON.stringify({
    headers,
    rows,
    knownSynonyms,
    headerOverrides,
    environment,
    expectations,
    returnContract,
    note,
    guardrails,
  });

  const client = new OpenAI({ apiKey });

  try {
    const mdl = ALLOWED_MODELS.has(model) ? model : 'gpt-4o-mini';
    const temp = typeof temperature === 'number' ? temperature : 0;

    const chat = await client.chat.completions.create({
      model: mdl,
      temperature: temp,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
    });

    const content = chat.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({ error: 'Model did not return JSON', content });
    }

    // add engine tag for your UI
    parsed.meta = parsed.meta || {};
    parsed.meta.engine = 'proxy';

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(parsed);
  } catch (err: any) {
    console.error('AI endpoint error:', err?.message || err);
    return res.status(500).json({ error: 'AI endpoint failure', detail: String(err?.message || err) });
  }
}
