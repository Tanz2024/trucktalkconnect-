# TruckTalk Connect - Advanced Features Implementation

## Overview

Beyond the core analysis functionality, TruckTalk Connect includes three advanced features that make it even more useful for logistics operations:

1. **One-way sync**: A "Push to TruckTalk" button that would send validated load data to TruckTalk's platform
2. **Auto-fixes**: Automatically detect and fix common data problems like missing columns and inconsistent date formats
3. **Organization profile**: Save broker name mappings and timezone preferences for your organization

These features were built to address real-world needs we've seen from logistics companies using spreadsheets.

## One-way Sync (Push to TruckTalk)

### What it does
When you have clean, validated load data, you can push it directly to TruckTalk's platform with one click. The button is only enabled when your analysis is successful and you have valid loads.

### How it works
- A "Push to TruckTalk" button appears in the Results tab
- Clicking it shows a confirmation dialog with a summary of what will be sent
- The system packages your load data into the format TruckTalk expects
- Currently implements a stub endpoint for testing, but ready for production integration

### Implementation details
The backend function `pushToTruckTalkPlatform()` in Code.gs handles the data transfer:

```javascript
// Current implementation (stub for testing)
function pushToTruckTalkPlatform(analysisData) {
  // In production, this would make a real API call:
  // var response = UrlFetchApp.fetch('https://api.trucktalk.com/v1/loads', {
  //   method: 'POST',
  //   headers: {'Authorization': 'Bearer ' + getTruckTalkApiKey()},
  //   payload: JSON.stringify(payload)
  // });
  
  return { success: true, pushedLoads: analysisData.loads.length };
}
```

The payload structure is designed to match TruckTalk's expected format:
```javascript
{
  source: 'sheets-addon',
  version: 1,
  timestamp: '2025-09-07T12:00:00Z',
  loads: [...],  // Your validated load objects
  meta: {
    totalLoads: 5,
    generatedBy: 'TruckTalk Connect',
    sheetName: 'Sheet1'
  }
}
```

### Production deployment
To make this live in production:
1. Replace the stub endpoint with TruckTalk's actual API URL
2. Add proper API key management
3. Implement error handling for network issues
4. Add retry logic for failed requests

## Auto-fixes

### What it does
Instead of just telling you about data problems, the system can automatically fix many common issues:

- **Missing columns**: Adds required columns to your spreadsheet
- **Date normalization**: Converts dates to ISO 8601 UTC format
- **Status standardization**: Normalizes status values to standard terms

### How it works
After analysis, if fixable issues are found, an "Auto-Fix Issues" button appears. Clicking it opens a dialog where you can choose which fixes to apply:

- Missing Columns: Shows which columns need to be added
- Date Format Issues: Option to normalize all dates to ISO format  
- Status Vocabulary: Option to standardize status terms

### Real examples from our test data
**Before auto-fix:**
```
PU date: Aug 24, 2025
PU time: 11:00 AM
Status: plan
```

**After auto-fix:**
```
fromAppointmentDateTimeUTC: 2025-08-24T03:00:00Z
status: Planned
```

### Implementation
The `applyAutoFixes()` function handles the actual fixes:

```javascript
function applyAutoFixes(fixes) {
  // Add missing columns
  fixes.missingColumns.forEach(function(columnName) {
    addMissingColumn(columnName, sheet.getLastColumn() + 1);
  });
  
  // Normalize dates using the sheet's timezone
  if (fixes.normalizeDates) {
    normalizeDateColumns();
  }
  
  // Standardize status values
  if (fixes.normalizeStatus) {
    normalizeStatusColumn();
  }
}
```

## Organization Profile

### What it does
Saves organization-specific settings so you don't have to configure them every time:

- **Broker name mappings**: Map variations like "ABC Transport" to "ABC Logistics"
- **Default timezone**: Set your organization's timezone (defaults to Malaysia Time)
- **Custom field mappings**: Save preferred column name mappings

### How it works
Click the settings gear icon in the header to open the organization profile dialog. Here you can:

1. Add broker mappings by entering original name → standard name
2. Select your default timezone from common Southeast Asian options
3. Save the profile, which persists across all your spreadsheets

### Real example
If your drivers sometimes write "Pos Malaysia" and sometimes "Pos Malaysia Berhad", you can map both to a single standard name. The system will automatically apply this mapping during analysis.

### Data storage
Settings are stored using Google Apps Script's Properties Service:
```javascript
function saveOrgProfile(profile) {
  var props = PropertiesService.getUserProperties();
  props.setProperty('orgProfile', JSON.stringify(profile));
}
```

This means each user has their own profile that persists across sessions.

## Testing the Features

### Test auto-fix
1. Create a spreadsheet with missing required columns
2. Add dates in various formats like "Sep 24, 2025" or "24/09/2025 2:30 PM"  
3. Add status values like "plan", "in transit", "complete"
4. Run analysis, then click "Auto-Fix Issues" to see the fixes applied

### Test push to TruckTalk
1. Make sure your analysis is successful with valid loads
2. Look for the "Push to TruckTalk" button in the Results tab
3. Click it and confirm in the dialog
4. Check the console logs to see the payload that would be sent

### Test organization profile
1. Click the settings gear icon in the header
2. Add a broker mapping like "ABC Transport" → "ABC Logistics"
3. Change the default timezone if needed
4. Save the profile
5. Future analyses will automatically apply these settings

## Files Modified

The advanced features required changes to several files:

**Code.gs**: Added backend functions for auto-fixes, push functionality, and profile management
**ui.html**: Added new buttons and dialogs for the advanced features  
**ui_js.html**: Added JavaScript to handle the new UI interactions
**ui_css.html**: Styled the new interface elements

## Production Considerations

### For one-way sync
- Replace the stub endpoint with TruckTalk's real API
- Add proper API key management and rotation
- Implement comprehensive error handling
- Add logging for audit trails

### For auto-fixes  
- Test thoroughly with various date formats found in real data
- Add more status vocabulary mappings based on user feedback
- Consider adding undo functionality for fixes
- Add validation to prevent data loss

### For organization profiles
- Consider admin-level settings for organization-wide defaults
- Add import/export functionality for sharing profiles
- Implement team-level profiles for larger organizations

All three features are fully implemented and ready for testing. The stub implementations make it easy to see how they work without requiring external API access.
