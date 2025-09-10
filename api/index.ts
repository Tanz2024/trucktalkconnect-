
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    message: 'TruckTalk Connect API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      analysis: '/api/ai',
      docs: 'https://github.com/Tanz2024/trucktalkconnect-'
    },
    timestamp: new Date().toISOString()
  });
}
