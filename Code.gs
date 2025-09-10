/**
 * TruckTalk Connect - Google Sheets Add-on
 * Clean, properly structured implementation following exact specifications
 */

// =============================================================================
// GOOGLE SHEETS ADD-ON SETUP
// =============================================================================

/**
 * Called when the add-on is installed
 */
function onInstall() {
  onOpen();
}

/**
 * Called when the document is opened
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('TruckTalk Connect')
      .addItem('Open TruckTalk Connect', 'showSidebar')
      .addSeparator()
      .addItem('Seed Sample Malaysia Data', 'seedSampleMalaysiaData')
      .addSeparator()
      .addItem('Test Connection', 'testAIConnection')
      .addItem('Check Permissions', 'checkPermissions')
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

// =============================================================================
// UTILITY AND TEST FUNCTIONS
// =============================================================================

/**
 * Test function for debugging
 */
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
 * Test OpenAI API connection
 */
function testAIConnection() {
  try {
    var vercelEndpoint = 'https://trucktalkconnect.vercel.app/api/ai';
    
    // Build a minimal snapshot following the exact request contract
    var snapshot = {
      sheetName: 'Test Snapshot (Malaysia)',
      headers: ['Load ID', 'From', 'To'],
      rows: [['TEST001','No. 1, Jalan Tun Razak, Kuala Lumpur','Lot 2, Jalan Kuchai Lama, Kuala Lumpur']],
      headerOverrides: {}
    };

    var payload = {
      snapshot: snapshot,
      meta: { region: 'Malaysia', test: true }
    };

    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(vercelEndpoint, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    try {
      var result = JSON.parse(responseText);
    } catch (e) {
      return { success: false, error: 'Invalid JSON from endpoint', raw: responseText, code: responseCode };
    }

    return { success: responseCode === 200, endpoint: vercelEndpoint, code: responseCode, info: result };
    
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Check required permissions
 */
function checkPermissions() {
  try {
    var results = [];
    
    // Test sheet access
    try {
      var sheet = SpreadsheetApp.getActiveSheet();
      results.push({ permission: 'Sheet Access', status: 'OK', details: 'Can access sheet: ' + sheet.getName() });
    } catch (e) {
      results.push({ permission: 'Sheet Access', status: 'FAILED', details: e.message });
    }
    
    // Test external URL access
    try {
      var response = UrlFetchApp.fetch('https://trucktalkconnect.vercel.app/api/health', { method: 'GET' });
      results.push({ permission: 'External URL Access', status: 'OK', details: 'Can reach Vercel endpoint' });
    } catch (e) {
      results.push({ permission: 'External URL Access', status: 'FAILED', details: e.message });
    }
    
    // Test properties service
    try {
      var props = PropertiesService.getScriptProperties();
      props.setProperty('ttc_test', 'test_value');
      var testValue = props.getProperty('ttc_test');
      results.push({ permission: 'Properties Service', status: testValue === 'test_value' ? 'OK' : 'FAILED', details: 'Can store/retrieve properties' });
    } catch (e) {
      results.push({ permission: 'Properties Service', status: 'FAILED', details: e.message });
    }
    
    return { success: true, results: results };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Seed sample Malaysia logistics data for testing
 */
function seedSampleMalaysiaData() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    
    // Clear existing data
    sheet.clear();
    
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
    
    // Sample Malaysia logistics data with various issues for testing
    var sampleData = [
      [
        'TTC001',
        'No. 1, Jalan Tun Razak, 50400 Kuala Lumpur, Malaysia',
        '2025-09-15',
        '08:00',
        'Lot 10, Jalan Sultan Ismail, 10200 George Town, Penang, Malaysia', 
        '2025-09-16',
        '14:00',
        'In Transit',
        'Ahmad bin Abdullah',
        '+60123456789',
        'WMD1234',
        'Malaysia Express Logistics'
      ],
      [
        'TTC002', 
        '25, Jalan Bukit Bintang, 55100 Kuala Lumpur, Malaysia',
        '2025-09-16',
        '09:30',
        'No. 15, Jalan Larkin, 80350 Johor Bahru, Johor, Malaysia',
        '2025-09-17', 
        '16:00',
        'Rolling',
        'Siti binti Rahman',
        '+60187654321',
        'WME5678',
        'Peninsular Transport Sdn Bhd'
      ],
      [
        'TTC003',
        'Block A, Jalan Semantan, 12000 Butterworth, Penang, Malaysia',
        '2025-09-17',
        '07:45',
        'Lot 25, Jalan Kuantan, 26100 Kuantan, Pahang, Malaysia',
        '2025-09-18',
        '13:30', 
        'Delivered',
        'Kumar a/l Raman',
        '+60195551234',
        'WMF9012',
        'East Coast Logistics'
      ],
      [
        'TTC004',
        '88, Jalan Raja Laut, 50350 Kuala Lumpur, Malaysia',
        '2025-09-18', 
        '10:15',
        'No. 12, Jalan Dato Keramat, 54000 Kuala Lumpur, Malaysia',
        '2025-09-18',
        '15:45',
        'Loading',
        'Tan Chee Wei',
        '+60166789012',
        'WMG3456',
        'KL Metro Delivery'
      ],
      [
        'TTC005',
        'Port Klang, Selangor, Malaysia',
        '2025-09-19',
        '06:00',
        'KLIA Cargo Terminal, 64000 Sepang, Selangor, Malaysia',
        '2025-09-19',
        '11:30',
        'Cancelled', 
        'Mohd Faiz bin Hassan',
        '+60134567890',
        'WMH7890',
        'Port Logistics Malaysia'
      ],
      [
        'TTC001', // Duplicate ID to test validation
        'Duplicate test address',
        '2025-09-20',
        '08:00',
        'Another duplicate address',
        '2025-09-21',
        '12:00',
        'Pending',
        'Test Driver',
        '+60123456789',
        'TEST123',
        'Test Broker'
      ],
      [
        'TTC006',
        '', // Empty required field to test validation
        'Invalid Date', // Bad date format
        '25:00', // Invalid time
        'Ipoh, Perak, Malaysia',
        '2025-09-22',
        '14:00',
        'Custom Status', // Non-standard status
        'Lee Mei Ling',
        'invalid-phone', // Invalid phone format
        '',  // Empty unit number
        'Northern Transport'
      ]
    ];
    
    // Set headers
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header row
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#2563eb');
    headerRange.setFontColor('white');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    
    // Set data
    if (sampleData.length > 0) {
      sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
    }
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    return {
      success: true,
      message: 'Sample Malaysia logistics data has been seeded successfully!',
      rows: sampleData.length + 1, // +1 for header
      columns: headers.length
    };
    
  } catch (error) {
    Logger.log('Error seeding sample data: ' + error.toString());
    return {
      success: false, 
      error: error.message
    };
  }
}

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Main analysis function that matches the project specification exactly
 * @param {Object} opts - Options object with headerOverrides
 * @returns {AnalysisResult} Analysis result following the exact schema
 */
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

    // Create header mapping with ambiguity detection
    var mappingResult = createBasicHeaderMapping(headers);
    var mapping = mappingResult.mapping;
    var ambiguities = mappingResult.ambiguities;
    
    // Apply header overrides if provided
    if (opts.headerOverrides) {
      Object.keys(opts.headerOverrides).forEach(function(header) {
        mapping[header] = opts.headerOverrides[header];
      });
    }
    // Prepare issues collection
    var issues = [];

    // Check for mapping ambiguities that need user confirmation
    if (ambiguities.length > 0 && !opts.headerOverrides) {
      return {
        ok: false,
        issues: [{
          code: 'MAPPING_AMBIGUOUS',
          type: 'warning',
          severity: 'warn',
          message: 'Multiple columns could match the same fields. Please confirm mapping.',
          suggestion: 'Review the suggested mappings and confirm your choices.',
          ambiguities: ambiguities
        }],
        mapping: mapping,
        meta: {
          analyzedRows: 0,
          analyzedAt: new Date().toISOString()
        }
      };
    }

    // Check for missing required columns (all core fields except optional driverPhone)
    var requiredFields = ['loadId','fromAddress','fromAppointmentDateTimeUTC','toAddress','toAppointmentDateTimeUTC','status','driverName','unitNumber','broker'];
    var mappedFields = Object.values(mapping);

    requiredFields.forEach(function(field) {
      if (!mappedFields.includes(field)) {
        var fieldDisplayName = field.replace(/([A-Z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); });
        issues.push({
          type: 'error',
          code: 'MISSING_COLUMN',
          severity: 'error',
          message: 'Missing required column: ' + fieldDisplayName,
          column: field,
          suggestion: 'Add a column for ' + fieldDisplayName + ' or map an existing column to this field.'
        });
      }
    });

    // If critical columns are missing, return early
    if (issues.length > 0) {
      return {
        ok: false,
        issues: issues,
        mapping: mapping,
        meta: {
          analyzedRows: 0,
          analyzedAt: new Date().toISOString()
        }
      };
    }

    // Analyze data and collect issues
    var loads = [];
    var seenLoadIds = new Set();
    var statusValues = new Set();

  // Process each row
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var load = {};
      var rowIssues = [];

      // Map row data to load object
      headers.forEach(function(header, colIndex) {
        var value = row[colIndex];
        var mappedField = mapping[header];
        
        if (mappedField) {
          // Check for empty required cells
          if ((value === null || value === undefined || value === '') && 
              ['loadId', 'fromAddress', 'toAddress'].includes(mappedField)) {
            rowIssues.push({
              type: 'error',
              code: 'EMPTY_REQUIRED_CELL',
              severity: 'error',
              message: 'Required field is empty: ' + mappedField,
              column: header,
              suggestion: 'Please provide a value for this required field.'
            });
            return;
          }
          
          if (value !== null && value !== undefined && value !== '') {
            if (mappedField.includes('Date') || mappedField.includes('Time')) {
              var dateResult = parseToUTC(value);
              if (dateResult.success) {
                load[mappedField] = dateResult.isoString;
                
                // Flag if we had to normalize the date format
                if (dateResult.wasNormalized) {
                  rowIssues.push({
                    type: 'warning',
                    code: 'NON_ISO_OUTPUT',
                    severity: 'warn',
                    message: 'Date normalized to ISO format: ' + value + ' → ' + dateResult.isoString,
                    column: header,
                    suggestion: dateResult.assumedTimezone ? 
                      'Consider specifying timezone explicitly (assumed +08:00 Malaysia time)' :
                      'Use ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ) for consistency'
                  });
                }
              } else {
                load[mappedField] = value;
                rowIssues.push({
                  type: 'error',
                  code: 'BAD_DATE_FORMAT',
                  severity: 'error',
                  message: 'Invalid date format: ' + value,
                  column: header,
                  suggestion: 'Use format: YYYY-MM-DD HH:MM or include timezone (e.g., 2025-08-29 14:00 CST)'
                });
              }
            } else {
              load[mappedField] = String(value).trim();
              // Collect status values for consistency check
              if (mappedField === 'status' && load[mappedField]) {
                statusValues.add(load[mappedField].toLowerCase());
              }
            }
          }
        }
      });

      // Validate required fields (only if not already flagged as empty)
      if (!load.loadId && !rowIssues.some(function(issue) { return issue.code === 'EMPTY_REQUIRED_CELL' && issue.message.includes('loadId'); })) {
        rowIssues.push({
          type: 'error',
          code: 'MISSING_REQUIRED',
          severity: 'error',
          message: 'Load ID is required',
          column: 'loadId',
          suggestion: 'Provide a unique identifier for this load.'
        });
      }

      if (!load.fromAddress && !rowIssues.some(function(issue) { return issue.code === 'EMPTY_REQUIRED_CELL' && issue.message.includes('fromAddress'); })) {
        rowIssues.push({
          type: 'error',
          code: 'MISSING_REQUIRED',
          severity: 'error',
          message: 'From address is required',
          column: 'fromAddress',
          suggestion: 'Provide the pickup location address.'
        });
      }

      if (!load.toAddress && !rowIssues.some(function(issue) { return issue.code === 'EMPTY_REQUIRED_CELL' && issue.message.includes('toAddress'); })) {
        rowIssues.push({
          type: 'error',
          code: 'MISSING_REQUIRED',
          severity: 'error',
          message: 'To address is required',
          column: 'toAddress',
          suggestion: 'Provide the delivery location address.'
        });
      }

      // Check for duplicate load IDs
      if (load.loadId && seenLoadIds.has(load.loadId)) {
        rowIssues.push({
          type: 'error',
          code: 'DUPLICATE_ID',
          severity: 'error',
          message: 'Duplicate load ID: ' + load.loadId,
          column: 'loadId',
          suggestion: 'Each load must have a unique identifier.'
        });
      } else if (load.loadId) {
        seenLoadIds.add(load.loadId);
      }

      // Add row issues to analysis
      if (rowIssues.length > 0) {
        rowIssues.forEach(function(issue) {
          issue.row = i + 2; // +2 because header is row 1 and arrays are 0-based
          issues.push(issue);
        });
      }

      // Add valid load to results
      if (load.loadId) {
        loads.push(load);
      }
    }

    // Check for inconsistent status values
    if (statusValues.size > 5) { // Flag if too many different status values
      var statusArray = Array.from(statusValues);
      issues.push({
        type: 'warning',
        code: 'INCONSISTENT_STATUS',
        severity: 'warn',
        message: 'Found ' + statusValues.size + ' different status values: ' + statusArray.slice(0, 5).join(', ') + (statusArray.length > 5 ? '...' : ''),
        suggestion: 'Consider standardizing status values (e.g., "Rolling", "Delivered", "Cancelled").'
      });
    }

    // Try server-side AI analysis via Vercel proxy for richer AnalysisResult
    var aiInsights = null;
    try {
      var vercelEndpoint = 'https://trucktalkconnect.vercel.app/api/ai';

      // Build compact snapshot to keep payload small (cap rows to 200 earlier)
      var snapshot = {
        sheetName: sheetData.data.sheetName || SpreadsheetApp.getActiveSheet().getName(),
        headers: sheetData.data.headers,
        rows: sheetData.data.rows,
        headerOverrides: opts.headerOverrides || {}
      };

      var payload = {
        headers: snapshot.headers,
        rows: snapshot.rows,
        headerOverrides: snapshot.headerOverrides,
        meta: { region: 'Malaysia', source: 'sheets-addon' }
      };

      var options = {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      var response = UrlFetchApp.fetch(vercelEndpoint, options);
      var code = response.getResponseCode();
      var text = response.getContentText();

      if (code === 200) {
        try {
          var parsed = JSON.parse(text);
          // Expect parsed to be AnalysisResult
          if (parsed && typeof parsed.ok !== 'undefined') {
            // Replace local issues/loads/mapping with AI's final result
            issues = parsed.issues || issues;
            loads = parsed.loads || loads;
            mapping = parsed.mapping || mapping;
            aiInsights = parsed;
          }
        } catch (pe) {
          Logger.log('Failed to parse AI response JSON: ' + pe.toString());
        }
      } else {
        Logger.log('Vercel AI endpoint returned HTTP ' + code + ': ' + text);
      }
    } catch (aiError) {
      Logger.log('AI analysis failed: ' + aiError.toString());
    }

    // Build result
    var result = {
      ok: issues.filter(function(issue) { return issue.type === 'error'; }).length === 0,
      issues: issues,
      mapping: mapping,
      meta: {
        analyzedRows: rows.length,
        analyzedAt: new Date().toISOString(),
        totalLoads: loads.length,
        validLoads: loads.filter(function(load) { return load.loadId; }).length,
        service: aiInsights ? 'AI' : 'Local'
      }
    };

    if (aiInsights) {
      result.aiInsights = aiInsights;
    }

    // Cache the results
    setCachedAnalysis(result);
    
    // Update rate limit
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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get sheet snapshot following the exact data model
 */
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
    var cleanRows = dataRows.map(function(row) {
      return validColumnIndices.map(function(index) { return row[index]; });
    });

    return {
      success: true,
      data: {
        sheetName: sheet.getName(),
        headers: cleanHeaders,
        rows: cleanRows,
        totalRows: cleanRows.length,
        totalColumns: cleanHeaders.length
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
