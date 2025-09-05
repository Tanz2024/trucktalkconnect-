// /api/health.ts - Simple health check endpoint
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TruckTalk Connect API',
    version: '1.0.0',
    environment: {
      node: process.version,
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      hmacConfigured: !!process.env.HMAC_SECRET
    }
  };

  return res.status(200).json(health);
}
