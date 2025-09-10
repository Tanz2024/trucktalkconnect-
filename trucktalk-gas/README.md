# TruckTalk Connect - Google Apps Script Add-on

A Google Sheets add-on for logistics data management with AI-powered analysis and validation.

## Setup

### Prerequisites
- Google account
- Google Sheets access
- Node.js and npm (for development)

### Installation
1. Install Google Apps Script CLI
```bash
npm install -g @google/clasp
```

2. Login to Google
```bash
clasp login
```

3. Clone or create new Apps Script project
```bash
clasp create --type sheets --title "TruckTalk Connect"
```

4. Copy the project files to your Apps Script project
5. Push to Google Apps Script
```bash
clasp push
```


## Required Scopes

The add-on needs these permissions:
- `https://www.googleapis.com/auth/spreadsheets.currentonly` - Access current spreadsheet
- `https://www.googleapis.com/auth/script.external_request` - Make external API calls

These are configured in `appsscript.json` and will be requested during first use.

## How to Run

### Basic Usage
1. Open any Google Sheets document with your logistics data
2. Go to Extensions > TruckTalk Connect > Open TruckTalk Connect
3. Click "Analyze current tab" to validate your data
4. Review results in the Results tab
5. Apply suggested fixes or corrections
6. Copy the standardized JSON output

### Data Format
Your spreadsheet should contain logistics data with headers like:
- Load ID
- Pickup address and date
- Delivery address and date  
- Driver name and contact
- Status information

The system will automatically map your headers to standard fields.

## Limitations

### Technical Limitations
- Requires internet connection for AI features
- Processing limited to current spreadsheet tab
- Maximum recommended dataset size is 1000 rows
- Response time depends on data complexity and API availability

### Data Limitations  
- Works best with tabular logistics data
- Complex nested structures not supported
- Some data types may require manual formatting
- AI suggestions need human review before applying

### Browser Support
- Optimized for Chrome and Edge browsers
- Limited functionality in Safari and Firefox
- Basic mobile browser support only

## File Structure

- `Code.gs` - Main backend functions and Google Apps Script integration
- `ui.html` - User interface structure and layout
- `ui_js.html` - Frontend JavaScript and interaction logic  
- `ui_css.html` - Styling and visual design
- `appsscript.json` - Project configuration and required permissions
- `.clasp.json` - CLASP deployment configuration

## Development

### Local Development
Use CLASP to sync changes between local files and Google Apps Script:
```bash
clasp pull  # Download latest from Apps Script
clasp push  # Upload local changes to Apps Script
```

### Testing
Test with sample data before using production datasets. The add-on includes validation to prevent data corruption.

## License

MIT License
