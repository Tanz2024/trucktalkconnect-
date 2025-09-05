# TruckTalk Connect - Google Sheets Add-on

A smart Google Sheets add-on that analyzes trucking loads data and converts it into structured JSON for TruckTalk's AI Agent.

## 🚛 Overview

TruckTalk Connect helps small carriers using Google Sheets as a lightweight TMS by:
- **Analyzing spreadsheet structure** and detecting issues
- **Validating load data** with AI-powered insights  
- **Converting data** to structured JSON format
- **Providing actionable suggestions** for data quality improvements

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Google Sheets  │    │   Vercel API     │    │   OpenAI API    │
│    Add-on       │───▶│   (ai.ts)        │───▶│  (Analysis)     │
│   (Sidebar)     │    │  Proxy Service   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
├── api/
│   └── ai.ts                 # Vercel serverless function for AI analysis
├── google-apps-script/
│   ├── appsscript.json      # Apps Script manifest
│   ├── code.js              # Main Google Apps Script functions
│   └── sidebar.html         # Sidebar UI for the add-on
├── package.json             # Node.js dependencies
├── index.html              # Landing page for the API
└── README.md               # This file
```

## 🚀 Deployment

### 1. Deploy the API Service

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod

# Set environment variables
vercel env add OPENAI_API_KEY
# Enter your OpenAI API key when prompted

# Optional: Add HMAC secret for additional security
vercel env add HMAC_SECRET
# Enter a strong secret string when prompted
```

### 2. Set up Google Apps Script Add-on

1. Go to [script.google.com](https://script.google.com)
2. Create a new project: "TruckTalk Connect"
3. Copy files from `google-apps-script/` directory:
   - Replace `appsscript.json` content
   - Replace `Code.gs` with `code.js` content  
   - Add `sidebar.html` as an HTML file
4. Update the API URL in `code.js`:
   ```javascript
   const TRUCKTALK_API_URL = "https://your-deployment-url.vercel.app/api/ai";
   ```
5. Save and deploy as an add-on

## 📊 Data Model

### Input: Spreadsheet Data
```javascript
{
  headers: ["Load ID", "PU", "DEL", "PU Time", "DEL Time", "Status", "Driver", "Unit", "Broker"],
  rows: [
    ["L001", "Chicago, IL", "Denver, CO", "2025-01-15 08:00 CST", "2025-01-16 14:00 MST", "Rolling", "John Smith", "T001", "ABC Logistics"]
  ],
  environment: { sheetTimezone: "America/Chicago" }
}
```

### Output: Analysis Result
```typescript
{
  ok: boolean;
  issues: Array<{
    code: string;              // MISSING_COLUMN, BAD_DATE_FORMAT, etc.
    severity: 'error'|'warn';
    message: string;
    rows?: number[];
    column?: string;
    suggestion?: string;
  }>;
  loads?: Load[];              // Structured load data (when ok=true)
  mapping: Record<string,string>; // Header→field mapping
  meta: { analyzedRows: number; analyzedAt: string; };
}
```

### Load Data Schema
```typescript
type Load = {
  loadId: string;
  fromAddress: string;
  fromAppointmentDateTimeUTC: string; // ISO 8601
  toAddress: string;
  toAppointmentDateTimeUTC: string;   // ISO 8601
  status: string;
  driverName: string;
  driverPhone?: string;
  unitNumber: string;
  broker: string;
};
```

## 🔍 Header Mapping

The system recognizes these header synonyms (case-insensitive):

| Field | Synonyms |
|-------|----------|
| `loadId` | Load ID, Ref, VRID, Reference, Ref # |
| `fromAddress` | From, PU, Pickup, Origin, Pickup Address |
| `fromAppointmentDateTimeUTC` | PU Time, Pickup Appt, Pickup Date/Time |
| `toAddress` | To, Drop, Delivery, Destination |
| `toAppointmentDateTimeUTC` | DEL Time, Delivery Appt, Delivery Date/Time |
| `status` | Status, Load Status, Stage |
| `driverName` | Driver, Driver Name |
| `driverPhone` | Phone, Driver Phone, Contact |
| `unitNumber` | Unit, Truck, Truck #, Tractor |
| `broker` | Broker, Customer, Shipper |

## ✅ Validation Rules

### Errors (Must Fix)
- **MISSING_COLUMN**: Required field has no mapped column
- **DUPLICATE_ID**: LoadId appears multiple times  
- **BAD_DATE_FORMAT**: Datetime not parseable
- **EMPTY_REQUIRED_CELL**: Required field is empty

### Warnings (Recommended Fixes)
- **NON_ISO_OUTPUT**: Datetime converted from non-ISO format
- **INCONSISTENT_STATUS**: Status values need normalization
- **FUTURE_DATE**: Load date is in the future

## 🧪 Testing

### Test the API directly:
```bash
curl -X POST https://your-deployment-url.vercel.app/api/ai \
  -H "Content-Type: application/json" \
  -d '{
    "headers": ["Load ID", "PU", "DEL", "Status"],
    "rows": [["L001", "Chicago", "Denver", "Rolling"]],
    "environment": {"sheetTimezone": "America/Chicago"}
  }'
```

### Test in Google Sheets:
1. Open the TruckTalk Connect add-on
2. Click "Test with Sample Data"
3. Review analysis results
4. Copy loads JSON for export

## 🔐 Security

- **API Key Protection**: OpenAI key stored securely in Vercel environment
- **HMAC Authentication**: Optional signature verification for API calls
- **CORS Configuration**: Proper cross-origin request handling
- **Input Validation**: Comprehensive payload validation

## 📝 Usage Flow

1. **Open Add-on** → TruckTalk Connect sidebar appears
2. **Analyze Sheet** → Click "Analyze Current Tab"  
3. **Review Issues** → Fix data quality problems if any
4. **Export Data** → Copy structured JSON for TruckTalk integration
5. **Preview Push** → See payload format before sending

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Run local development server
vercel dev

# Test with sample data
node test-api.js
```

### Environment Variables
```bash
OPENAI_API_KEY=sk-proj-...    # Required: Your OpenAI API key
HMAC_SECRET=your-secret       # Optional: For request signature verification
```

## 📋 Sample Data

Test with this sample spreadsheet structure:
```
| Load ID | PU          | DEL         | PU Time              | DEL Time             | Status     | Driver     | Unit | Broker        |
|---------|-------------|-------------|----------------------|----------------------|------------|------------|------|---------------|
| L001    | Chicago, IL | Denver, CO  | 2025-01-15 08:00 CST | 2025-01-16 14:00 MST | Rolling    | John Smith | T001 | ABC Logistics |
| L002    | Dallas, TX  | Phoenix, AZ | 2025-01-17 09:00     | 2025-01-18 15:00     | Dispatched | Jane Doe   | T002 | XYZ Freight   |
```

## 🤝 Support

For issues or questions:
1. Check the analysis results for specific error messages
2. Verify your spreadsheet has proper headers and data format
3. Ensure the API service is deployed and accessible
4. Review the console logs in Google Apps Script editor

## 📄 License

MIT License - see LICENSE file for details.
