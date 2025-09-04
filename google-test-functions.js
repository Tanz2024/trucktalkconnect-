// Quick Test Functions for Google Apps Script

/**
 * Run this first to test basic connection
 */
function quickTest() {
  console.log("🔄 Testing OpenAI connection...");
  
  const result = askAI("Say 'Hello from Google Apps Script!' if you can hear me.");
  
  console.log("✅ Success! AI Response:", result);
  
  // Also test in a Google Sheet
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.getRange("A1").setValue("AI Test Result:");
    sheet.getRange("B1").setValue(result);
    console.log("✅ Result also written to Google Sheet!");
  } catch (e) {
    console.log("ℹ️  No active sheet, but API connection works!");
  }
  
  return result;
}

/**
 * Test different models
 */
function testModels() {
  const message = "Explain quantum computing in one sentence.";
  
  console.log("🧪 Testing different models...");
  
  // Test each allowed model
  const models = ["gpt-4o-mini", "gpt-4o-mini-latest", "gpt-4o-mini-2024-07-18"];
  
  models.forEach(model => {
    console.log(`\n📝 Testing ${model}:`);
    const result = askAI(message, model);
    console.log(result);
  });
}

/**
 * Integration with Google Sheets example
 */
function sheetIntegration() {
  console.log("📊 Testing Google Sheets integration...");
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Write headers
  sheet.getRange("A1").setValue("Question");
  sheet.getRange("B1").setValue("AI Response");
  sheet.getRange("C1").setValue("Timestamp");
  
  // Ask AI a question
  const question = "What are 3 benefits of using AI in spreadsheets?";
  const answer = askAI(question);
  const timestamp = new Date();
  
  // Write to sheet
  sheet.getRange("A2").setValue(question);
  sheet.getRange("B2").setValue(answer);
  sheet.getRange("C2").setValue(timestamp);
  
  console.log("✅ Data written to sheet!");
  console.log("Question:", question);
  console.log("Answer:", answer);
}
