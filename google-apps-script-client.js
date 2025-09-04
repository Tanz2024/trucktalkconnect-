/**
 * OpenAI Proxy Client for Google Apps Script
 * Replace YOUR_PROXY_URL with your actual Vercel deployment URL
 */

const PROXY_URL = "https://trucktalkconnect.vercel.app/api/ai";

/**
 * Main function to call OpenAI via your proxy
 * @param {string} userMessage - The message to send to AI
 * @param {string} model - Optional: specify model (defaults to gpt-4o-mini)
 * @param {number} temperature - Optional: creativity level 0-1 (defaults to 0.7)
 * @returns {string} AI response
 */
function askAI(userMessage, model = "gpt-4o-mini", temperature = 0.7) {
  try {
    const payload = {
      model: model,
      temperature: temperature,
      messages: [
        {
          role: "user",
          content: userMessage
        }
      ]
    };
    
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(PROXY_URL, options);
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`API Error: ${response.getResponseCode()} - ${response.getContentText()}`);
    }
    
    const data = JSON.parse(response.getContentText());
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return `Error: ${error.message}`;
  }
}

/**
 * Advanced function for conversation with context
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} model - Optional: specify model
 * @param {number} temperature - Optional: creativity level
 * @returns {string} AI response
 */
function chatWithContext(messages, model = "gpt-4o-mini", temperature = 0.7) {
  try {
    const payload = {
      model: model,
      temperature: temperature,
      messages: messages
    };
    
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(PROXY_URL, options);
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`API Error: ${response.getResponseCode()} - ${response.getContentText()}`);
    }
    
    const data = JSON.parse(response.getContentText());
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return `Error: ${error.message}`;
  }
}

// ============== EXAMPLE USAGE FUNCTIONS ==============

/**
 * Simple test function
 */
function testBasicCall() {
  const result = askAI("Hello! Can you help me with a quick test?");
  console.log("AI Response:", result);
  return result;
}

/**
 * Example: Analyze Google Sheets data
 */
function analyzeSheetData() {
  // Get data from active sheet
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Convert to string for AI analysis
  const dataString = data.map(row => row.join(", ")).join("\n");
  
  const prompt = `Analyze this data and provide insights:\n\n${dataString}`;
  const analysis = askAI(prompt);
  
  console.log("Data Analysis:", analysis);
  return analysis;
}

/**
 * Example: Email assistant
 */
function generateEmail(topic, tone = "professional") {
  const prompt = `Write a ${tone} email about: ${topic}`;
  const email = askAI(prompt);
  
  console.log("Generated Email:", email);
  return email;
}

/**
 * Example: Conversation with context
 */
function conversationExample() {
  const messages = [
    { role: "system", content: "You are a helpful assistant for data analysis." },
    { role: "user", content: "I have sales data I need to analyze." },
    { role: "assistant", content: "I'd be happy to help analyze your sales data. What specific aspects would you like me to focus on?" },
    { role: "user", content: "I want to understand trends and patterns." }
  ];
  
  const response = chatWithContext(messages);
  console.log("Conversation Response:", response);
  return response;
}
