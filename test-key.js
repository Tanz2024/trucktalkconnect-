// Test script to verify OpenAI API key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-key-here';

async function testOpenAIKey() {
  console.log('🔑 Testing OpenAI API Key...');
  
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-key-here') {
    console.error('❌ No API key provided');
    console.log('Set your key: $env:OPENAI_API_KEY="sk-proj-..."');
    return;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello!' }],
        max_tokens: 10
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API Key is working!');
      console.log('Response:', data.choices[0].message.content);
    } else {
      console.error('❌ API Key error:', data.error.message);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testOpenAIKey();
