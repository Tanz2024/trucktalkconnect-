# OpenAI Proxy

A minimal serverless OpenAI proxy for Vercel that protects your API key.

## Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy to Vercel:
```bash
vercel --prod
```

3. Set environment variables:
```bash
vercel env add OPENAI_API_KEY
# Enter your OpenAI API key when prompted

# Optional: Add HMAC secret for additional security
vercel env add HMAC_SECRET
# Enter a strong secret string when prompted
```

4. Redeploy to apply environment variables:
```bash
vercel --prod
```

## Testing

Replace `your-deployment-url` with your actual Vercel deployment URL:

```bash
curl -X POST https://your-deployment-url/api/ai \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "messages": [
      {
        "role": "user", 
        "content": "Hello, world!"
      }
    ]
  }'
```

## Security Features

- **Model Validation**: Only allows approved GPT-4o-mini models
- **CORS**: Configured for cross-origin requests
- **HMAC Authentication** (optional): If `HMAC_SECRET` is set, validates request signatures via `X-Signature` header
