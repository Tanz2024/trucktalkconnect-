import { createHmac } from 'crypto';

interface RequestBody {
  model?: string;
  messages?: any[];
  temperature?: number;
}

interface Request {
  method?: string;
  headers: { [key: string]: string | string[] | undefined };
  body?: RequestBody;
}

interface Response {
  status(statusCode: number): Response;
  json(object: any): Response;
  setHeader(name: string, value: string): void;
  end(): void;
}

const ALLOWED_MODELS = new Set([
  'gpt-4o-mini',
  'gpt-4o-mini-latest', 
  'gpt-4o-mini-2024-07-18'
]);

function verifyHmac(secret: string, body: string, signature: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(body);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  return expectedSignature === signature;
}

export default async function handler(req: Request, res: Response) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // HMAC validation if secret is configured
  const hmacSecret = process.env.HMAC_SECRET;
  if (hmacSecret) {
    const signature = req.headers['x-signature'] as string;
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    const rawBody = JSON.stringify(req.body);
    if (!verifyHmac(hmacSecret, rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const { model, messages, temperature } = req.body || {};

  // Validate required fields
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages array' });
  }

  // Validate model
  if (!model || !ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: 'Invalid or unsupported model' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, messages, temperature })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed' });
  }
}
