/**
 * TruckTalk Connect - Unit Tests
 * Comprehensive test suite for utility functions
 * Run these tests to ensure data normalization works correctly
 */

/**
 * Test runner function - call this to run all tests
 * Usage: In Google Apps Script editor, run testAllUtilities()
 */
function testAllUtilities() {
  Logger.log('🧪 Starting TruckTalk Connect Utility Tests...\n');
  
  var totalTests = 0;
  var passedTests = 0;
  
  // Run all test suites
  var results = [
    testNormalizeDate(),
    testNormalizePhone(),
    testNormalizeStatus(),
    testIsValidLoadId(),
    testGenerateLoadId(),
    testIsValidTime(),
    testNormalizeTime()
  ];
  
  // Aggregate results
  results.forEach(function(result) {
    totalTests += result.total;
    passedTests += result.passed;
  });
  
  // Print summary
  Logger.log('\n📊 TEST SUMMARY:');
  Logger.log('Total Tests: ' + totalTests);
  Logger.log('Passed: ' + passedTests);
  Logger.log('Failed: ' + (totalTests - passedTests));
  Logger.log('Success Rate: ' + Math.round((passedTests / totalTests) * 100) + '%');
  
  if (passedTests === totalTests) {
    Logger.log('✅ ALL TESTS PASSED!');
  } else {
    Logger.log('❌ Some tests failed. Check logs above for details.');
  }
  
  return {
    total: totalTests,
    passed: passedTests,
    success: passedTests === totalTests
  };
}

/**
 * Test helper function - asserts equality and logs results
 */
function assertEqual(actual, expected, testName) {
  var passed = actual === expected;
  var status = passed ? '✅' : '❌';
  var message = status + ' ' + testName;
  
  if (!passed) {
    message += ' | Expected: "' + expected + '", Got: "' + actual + '"';
  }
  
  Logger.log(message);
  return passed;
}

/**
 * Test suite for normalizeDate function
 */
function testNormalizeDate() {
  Logger.log('🔍 Testing normalizeDate function...');
  var tests = 0;
  var passed = 0;
  
  // Test cases: [input, expected]
  var testCases = [
    // Already ISO format
    ['2025-09-15', '2025-09-15'],
    ['2025-12-31', '2025-12-31'],
    
    // US format
    ['Sep 19, 2025', '2025-09-19'],
    ['December 25, 2025', '2025-12-25'],
    ['Jan 1, 2025', '2025-01-01'],
    
    // DD/MM/YYYY format
    ['20/09/2025', '2025-09-20'],
    ['31/12/2025', '2025-12-31'],
    ['01/01/2025', '2025-01-01'],
    
    // Verbose format
    ['September 26th, 2025', '2025-09-26'],
    ['January 1st, 2025', '2025-01-01'],
    
    // Edge cases
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['invalid date', ''],
    ['2025-13-01', ''], // Invalid month
    ['2025-02-30', '']  // Invalid date
  ];
  
  testCases.forEach(function(testCase) {
    tests++;
    if (assertEqual(normalizeDate(testCase[0]), testCase[1], 'normalizeDate("' + testCase[0] + '")')) {
      passed++;
    }
  });
  
  Logger.log('normalizeDate: ' + passed + '/' + tests + ' tests passed\n');
  return { total: tests, passed: passed };
}

/**
 * Test suite for normalizePhone function
 */
function testNormalizePhone() {
  Logger.log('🔍 Testing normalizePhone function...');
  var tests = 0;
  var passed = 0;
  
  var testCases = [
    // Already normalized
    ['+60123456789', '+60123456789'],
    ['+60187654321', '+60187654321'],
    
    // Without country code
    ['123456789', '+60123456789'],
    ['0123456789', '+60123456789'],
    
    // With country code but no +
    ['60123456789', '+60123456789'],
    
    // With formatting
    ['+6012-345-6789', '+60123456789'],
    ['012-345-6789', '+60123456789'],
    ['+60 12 345 6789', '+60123456789'],
    
    // Edge cases
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['123', ''], // Too short
    ['12345678901234567890', ''], // Too long
    ['abc123', ''], // Invalid characters
  ];
  
  testCases.forEach(function(testCase) {
    tests++;
    if (assertEqual(normalizePhone(testCase[0]), testCase[1], 'normalizePhone("' + testCase[0] + '")')) {
      passed++;
    }
  });
  
  Logger.log('normalizePhone: ' + passed + '/' + tests + ' tests passed\n');
  return { total: tests, passed: passed };
}

/**
 * Test suite for normalizeStatus function
 */
function testNormalizeStatus() {
  Logger.log('🔍 Testing normalizeStatus function...');
  var tests = 0;
  var passed = 0;
  
  var testCases = [
    // Direct mappings
    ['PENDING', 'PENDING'],
    ['pending', 'PENDING'],
    ['Pending', 'PENDING'],
    
    ['DELIVERED', 'DELIVERED'],
    ['delivered', 'DELIVERED'],
    
    ['IN_TRANSIT', 'IN_TRANSIT'],
    ['ROLLING', 'IN_TRANSIT'], // Alternative mapping
    ['rolling', 'IN_TRANSIT'],
    
    ['SCHEDULED', 'SCHEDULED'],
    ['ASSIGNED', 'SCHEDULED'], // Alternative mapping
    ['assigned', 'SCHEDULED'],
    
    ['CANCELLED', 'CANCELLED'],
    ['cancelled', 'CANCELLED'],
    
    // Edge cases
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['INVALID_STATUS', ''],
    ['ERROR_STATUS', ''],
  ];
  
  testCases.forEach(function(testCase) {
    tests++;
    if (assertEqual(normalizeStatus(testCase[0]), testCase[1], 'normalizeStatus("' + testCase[0] + '")')) {
      passed++;
    }
  });
  
  Logger.log('normalizeStatus: ' + passed + '/' + tests + ' tests passed\n');
  return { total: tests, passed: passed };
}

/**
 * Test suite for isValidLoadId function
 */
function testIsValidLoadId() {
  Logger.log('🔍 Testing isValidLoadId function...');
  var tests = 0;
  var passed = 0;
  
  var testCases = [
    // Valid IDs
    ['TTC2025001', true],
    ['TTC2025999', true],
    ['TTC2024123', true],
    ['TTC20251000', true], // 4+ digits ok
    
    // Invalid IDs
    ['', false],
    [null, false],
    [undefined, false],
    ['TTC001', false], // Missing year
    ['TC2025001', false], // Wrong prefix
    ['TTC202501', false], // Year too short
    ['TTC25001', false], // Year too short
    ['TTC202A001', false], // Non-numeric in year
    ['TTC2025', false], // Missing sequence
    ['2025001', false], // Missing TTC prefix
  ];
  
  testCases.forEach(function(testCase) {
    tests++;
    if (assertEqual(isValidLoadId(testCase[0]), testCase[1], 'isValidLoadId("' + testCase[0] + '")')) {
      passed++;
    }
  });
  
  Logger.log('isValidLoadId: ' + passed + '/' + tests + ' tests passed\n');
  return { total: tests, passed: passed };
}

/**
 * Test suite for generateLoadId function
 */
function testGenerateLoadId() {
  Logger.log('🔍 Testing generateLoadId function...');
  var tests = 0;
  var passed = 0;
  
  var currentYear = new Date().getFullYear();
  var expectedPrefix = 'TTC' + currentYear;
  
  // Test with empty data
  tests++;
  var result1 = generateLoadId([]);
  if (assertEqual(result1, expectedPrefix + '001', 'generateLoadId([]) - empty data')) {
    passed++;
  }
  
  // Test with existing data
  tests++;
  var mockData = [
    ['TTC2025001', 'other', 'data'],
    ['TTC2025003', 'more', 'data'],
    ['TTC2024999', 'old', 'year'] // Should be ignored
  ];
  var result2 = generateLoadId(mockData);
  if (assertEqual(result2, expectedPrefix + '004', 'generateLoadId with existing data')) {
    passed++;
  }
  
  // Test with mixed data
  tests++;
  var mixedData = [
    ['', 'empty', 'id'],
    ['INVALID', 'bad', 'id'],
    ['TTC2025010', 'valid', 'id'],
    [null, 'null', 'id']
  ];
  var result3 = generateLoadId(mixedData);
  if (assertEqual(result3, expectedPrefix + '011', 'generateLoadId with mixed data')) {
    passed++;
  }
  
  Logger.log('generateLoadId: ' + passed + '/' + tests + ' tests passed\n');
  return { total: tests, passed: passed };
}

/**
 * Test suite for isValidTime function
 */
function testIsValidTime() {
  Logger.log('🔍 Testing isValidTime function...');
  var tests = 0;
  var passed = 0;
  
  var testCases = [
    // Valid times
    ['08:00', true],
    ['23:59', true],
    ['00:00', true],
    ['12:30', true],
    ['9:15', true], // Single digit hour ok
    
    // Invalid times
    ['', false],
    [null, false],
    [undefined, false],
    ['24:00', false], // Invalid hour
    ['12:60', false], // Invalid minute
    ['8:5', false], // Single digit minute not ok
    ['2:45 PM', false], // AM/PM format not 24-hour
    ['abc:def', false], // Non-numeric
    ['12', false], // Missing minutes
    ['12:', false], // Missing minutes
    [':30', false], // Missing hours
  ];
  
  testCases.forEach(function(testCase) {
    tests++;
    if (assertEqual(isValidTime(testCase[0]), testCase[1], 'isValidTime("' + testCase[0] + '")')) {
      passed++;
    }
  });
  
  Logger.log('isValidTime: ' + passed + '/' + tests + ' tests passed\n');
  return { total: tests, passed: passed };
}

/**
 * Test suite for normalizeTime function
 */
function testNormalizeTime() {
  Logger.log('🔍 Testing normalizeTime function...');
  var tests = 0;
  var passed = 0;
  
  var testCases = [
    // Already normalized
    ['08:00', '08:00'],
    ['23:59', '23:59'],
    ['12:30', '12:30'],
    
    // Single digit hours
    ['9:15', '09:15'],
    ['5:00', '05:00'],
    
    // 12-hour format
    ['2:45 PM', '14:45'],
    ['12:00 PM', '12:00'],
    ['12:00 AM', '00:00'],
    ['11:30 PM', '23:30'],
    ['1:15 AM', '01:15'],
    
    // Edge cases
    ['', ''],
    [null, ''],
    [undefined, ''],
    ['invalid time', ''],
    ['25:00', ''], // Invalid hour
    ['12:70', ''], // Invalid minute
  ];
  
  testCases.forEach(function(testCase) {
    tests++;
    if (assertEqual(normalizeTime(testCase[0]), testCase[1], 'normalizeTime("' + testCase[0] + '")')) {
      passed++;
    }
  });
  
  Logger.log('normalizeTime: ' + passed + '/' + tests + ' tests passed\n');
  return { total: tests, passed: passed };
}

/**
 * Integration test - tests multiple functions together
 */
function testDataNormalizationIntegration() {
  Logger.log('🔍 Running integration tests...');
  
  // Test a complete row normalization
  var mockRow = [
    '', // Missing Load ID
    'Valid Address',
    'Sep 19, 2025', // Bad date format
    '2:45 PM', // Bad time format
    'Another Address',
    '20/09/2025', // Bad date format
    '18:20',
    'pending', // Bad status format
    'John Doe',
    '+6012-345-6789', // Bad phone format
    'WM1234A',
    'Carrier Name'
  ];
  
  var existingData = [['TTC2025001', 'data'], ['TTC2025002', 'data']];
  
  // Normalize each field
  var normalizedRow = [
    generateLoadId(existingData), // Should be TTC2025003
    mockRow[1], // Address unchanged
    normalizeDate(mockRow[2]), // Should be 2025-09-19
    normalizeTime(mockRow[3]), // Should be 14:45
    mockRow[4], // Address unchanged
    normalizeDate(mockRow[5]), // Should be 2025-09-20
    mockRow[6], // Time already good
    normalizeStatus(mockRow[7]), // Should be PENDING
    mockRow[8], // Name unchanged
    normalizePhone(mockRow[9]), // Should be +60123456789
    mockRow[10], // License unchanged
    mockRow[11] // Carrier unchanged
  ];
  
  Logger.log('Integration test result:');
  Logger.log('Original: ' + JSON.stringify(mockRow));
  Logger.log('Normalized: ' + JSON.stringify(normalizedRow));
  
  // Verify critical normalizations
  var currentYear = new Date().getFullYear();
  assertEqual(normalizedRow[0], 'TTC' + currentYear + '003', 'Generated Load ID');
  assertEqual(normalizedRow[2], '2025-09-19', 'Normalized pickup date');
  assertEqual(normalizedRow[3], '14:45', 'Normalized pickup time');
  assertEqual(normalizedRow[5], '2025-09-20', 'Normalized delivery date');
  assertEqual(normalizedRow[7], 'PENDING', 'Normalized status');
  assertEqual(normalizedRow[9], '+60123456789', 'Normalized phone');
  
  Logger.log('Integration test completed\n');
}
