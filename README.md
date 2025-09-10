# TruckTalk Connect

TruckTalk Connect is a comprehensive logistics data management solution that transforms how trucking companies handle their spreadsheet data. It combines AI-powered analysis with seamless Google Sheets integration to validate, standardize, and export logistics data.

## Architecture

This repository contains two integrated components that work together:

### Vercel API Service
The backend AI analysis service deployed on Vercel that processes logistics data, validates formats, and provides intelligent suggestions for data cleanup.

### Google Apps Script Add-on
A Google Sheets sidebar add-on that provides an intuitive interface for users to analyze their logistics data directly within their spreadsheets.

## Setup

### Prerequisites
- Node.js 18 or higher
- Google account with Google Sheets access
- Vercel account (for API deployment)
- Google Apps Script access

### Vercel API Setup
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Add your OpenAI API key and other configurations
   ```
4. Run locally:
   ```bash
   npm run dev
   ```
5. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

### Google Apps Script Add-on Setup
1. Install Google Apps Script CLI:
   ```bash
   npm install -g @google/clasp
   ```
2. Login to Google:
   ```bash
   clasp login
   ```
3. Navigate to the add-on folder:
   ```bash
   cd trucktalk-gas
   ```
4. Deploy to Google Apps Script:
   ```bash
   clasp push
   ```
5. Open Google Sheets and find TruckTalk Connect in the Extensions menu

## Required Scopes

### Vercel API Scopes
- OpenAI API access for data analysis
- HTTPS requests from Google Apps Script clients
- CORS enabled for browser requests

### Google Apps Script Scopes
The add-on requires these Google permissions:
- `https://www.googleapis.com/auth/spreadsheets.currentonly` - Read and modify the current spreadsheet
- `https://www.googleapis.com/auth/script.external_request` - Make API calls to the Vercel service
- `https://www.googleapis.com/auth/script.container.ui` - Display sidebar interface

These permissions are automatically requested when users first install the add-on.

## How to Run

### For End Users
1. Open your Google Sheets document containing logistics data
2. Go to Extensions > TruckTalk Connect > Open TruckTalk Connect
3. Click "Analyze current tab" to start the AI analysis
4. Review the results in the Results tab:
   - View validation errors and warnings
   - See AI-suggested header mappings
   - Review auto-fix recommendations
5. Apply suggested fixes or make manual corrections
6. Copy the standardized JSON data for integration with other systems

### For Developers
1. **API Development**: Use `npm run dev` to run the Vercel API locally
2. **Add-on Development**: Use `clasp push` to deploy changes to Google Apps Script
3. **Testing**: Test with sample logistics data before production use

### Expected Data Format
Your spreadsheet should include logistics data with columns such as:
- Load ID or reference number
- Pickup address and appointment time
- Delivery address and appointment time
- Driver name and contact information
- Load status and tracking information
- Broker or customer details

The AI will automatically map your existing column headers to standardized field names.

## Limitations

### Technical Limitations
- **Processing Speed**: Large datasets (over 1000 rows) may take several minutes to process
- **Internet Dependency**: Both AI analysis and real-time validation require active internet connection
- **API Rate Limits**: OpenAI API usage is subject to rate limiting and may slow down with heavy usage
- **Browser Compatibility**: Optimized for Chrome and Edge browsers, limited functionality in Safari and Firefox
- **Mobile Support**: Basic mobile browser support only, desktop experience recommended

### Data Limitations
- **Structured Data Only**: Works best with tabular logistics data, cannot process unstructured text or images
- **Header Recognition**: AI mapping works well with common logistics terminology but may struggle with highly customized or abbreviated headers
- **Data Types**: Some complex Excel formulas and formatting may not translate perfectly
- **Volume Limits**: Google Apps Script has execution time limits that may affect very large datasets

### Functional Limitations
- **Manual Review Required**: All AI suggestions require human approval before being applied to data
- **Single Sheet Processing**: Can only analyze one spreadsheet tab at a time
- **No Real-time Collaboration**: Analysis should be performed by one user at a time
- **Backup Recommended**: Always keep backups of original data before applying automated fixes

### Security and Privacy
- **Data Processing**: Logistics data is sent to OpenAI for analysis, ensure compliance with your data privacy requirements
- **Google Permissions**: Add-on requires broad spreadsheet access permissions
- **Network Security**: All API communications use HTTPS encryption

## File Structure

```
trucktalkconnect/
├── api/                    # Vercel serverless functions
│   └── ai.ts              # Main AI analysis endpoint
├── public/                # Static assets for Vercel
├── trucktalk-gas/         # Google Apps Script add-on
│   ├── Code.gs           # Server-side Google Apps Script functions
│   ├── ui.html           # Sidebar HTML structure
│   ├── ui_js.html        # Client-side JavaScript
│   ├── ui_css.html       # Styling and CSS
│   ├── appsscript.json   # Google Apps Script configuration
│   └── .clasp.json       # CLASP deployment settings
├── package.json           # Node.js dependencies and scripts
├── vercel.json           # Vercel deployment configuration
└── tsconfig.json         # TypeScript configuration
```

## Troubleshooting

### Common Issues
- **Add-on not appearing**: Check that Google Apps Script is enabled and the script is properly authorized
- **Analysis fails**: Verify internet connection and try with a smaller dataset
- **Slow performance**: Large datasets may require breaking into smaller chunks for processing
- **Permission errors**: Re-authorize the add-on in Google Sheets if permissions were revoked

### Getting Help
- Check browser console for detailed error messages
- Review the analysis results panel for specific data validation issues
- Ensure your data follows the expected logistics data format
- Verify that all required API keys and configurations are properly set

## Development

### Local Development
1. **API Changes**: Make changes to files in `/api` and test with `npm run dev`
2. **Add-on Changes**: Modify files in `/trucktalk-gas` and deploy with `clasp push`
3. **Testing**: Use sample data to test all functionality before production deployment

### Deployment
- **Vercel API**: Automatically deploys when pushing to the main branch
- **Google Apps Script**: Manual deployment using `clasp push` from the `trucktalk-gas` directory

## License

MIT License - This project is open source and available under the MIT License.