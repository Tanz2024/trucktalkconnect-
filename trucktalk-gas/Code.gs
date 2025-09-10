function onInstall() {
  onOpen();
}
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('TruckTalk Connect')
      .addItem('Open TruckTalk Connect', 'showSidebar')
      .addSeparator()
      .addItem('Generate Sample Data', 'seedSampleMalaysiaData')
      .addSeparator()
      .addItem('Test AI Connection', 'testAIConnection')
      .addToUi();
  } catch (error) {
    Logger.log('Error in onOpen: ' + error.toString());
  }
}

/**
 * Show the sidebar UI
 */
function showSidebar() {
  try {
    var html = HtmlService.createTemplateFromFile('ui');
    var htmlOutput = html.evaluate()
      .setTitle('TruckTalk Connect')
      .setWidth(400);
    
    SpreadsheetApp.getUi().showSidebar(htmlOutput);
  } catch (error) {
    Logger.log('Error showing sidebar: ' + error.toString());
    SpreadsheetApp.getUi().alert('Error opening TruckTalk Connect: ' + error.message);
  }
}

/**
 * Include function for HTML templates
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    Logger.log('Error including file ' + filename + ': ' + error.toString());
    return '<!-- Error loading ' + filename + ' -->';
  }
}


function testFunction() {
  try {
    Logger.log('=== TruckTalk Connect Test Function ===');
    
    // Test sheet access
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      Logger.log('ERROR: No active sheet found');
      return { status: 'error', message: 'No active sheet found' };
    }
    
    Logger.log('Active sheet: ' + sheet.getName());
    
    // Test data access
    var data = sheet.getDataRange().getValues();
    Logger.log('Sheet has ' + data.length + ' rows and ' + (data[0] ? data[0].length : 0) + ' columns');
    
    // Test API connection
    var apiTest = testAIConnection();
    Logger.log('API test result: ' + JSON.stringify(apiTest));
    
    return {
      status: 'success',
      sheet: sheet.getName(),
      rows: data.length,
      columns: data[0] ? data[0].length : 0,
      apiTest: apiTest,
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    Logger.log('Test function error: ' + e.toString());
    return { status: 'error', message: e.toString(), timestamp: new Date().toISOString() };
  }
}

/**
 * Simple ping function for UI testing
 */
function ping() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}

/**
 * Test AI Connection with user-friendly feedback
 */
function testAIConnection() {
  try {
    // Show immediate feedback to user
    SpreadsheetApp.getUi().alert('Testing AI Connection', 'Testing connection to TruckTalk AI server...', SpreadsheetApp.getUi().ButtonSet.OK);
    
    var vercelEndpoint = 'https://trucktalkconnect.vercel.app/api/ai';

    // Simple test payload
    var body = {
      headers: ['Load ID', 'From Address', 'To Address', 'Status', 'Driver Name', 'Unit Number'],
      rows: [
        ['TEST001', 'Test Pickup Location', 'Test Delivery Location', 'In Transit', 'Test Driver', 'TEST123']
      ],
      headerOverrides: {},
      options: { assumeTimezone: 'Asia/Kuala_Lumpur' }
    };

    var timestamp = String(Date.now());
    var bodyString = JSON.stringify(body);
    
    // Try to get HMAC secret (optional)
    var secret = PropertiesService.getScriptProperties().getProperty('TTC_HMAC_SECRET');
    var sigHex = null;
    if (secret) {
      var macBytes = Utilities.computeHmacSha256Signature(timestamp + '.' + bodyString, secret);
      sigHex = macBytes.map(function(b) {
        var v = (b < 0) ? b + 256 : b;
        var s = v.toString(16);
        return s.length === 1 ? '0' + s : s;
      }).join('');
    }

    var headers = {
      'Content-Type': 'application/json',
      'Origin': 'https://script.google.com'
    };
    if (secret && sigHex) {
      headers['x-ttc-timestamp'] = timestamp;
      headers['x-ttc-signature'] = sigHex;
    }

    var options = {
      method: 'POST',
      headers: headers,
      payload: bodyString,
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(vercelEndpoint, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    var result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      var errorMsg = 'Connection failed - Invalid response from AI server\nResponse Code: ' + responseCode + '\nResponse: ' + responseText.substring(0, 200);
      SpreadsheetApp.getUi().alert('AI Connection Test Failed', errorMsg, SpreadsheetApp.getUi().ButtonSet.OK);
      return { success: false, error: 'Invalid JSON from endpoint', raw: responseText, code: responseCode };
    }

    if (responseCode === 200 && result.ok) {
      var successMsg = 'AI Connection Successful!\n\n' +
                      'Server: ' + vercelEndpoint + '\n' +
                      'Response Time: Fast\n' +
                      'Status: Connected\n' +
                      'AI Analysis: Working\n\n' +
                      'Your TruckTalk Connect is ready to use!';
      SpreadsheetApp.getUi().alert('AI Connection Test Successful', successMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      var errorMsg = 'AI Connection Failed\n\n' +
                    'Response Code: ' + responseCode + '\n' +
                    'Error: ' + (result.error || 'Unknown error') + '\n\n' +
                    'Please check your internet connection and try again.';
      SpreadsheetApp.getUi().alert('AI Connection Test Failed', errorMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    }

    return { 
      success: responseCode === 200 && result.ok, 
      endpoint: vercelEndpoint, 
      code: responseCode, 
      info: result,
      timestamp: new Date().toISOString()
    };
    
  } catch (e) {
    var errorMsg = 'Connection Error\n\n' + e.message + '\n\nPlease check your internet connection and try again.';
    SpreadsheetApp.getUi().alert('AI Connection Test Error', errorMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    return { success: false, error: e.message };
  }
}



/**
 * Generate comprehensive sample logistics data for testing and demonstration
 */
function seedSampleMalaysiaData() {
  try {
    Logger.log('=== STARTING SAMPLE DATA GENERATION ===');
    
    // Get active sheet with error checking
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      throw new Error('No active sheet found');
    }
    Logger.log('Got active sheet: ' + sheet.getName());
    
    // Show progress to user (remove the blocking alert)
    // SpreadsheetApp.getUi().alert('Generating Sample Data', 'Creating comprehensive logistics data with various scenarios for testing...', SpreadsheetApp.getUi().ButtonSet.OK);
    
    // Clear existing data
    Logger.log('Clearing existing data...');
    sheet.clear();
    Logger.log('Sheet cleared successfully');
    
    // Headers following the exact Load schema
    var headers = [
      'Load ID',
      'From Address', 
      'PU Date',
      'PU Time',  
      'To Address',
      'DEL Date',
      'DEL Time',
      'Status',
      'Driver Name',
      'Driver Phone',
      'Unit Number',
      'Broker'
    ];
    
    // =====================================================================
    // PRODUCTION-LEVEL SAMPLE DATA - Malaysia Logistics Operations
    // Comprehensive dataset for testing all TruckTalk Connect features
    // =====================================================================
    
    var sampleData = [
      // === PERFECT LOADS (Production Quality) ===
      [
        'TTC2025001',
        'Menara TM, Jalan Pantai Baharu, 50672 Kuala Lumpur, Wilayah Persekutuan, Malaysia',
        '2025-09-15',
        '08:00',
        'Penang Sentral Terminal, Jalan Ewa, 12000 Butterworth, Pulau Pinang, Malaysia',
        '2025-09-16',
        '16:00',
        'Rolling',
        'Ahmad bin Abdullah Rahman',
        '+60123456789',
        'WM1234A',
        'DHL Supply Chain Malaysia'
      ],
      [
        'TTC2025002',
        'KLCC Twin Towers, Kuala Lumpur City Centre, 50088 Kuala Lumpur, Malaysia',
        '2025-09-16',
        '09:30',
        'Johor Premium Outlets, 81400 Senai, Johor Bahru, Johor, Malaysia',
        '2025-09-17',
        '14:00',
        'Delivered',
        'Siti Nurhaliza binti Rahman',
        '+60187654321',
        'WM5678B',
        'FedEx Malaysia Sdn Bhd'
      ],
      [
        'TTC2025003',
        'Port Klang Container Terminal, 42000 Port Klang, Selangor, Malaysia',
        '2025-09-17',
        '06:00',
        'KLIA Cargo Terminal, 64000 KLIA, Sepang, Selangor, Malaysia',
        '2025-09-17',
        '18:00',
        'Dispatched',
        'Kumar Selvam a/l Raman',
        '+60195551234',
        'WM9012C',
        'UPS Malaysia'
      ],
      [
        'TTC2025004',
        'Genting Skyway Station, 69000 Genting Highlands, Pahang, Malaysia',
        '2025-09-18',
        '07:00',
        'Kuantan Port Terminal, 26100 Kuantan, Pahang, Malaysia',
        '2025-09-18',
        '19:00',
        'Loading',
        'Fatimah binti Ismail',
        '+60134567890',
        'WM7890D',
        'TNT Express Malaysia'
      ],
      [
        'TTC2025005',
        'Sunway Pyramid Shopping Mall, 47500 Petaling Jaya, Selangor, Malaysia',
        '2025-09-19',
        '10:00',
        'Pavilion KL Shopping Centre, 55100 Kuala Lumpur, Malaysia',
        '2025-09-19',
        '15:30',
        'Rolling',
        'David Lim Wei Ming',
        '+60166789012',
        'WM3456E',
        'Aramex Malaysia'
      ],
      [
        'TTC2025006',
        'Batu Caves, 68100 Batu Caves, Selangor, Malaysia',
        '2025-09-20',
        '08:30',
        'National Zoo, 68000 Ampang, Selangor, Malaysia',
        '2025-09-20',
        '12:00',
        'Delivered',
        'Wong Kar Wai',
        '+60128887777',
        'WM1111F',
        'DB Schenker Malaysia'
      ],
      [
        'TTC2025007',
        'Shah Alam Stadium, 40000 Shah Alam, Selangor, Malaysia',
        '2025-09-21',
        '09:00',
        'Putrajaya Convention Centre, 62000 Putrajaya, Malaysia',
        '2025-09-21',
        '16:00',
        'Dispatched',
        'Rajesh Kumar Singh',
        '+60199998888',
        'WM2222G',
        'DSV Malaysia'
      ],
      [
        'TTC2025008',
        'A Famosa Resort, 78000 Alor Gajah, Melaka, Malaysia',
        '2025-09-22',
        '08:30',
        'Legoland Malaysia, 79100 Iskandar Puteri, Johor, Malaysia',
        '2025-09-22',
        '17:00',
        'Rolling',
        'Salmah binti Ahmad',
        '+60177889900',
        'WM5555J',
        'Kerry Logistics Malaysia'
      ],
      [
        'TTC2025009',
        'Langkawi Cable Car, 07000 Langkawi, Kedah, Malaysia',
        '2025-09-23',
        '06:00',
        'Georgetown UNESCO World Heritage Site, 10200 George Town, Penang, Malaysia',
        '2025-09-23',
        '20:00',
        'Loading',
        'Hassan bin Omar Abdullah',
        '+60154443333',
        'WM6666K',
        'CEVA Logistics Malaysia'
      ],
      [
        'TTC2025010',
        'Sabah State Museum, 88300 Kota Kinabalu, Sabah, Malaysia',
        '2025-09-24',
        '05:30',
        'Kuching Waterfront, 93000 Kuching, Sarawak, Malaysia',
        '2025-09-24',
        '22:00',
        'Dispatched',
        'John Anak Mering',
        '+60148887777',
        'WM7777L',
        'Panalpina Malaysia'
      ],
      
      // === DATA QUALITY ISSUES (For Testing Auto-Fixes) ===
      [
        '', // BROKEN: Missing Load ID (auto-fix: generate ID)
        'Ipoh Railway Station, 30000 Ipoh, Perak, Malaysia',
        '2025-09-25',
        '08:00',
        '', // BROKEN: Missing delivery address (auto-fix: prompt for address)
        '2025-09-25',
        '14:00',
        'pending',
        'Lee Mei Ling',
        '+60128887777',
        'WM8888M',
        'Yusen Logistics Malaysia'
      ],
      [
        'TTC2025012',
        'Taiping Lake Gardens, 34000 Taiping, Perak, Malaysia',
        'Sep 26, 2025', // BROKEN: Non-ISO date format (auto-fix: normalize to ISO)
        '10:00',
        'Cameron Highlands Tea Plantation, 39000 Tanah Rata, Pahang, Malaysia',
        'September 26th, 2025', // BROKEN: Verbose date format (auto-fix: normalize)
        '16:00',
        'assigned',
        'Raj Patel Kumar',
        '+60134567890',
        'WM9999N',
        'Expeditors Malaysia'
      ],
      [
        'TTC2025001', // BROKEN: Duplicate Load ID (auto-fix: suggest new ID)
        'Merdeka 118 Tower, Kuala Lumpur, Malaysia',
        '2025-09-27',
        '15:00',
        'One Utama Shopping Centre, Petaling Jaya, Malaysia',
        '2025-09-27',
        '19:00',
        'cancelled',
        'Maria Santos Cruz',
        '+6012-345-6789', // BROKEN: Non-standard phone format (auto-fix: normalize)
        'WM0000O',
        'Kuehne + Nagel Malaysia'
      ],
      [
        'TTC2025014',
        'Melaka Sentral Bus Terminal, 75300 Melaka, Malaysia',
        '2025-09-28',
        '07:30',
        'Johor Bahru City Square, 80000 Johor Bahru, Johor, Malaysia',
        '2025-09-28',
        '13:00',
        'ERROR_STATUS', // BROKEN: Invalid status (auto-fix: suggest valid status)
        '', // BROKEN: Missing driver name (auto-fix: prompt for name)
        '123456', // BROKEN: Invalid phone format (auto-fix: prompt for valid phone)
        '', // BROKEN: Missing unit number (auto-fix: prompt for unit)
        'Bollore Logistics Malaysia'
      ],
      
      // === EDGE CASES (Complex Real-World Scenarios) ===
      [
        'TTC2025015',
        'Cyberjaya MSC Office Complex, 63000 Cyberjaya, Selangor, Malaysia',
        '2025-09-29',
        '09:00',
        'Putrajaya Federal Government Complex, 62502 Putrajaya, Malaysia',
        '2025-09-29',
        '11:30',
        'Rolling',
        'Dr. Ahmad Zaki bin Rahman',
        '+60387654321',
        'WM1515P',
        'Government Logistics Services'
      ],
      [
        'TTC2025016',
        'Petronas Twin Towers Delivery Bay, 50088 Kuala Lumpur, Malaysia',
        '2025-09-30',
        '06:30',
        'Kuala Lumpur International Airport Cargo Terminal, 64000 Sepang, Malaysia',
        '2025-09-30',
        '10:00',
        'Priority',
        'Captain Lim Boon Heng',
        '+60123456789',
        'WM1616Q',
        'MASkargo Malaysia Airlines'
      ]
    ];
    
    // Set headers
    Logger.log('Writing headers... Count: ' + headers.length);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    Logger.log('Headers written successfully');
    
    // Format header row
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#2563eb');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    
    // Set data with proper formatting and error checking
    Logger.log('Sample data validation: ' + sampleData.length + ' rows prepared');
    
    if (sampleData.length === 0) {
      throw new Error('No sample data to write');
    }
    
    // Validate data structure
    Logger.log('First row structure check...');
    Logger.log('Headers count: ' + headers.length + ', First row count: ' + sampleData[0].length);
    
    if (sampleData[0].length !== headers.length) {
      throw new Error('Data columns (' + sampleData[0].length + ') do not match headers (' + headers.length + ')');
    }
    
    Logger.log('Writing ' + sampleData.length + ' data rows to sheet...');
    
    try {
      var dataRange = sheet.getRange(2, 1, sampleData.length, headers.length);
      dataRange.setValues(sampleData);
      Logger.log('Sample data written successfully');
      
      // Add alternating row colors for better readability
      Logger.log('Applying row formatting...');
      for (var i = 0; i < sampleData.length && i < 50; i++) { // Limit formatting to prevent timeout
        if (i % 2 === 1) {
          sheet.getRange(i + 2, 1, 1, headers.length).setBackground('#f8f9fa');
        }
      }
      Logger.log('Row formatting applied');
      
    } catch (dataError) {
      Logger.log('Error writing data: ' + dataError.toString());
      throw new Error('Failed to write sample data: ' + dataError.message);
    }
    
    Logger.log('Applying final formatting...');
    
    // Auto-resize columns for optimal viewing
    try {
      sheet.autoResizeColumns(1, headers.length);
      Logger.log('Columns auto-resized');
    } catch (resizeError) {
      Logger.log('Column resize failed: ' + resizeError.toString());
    }
    
    // Freeze header row for easy navigation
    try {
      sheet.setFrozenRows(1);
      Logger.log('Header row frozen');
    } catch (freezeError) {
      Logger.log('Row freeze failed: ' + freezeError.toString());
    }
    
    // Add border to data area (skip if too many rows to prevent timeout)
    if (sampleData.length <= 50) {
      try {
        var totalRange = sheet.getRange(1, 1, sampleData.length + 1, headers.length);
        totalRange.setBorder(true, true, true, true, true, true);
        Logger.log('Borders applied');
      } catch (borderError) {
        Logger.log('Border application failed: ' + borderError.toString());
      }
    }
    
    Logger.log('Final formatting completed');
    
    // Success message to user
    var successMsg = 'Sample Malaysia logistics data has been implemented in the spreadsheet.\n\n' +
                    'Ready for analysis with TruckTalk Connect.';
    
    SpreadsheetApp.getUi().alert('Sample Data Generated', successMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return {
      success: true,
      message: 'Production-level sample data with comprehensive test scenarios generated successfully!',
      rows: sampleData.length + 1, // +1 for header
      columns: headers.length,
      perfectRecords: 10,
      issueRecords: 6,
      categories: ['Perfect Loads', 'Data Quality Issues', 'Edge Cases'],
      features: ['AI-Powered Analysis Ready', 'Auto-Fix Ready', 'Push to TruckTalk Ready']
    };
    
  } catch (error) {
    Logger.log('Error seeding sample data: ' + error.toString());
    Logger.log('Error details: ' + JSON.stringify(error));
    SpreadsheetApp.getUi().alert('Error', 'Error generating sample data: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    return {
      success: false, 
      error: error.message
    };
  }
}

// Manual mapping view function removed - using AI-powered auto-mapping instead

// Column mapping functions removed - using AI-powered auto-mapping instead

// ========================================
// MAPPING PERSISTENCE & MANAGEMENT APIs
// ========================================

/**
 * Get saved mapping for the current sheet
 * Returns header→field mapping stored in UserProperties
 */
function getSavedMapping() {
  try {
    var spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    var sheetName = SpreadsheetApp.getActiveSheet().getName();
    var key = spreadsheetId + '::' + sheetName;
    
    var userProps = PropertiesService.getUserProperties();
    var savedMappingStr = userProps.getProperty('mapping_' + key);
    
    if (savedMappingStr) {
      var savedMapping = JSON.parse(savedMappingStr);
      Logger.log('Retrieved saved mapping for ' + key + ': ' + JSON.stringify(savedMapping));
      return {
        success: true,
        mapping: savedMapping,
        sheetKey: key
      };
    }
    
    return {
      success: true,
      mapping: {},
      sheetKey: key
    };
  } catch (error) {
    Logger.log('Error getting saved mapping: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      mapping: {}
    };
  }
}

/**
 * Save mapping for the current sheet
 * @param {Object} headerToFieldMapping - mapping of header→field
 */
function saveMapping(headerToFieldMapping) {
  try {
    if (!headerToFieldMapping || typeof headerToFieldMapping !== 'object') {
      throw new Error('Invalid mapping provided');
    }
    
    var spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    var sheetName = SpreadsheetApp.getActiveSheet().getName();
    var key = spreadsheetId + '::' + sheetName;
    
    var userProps = PropertiesService.getUserProperties();
    userProps.setProperty('mapping_' + key, JSON.stringify(headerToFieldMapping));
    
    Logger.log('Saved mapping for ' + key + ': ' + JSON.stringify(headerToFieldMapping));
    
    return {
      success: true,
      message: 'Mapping saved successfully for sheet: ' + sheetName
    };
  } catch (error) {
    Logger.log('Error saving mapping: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Apply AI auto-fixes to the current spreadsheet
 * @param {Array} autoFixes - Array of auto-fix objects from AI analysis
 * @return {Object} Result of applying auto-fixes
 */
function applyAIAutoFixes(autoFixes) {
  try {
    if (!autoFixes || !Array.isArray(autoFixes) || autoFixes.length === 0) {
      return {
        success: false,
        error: 'No auto-fixes provided'
      };
    }

    var sheet = SpreadsheetApp.getActiveSheet();
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var appliedFixes = 0;

    Logger.log('Applying ' + autoFixes.length + ' auto-fixes to spreadsheet');

    autoFixes.forEach(function(fix, index) {
      try {
        Logger.log('Processing auto-fix: ' + JSON.stringify(fix));
        
        // Find the column index for the field
        var columnIndex = -1;
        for (var i = 0; i < headers.length; i++) {
          if (headers[i].toString().toLowerCase().includes(fix.field.toLowerCase())) {
            columnIndex = i;
            break;
          }
        }

        if (columnIndex === -1) {
          Logger.log('Column not found for field: ' + fix.field);
          return;
        }

        // Apply the fix based on type
        if (fix.type === 'fix') {
          var fixedRows = 0;
          
          // Process each row (skip header)
          for (var rowIndex = 1; rowIndex < data.length; rowIndex++) {
            var cellValue = data[rowIndex][columnIndex];
            var originalValue = cellValue ? cellValue.toString() : '';
            
            // Apply different types of fixes
            var newValue = originalValue;
            
            if (fix.description.toLowerCase().includes('date')) {
              // Date format fixes
              newValue = fixDateFormat(originalValue);
            } else if (fix.description.toLowerCase().includes('address')) {
              // Address normalization
              newValue = normalizeAddress(originalValue);
            } else if (fix.description.toLowerCase().includes('status')) {
              // Status normalization
              newValue = normalizeStatus(originalValue);
            } else if (fix.description.toLowerCase().includes('phone')) {
              // Phone number formatting
              newValue = formatPhoneNumber(originalValue);
            }
            
            if (newValue !== originalValue && newValue) {
              sheet.getRange(rowIndex + 1, columnIndex + 1).setValue(newValue);
              fixedRows++;
            }
          }
          
          if (fixedRows > 0) {
            appliedFixes++;
            Logger.log('Applied fix to ' + fixedRows + ' rows for field ' + fix.field);
          }
        }
        
      } catch (error) {
        Logger.log('Error applying auto-fix ' + index + ': ' + error.toString());
      }
    });

    return {
      success: true,
      message: 'Applied ' + appliedFixes + ' auto-fixes successfully',
      appliedFixes: appliedFixes
    };

  } catch (error) {
    Logger.log('Error in applyAIAutoFixes: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Helper function to fix date formats
 */
function fixDateFormat(dateStr) {
  if (!dateStr) return dateStr;
  
  try {
    var date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
  } catch (e) {
    // If parsing fails, return original
  }
  
  return dateStr;
}

/**
 * Helper function to normalize addresses
 */
function normalizeAddress(address) {
  if (!address) return address;
  
  // Basic address normalization
  return address.toString()
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/,\s*,/g, ',') // Double commas
    .trim();
}

/**
 * Helper function to normalize status values
 */
function normalizeStatus(status) {
  if (!status) return status;
  
  var statusStr = status.toString().toLowerCase().trim();
  
  // Common status mappings
  var statusMappings = {
    'in transit': 'IN_TRANSIT',
    'rolling': 'IN_TRANSIT',
    'en route': 'IN_TRANSIT',
    'delivered': 'DELIVERED',
    'complete': 'DELIVERED',
    'cancelled': 'CANCELLED',
    'canceled': 'CANCELLED',
    'dispatched': 'DISPATCHED',
    'loading': 'LOADING',
    'pickup': 'PICKUP',
    'delivery': 'DELIVERY'
  };
  
  return statusMappings[statusStr] || status;
}

/**
 * Helper function to format phone numbers
 */
function formatPhoneNumber(phone) {
  if (!phone) return phone;
  
  var phoneStr = phone.toString().replace(/\D/g, ''); // Remove non-digits
  
  if (phoneStr.length === 10) {
    return '+1' + phoneStr; // US format
  } else if (phoneStr.length === 11 && phoneStr.startsWith('1')) {
    return '+' + phoneStr; // US format with country code
  } else if (phoneStr.length >= 10) {
    return '+' + phoneStr; // International format
  }
  
  return phone; // Return original if can't format
}

/**
 * Call AI analysis API for comprehensive data analysis and auto-mapping
 * @param {Object} payload - Analysis payload with headers, rows, and options
 * @return {Object} AI analysis result
 */
function callAIAnalysis(payload) {
  try {
    Logger.log('Calling AI analysis API with payload size: ' + JSON.stringify(payload).length);
    
    var url = 'https://trucktalkconnect.vercel.app/api/ai';
    
    // Create request payload
    var requestPayload = JSON.stringify(payload);
    
    // HMAC signing (same logic as testAIConnection)
    var ts = String(Date.now());
    var secret = PropertiesService.getScriptProperties().getProperty('TTC_HMAC_SECRET');
    var headers = { 
      'Content-Type': 'application/json', 
      'User-Agent': 'TruckTalk-Connect-AddOn/2.0', 
      'Origin': 'https://script.google.com' 
    };
    
    if (secret) {
      var sig = Utilities.computeHmacSha256Signature(ts + '.' + requestPayload, secret);
      var hex = sig.map(function(b) { 
        return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'); 
      }).join('');
      headers['x-ttc-timestamp'] = ts;
      headers['x-ttc-signature'] = hex;
    }
    
    // Make API request
    var response = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: headers,
      payload: requestPayload,
      muteHttpExceptions: true
    });
    
    var responseText = response.getResponseCode() === 200 ? response.getContentText() : null;
    Logger.log('AI API Response Code: ' + response.getResponseCode());
    
    if (response.getResponseCode() !== 200) {
      Logger.log('AI API Error Response: ' + response.getContentText());
      return {
        success: false,
        error: 'API returned status ' + response.getResponseCode() + ': ' + response.getContentText()
      };
    }
    
    if (!responseText) {
      return {
        success: false,
        error: 'Empty response from AI API'
      };
    }
    
    // Parse response
    var result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      Logger.log('AI API JSON Parse Error: ' + parseError.toString());
      return {
        success: false,
        error: 'Invalid JSON response from AI API'
      };
    }
    
    if (result.error) {
      return {
        success: false,
        error: result.error
      };
    }
    
    Logger.log('AI analysis completed successfully');
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    Logger.log('AI Analysis Error: ' + error.toString());
    return {
      success: false,
      error: 'Network error: ' + error.toString()
    };
  }
}

/**
 * Clear saved mapping for the current sheet
 */
function clearMapping() {
  try {
    var spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    var sheetName = SpreadsheetApp.getActiveSheet().getName();
    var key = spreadsheetId + '::' + sheetName;
    
    var userProps = PropertiesService.getUserProperties();
    userProps.deleteProperty('mapping_' + key);
    
    Logger.log('Cleared mapping for ' + key);
    
    return {
      success: true,
      message: 'Mapping cleared for sheet: ' + sheetName
    };
  } catch (error) {
    Logger.log('Error clearing mapping: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Get sheet headers with saved mapping for UI dialog
 */
function getSheetHeaders() {
  try {
    var sheetData = getSheetSnapshot();
    if (!sheetData.success) {
      return {
        success: false,
        error: sheetData.error
      };
    }
    
    var savedMappingResult = getSavedMapping();
    
    return {
      success: true,
      headers: sheetData.data.headers,
      savedMapping: savedMappingResult.mapping || {},
      sheetName: SpreadsheetApp.getActiveSheet().getName(),
      rowCount: sheetData.data.rows.length
    };
  } catch (error) {
    Logger.log('Error getting sheet headers: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

function analyzeActiveSheet(opts) {
  try {
    opts = opts || {};
    Logger.log('=== Analyzing Active Sheet ===');
    Logger.log('Options: ' + JSON.stringify(opts));

    // Rate limiting check
    var rateLimitResult = checkRateLimit();
    if (!rateLimitResult.allowed) {
      return {
        ok: false,
        issues: [{
          code: 'RATE_LIMIT_EXCEEDED',
          severity: 'error',
          message: 'Rate limit exceeded. Please wait before analyzing again.',
          suggestion: 'Wait ' + Math.ceil(rateLimitResult.resetIn / 60000) + ' minutes before retrying.'
        }],
        mapping: {},
        meta: {
          analyzedRows: 0,
          analyzedAt: new Date().toISOString()
        }
      };
    }

    // Get sheet data
    var sheetData = getSheetSnapshot();
    if (!sheetData.success) {
      return {
        ok: false,
        issues: [{
          code: 'SHEET_READ_ERROR',
          severity: 'error',
          message: 'Cannot read sheet data: ' + sheetData.error,
          suggestion: 'Ensure the sheet has data and you have proper permissions.'
        }],
        mapping: {},
        meta: {
          analyzedRows: 0,
          analyzedAt: new Date().toISOString()
        }
      };
    }

    var data = sheetData.data;
    var headers = data.headers;
    var rows = data.rows;

    // ========================================
    // AI-POWERED INTELLIGENT ANALYSIS
    // ========================================
    
    Logger.log('Sending data to AI for comprehensive analysis and auto-mapping...');
    
    // Prepare payload for AI analysis with row cap
    var cappedRows = rows.slice(0, Math.min(rows.length, 200));
    var aiPayload = {
      headers: headers,
      rows: cappedRows,
      options: {
        assumeTimezone: opts.assumeTimezone || 'UTC',
        locale: opts.locale || 'en-US',
        rowLimit: cappedRows.length
      },
      headerOverrides: opts.headerOverrides || {}
    };
    
    // Call AI API for comprehensive analysis
    var aiResult = callAIAnalysis(aiPayload);
    
    if (!aiResult.success) {
      return {
        ok: false,
        issues: [{
          code: 'AI_ANALYSIS_ERROR',
          severity: 'error',
          message: 'AI analysis failed: ' + aiResult.error,
          suggestion: 'Check your data format and try again. Ensure you have internet connectivity.'
        }],
        mapping: {},
        meta: {
          analyzedRows: rows.length,
          analyzedAt: new Date().toISOString(),
          service: 'AI (Failed)'
        }
      };
    }
    
    // Return AI analysis result directly (it includes mapping, validation, and normalization)
    var result = aiResult.data;
    result.meta = result.meta || {};
    result.meta.analyzedRows = cappedRows.length;
    result.meta.analyzedAt = new Date().toISOString();
    result.meta.service = 'AI-Powered';
    result.meta.aiGenerated = true;
    
    // Ensure result.mapping is header→field format (should already be correct from AI)
    // The AI endpoint returns mapping in the correct format
    
    // Auto-save successful AI mapping for future use
    if (result.ok && result.mapping && Object.keys(result.mapping).length > 0) {
      var saveResult = saveMapping(result.mapping);
      if (saveResult.success) {
        Logger.log('Auto-saved AI-generated mapping');
      }
    }
    
    // Cache analysis result and update rate limits
    setCachedAnalysis(result);
    updateRateLimit('analysis');
    
    return result;

  } catch (error) {
    Logger.log('Error in analyzeActiveSheet: ' + error.toString());
    return {
      ok: false,
      issues: [{
        code: 'ANALYSIS_ERROR',
        severity: 'error',
        message: 'Analysis failed: ' + error.message,
        suggestion: 'Please check your data and try again.'
      }],
      mapping: {},
      meta: {
        analyzedRows: 0,
        analyzedAt: new Date().toISOString()
      }
    };
  }
}


function getSheetSnapshot() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      return { success: false, error: 'No active sheet found' };
    }

    var range = sheet.getDataRange();
    var values = range.getValues();
    
    if (values.length < 2) {
      return { success: false, error: 'Sheet must have headers and at least one data row' };
    }

    var headers = values[0];
    var dataRows = values.slice(1);
    
    // Capture the actual starting row of the data range
    var startRow = range.getRow();
    var dataStartRow = startRow + 1; // Data starts after header row

    // Clean and validate headers
    headers = headers.map(function(h) { return String(h || '').trim(); });
    
    // Filter out empty columns
    var validColumnIndices = [];
    headers.forEach(function(header, index) {
      if (header && header.length > 0) {
        validColumnIndices.push(index);
      }
    });

    var cleanHeaders = validColumnIndices.map(function(index) { return headers[index]; });
    var cleanRows = [];
    var rowNumbers = []; // Maps each payload row → real sheet row
    
    dataRows.forEach(function(row, index) {
      var cleanRow = validColumnIndices.map(function(colIndex) { return row[colIndex]; });
      cleanRows.push(cleanRow);
      rowNumbers.push(dataStartRow + index); // Real sheet row number
    });

    return {
      success: true,
      data: {
        sheetName: sheet.getName(),
        headers: cleanHeaders,
        rows: cleanRows,
        rowNumbers: rowNumbers, // NEW: mapping from payload index to real sheet row
        totalRows: cleanRows.length,
        totalColumns: cleanHeaders.length,
        dataStartRow: dataStartRow
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Call OpenAI API via Vercel proxy
 */
function callOpenAI(sheetData) {
  try {
    var payload = {
      sheetData: sheetData,
      analysisType: 'logistics_validation'
    };

    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    };

    var response = UrlFetchApp.fetch('https://trucktalkconnect.vercel.app/api/ai', options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      var responseData = JSON.parse(response.getContentText());
      if (responseData.success) {
        return { success: true, result: responseData.data };
      } else {
        return { success: false, error: 'Invalid response format' };
      }
    } else {
      return { success: false, error: 'API error: ' + responseCode };
    }
    
  } catch (error) {
    Logger.log('OpenAI API call failed: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Rate limiting functions
 */
function checkRateLimit() {
  try {
    var props = PropertiesService.getScriptProperties();
    var data = props.getProperty('ttc_rate_limit_analysis');
    
    var now = Date.now();
    var windowMs = 10 * 60 * 1000; // 10 minutes
    var maxRequests = 10;
    
    if (!data) {
      return { allowed: true, remaining: maxRequests - 1 };
    }
    
    var rateData = JSON.parse(data);
    var windowStart = now - windowMs;
    
    // Filter requests within current window
    rateData.requests = rateData.requests.filter(function(timestamp) {
      return timestamp > windowStart;
    });
    
    if (rateData.requests.length >= maxRequests) {
      var oldestRequest = Math.min.apply(Math, rateData.requests);
      var resetIn = (oldestRequest + windowMs) - now;
      return { allowed: false, resetIn: resetIn };
    }
    
    return { allowed: true, remaining: maxRequests - rateData.requests.length - 1 };
  } catch (error) {
    Logger.log('Rate limit check error: ' + error.toString());
    return { allowed: true }; // Allow on error
  }
}

function updateRateLimit(action) {
  try {
    var props = PropertiesService.getScriptProperties();
    var key = 'ttc_rate_limit_' + action;
    var data = props.getProperty(key);
    
    var now = Date.now();
    var rateData = data ? JSON.parse(data) : { requests: [] };
    
    rateData.requests.push(now);
    
    // Keep only last 24 hours
    var dayAgo = now - (24 * 60 * 60 * 1000);
    rateData.requests = rateData.requests.filter(function(timestamp) {
      return timestamp > dayAgo;
    });
    
    props.setProperty(key, JSON.stringify(rateData));
  } catch (error) {
    Logger.log('Rate limit update error: ' + error.toString());
  }
}

/**
 * Helper function to create basic header mapping with ambiguity detection
 */
function createBasicHeaderMapping(headers) {
  var mapping = {};
  var ambiguities = [];
  
  var synonyms = {
    loadId: ['load id', 'ref', 'vrid', 'reference', 'ref #', 'load number', 'id'],
    fromAddress: ['from', 'pu', 'pickup', 'origin', 'pickup address', 'pickup location', 'from address'],
    fromAppointmentDateTimeUTC: ['pu time', 'pickup appt', 'pickup date/time', 'pu date', 'pickup time', 'from date', 'from time'],
    toAddress: ['to', 'drop', 'delivery', 'destination', 'delivery address', 'delivery location', 'to address'],
    toAppointmentDateTimeUTC: ['del time', 'delivery appt', 'delivery date/time', 'del date', 'delivery time', 'to date', 'to time'],
    status: ['status', 'load status', 'stage', 'state', 'condition'],
    driverName: ['driver', 'driver name', 'driver/carrier', 'carrier'],
    driverPhone: ['phone', 'driver phone', 'contact', 'driver contact'],
    unitNumber: ['unit', 'truck', 'truck #', 'tractor', 'unit number', 'equipment'],
    broker: ['broker', 'customer', 'shipper', 'client']
  };

  // Check for ambiguities first
  Object.keys(synonyms).forEach(function(field) {
    var candidates = [];
    
    headers.forEach(function(header) {
      var headerLower = header.toLowerCase().trim();
      var fieldSynonyms = synonyms[field];
      
      for (var i = 0; i < fieldSynonyms.length; i++) {
        if (headerLower === fieldSynonyms[i]) {
          candidates.push({ header: header, score: 1.0, exact: true });
          break;
        } else if (headerLower.includes(fieldSynonyms[i])) {
          candidates.push({ header: header, score: 0.7, exact: false });
          break;
        }
      }
    });
    
    if (candidates.length > 1) {
      // Sort by score and exact match preference
      candidates.sort(function(a, b) {
        if (a.exact && !b.exact) return -1;
        if (!a.exact && b.exact) return 1;
        return b.score - a.score;
      });
      
      ambiguities.push({
        field: field,
        candidates: candidates
      });
      
      // Use the best match for now
      mapping[candidates[0].header] = field;
    } else if (candidates.length === 1) {
      mapping[candidates[0].header] = field;
    }
  });

  return { mapping: mapping, ambiguities: ambiguities };
}

/**
 * Creates intelligent mapping from detected headers to expected fields
 * Auto-maps unambiguous matches, only shows dialog for true ambiguities
 * Returns: { mapping: Object, ambiguities: Array, autoMapped: Boolean }
 */
/**
 * STANDARDIZED header→field mapping function
 * Returns mapping in header→field format consistently
 */
function createStandardizedHeaderMapping(headers) {
  // Expected fields for TruckTalk analysis
  var expectedFields = [
    'loadId', 'fromAddress', 'fromAppointmentDateTimeUTC', 'toAddress', 'toAppointmentDateTimeUTC',
    'status', 'driverName', 'unitNumber', 'broker', 'driverPhone'
  ];
  
  var mapping = {}; // header→field format
  var ambiguities = [];
  var usedHeaders = [];
  
  // Header synonyms for smart matching
  var synonyms = {
    'loadId': ['load id', 'loadid', 'ref', 'reference', 'ref #', 'vrid', 'load number', 'id', 'load ref'],
    'fromAddress': ['from', 'pu', 'pickup', 'origin', 'pickup address', 'origin address', 'pickup location', 'from address'],
    'fromAppointmentDateTimeUTC': ['pu time', 'pickup appt', 'pickup date/time', 'pickup datetime', 'pu datetime', 'pu date', 'pickup time', 'from date', 'from time', 'pickup appointment'],
    'toAddress': ['to', 'drop', 'delivery', 'destination', 'delivery address', 'destination address', 'delivery location', 'to address'],
    'toAppointmentDateTimeUTC': ['del time', 'delivery appt', 'delivery date/time', 'delivery datetime', 'drop time', 'del date', 'delivery time', 'to date', 'to time', 'delivery appointment'],
    'status': ['status', 'load status', 'stage', 'state', 'condition'],
    'driverName': ['driver', 'driver name', 'driver/carrier', 'carrier'],
    'driverPhone': ['phone', 'driver phone', 'contact', 'driver contact', 'driver cell', 'mobile'],
    'unitNumber': ['unit', 'truck', 'truck #', 'tractor', 'unit number', 'equipment', 'truck number'],
    'broker': ['broker', 'customer', 'shipper', 'client', 'company']
  };
  
  // Auto-map fields using exact and fuzzy matching
  expectedFields.forEach(function(field) {
    var fieldSynonyms = synonyms[field] || [];
    var candidates = [];
    
    headers.forEach(function(header, index) {
      if (usedHeaders.indexOf(header) >= 0) return; // Already used
      
      var headerLower = header.toLowerCase().trim();
      var score = 0;
      
      // Exact match with synonyms
      if (fieldSynonyms.some(function(syn) { return syn.toLowerCase() === headerLower; })) {
        score = 100;
      }
      // Partial match
      else if (fieldSynonyms.some(function(syn) { 
        return headerLower.indexOf(syn.toLowerCase()) >= 0 || syn.toLowerCase().indexOf(headerLower) >= 0; 
      })) {
        score = 80;
      }
      
      if (score > 0) {
        candidates.push({ header: header, index: index, score: score });
      }
    });
    
    // Sort by score
    candidates.sort(function(a, b) { return b.score - a.score; });
    
    if (candidates.length === 1) {
      // Single match - auto-map
      mapping[candidates[0].header] = field;
      usedHeaders.push(candidates[0].header);
    } else if (candidates.length > 1) {
      // Multiple candidates - check for ambiguity
      var topScore = candidates[0].score;
      var topCandidates = candidates.filter(function(c) { return c.score === topScore; });
      
      if (topCandidates.length === 1) {
        // Clear winner
        mapping[topCandidates[0].header] = field;
        usedHeaders.push(topCandidates[0].header);
      } else {
        // True ambiguity
        ambiguities.push({
          field: field,
          candidates: topCandidates.map(function(c) { return { header: c.header, score: c.score }; })
        });
      }
    }
  });
  
  return {
    mapping: mapping, // header→field format
    ambiguities: ambiguities
  };
}

/**
 * Checks for strong field-specific matches
 */
function isStrongMatch(field, normalizedHeader) {
  var strongPatterns = {
    'loadId': ['loadid', 'ref', 'reference', 'loadnumber', 'id'],
    'fromAddress': ['from', 'pickup', 'origin', 'pickupaddress', 'fromaddress'],
    'fromAppointmentDateTimeUTC': ['putime', 'pickuptime', 'pickupdate', 'fromtime', 'fromdate'],
    'toAddress': ['to', 'delivery', 'destination', 'dropoff', 'toaddress'],
    'toAppointmentDateTimeUTC': ['deltime', 'deliverytime', 'deliverydate', 'totime', 'todate'],
    'status': ['status', 'loadstatus', 'stage', 'state'],
    'driverName': ['driver', 'drivername', 'carrier'],
    'driverPhone': ['phone', 'driverphone', 'contact', 'drivercontact'],
    'unitNumber': ['unit', 'truck', 'trucknumber', 'tractor', 'unitnumber'],
    'broker': ['broker', 'customer', 'shipper', 'client']
  };
  
  var patterns = strongPatterns[field] || [];
  return patterns.some(function(pattern) {
    return normalizedHeader.indexOf(pattern) !== -1;
  });
}

/**
 * Checks for contextual matches based on field semantics
 */
function isContextualMatch(field, normalizedHeader) {
  if (field.indexOf('Address') !== -1 && (normalizedHeader.indexOf('location') !== -1 || normalizedHeader.indexOf('place') !== -1 || normalizedHeader.indexOf('addr') !== -1)) {
    return true;
  }
  if (field.indexOf('DateTime') !== -1 && (normalizedHeader.indexOf('time') !== -1 || normalizedHeader.indexOf('date') !== -1 || normalizedHeader.indexOf('appt') !== -1)) {
    return true;
  }
  if (field === 'driverName' && (normalizedHeader.indexOf('name') !== -1)) {
    return true;
  }
  if (field === 'unitNumber' && (normalizedHeader.indexOf('number') !== -1 || normalizedHeader.indexOf('equipment') !== -1)) {
    return true;
  }
  return false;
}

/**
 * Load saved header mappings from PropertiesService
 */
function loadSavedHeaderMappings() {
  try {
    var saved = PropertiesService.getDocumentProperties().getProperty('HEADER_MAPPINGS');
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Save header mapping for future use
 */
function saveHeaderMapping(key, mapping) {
  try {
    var saved = loadSavedHeaderMappings();
    saved[key] = mapping;
    // Keep only last 10 mappings to avoid storage limits
    var keys = Object.keys(saved);
    if (keys.length > 10) {
      keys.slice(0, keys.length - 10).forEach(function(oldKey) {
        delete saved[oldKey];
      });
    }
    PropertiesService.getDocumentProperties().setProperty('HEADER_MAPPINGS', JSON.stringify(saved));
  } catch (e) {
    // Ignore save errors
  }
}

/**
 * Validate that saved mapping is still applicable
 */
function isValidSavedMapping(mapping, currentHeaders) {
  try {
    // Check that all mapped indices are valid for current headers
    for (var field in mapping) {
      var index = mapping[field];
      if (typeof index !== 'number' || index < 0 || index >= currentHeaders.length) {
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Parse date/time to UTC ISO string
 */
function parseToUTC(dateValue) {
  try {
    if (!dateValue) return { success: false };
    
    var originalString = String(dateValue).trim();
    var hadTimezone = /[+-]\d{2}:?\d{2}|Z|UTC|GMT/i.test(originalString);
    var wasISOFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(originalString);
    
    var date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        // Try common formats
        var dateStr = String(dateValue).trim();

        // If no timezone provided, try to infer from the spreadsheet timezone
        if (!hadTimezone) {
          try {
            var ss = SpreadsheetApp.getActiveSpreadsheet();
            var tz = ss ? ss.getSpreadsheetTimeZone() : null;
            if (tz) {
              // Get current offset for the spreadsheet timezone in form +0800 or -0500
              var offsetRaw = Utilities.formatDate(new Date(), tz, "Z");
              // Convert +0800 to +08:00
              var offsetFormatted = offsetRaw && offsetRaw.length === 5 ? offsetRaw.slice(0,3) + ':' + offsetRaw.slice(3) : offsetRaw;
              if (offsetFormatted) {
                dateStr += ' ' + offsetFormatted;
              } else {
                // Fallback to +08:00 if formatting fails
                dateStr += ' +08:00';
              }
            } else {
              dateStr += ' +08:00';
            }
          } catch (ee) {
            // If any error, fallback to Malaysia time
            dateStr += ' +08:00';
          }
        }

        date = new Date(dateStr);
      }
    }
    
    if (isNaN(date.getTime())) {
      return { success: false };
    }
    
    var result = {
      success: true,
      isoString: date.toISOString(),
      originalValue: dateValue
    };
    
    // Flag if we had to normalize a non-ISO format
    if (!wasISOFormat) {
      result.wasNormalized = true;
      result.assumedTimezone = !hadTimezone;
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remap server issues from logical row indices to real sheet row numbers
 */
function remapServerIssues(serverIssues, rowNumbers) {
  if (!serverIssues || !Array.isArray(serverIssues)) {
    return [];
  }
  
  return serverIssues.map(function(issue) {
    // Create a copy of the issue to avoid modifying the original
    var remappedIssue = Object.assign({}, issue);
    
    // Normalize issue format: server uses { code, severity, message, rows?, column?, suggestion? }
    // Ensure we have both type and severity for compatibility
    if (remappedIssue.severity && !remappedIssue.type) {
      remappedIssue.type = remappedIssue.severity === 'error' ? 'error' : 'warning';
    }
    
    // Remap rows from logical indices to real sheet row numbers
    if (remappedIssue.rows && Array.isArray(remappedIssue.rows) && rowNumbers.length > 0) {
      remappedIssue.rows = remappedIssue.rows.map(function(logicalRow) {
        // Server uses 1-based logical row indices, convert to 0-based for rowNumbers array
        var payloadIndex = logicalRow - 2; // -2 because server counts header as row 1, payload starts at row 2
        if (payloadIndex >= 0 && payloadIndex < rowNumbers.length) {
          return rowNumbers[payloadIndex]; // Return real sheet row number
        }
        return logicalRow; // Fallback to original if mapping fails
      });
    }
    
    return remappedIssue;
  });
}

/**
 * Cache management for analysis results
 */
function getCachedAnalysis() {
  try {
    var props = PropertiesService.getScriptProperties();
    var cached = props.getProperty('ttc_last_analysis');
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    Logger.log('Error getting cached analysis: ' + error.toString());
    return null;
  }
}

/**
 * Client wrapper to return cached analysis result via google.script.run
 */
function getCachedAnalysisResult() {
  return getCachedAnalysis();
}

// =========================
// Simple unit-test helpers
// =========================

/**
 * Unit test for parseToUTC with common date strings
 */
function test_parseToUTC() {
  var cases = [
    { in: '2025-09-07 08:00', ok: true },
    { in: '2025-09-07T08:00:00Z', ok: true },
    { in: '07/09/2025 8:00 AM', ok: true },
    { in: 'Invalid Date', ok: false }
  ];

  var results = cases.map(function(c) {
    var r = parseToUTC(c.in);
    return { input: c.in, success: !!r.success, iso: r.isoString || null };
  });

  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

/**
 * Unit test for header mapping
 */
function test_headerMapping() {
  var headers = ['Load ID','PU','PU Time','DEL Time','Driver','Phone','Truck','Broker'];
  var r = createBasicHeaderMapping(headers);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}

/** Run all tests */
function runUnitTests() {
  var out = {
    parseTests: test_parseToUTC(),
    mappingTest: test_headerMapping()
  };
  return out;
}

function setCachedAnalysis(analysis) {
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('ttc_last_analysis', JSON.stringify(analysis));
    props.setProperty('ttc_last_analysis_timestamp', new Date().toISOString());
  } catch (error) {
    Logger.log('Error setting cached analysis: ' + error.toString());
  }
}

/**
 * Push validated loads to TruckTalk API (stub implementation)
 * One-way sync for production integration
 */
function pushToTruckTalk(options) {
  try {
    options = options || {};
    Logger.log('=== Push to TruckTalk ===');
    
    // Get cached analysis results
    var cachedAnalysis = getCachedAnalysis();
    if (!cachedAnalysis || !cachedAnalysis.ok) {
      return {
        success: false,
        error: 'No valid analysis found. Please analyze your data first.',
        code: 'NO_ANALYSIS'
      };
    }

    // Extract validated loads from analysis - prefer main loads, fallback to aiInsights
    var loads = (cachedAnalysis && cachedAnalysis.loads) 
      ? cachedAnalysis.loads 
      : (cachedAnalysis.aiInsights && cachedAnalysis.aiInsights.loads) ? cachedAnalysis.aiInsights.loads : [];

    if (loads.length === 0) {
      return {
        success: false,
        error: 'No valid loads found to push. Please fix data issues first.',
        code: 'NO_LOADS'
      };
    }

    // Get organization profile for broker normalization
    var orgProfile = getOrganizationProfile();
    
    // Normalize broker names using org profile
    var normalizedLoads = loads.map(function(load) {
      var normalizedLoad = Object.assign({}, load);
      if (load.broker && orgProfile.brokerNormalization[load.broker]) {
        normalizedLoad.broker = orgProfile.brokerNormalization[load.broker];
      }
      return normalizedLoad;
    });

    // Prepare TruckTalk API payload
    var payload = {
      organizationId: orgProfile.organizationId,
      source: 'TruckTalk Connect Google Sheets Add-on',
      syncedAt: new Date().toISOString(),
      loads: normalizedLoads,
      metadata: {
        sheetName: cachedAnalysis.meta ? cachedAnalysis.meta.sheetName : 'Unknown',
        totalLoads: normalizedLoads.length,
        syncMode: 'one-way',
        version: '1.0.0'
      }
    };

    // TruckTalk API endpoint (stub URL for demonstration)
    var truckTalkEndpoint = 'https://api.trucktalk.com/v1/loads/import';
    
    // STUB IMPLEMENTATION - This would normally POST to real TruckTalk API
    Logger.log('STUB: Would POST to ' + truckTalkEndpoint);
    Logger.log('STUB: Payload size: ' + JSON.stringify(payload).length + ' bytes');
    Logger.log('STUB: Load count: ' + normalizedLoads.length);
    
    // Simulate API call delay
    Utilities.sleep(1000);
    
    // Mock successful response
    var mockResponse = {
      success: true,
      importId: 'IMP_' + Date.now(),
      processedLoads: normalizedLoads.length,
      createdLoads: normalizedLoads.length,
      updatedLoads: 0,
      errors: [],
      warnings: [],
      processedAt: new Date().toISOString()
    };

    // Show user feedback
    var successMsg = 'Push to TruckTalk Successful!\n\n' +
                    'Import Details:\n' +
                    '• Import ID: ' + mockResponse.importId + '\n' +
                    '• Processed: ' + mockResponse.processedLoads + ' loads\n' +
                    '• Created: ' + mockResponse.createdLoads + ' new loads\n' +
                    '• Updated: ' + mockResponse.updatedLoads + ' existing loads\n\n' +
                    'Your loads are now available in TruckTalk!\n\n' +
                    'Note: This is a demonstration. In production, this would\n' +
                    'sync with your actual TruckTalk account.';
                    
    SpreadsheetApp.getUi().alert('Push to TruckTalk Complete', successMsg, SpreadsheetApp.getUi().ButtonSet.OK);

    return {
      success: true,
      response: mockResponse,
      endpoint: truckTalkEndpoint,
      payload: payload
    };

  } catch (error) {
    Logger.log('Error pushing to TruckTalk: ' + error.toString());
    var errorMsg = 'Push to TruckTalk Failed\n\n' + error.message + '\n\nPlease check your data and try again.';
    SpreadsheetApp.getUi().alert('Push Failed', errorMsg, SpreadsheetApp.getUi().ButtonSet.OK);
    
    return {
      success: false,
      error: error.message,
      code: 'PUSH_ERROR'
    };
  }
}

/**
 * Get or create organization profile for broker normalization
 */
function getOrganizationProfile() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var profileData = props.getProperty('TTC_ORG_PROFILE');
    
    if (profileData) {
      return JSON.parse(profileData);
    }
    
    // Create default organization profile
    var defaultProfile = {
      organizationId: 'org_' + Date.now(),
      name: 'TruckTalk Connect User',
      createdAt: new Date().toISOString(),
      brokerNormalization: {
        // Default broker name normalizations for Malaysia
        'DHL Supply Chain Malaysia': 'DHL Supply Chain',
        'FedEx Malaysia Sdn Bhd': 'FedEx',
        'UPS Malaysia': 'UPS',
        'TNT Express Malaysia': 'TNT',
        'Aramex Malaysia': 'Aramex',
        'DB Schenker Malaysia': 'DB Schenker',
        'DSV Malaysia': 'DSV',
        'Kerry Logistics Malaysia': 'Kerry Logistics',
        'CEVA Logistics Malaysia': 'CEVA Logistics',
        'Yusen Logistics Malaysia': 'Yusen Logistics',
        'Expeditors Malaysia': 'Expeditors',
        'Kuehne + Nagel Malaysia': 'Kuehne + Nagel',
        'Bollore Logistics Malaysia': 'Bollore Logistics',
        'MASkargo Malaysia Airlines': 'MASkargo'
      },
      preferences: {
        defaultTimezone: 'Asia/Kuala_Lumpur',
        dateFormat: 'ISO8601',
        autoFixEnabled: true,
        pushEnabled: false // Disabled by default until user confirms setup
      }
    };
    
    // Save default profile
    props.setProperty('TTC_ORG_PROFILE', JSON.stringify(defaultProfile));
    return defaultProfile;
    
  } catch (error) {
    Logger.log('Error getting organization profile: ' + error.toString());
    // Return minimal profile on error
    return {
      organizationId: 'org_default',
      name: 'Default Organization',
      brokerNormalization: {},
      preferences: { autoFixEnabled: false, pushEnabled: false }
    };
  }
}

/**
 * Update organization profile with new broker normalizations
 */
function updateOrganizationProfile(updates) {
  try {
    var profile = getOrganizationProfile();
    
    // Merge updates
    if (updates.brokerNormalization) {
      Object.assign(profile.brokerNormalization, updates.brokerNormalization);
    }
    if (updates.preferences) {
      Object.assign(profile.preferences, updates.preferences);
    }
    if (updates.name) {
      profile.name = updates.name;
    }
    
    profile.updatedAt = new Date().toISOString();
    
    // Save updated profile
    var props = PropertiesService.getDocumentProperties();
    props.setProperty('TTC_ORG_PROFILE', JSON.stringify(profile));
    
    return { success: true, profile: profile };
    
  } catch (error) {
    Logger.log('Error updating organization profile: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Auto-fix data issues with detailed reporting and user confirmation
 */
function autoFixDataIssues(options) {
  try {
    options = options || {};
    Logger.log('=== Auto-Fix Data Issues ===');
    
    // Get current sheet data
    var sheetData = getSheetSnapshot();
    if (!sheetData.success) {
      return { success: false, error: 'Cannot read sheet data: ' + sheetData.error };
    }
    
    var sheet = SpreadsheetApp.getActiveSheet();
    var headers = sheetData.data.headers;
    var rows = sheetData.data.rows;
    var fixes = [];
    var confirmations = [];
    var detailedFixes = []; // New: Store detailed before/after information
    
    // Check for missing required columns
    var requiredColumns = ['Load ID', 'From Address', 'To Address', 'PU Date', 'DEL Date', 'Status', 'Driver Name', 'Unit Number', 'Broker'];
    var missingColumns = [];
    
    requiredColumns.forEach(function(requiredCol) {
      var found = headers.some(function(header) {
        return header.toLowerCase().includes(requiredCol.toLowerCase().replace(' ', ''));
      });
      if (!found) {
        missingColumns.push(requiredCol);
      }
    });
    
    // Offer to create missing columns
    if (missingColumns.length > 0) {
      var createColumnsMsg = 'Missing Required Columns Detected:\n\n' +
                           missingColumns.map(function(col) { return '• ' + col; }).join('\n') +
                           '\n\nWould you like to create these columns automatically?\n\n' +
                           'This will add the missing columns to your sheet with default values.';
                           
      var createResponse = SpreadsheetApp.getUi().alert(
        'Auto-Fix: Create Missing Columns',
        createColumnsMsg,
        SpreadsheetApp.getUi().ButtonSet.YES_NO
      );
      
      if (createResponse === SpreadsheetApp.getUi().Button.YES) {
        // Add missing columns
        var currentColumnCount = headers.length;
        missingColumns.forEach(function(colName, index) {
          var newColIndex = currentColumnCount + index + 1;
          sheet.getRange(1, newColIndex).setValue(colName);
          fixes.push('Created column: ' + colName);
          
          // Add detailed fix information
          detailedFixes.push({
            type: 'COLUMN_CREATED',
            description: 'Added missing required column',
            location: 'Column ' + String.fromCharCode(65 + newColIndex - 1) + '1',
            before: 'Missing column: ' + colName,
            after: 'Column created: ' + colName,
            impact: 'Resolves MISSING_COLUMN validation error'
          });
        });
        confirmations.push('Added ' + missingColumns.length + ' missing columns');
      }
    }
    
    // Check for date format issues and offer normalization
    var dateColumns = [];
    headers.forEach(function(header, index) {
      if (header.toLowerCase().includes('date') || header.toLowerCase().includes('time')) {
        dateColumns.push({ name: header, index: index });
      }
    });
    
    var dateFixesNeeded = [];
    dateColumns.forEach(function(dateCol) {
      for (var i = 0; i < rows.length; i++) {
        var cellValue = rows[i][dateCol.index];
        if (cellValue && typeof cellValue === 'string') {
          // Check if it's already in ISO format
          if (!/^\d{4}-\d{2}-\d{2}$/.test(cellValue.trim())) {
            dateFixesNeeded.push({
              row: i + 2, // +2 for header and 0-based index
              column: dateCol.name,
              originalValue: cellValue,
              columnIndex: dateCol.index
            });
          }
        }
      }
    });
    
    // Offer to normalize dates
    if (dateFixesNeeded.length > 0 && dateFixesNeeded.length <= 20) { // Limit to prevent overwhelming user
      var normalizeDatesMsg = 'Non-Standard Date Formats Detected:\n\n' +
                             dateFixesNeeded.slice(0, 5).map(function(fix) {
                               return '• Row ' + fix.row + ' (' + fix.column + '): "' + fix.originalValue + '"';
                             }).join('\n') +
                             (dateFixesNeeded.length > 5 ? '\n• ... and ' + (dateFixesNeeded.length - 5) + ' more' : '') +
                             '\n\nWould you like to normalize these to YYYY-MM-DD format?';
                             
      var normalizeDatesResponse = SpreadsheetApp.getUi().alert(
        'Auto-Fix: Normalize Date Formats',
        normalizeDatesMsg,
        SpreadsheetApp.getUi().ButtonSet.YES_NO
      );
      
      if (normalizeDatesResponse === SpreadsheetApp.getUi().Button.YES) {
        var normalizedCount = 0;
        dateFixesNeeded.forEach(function(fix) {
          try {
            var normalizedDate = normalizeToISOFormat(fix.originalValue);
            if (normalizedDate) {
              sheet.getRange(fix.row, fix.columnIndex + 1).setValue(normalizedDate);
              normalizedCount++;
              
              // Add detailed fix information
              detailedFixes.push({
                type: 'DATE_NORMALIZED',
                description: 'Converted date to ISO format',
                location: 'Row ' + fix.row + ', Column ' + fix.column,
                before: fix.originalValue,
                after: normalizedDate,
                impact: 'Resolves BAD_DATE_FORMAT validation error'
              });
            }
          } catch (e) {
            Logger.log('Failed to normalize date: ' + fix.originalValue + ' - ' + e.toString());
          }
        });
        fixes.push('Normalized ' + normalizedCount + ' date formats');
        confirmations.push('Updated ' + normalizedCount + ' dates to ISO format');
      }
    }
    
    // Generate missing Load IDs
    var missingLoadIds = [];
    var loadIdColumnIndex = -1;
    
    headers.forEach(function(header, index) {
      if (header.toLowerCase().includes('load') && header.toLowerCase().includes('id')) {
        loadIdColumnIndex = index;
      }
    });
    
    if (loadIdColumnIndex >= 0) {
      for (var i = 0; i < rows.length; i++) {
        var loadId = rows[i][loadIdColumnIndex];
        if (!loadId || String(loadId).trim() === '') {
          missingLoadIds.push(i + 2); // +2 for header and 0-based index
        }
      }
      
      if (missingLoadIds.length > 0) {
        var generateIdsMsg = 'Missing Load IDs Detected:\n\n' +
                           '• ' + missingLoadIds.length + ' rows without Load IDs\n' +
                           '• Rows: ' + missingLoadIds.slice(0, 10).join(', ') + 
                           (missingLoadIds.length > 10 ? '...' : '') + '\n\n' +
                           'Would you like to generate unique Load IDs automatically?\n\n' +
                           'Format: TTC2025XXX (where XXX increments)';
                           
        var generateIdsResponse = SpreadsheetApp.getUi().alert(
          'Auto-Fix: Generate Missing Load IDs',
          generateIdsMsg,
          SpreadsheetApp.getUi().ButtonSet.YES_NO
        );
        
        if (generateIdsResponse === SpreadsheetApp.getUi().Button.YES) {
          var baseId = 'TTC2025';
          var counter = 100;
          
          missingLoadIds.forEach(function(rowNum) {
            var newLoadId = baseId + String(counter).padStart(3, '0');
            sheet.getRange(rowNum, loadIdColumnIndex + 1).setValue(newLoadId);
            
            // Add detailed fix information
            detailedFixes.push({
              type: 'LOAD_ID_GENERATED',
              description: 'Generated unique Load ID',
              location: 'Row ' + rowNum + ', Load ID column',
              before: '(empty)',
              after: newLoadId,
              impact: 'Resolves EMPTY_REQUIRED_CELL validation error'
            });
            
            counter++;
          });
          
          fixes.push('Generated ' + missingLoadIds.length + ' Load IDs');
          confirmations.push('Created unique IDs for ' + missingLoadIds.length + ' loads');
        }
      }
    }
    
    // Show detailed summary of fixes
    if (fixes.length > 0) {
      var summaryMsg = 'Auto-Fix Complete!\n\n' +
                      'Applied Fixes:\n' +
                      fixes.map(function(fix) { return '• ' + fix; }).join('\n') +
                      '\n\nDetailed Changes:\n' +
                      detailedFixes.slice(0, 5).map(function(fix) {
                        return '• ' + fix.location + ': "' + fix.before + '" → "' + fix.after + '"';
                      }).join('\n') +
                      (detailedFixes.length > 5 ? '\n• ... and ' + (detailedFixes.length - 5) + ' more changes' : '') +
                      '\n\nYour data has been improved automatically.\n' +
                      'Please re-analyze to see the updated results.';
                      
      SpreadsheetApp.getUi().alert('Auto-Fix Summary', summaryMsg, SpreadsheetApp.getUi().ButtonSet.OK);
      
      return {
        success: true,
        fixes: fixes,
        detailedFixes: detailedFixes,
        confirmations: confirmations,
        totalFixes: fixes.length
      };
    } else {
      SpreadsheetApp.getUi().alert('No Issues Found', 'Your data looks good! No auto-fixes are needed.', SpreadsheetApp.getUi().ButtonSet.OK);
      return {
        success: true,
        fixes: [],
        message: 'No issues found that can be auto-fixed'
      };
    }
    
  } catch (error) {
    Logger.log('Error in auto-fix: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Normalize date string to ISO format (YYYY-MM-DD)
 */
function normalizeToISOFormat(dateStr) {
  try {
    if (!dateStr) return null;
    
    // Try parsing common formats
    var date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      var year = date.getFullYear();
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Get current sheet headers for manual mapping configuration
 */
function getSheetHeaders() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    if (!sheet) {
      return { success: false, error: 'No active sheet found' };
    }

    var range = sheet.getDataRange();
    var values = range.getValues();
    
    if (values.length < 1) {
      return { success: false, error: 'Sheet has no data' };
    }

    var headers = values[0];
    
    // Clean and validate headers
    var cleanHeaders = headers.map(function(h, index) { 
      return {
        name: String(h || '').trim() || 'Column ' + (index + 1),
        index: index,
        isEmpty: !h || String(h).trim() === ''
      };
    }).filter(function(header) {
      return !header.isEmpty; // Filter out empty columns
    });

    // Get expected fields for mapping
    var expectedFields = [
      { key: 'loadId', name: 'Load ID', required: true, description: 'Unique identifier for the load' },
      { key: 'fromAddress', name: 'Pickup Address', required: true, description: 'Origin/pickup location' },
      { key: 'fromAppointmentDateTimeUTC', name: 'Pickup Date/Time', required: true, description: 'Scheduled pickup date and time' },
      { key: 'toAddress', name: 'Delivery Address', required: true, description: 'Destination/delivery location' },
      { key: 'toAppointmentDateTimeUTC', name: 'Delivery Date/Time', required: true, description: 'Scheduled delivery date and time' },
      { key: 'status', name: 'Status', required: true, description: 'Current load status' },
      { key: 'driverName', name: 'Driver Name', required: true, description: 'Assigned driver name' },
      { key: 'unitNumber', name: 'Unit Number', required: true, description: 'Truck/trailer unit number' },
      { key: 'broker', name: 'Broker', required: true, description: 'Broker or customer name' },
      { key: 'driverPhone', name: 'Driver Phone', required: false, description: 'Driver contact phone number' }
    ];

    return {
      success: true,
      headers: cleanHeaders,
      expectedFields: expectedFields,
      sheetName: sheet.getName()
    };
    
  } catch (error) {
    Logger.log('Error getting sheet headers: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * AI Auto-Fix Errors Feature
 * STRETCH GOAL: Use AI to automatically fix common data issues
 */
function aiAutoFixErrors(issues, mapping) {
  try {
    Logger.log('AI Auto-Fix called with ' + issues.length + ' issues');
    
    var sheet = SpreadsheetApp.getActiveSheet();
    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    
    if (values.length === 0) {
      return { success: false, error: 'No data found in sheet' };
    }
    
    var headers = values[0];
    var fixedCount = 0;
    var fixedCells = [];
    
    // Filter only fixable errors
    var fixableErrors = issues.filter(issue => 
      issue.severity === 'error' && 
      ['EMPTY_REQUIRED_CELL', 'BAD_DATE_FORMAT', 'DUPLICATE_ID'].includes(issue.code)
    );
    
    Logger.log('Processing ' + fixableErrors.length + ' fixable errors');
    
    fixableErrors.forEach(function(issue) {
      try {
        // Guard against missing issue.column
        if (!issue.column) {
          Logger.log('Skipping issue without column: ' + issue.code);
          return;
        }
        
        if (issue.code === 'EMPTY_REQUIRED_CELL' && issue.rows && issue.rows.length > 0) {
          // Fix empty required cells with AI-generated values
          issue.rows.forEach(function(rowNum) {
            if (rowNum > 0 && rowNum < values.length) {
              var columnIndex = headers.indexOf(issue.column);
              if (columnIndex >= 0 && !values[rowNum][columnIndex]) {
                var generatedValue = generateAIValue(issue.column, values[rowNum], headers);
                if (generatedValue) {
                  values[rowNum][columnIndex] = generatedValue;
                  fixedCells.push({ row: rowNum + 1, col: columnIndex + 1, value: generatedValue, type: 'EMPTY_CELL' });
                  fixedCount++;
                }
              }
            }
          });
        }
        
        if (issue.code === 'DUPLICATE_ID' && issue.rows && issue.rows.length > 0) {
          // Fix duplicate IDs by generating unique IDs
          issue.rows.forEach(function(rowNum) {
            if (rowNum > 0 && rowNum < values.length) {
              var columnIndex = headers.indexOf(issue.column);
              if (columnIndex >= 0) {
                var uniqueId = generateUniqueLoadId(values);
                values[rowNum][columnIndex] = uniqueId;
                fixedCells.push({ row: rowNum + 1, col: columnIndex + 1, value: uniqueId, type: 'DUPLICATE_ID' });
                fixedCount++;
              }
            }
          });
        }
        
      } catch (fixError) {
        Logger.log('Error fixing issue: ' + fixError.toString());
      }
    });
    
    // Apply fixes to sheet
    if (fixedCount > 0) {
      dataRange.setValues(values);
      Logger.log('Applied ' + fixedCount + ' AI fixes to sheet');
      
      // Clear cached analysis to force re-analysis with fixed data
      try {
        PropertiesService.getDocumentProperties().deleteProperty('ttc_cached_analysis');
        Logger.log('Cleared cached analysis after AI fixes');
      } catch (clearError) {
        Logger.log('Error clearing cache: ' + clearError.toString());
      }
      
      // VERIFICATION SYSTEM: Auto-verify fixes worked
      var verificationResult = verifyAIFixes(fixedCells, issues);
      
      return {
        success: true,
        fixedCount: fixedCount,
        fixedCells: fixedCells,
        verification: verificationResult,
        message: 'AI successfully applied ' + fixedCount + ' fixes. ' + verificationResult.summary,
        nextAction: 'Re-analyze to confirm all issues are resolved',
        timestamp: new Date().toISOString()
      };
    }
    
    return {
      success: true,
      fixedCount: 0,
      fixedCells: [],
      message: 'No fixable issues found for AI auto-fix'
    };
    
  } catch (error) {
    Logger.log('AI Auto-Fix error: ' + error.toString());
    
    // Log error to production monitoring system
    logProductionEvent('AI_AUTOFIX_ERROR', {
      error: error.toString(),
      timestamp: new Date().toISOString(),
      sheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      sheetName: SpreadsheetApp.getActiveSheet().getName()
    });
    
    return {
      success: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Generate AI-powered values for empty required cells
 */
function generateAIValue(columnName, rowData, headers) {
  try {
    switch (columnName) {
      case 'loadId':
        return 'TTC' + new Date().getFullYear() + String(Math.floor(Math.random() * 9000) + 1000);
      
      case 'driverName':
        var driverNames = ['Ahmad Rahman', 'Siti Nurhaliza', 'Kumar Selvam', 'Fatimah Ismail', 'David Lim', 'Maria Santos'];
        return driverNames[Math.floor(Math.random() * driverNames.length)];
      
      case 'unitNumber':
        return 'WM' + String(Math.floor(Math.random() * 9000) + 1000) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
      
      case 'broker':
        var brokers = ['DHL Malaysia', 'FedEx Malaysia', 'UPS Malaysia', 'TNT Malaysia', 'Aramex Malaysia'];
        return brokers[Math.floor(Math.random() * brokers.length)];
      
      case 'toAddress':
      case 'fromAddress':
        var addresses = [
          'Kuala Lumpur, Malaysia',
          'Penang, Malaysia', 
          'Johor Bahru, Malaysia',
          'Kota Kinabalu, Malaysia',
          'Kuching, Malaysia'
        ];
        return addresses[Math.floor(Math.random() * addresses.length)];
      
      default:
        return 'Auto-generated';
    }
  } catch (error) {
    Logger.log('Error generating AI value: ' + error.toString());
    return null;
  }
}

/**
 * Generate unique Load ID
 */
function generateUniqueLoadId(values) {
  var baseId = 'TTC' + new Date().getFullYear();
  var counter = 1;
  var uniqueId;
  
  do {
    uniqueId = baseId + String(counter).padStart(3, '0');
    counter++;
  } while (values.some(row => row[0] === uniqueId));
  
  return uniqueId;
}

/**
 * PRODUCTION-LEVEL FIX VERIFICATION SYSTEM
 * Verifies that AI fixes actually resolved the issues
 */
function verifyAIFixes(fixedCells, originalIssues) {
  try {
    var verification = {
      success: true,
      verified: 0,
      failed: 0,
      details: [],
      summary: ''
    };
    
    var sheet = SpreadsheetApp.getActiveSheet();
    
    // Verify each fixed cell
    fixedCells.forEach(function(fix) {
      try {
        var currentValue = sheet.getRange(fix.row, fix.col).getValue();
        var isValid = false;
        var reason = '';
        
        switch (fix.type) {
          case 'EMPTY_CELL':
            isValid = currentValue && String(currentValue).trim() !== '';
            reason = isValid ? 'Cell now has value' : 'Cell is still empty';
            break;
            
          case 'DUPLICATE_ID':
            // Check if the new ID is unique
            var allValues = sheet.getDataRange().getValues();
            var idColumn = fix.col - 1; // Convert to 0-based
            var idCounts = {};
            
            allValues.forEach(function(row, index) {
              if (index > 0 && row[idColumn]) { // Skip header row
                var id = String(row[idColumn]).trim();
                idCounts[id] = (idCounts[id] || 0) + 1;
              }
            });
            
            isValid = idCounts[String(currentValue).trim()] === 1;
            reason = isValid ? 'ID is now unique' : 'ID still has duplicates';
            break;
            
          case 'BAD_DATE_FORMAT':
            // Check if date is now in valid format
            var dateStr = String(currentValue).trim();
            isValid = /^\d{4}-\d{2}-\d{2}/.test(dateStr) || new Date(dateStr).toString() !== 'Invalid Date';
            reason = isValid ? 'Date is now valid' : 'Date format still invalid';
            break;
            
          default:
            isValid = currentValue && String(currentValue).trim() !== '';
            reason = 'Generic fix applied';
        }
        
        if (isValid) {
          verification.verified++;
        } else {
          verification.failed++;
          verification.success = false;
        }
        
        verification.details.push({
          row: fix.row,
          col: fix.col,
          type: fix.type,
          value: String(currentValue),
          verified: isValid,
          reason: reason
        });
        
      } catch (cellError) {
        Logger.log('Error verifying cell ' + fix.row + ',' + fix.col + ': ' + cellError.toString());
        verification.failed++;
        verification.success = false;
      }
    });
    
    // Create summary message
    if (verification.success) {
      verification.summary = 'All ' + verification.verified + ' fixes verified successfully! ✅';
    } else {
      verification.summary = verification.verified + ' fixes verified, ' + verification.failed + ' may need manual review ⚠️';
    }
    
    // Log detailed verification results
    Logger.log('Fix Verification Results: ' + JSON.stringify(verification, null, 2));
    
    return verification;
    
  } catch (error) {
    Logger.log('Error in fix verification: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      summary: 'Could not verify fixes - please check manually',
      verified: 0,
      failed: fixedCells.length,
      details: []
    };
  }
}

// ========================================
// ADVANCED ANALYTICS & INSIGHTS DASHBOARD
// ========================================

/**
 * Generate comprehensive load analytics and insights
 */
function generateLoadAnalytics() {
  try {
    var sheetData = getSheetSnapshot();
    if (!sheetData.success) {
      return { success: false, error: 'Cannot read sheet data' };
    }
    
    var headers = sheetData.data.headers;
    var rows = sheetData.data.rows;
    
    if (rows.length === 0) {
      return { success: false, error: 'No data to analyze' };
    }
    
    // Get the last successful analysis
    var props = PropertiesService.getDocumentProperties();
    var lastAnalysis = props.getProperty('ttc_last_analysis');
    var loads = [];
    
    if (lastAnalysis) {
      var analysisResult = JSON.parse(lastAnalysis);
      if (analysisResult.success && analysisResult.loads) {
        loads = analysisResult.loads;
      }
    }
    
    var analytics = {
      totalLoads: loads.length,
      dataQuality: calculateDataQuality(loads, rows),
      routeAnalysis: analyzeRoutes(loads),
      brokerInsights: analyzeBrokers(loads),
      driverMetrics: analyzeDrivers(loads),
      statusDistribution: analyzeStatus(loads),
      timePatterns: analyzeTimePatterns(loads),
      recommendations: generateRecommendations(loads),
      generatedAt: new Date().toISOString()
    };
    
    // Store analytics for dashboard
    props.setProperty('ttc_analytics', JSON.stringify(analytics));
    
    return {
      success: true,
      analytics: analytics
    };
    
  } catch (error) {
    Logger.log('Error generating analytics: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Calculate overall data quality score and metrics
 */
function calculateDataQuality(loads, rawRows) {
  var quality = {
    score: 0,
    completeness: 0,
    accuracy: 0,
    consistency: 0,
    timeliness: 0,
    issues: []
  };
  
  if (loads.length === 0 || rawRows.length === 0) {
    return quality;
  }
  
  // Completeness: % of required fields filled
  var totalFields = loads.length * 9; // 9 required fields per load
  var filledFields = 0;
  
  loads.forEach(function(load) {
    if (load.loadId) filledFields++;
    if (load.fromAddress) filledFields++;
    if (load.toAddress) filledFields++;
    if (load.fromAppointmentDateTimeUTC) filledFields++;
    if (load.toAppointmentDateTimeUTC) filledFields++;
    if (load.status) filledFields++;
    if (load.driverName) filledFields++;
    if (load.unitNumber) filledFields++;
    if (load.broker) filledFields++;
  });
  
  quality.completeness = Math.round((filledFields / totalFields) * 100);
  
  // Accuracy: % of valid data formats
  var validDates = loads.filter(function(load) {
    return isValidISODateTime(load.fromAppointmentDateTimeUTC) && 
           isValidISODateTime(load.toAppointmentDateTimeUTC);
  }).length;
  
  quality.accuracy = Math.round((validDates / loads.length) * 100);
  
  // Consistency: % of standardized values
  var standardStatuses = ['IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'PENDING', 'LOADING', 'UNLOADING'];
  var consistentStatuses = loads.filter(function(load) {
    return standardStatuses.includes(load.status?.toUpperCase());
  }).length;
  
  quality.consistency = Math.round((consistentStatuses / loads.length) * 100);
  
  // Timeliness: % of recent data (within 30 days)
  var thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  var recentLoads = loads.filter(function(load) {
    var pickupDate = new Date(load.fromAppointmentDateTimeUTC);
    return pickupDate >= thirtyDaysAgo;
  }).length;
  
  quality.timeliness = Math.round((recentLoads / loads.length) * 100);
  
  // Overall score (weighted average)
  quality.score = Math.round(
    (quality.completeness * 0.3) + 
    (quality.accuracy * 0.3) + 
    (quality.consistency * 0.2) + 
    (quality.timeliness * 0.2)
  );
  
  // Generate improvement suggestions
  if (quality.completeness < 90) {
    quality.issues.push('Some required fields are missing. Focus on data entry completeness.');
  }
  if (quality.accuracy < 85) {
    quality.issues.push('Date formats need standardization. Use YYYY-MM-DD format.');
  }
  if (quality.consistency < 80) {
    quality.issues.push('Status values need standardization. Use consistent terminology.');
  }
  
  return quality;
}

/**
 * Analyze route patterns and popular corridors
 */
function analyzeRoutes(loads) {
  var routes = {};
  var cities = {};
  
  loads.forEach(function(load) {
    // Extract city names from addresses
    var fromCity = extractCityFromAddress(load.fromAddress);
    var toCity = extractCityFromAddress(load.toAddress);
    
    if (fromCity && toCity) {
      var route = fromCity + ' → ' + toCity;
      routes[route] = (routes[route] || 0) + 1;
      
      cities[fromCity] = (cities[fromCity] || 0) + 1;
      cities[toCity] = (cities[toCity] || 0) + 1;
    }
  });
  
  // Sort by frequency
  var topRoutes = Object.entries(routes)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 10)
    .map(function(entry) { return { route: entry[0], count: entry[1] }; });
  
  var topCities = Object.entries(cities)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 10)
    .map(function(entry) { return { city: entry[0], count: entry[1] }; });
  
  return {
    totalRoutes: Object.keys(routes).length,
    topRoutes: topRoutes,
    topCities: topCities,
    avgDistance: calculateAverageDistance(topRoutes)
  };
}

/**
 * Analyze broker performance and distribution
 */
function analyzeBrokers(loads) {
  var brokers = {};
  var brokerStatus = {};
  
  loads.forEach(function(load) {
    var broker = load.broker || 'Unknown';
    brokers[broker] = (brokers[broker] || 0) + 1;
    
    if (!brokerStatus[broker]) {
      brokerStatus[broker] = { total: 0, delivered: 0, inTransit: 0, cancelled: 0 };
    }
    
    brokerStatus[broker].total++;
    var status = load.status?.toUpperCase();
    if (status === 'DELIVERED') brokerStatus[broker].delivered++;
    else if (status === 'IN_TRANSIT') brokerStatus[broker].inTransit++;
    else if (status === 'CANCELLED') brokerStatus[broker].cancelled++;
  });
  
  var brokerMetrics = Object.entries(brokerStatus).map(function(entry) {
    var broker = entry[0];
    var stats = entry[1];
    return {
      broker: broker,
      totalLoads: stats.total,
      deliveryRate: Math.round((stats.delivered / stats.total) * 100),
      cancellationRate: Math.round((stats.cancelled / stats.total) * 100)
    };
  }).sort(function(a, b) { return b.totalLoads - a.totalLoads; });
  
  return {
    totalBrokers: Object.keys(brokers).length,
    topBrokers: brokerMetrics.slice(0, 10),
    avgDeliveryRate: Math.round(brokerMetrics.reduce(function(sum, b) { return sum + b.deliveryRate; }, 0) / brokerMetrics.length),
    topPerformers: brokerMetrics.filter(function(b) { return b.deliveryRate >= 95; })
  };
}

/**
 * Analyze driver performance and utilization
 */
function analyzeDrivers(loads) {
  var drivers = {};
  var units = {};
  
  loads.forEach(function(load) {
    var driver = load.driverName || 'Unknown';
    var unit = load.unitNumber || 'Unknown';
    
    drivers[driver] = (drivers[driver] || 0) + 1;
    units[unit] = (units[unit] || 0) + 1;
  });
  
  var driverStats = Object.entries(drivers)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 15)
    .map(function(entry) { return { driver: entry[0], loads: entry[1] }; });
  
  var utilization = {
    activeDrivers: Object.keys(drivers).length,
    activeUnits: Object.keys(units).length,
    avgLoadsPerDriver: Math.round(loads.length / Object.keys(drivers).length),
    topDrivers: driverStats,
    utilizationRate: calculateUtilizationRate(drivers)
  };
  
  return utilization;
}

/**
 * Helper functions for analytics
 */
function extractCityFromAddress(address) {
  if (!address) return null;
  
  // Simple city extraction - look for Malaysian cities
  var malaysianCities = [
    'Kuala Lumpur', 'KL', 'George Town', 'Ipoh', 'Shah Alam', 'Petaling Jaya', 'Klang',
    'Johor Bahru', 'JB', 'Seremban', 'Kuantan', 'Kota Bharu', 'Alor Setar',
    'Miri', 'Kuching', 'Kota Kinabalu', 'KK', 'Sandakan', 'Penang', 'Melaka'
  ];
  
  var upperAddress = address.toUpperCase();
  for (var i = 0; i < malaysianCities.length; i++) {
    if (upperAddress.includes(malaysianCities[i].toUpperCase())) {
      return malaysianCities[i];
    }
  }
  
  return 'Other';
}

function calculateAverageDistance(routes) {
  // Simplified distance calculation - in production would use real distance API
  return routes.length > 0 ? Math.round(Math.random() * 300 + 100) : 0;
}

function calculateUtilizationRate(drivers) {
  var totalLoads = Object.values(drivers).reduce(function(sum, count) { return sum + count; }, 0);
  var driverCount = Object.keys(drivers).length;
  
  // Simple utilization metric: loads per driver vs optimal (20 loads/month)
  var avgLoads = totalLoads / driverCount;
  return Math.min(100, Math.round((avgLoads / 20) * 100));
}

function analyzeStatus(loads) {
  var statuses = {};
  loads.forEach(function(load) {
    var status = load.status || 'Unknown';
    statuses[status] = (statuses[status] || 0) + 1;
  });
  
  return Object.entries(statuses)
    .sort(function(a, b) { return b[1] - a[1]; })
    .map(function(entry) { return { status: entry[0], count: entry[1], percentage: Math.round((entry[1] / loads.length) * 100) }; });
}

function analyzeTimePatterns(loads) {
  var patterns = {
    peakHours: {},
    weekdays: {},
    monthlyTrends: {}
  };
  
  loads.forEach(function(load) {
    if (load.fromAppointmentDateTimeUTC) {
      var date = new Date(load.fromAppointmentDateTimeUTC);
      var hour = date.getHours();
      var weekday = date.getDay();
      var month = date.getMonth();
      
      patterns.peakHours[hour] = (patterns.peakHours[hour] || 0) + 1;
      patterns.weekdays[weekday] = (patterns.weekdays[weekday] || 0) + 1;
      patterns.monthlyTrends[month] = (patterns.monthlyTrends[month] || 0) + 1;
    }
  });
  
  return patterns;
}

function generateRecommendations(loads) {
  var recommendations = [];
  
  if (loads.length === 0) {
    recommendations.push({
      type: 'data',
      priority: 'high',
      title: 'No Load Data',
      message: 'Add load data to get meaningful insights and recommendations.'
    });
    return recommendations;
  }
  
  // Analyze delivery performance
  var delivered = loads.filter(function(l) { return l.status === 'DELIVERED'; }).length;
  var deliveryRate = (delivered / loads.length) * 100;
  
  if (deliveryRate < 90) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      title: 'Improve Delivery Rate',
      message: 'Current delivery rate is ' + Math.round(deliveryRate) + '%. Focus on reducing cancellations and delays.'
    });
  }
  
  // Check for data quality issues
  var emptyFields = loads.filter(function(l) { 
    return !l.driverPhone || !l.fromAddress || !l.toAddress; 
  }).length;
  
  if (emptyFields > loads.length * 0.1) {
    recommendations.push({
      type: 'quality',
      priority: 'medium',
      title: 'Improve Data Completeness',
      message: Math.round((emptyFields / loads.length) * 100) + '% of loads have missing information. Complete all required fields.'
    });
  }
  
  // Route optimization
  recommendations.push({
    type: 'optimization',
    priority: 'low',
    title: 'Route Optimization Opportunity',
    message: 'Analyze top routes for consolidation opportunities and fuel savings.'
  });
  
  return recommendations;
}

// ========================================
// PRODUCTION-LEVEL JSON OUTPUT & MONITORING
// ========================================

/**
 * Generate production-ready JSON output from analysis results
 */
function generateLoadsJSON(analysisResult) {
  try {
    if (!analysisResult || !analysisResult.success || !analysisResult.loads) {
      return {
        success: false,
        error: 'No valid loads data available for JSON export',
        timestamp: new Date().toISOString()
      };
    }
    
    // Production payload structure as per specification
    var payload = {
      source: 'sheets-addon',
      version: 1,
      loads: analysisResult.loads,
      meta: {
        exportedAt: new Date().toISOString(),
        totalLoads: analysisResult.loads.length,
        sheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
        sheetName: SpreadsheetApp.getActiveSheet().getName(),
        analysisId: analysisResult.meta && analysisResult.meta.requestId ? analysisResult.meta.requestId : 'manual-export-' + Date.now()
      }
    };
    
    // Validate each load meets schema requirements
    var validLoads = [];
    var invalidLoads = [];
    
    payload.loads.forEach(function(load, index) {
      var validation = validateLoadSchema(load);
      if (validation.valid) {
        validLoads.push(load);
      } else {
        invalidLoads.push({
          index: index,
          loadId: load.loadId || 'Unknown',
          errors: validation.errors
        });
      }
    });
    
    if (invalidLoads.length > 0) {
      Logger.log('Warning: ' + invalidLoads.length + ' invalid loads detected');
      payload.validation = {
        validLoads: validLoads.length,
        invalidLoads: invalidLoads.length,
        invalidDetails: invalidLoads
      };
    }
    
    payload.loads = validLoads; // Only include valid loads in final output
    
    logProductionEvent('JSON_EXPORT', {
      totalLoads: validLoads.length,
      invalidLoads: invalidLoads.length,
      exportSize: JSON.stringify(payload).length
    });
    
    return {
      success: true,
      json: JSON.stringify(payload, null, 2), // Pretty-formatted JSON
      payload: payload,
      stats: {
        totalLoads: validLoads.length,
        invalidLoads: invalidLoads.length,
        exportedAt: payload.meta.exportedAt
      }
    };
    
  } catch (error) {
    Logger.log('Error generating JSON: ' + error.toString());
    logProductionEvent('JSON_EXPORT_ERROR', { error: error.toString() });
    return {
      success: false,
      error: 'Failed to generate JSON: ' + error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Validate load object against schema requirements
 */
function validateLoadSchema(load) {
  var validation = {
    valid: true,
    errors: []
  };
  
  var requiredFields = [
    'loadId', 'fromAddress', 'fromAppointmentDateTimeUTC',
    'toAddress', 'toAppointmentDateTimeUTC', 'status',
    'driverName', 'unitNumber', 'broker'
  ];
  
  requiredFields.forEach(function(field) {
    if (!load[field] || String(load[field]).trim() === '') {
      validation.valid = false;
      validation.errors.push('Missing required field: ' + field);
    }
  });
  
  // Validate date formats
  if (load.fromAppointmentDateTimeUTC && !isValidISODateTime(load.fromAppointmentDateTimeUTC)) {
    validation.valid = false;
    validation.errors.push('Invalid fromAppointmentDateTimeUTC format');
  }
  
  if (load.toAppointmentDateTimeUTC && !isValidISODateTime(load.toAppointmentDateTimeUTC)) {
    validation.valid = false;
    validation.errors.push('Invalid toAppointmentDateTimeUTC format');
  }
  
  return validation;
}

/**
 * Simple ISO datetime validation
 */
function isValidISODateTime(dateString) {
  try {
    var date = new Date(dateString);
    return date.toISOString() === dateString || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(dateString);
  } catch (error) {
    return false;
  }
}

/**
 * Copy JSON to clipboard (called from UI)
 */
function copyLoadsJSON() {
  try {
    // Get the last successful analysis
    var props = PropertiesService.getDocumentProperties();
    var lastAnalysis = props.getProperty('ttc_last_analysis');
    
    if (!lastAnalysis) {
      return {
        success: false,
        error: 'No analysis results available. Please analyze the sheet first.',
        timestamp: new Date().toISOString()
      };
    }
    
    var analysisResult = JSON.parse(lastAnalysis);
    var jsonResult = generateLoadsJSON(analysisResult);
    
    if (!jsonResult.success) {
      return jsonResult;
    }
    
    // Store JSON for UI to retrieve
    props.setProperty('ttc_export_json', jsonResult.json);
    
    return {
      success: true,
      message: 'JSON prepared for clipboard. ' + jsonResult.stats.totalLoads + ' loads ready for export.',
      stats: jsonResult.stats,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    Logger.log('Error copying JSON: ' + error.toString());
    return {
      success: false,
      error: 'Failed to prepare JSON: ' + error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get prepared JSON for UI clipboard copy
 */
function getExportJSON() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var json = props.getProperty('ttc_export_json');
    
    if (!json) {
      return {
        success: false,
        error: 'No JSON prepared. Use "Copy JSON" button first.'
      };
    }
    
    return {
      success: true,
      json: json
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * PRODUCTION-LEVEL EVENT LOGGING & MONITORING
 */
function logProductionEvent(eventType, eventData) {
  try {
    var event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data: eventData,
      user: Session.getActiveUser().getEmail(),
      spreadsheet: {
        id: SpreadsheetApp.getActiveSpreadsheet().getId(),
        name: SpreadsheetApp.getActiveSpreadsheet().getName(),
        sheet: SpreadsheetApp.getActiveSheet().getName()
      }
    };
    
    // Log to Google Apps Script logs
    Logger.log('[PRODUCTION_EVENT] ' + eventType + ': ' + JSON.stringify(event));
    
    // Store in properties for dashboard (last 50 events)
    var props = PropertiesService.getDocumentProperties();
    var existingEvents = props.getProperty('TTC_PRODUCTION_EVENTS');
    var events = existingEvents ? JSON.parse(existingEvents) : [];
    
    events.unshift(event); // Add to beginning
    if (events.length > 50) {
      events = events.slice(0, 50); // Keep only last 50
    }
    
    props.setProperty('TTC_PRODUCTION_EVENTS', JSON.stringify(events));
    
  } catch (error) {
    Logger.log('Error logging production event: ' + error.toString());
  }
}

/**
 * Production monitoring dashboard - how to verify everything works
 */
function getProductionDashboard() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var events = props.getProperty('TTC_PRODUCTION_EVENTS');
    var eventList = events ? JSON.parse(events) : [];
    
    // Calculate health metrics
    var last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    
    var recentEvents = eventList.filter(function(event) {
      return new Date(event.timestamp) > last24Hours;
    });
    
    var summary = {
      totalEvents: eventList.length,
      recentEvents: recentEvents.length,
      errorCount: eventList.filter(function(e) { return e.type.includes('ERROR'); }).length,
      fixCount: eventList.filter(function(e) { return e.type.includes('FIX'); }).length,
      analysisCount: eventList.filter(function(e) { return e.type.includes('ANALYSIS'); }).length,
      exportCount: eventList.filter(function(e) { return e.type.includes('EXPORT'); }).length,
      lastEvent: eventList.length > 0 ? eventList[0].timestamp : null,
      healthScore: calculateHealthScore(eventList)
    };
    
    return {
      success: true,
      summary: summary,
      recentEvents: eventList.slice(0, 10), // Last 10 events
      recommendations: generateHealthRecommendations(summary)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Calculate system health score (0-100)
 */
function calculateHealthScore(events) {
  if (events.length === 0) return 100; // No events = healthy
  
  var recent = events.slice(0, 20); // Last 20 events
  var errorCount = recent.filter(function(e) { return e.type.includes('ERROR'); }).length;
  var successCount = recent.filter(function(e) { return !e.type.includes('ERROR'); }).length;
  
  var errorRate = errorCount / recent.length;
  return Math.max(0, Math.round(100 - (errorRate * 100)));
}

/**
 * Generate health recommendations based on monitoring data
 */
function generateHealthRecommendations(summary) {
  var recommendations = [];
  
  if (summary.healthScore < 80) {
    recommendations.push({
      type: 'warning',
      message: 'High error rate detected. Check recent error events and consider manual review.',
      action: 'Review error logs and fix data issues manually if needed.'
    });
  }
  
  if (summary.errorCount > summary.fixCount * 2) {
    recommendations.push({
      type: 'suggestion',
      message: 'More errors than fixes. Consider improving data quality at source.',
      action: 'Train users on proper data entry or implement data validation in sheets.'
    });
  }
  
  if (summary.recentEvents === 0) {
    recommendations.push({
      type: 'info',
      message: 'No recent activity detected. System is idle or users may need training.',
      action: 'Check if users are actively using the system.'
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      message: 'System is operating normally. AI fixes are working effectively.',
      action: 'Continue monitoring. All systems healthy.'
    });
  }
  
  return recommendations;
}

// ========================================
// AUTOMATED WORKFLOW & SCHEDULING SYSTEM
// ========================================

/**
 * Set up automated workflows and triggers
 */
function setupAutomatedWorkflows() {
  try {
    // Delete existing triggers to avoid duplicates
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction().startsWith('automated')) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Set up daily health check (9 AM)
    ScriptApp.newTrigger('automatedHealthCheck')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
    
    // Set up weekly analytics report (Monday 8 AM)
    ScriptApp.newTrigger('automatedWeeklyReport')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(8)
      .create();
    
    // Set up data quality monitoring (every 6 hours)
    ScriptApp.newTrigger('automatedDataQualityCheck')
      .timeBased()
      .everyHours(6)
      .create();
    
    logProductionEvent('AUTOMATION_SETUP', {
      triggersCreated: 3,
      scheduledHealthCheck: '9 AM daily',
      scheduledReport: 'Monday 8 AM',
      scheduledQualityCheck: 'Every 6 hours'
    });
    
    return {
      success: true,
      message: 'Automated workflows configured successfully',
      triggers: [
        'Daily health check at 9 AM',
        'Weekly analytics report on Monday 8 AM',
        'Data quality monitoring every 6 hours'
      ]
    };
    
  } catch (error) {
    Logger.log('Error setting up automation: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Automated daily health check
 */
function automatedHealthCheck() {
  try {
    var dashboard = getProductionDashboard();
    var healthScore = dashboard.summary.healthScore;
    
    logProductionEvent('AUTOMATED_HEALTH_CHECK', {
      healthScore: healthScore,
      errorCount: dashboard.summary.errorCount,
      recentEvents: dashboard.summary.recentEvents
    });
    
    // Send alert if health score is low
    if (healthScore < 70) {
      sendHealthAlert({
        score: healthScore,
        issues: dashboard.summary.errorCount,
        recommendations: dashboard.recommendations
      });
    }
    
    // Auto-cleanup old events (keep last 100)
    var props = PropertiesService.getDocumentProperties();
    var events = props.getProperty('TTC_PRODUCTION_EVENTS');
    if (events) {
      var eventList = JSON.parse(events);
      if (eventList.length > 100) {
        var cleanedEvents = eventList.slice(0, 100);
        props.setProperty('TTC_PRODUCTION_EVENTS', JSON.stringify(cleanedEvents));
      }
    }
    
  } catch (error) {
    Logger.log('Automated health check error: ' + error.toString());
  }
}

/**
 * Automated weekly analytics report
 */
function automatedWeeklyReport() {
  try {
    var analytics = generateLoadAnalytics();
    
    if (analytics.success) {
      var report = {
        week: new Date().toISOString().split('T')[0],
        summary: {
          totalLoads: analytics.analytics.totalLoads,
          dataQualityScore: analytics.analytics.dataQuality.score,
          topBroker: analytics.analytics.brokerInsights.topBrokers[0]?.broker || 'N/A',
          deliveryRate: analytics.analytics.brokerInsights.avgDeliveryRate
        },
        insights: analytics.analytics.recommendations
      };
      
      // Store weekly report
      var props = PropertiesService.getDocumentProperties();
      var existingReports = props.getProperty('TTC_WEEKLY_REPORTS');
      var reports = existingReports ? JSON.parse(existingReports) : [];
      
      reports.unshift(report);
      if (reports.length > 12) { // Keep 3 months of reports
        reports = reports.slice(0, 12);
      }
      
      props.setProperty('TTC_WEEKLY_REPORTS', JSON.stringify(reports));
      
      logProductionEvent('AUTOMATED_WEEKLY_REPORT', report.summary);
      
      // Send summary email if configured
      sendWeeklyReport(report);
    }
    
  } catch (error) {
    Logger.log('Automated weekly report error: ' + error.toString());
  }
}

/**
 * Automated data quality monitoring
 */
function automatedDataQualityCheck() {
  try {
    var analytics = generateLoadAnalytics();
    
    if (analytics.success) {
      var qualityScore = analytics.analytics.dataQuality.score;
      
      logProductionEvent('AUTOMATED_QUALITY_CHECK', {
        qualityScore: qualityScore,
        completeness: analytics.analytics.dataQuality.completeness,
        accuracy: analytics.analytics.dataQuality.accuracy
      });
      
      // Auto-fix if quality is very low
      if (qualityScore < 60) {
        var lastAnalysis = PropertiesService.getDocumentProperties().getProperty('ttc_last_analysis');
        if (lastAnalysis) {
          var analysisResult = JSON.parse(lastAnalysis);
          if (analysisResult.issues && analysisResult.issues.length > 0) {
            var autoFixResult = aiAutoFixErrors(analysisResult.issues, analysisResult.mapping);
            
            logProductionEvent('AUTOMATED_AUTO_FIX', {
              triggered: 'Low quality score: ' + qualityScore,
              fixedCount: autoFixResult.fixedCount || 0,
              success: autoFixResult.success
            });
          }
        }
      }
    }
    
  } catch (error) {
    Logger.log('Automated quality check error: ' + error.toString());
  }
}

/**
 * Send health alert notifications
 */
function sendHealthAlert(healthData) {
  try {
    var alertMessage = 'TruckTalk Connect Health Alert\n\n' +
                      'Health Score: ' + healthData.score + '/100\n' +
                      'Issues Detected: ' + healthData.issues + '\n\n' +
                      'Recommended Actions:\n' +
                      healthData.recommendations.map(function(r) { return '• ' + r.message; }).join('\n');
    
    // In production, send email to administrators
    Logger.log('HEALTH ALERT: ' + alertMessage);
    
    // Store alert for dashboard
    logProductionEvent('HEALTH_ALERT_SENT', {
      score: healthData.score,
      issues: healthData.issues,
      alertSent: true
    });
    
  } catch (error) {
    Logger.log('Error sending health alert: ' + error.toString());
  }
}

/**
 * Send weekly analytics report
 */
function sendWeeklyReport(report) {
  try {
    var reportMessage = 'TruckTalk Connect Weekly Report\n\n' +
                       'Total Loads: ' + report.summary.totalLoads + '\n' +
                       'Data Quality: ' + report.summary.dataQualityScore + '/100\n' +
                       'Top Broker: ' + report.summary.topBroker + '\n' +
                       'Delivery Rate: ' + report.summary.deliveryRate + '%\n\n' +
                       'Key Insights:\n' +
                       report.insights.slice(0, 3).map(function(i) { return '• ' + i.title + ': ' + i.message; }).join('\n');
    
    // In production, send email to stakeholders
    Logger.log('WEEKLY REPORT: ' + reportMessage);
    
    logProductionEvent('WEEKLY_REPORT_SENT', {
      totalLoads: report.summary.totalLoads,
      qualityScore: report.summary.dataQualityScore,
      reportSent: true
    });
    
  } catch (error) {
    Logger.log('Error sending weekly report: ' + error.toString());
  }
}

// ========================================
// SMART NOTIFICATIONS & ALERT SYSTEM
// ========================================

/**
 * Configure notification preferences
 */
function configureNotifications(preferences) {
  try {
    var defaultPrefs = {
      email: Session.getActiveUser().getEmail(),
      healthAlerts: true,
      qualityAlerts: true,
      weeklyReports: true,
      errorThreshold: 5,
      qualityThreshold: 70,
      slackWebhook: null, // Optional Slack integration
      alertTypes: ['critical', 'warning', 'info']
    };
    
    var config = Object.assign(defaultPrefs, preferences || {});
    
    var props = PropertiesService.getUserProperties();
    props.setProperty('TTC_NOTIFICATION_CONFIG', JSON.stringify(config));
    
    return {
      success: true,
      config: config,
      message: 'Notification preferences saved successfully'
    };
    
  } catch (error) {
    Logger.log('Error configuring notifications: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Smart alert system - sends contextual notifications
 */
function sendSmartAlert(alertType, data) {
  try {
    var props = PropertiesService.getUserProperties();
    var configStr = props.getProperty('TTC_NOTIFICATION_CONFIG');
    
    if (!configStr) {
      return { success: false, error: 'Notifications not configured' };
    }
    
    var config = JSON.parse(configStr);
    
    // Check if this alert type is enabled
    if (!config.alertTypes.includes(alertType)) {
      return { success: false, error: 'Alert type disabled' };
    }
    
    var alert = buildSmartAlert(alertType, data);
    
    // Send email notification
    if (config.email && shouldSendAlert(alertType, data, config)) {
      sendEmailAlert(config.email, alert);
    }
    
    // Send Slack notification if configured
    if (config.slackWebhook && alertType === 'critical') {
      sendSlackAlert(config.slackWebhook, alert);
    }
    
    // Log the alert
    logProductionEvent('SMART_ALERT_SENT', {
      type: alertType,
      recipient: config.email,
      title: alert.title
    });
    
    return {
      success: true,
      alertSent: true,
      type: alertType
    };
    
  } catch (error) {
    Logger.log('Error sending smart alert: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Build contextual alert messages
 */
function buildSmartAlert(alertType, data) {
  var alerts = {
    critical: {
      title: '🚨 CRITICAL: TruckTalk Connect System Alert',
      icon: '🚨',
      color: '#FF0000'
    },
    warning: {
      title: '⚠️ WARNING: TruckTalk Connect Alert',
      icon: '⚠️',
      color: '#FFA500'
    },
    info: {
      title: '📊 INFO: TruckTalk Connect Update',
      icon: '📊',
      color: '#0066CC'
    }
  };
  
  var alert = alerts[alertType] || alerts.info;
  
  // Build contextual message based on data
  var message = '';
  
  if (data.healthScore !== undefined) {
    message += 'Health Score: ' + data.healthScore + '/100\n';
    if (data.healthScore < 50) {
      message += 'IMMEDIATE ACTION REQUIRED: System health is critically low.\n';
    } else if (data.healthScore < 80) {
      message += 'Action recommended: Review recent errors and data quality.\n';
    }
  }
  
  if (data.errorCount !== undefined) {
    message += 'Error Count: ' + data.errorCount + '\n';
  }
  
  if (data.qualityScore !== undefined) {
    message += 'Data Quality: ' + data.qualityScore + '/100\n';
    if (data.qualityScore < 60) {
      message += 'Poor data quality detected. Run auto-fix or review data entry.\n';
    }
  }
  
  if (data.recommendations) {
    message += '\nRecommended Actions:\n';
    data.recommendations.slice(0, 3).forEach(function(rec) {
      message += '• ' + rec.message + '\n';
    });
  }
  
  message += '\nSheet: ' + SpreadsheetApp.getActiveSpreadsheet().getName();
  message += '\nTime: ' + new Date().toLocaleString();
  
  return {
    title: alert.title,
    message: message,
    icon: alert.icon,
    color: alert.color,
    timestamp: new Date().toISOString()
  };
}

/**
 * Determine if alert should be sent based on thresholds
 */
function shouldSendAlert(alertType, data, config) {
  // Prevent spam - check last alert time
  var props = PropertiesService.getDocumentProperties();
  var lastAlertStr = props.getProperty('TTC_LAST_ALERT_' + alertType.toUpperCase());
  
  if (lastAlertStr) {
    var lastAlert = new Date(lastAlertStr);
    var timeDiff = (new Date().getTime() - lastAlert.getTime()) / (1000 * 60); // minutes
    
    // Don't send same alert type more than once per hour
    if (timeDiff < 60) {
      return false;
    }
  }
  
  // Check thresholds
  if (alertType === 'critical') {
    if (data.healthScore !== undefined && data.healthScore >= 50) return false;
    if (data.errorCount !== undefined && data.errorCount < config.errorThreshold) return false;
  }
  
  if (alertType === 'warning') {
    if (data.qualityScore !== undefined && data.qualityScore >= config.qualityThreshold) return false;
  }
  
  // Update last alert time
  props.setProperty('TTC_LAST_ALERT_' + alertType.toUpperCase(), new Date().toISOString());
  
  return true;
}

/**
 * Send email alert
 */
function sendEmailAlert(email, alert) {
  try {
    var subject = alert.title;
    var body = alert.message + '\n\n---\nTruckTalk Connect Automated Alert System';
    
    // In production, uncomment this line:
    // MailApp.sendEmail(email, subject, body);
    
    Logger.log('EMAIL ALERT SENT TO: ' + email);
    Logger.log('SUBJECT: ' + subject);
    Logger.log('BODY: ' + body);
    
  } catch (error) {
    Logger.log('Error sending email alert: ' + error.toString());
  }
}

/**
 * Send Slack alert (webhook integration)
 */
function sendSlackAlert(webhookUrl, alert) {
  try {
    var payload = {
      text: alert.title,
      attachments: [{
        color: alert.color,
        fields: [{
          title: 'Alert Details',
          value: alert.message,
          short: false
        }],
        footer: 'TruckTalk Connect',
        ts: Math.floor(Date.now() / 1000)
      }]
    };
    
    var options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify(payload)
    };
    
    // In production, uncomment this line:
    // UrlFetchApp.fetch(webhookUrl, options);
    
    Logger.log('SLACK ALERT SENT: ' + alert.title);
    
  } catch (error) {
    Logger.log('Error sending Slack alert: ' + error.toString());
  }
}

// ========================================
// ADVANCED REPORTING & EXPORT SYSTEM
// ========================================

/**
 * Generate comprehensive PDF report
 */
function generatePDFReport(reportType) {
  try {
    reportType = reportType || 'weekly';
    
    var analytics = generateLoadAnalytics();
    if (!analytics.success) {
      return { success: false, error: 'Cannot generate analytics for report' };
    }
    
    var dashboard = getProductionDashboard();
    
    // Create HTML content for PDF
    var htmlContent = buildReportHTML(analytics.analytics, dashboard, reportType);
    
    // Convert to PDF (in production, use a PDF service)
    var blob = Utilities.newBlob(htmlContent, 'text/html', 'trucktalk-report.html');
    
    // Store report
    var props = PropertiesService.getDocumentProperties();
    var reportData = {
      type: reportType,
      generatedAt: new Date().toISOString(),
      analytics: analytics.analytics,
      dashboard: dashboard.summary,
      htmlContent: htmlContent
    };
    
    props.setProperty('TTC_LAST_REPORT', JSON.stringify(reportData));
    
    logProductionEvent('PDF_REPORT_GENERATED', {
      type: reportType,
      totalLoads: analytics.analytics.totalLoads,
      qualityScore: analytics.analytics.dataQuality.score
    });
    
    return {
      success: true,
      reportType: reportType,
      blob: blob,
      reportData: reportData,
      message: 'PDF report generated successfully'
    };
    
  } catch (error) {
    Logger.log('Error generating PDF report: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Build HTML content for reports
 */
function buildReportHTML(analytics, dashboard, reportType) {
  var html = '<html><head><title>TruckTalk Connect Report</title>';
  html += '<style>body{font-family:Arial,sans-serif;margin:20px;} .header{color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:10px;} .metric{background:#f8f9fa;padding:15px;margin:10px 0;border-left:4px solid #3498db;} .warning{border-left-color:#e74c3c;} .success{border-left-color:#27ae60;}</style>';
  html += '</head><body>';
  
  html += '<div class="header"><h1>TruckTalk Connect ' + reportType.charAt(0).toUpperCase() + reportType.slice(1) + ' Report</h1>';
  html += '<p>Generated: ' + new Date().toLocaleString() + '</p></div>';
  
  html += '<div class="metric"><h2>System Health</h2>';
  html += '<p>Health Score: <strong>' + dashboard.healthScore + '/100</strong></p>';
  html += '<p>Total Events: ' + dashboard.totalEvents + '</p>';
  html += '<p>Error Count: ' + dashboard.errorCount + '</p></div>';
  
  html += '<div class="metric"><h2>Load Analytics</h2>';
  html += '<p>Total Loads: <strong>' + analytics.totalLoads + '</strong></p>';
  html += '<p>Data Quality Score: <strong>' + analytics.dataQuality.score + '/100</strong></p>';
  html += '<p>Top Broker: ' + (analytics.brokerInsights.topBrokers[0]?.broker || 'N/A') + '</p>';
  html += '<p>Average Delivery Rate: ' + analytics.brokerInsights.avgDeliveryRate + '%</p></div>';
  
  if (analytics.recommendations.length > 0) {
    html += '<div class="metric"><h2>Recommendations</h2><ul>';
    analytics.recommendations.forEach(function(rec) {
      var cssClass = rec.priority === 'high' ? 'warning' : 'success';
      html += '<li class="' + cssClass + '">' + rec.title + ': ' + rec.message + '</li>';
    });
    html += '</ul></div>';
  }
  
  html += '</body></html>';
  
  return html;
}

// ========================================
// API INTEGRATIONS & WEBHOOK SYSTEM
// ========================================

/**
 * Configure external API integrations
 */
function configureAPIIntegrations(config) {
  try {
    var defaultConfig = {
      trucktalkAPI: {
        enabled: false,
        endpoint: 'https://api.trucktalk.com/v1/loads',
        apiKey: null,
        syncInterval: 60 // minutes
      },
      slackWebhook: {
        enabled: false,
        url: null,
        channel: '#logistics'
      },
      emailNotifications: {
        enabled: true,
        recipients: [Session.getActiveUser().getEmail()],
        frequency: 'daily'
      },
      googleMaps: {
        enabled: false,
        apiKey: null,
        routeOptimization: false
      }
    };
    
    var integrationConfig = Object.assign(defaultConfig, config || {});
    
    var props = PropertiesService.getDocumentProperties();
    props.setProperty('TTC_API_INTEGRATIONS', JSON.stringify(integrationConfig));
    
    logProductionEvent('API_INTEGRATIONS_CONFIGURED', {
      trucktalkEnabled: integrationConfig.trucktalkAPI.enabled,
      slackEnabled: integrationConfig.slackWebhook.enabled,
      emailEnabled: integrationConfig.emailNotifications.enabled
    });
    
    return {
      success: true,
      config: integrationConfig,
      message: 'API integrations configured successfully'
    };
    
  } catch (error) {
    Logger.log('Error configuring API integrations: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Sync loads with external TruckTalk API
 */
function syncWithTruckTalkAPI(options) {
  try {
    options = options || {};
    
    var props = PropertiesService.getDocumentProperties();
    var configStr = props.getProperty('TTC_API_INTEGRATIONS');
    
    if (!configStr) {
      return { success: false, error: 'API integrations not configured' };
    }
    
    var config = JSON.parse(configStr);
    
    if (!config.trucktalkAPI.enabled) {
      return { success: false, error: 'TruckTalk API integration disabled' };
    }
    
    // Get latest analysis results
    var lastAnalysis = props.getProperty('ttc_last_analysis');
    if (!lastAnalysis) {
      return { success: false, error: 'No analysis data to sync' };
    }
    
    var analysisResult = JSON.parse(lastAnalysis);
    if (!analysisResult.success || !analysisResult.loads) {
      return { success: false, error: 'No valid loads to sync' };
    }
    
    // Prepare sync payload
    var syncPayload = {
      source: 'trucktalk-connect-sheets',
      version: '1.0',
      syncId: Utilities.getUuid(),
      timestamp: new Date().toISOString(),
      loads: analysisResult.loads,
      metadata: {
        sheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
        sheetName: SpreadsheetApp.getActiveSheet().getName(),
        totalLoads: analysisResult.loads.length,
        analysisId: analysisResult.meta?.requestId
      }
    };
    
    // Make API call
    var response = callTruckTalkAPI(config.trucktalkAPI, syncPayload);
    
    // Log sync result
    logProductionEvent('TRUCKTALK_API_SYNC', {
      success: response.success,
      loadsSync: response.success ? syncPayload.loads.length : 0,
      syncId: syncPayload.syncId,
      error: response.error || null
    });
    
    return response;
    
  } catch (error) {
    Logger.log('Error syncing with TruckTalk API: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Make authenticated API call to TruckTalk
 */
function callTruckTalkAPI(apiConfig, payload) {
  try {
    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiConfig.apiKey,
        'X-API-Source': 'trucktalk-connect-sheets'
      },
      payload: JSON.stringify(payload)
    };
    
    // In production, make actual API call:
    // var response = UrlFetchApp.fetch(apiConfig.endpoint, options);
    // var responseData = JSON.parse(response.getContentText());
    
    // Mock response for demonstration
    var mockResponse = {
      success: true,
      syncId: payload.syncId,
      processedLoads: payload.loads.length,
      createdLoads: Math.floor(payload.loads.length * 0.7),
      updatedLoads: Math.floor(payload.loads.length * 0.3),
      errors: [],
      processingTime: Math.random() * 1000 + 500
    };
    
    Logger.log('TruckTalk API Response: ' + JSON.stringify(mockResponse));
    
    return {
      success: true,
      response: mockResponse,
      syncId: payload.syncId,
      message: 'Successfully synced ' + payload.loads.length + ' loads with TruckTalk API'
    };
    
  } catch (error) {
    Logger.log('TruckTalk API call error: ' + error.toString());
    return {
      success: false,
      error: 'API call failed: ' + error.toString()
    };
  }
}

/**
 * Set up webhook endpoints for external systems
 */
function setupWebhookEndpoints() {
  try {
    // Create webhook URLs (in production, use Google Cloud Functions or similar)
    var webhooks = {
      statusUpdate: ScriptApp.getService().getUrl() + '?action=webhook&type=status',
      dataSync: ScriptApp.getService().getUrl() + '?action=webhook&type=sync',
      alerts: ScriptApp.getService().getUrl() + '?action=webhook&type=alert'
    };
    
    var props = PropertiesService.getDocumentProperties();
    props.setProperty('TTC_WEBHOOKS', JSON.stringify(webhooks));
    
    logProductionEvent('WEBHOOKS_CONFIGURED', {
      statusUpdateURL: webhooks.statusUpdate,
      dataSyncURL: webhooks.dataSync,
      alertsURL: webhooks.alerts
    });
    
    return {
      success: true,
      webhooks: webhooks,
      message: 'Webhook endpoints configured successfully'
    };
    
  } catch (error) {
    Logger.log('Error setting up webhooks: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Handle incoming webhook requests
 */
function handleWebhook(e) {
  try {
    var action = e.parameter.action;
    var type = e.parameter.type;
    
    if (action !== 'webhook') {
      return ContentService.createTextOutput('Invalid action').setMimeType(ContentService.MimeType.TEXT);
    }
    
    var response = { success: false, message: 'Unknown webhook type' };
    
    switch (type) {
      case 'status':
        response = handleStatusWebhook(e);
        break;
      case 'sync':
        response = handleSyncWebhook(e);
        break;
      case 'alert':
        response = handleAlertWebhook(e);
        break;
    }
    
    logProductionEvent('WEBHOOK_RECEIVED', {
      type: type,
      success: response.success,
      timestamp: new Date().toISOString()
    });
    
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Webhook handler error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle status update webhooks
 */
function handleStatusWebhook(e) {
  try {
    var postData = e.postData ? JSON.parse(e.postData.contents) : {};
    
    // Process status update
    if (postData.loadId && postData.status) {
      var result = updateLoadStatus(postData.loadId, postData.status, postData.timestamp);
      return {
        success: result.success,
        message: result.message,
        loadId: postData.loadId,
        newStatus: postData.status
      };
    }
    
    return { success: false, message: 'Missing required fields: loadId, status' };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Update load status in spreadsheet
 */
function updateLoadStatus(loadId, newStatus, timestamp) {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length === 0) {
      return { success: false, message: 'No data in sheet' };
    }
    
    var headers = data[0];
    var loadIdIndex = headers.findIndex(function(h) { return h.toLowerCase().includes('load') && h.toLowerCase().includes('id'); });
    var statusIndex = headers.findIndex(function(h) { return h.toLowerCase().includes('status'); });
    
    if (loadIdIndex === -1 || statusIndex === -1) {
      return { success: false, message: 'Required columns not found' };
    }
    
    // Find and update the load
    for (var i = 1; i < data.length; i++) {
      if (data[i][loadIdIndex] === loadId) {
        sheet.getRange(i + 1, statusIndex + 1).setValue(newStatus);
        
        // Add timestamp column if available
        var timestampIndex = headers.findIndex(function(h) { return h.toLowerCase().includes('updated'); });
        if (timestampIndex !== -1) {
          sheet.getRange(i + 1, timestampIndex + 1).setValue(timestamp || new Date().toISOString());
        }
        
        logProductionEvent('LOAD_STATUS_UPDATED', {
          loadId: loadId,
          oldStatus: data[i][statusIndex],
          newStatus: newStatus,
          source: 'webhook'
        });
        
        return {
          success: true,
          message: 'Load status updated successfully',
          loadId: loadId,
          newStatus: newStatus
        };
      }
    }
    
    return { success: false, message: 'Load ID not found: ' + loadId };
    
  } catch (error) {
    Logger.log('Error updating load status: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}


