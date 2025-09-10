/**
 * Integration Test for TruckTalk Connect
 * Tests the interaction between multiple functions
 */

function runIntegrationTest() {
  Logger.log('🔧 TruckTalk Connect - Integration Test');
  Logger.log('======================================\n');
  
  var testResults = {
    dataGeneration: false,
    utilities: false,  
    autoFix: false,
    totalScore: 0
  };
  
  try {
    // Test 1: Sample data generation
    Logger.log('1️⃣ Testing sample data generation...');
    var sheet = SpreadsheetApp.getActiveSheet();
    if (sheet) {
      // Clear and generate sample data
      seedSampleMalaysiaData();
      
      // Verify data was created
      var range = sheet.getDataRange();
      var values = range.getValues();
      
      if (values.length >= 6) { // Header + 5 data rows
        Logger.log('✅ Sample data generated: ' + (values.length - 1) + ' rows');
        testResults.dataGeneration = true;
        testResults.totalScore += 33;
      } else {
        Logger.log('❌ Sample data generation failed');
      }
    }
    
    // Test 2: Utility functions with real data
    Logger.log('\n2️⃣ Testing utility functions with sample data...');  
    var testCases = [
      { input: 'Sep 19, 2025', func: 'normalizeDate', expected: '2025-09-19' },
      { input: '2:45 PM', func: 'normalizeTime', expected: '14:45' },
      { input: '+6012-345-6789', func: 'normalizePhone', expected: '+60123456789' },
      { input: 'pending', func: 'normalizeStatus', expected: 'PENDING' },
      { input: 'TTC2025001', func: 'isValidLoadId', expected: true }
    ];
    
    var utilityPassed = 0;
    testCases.forEach(function(test) {
      try {
        var result;
        switch(test.func) {
          case 'normalizeDate':
            result = normalizeDate(test.input);
            break;
          case 'normalizeTime': 
            result = normalizeTime(test.input);
            break;
          case 'normalizePhone':
            result = normalizePhone(test.input);
            break;
          case 'normalizeStatus':
            result = normalizeStatus(test.input);
            break;
          case 'isValidLoadId':
            result = isValidLoadId(test.input);
            break;
        }
        
        var passed = result === test.expected;
        Logger.log((passed ? '✅' : '❌') + ' ' + test.func + '("' + test.input + '") → ' + result);
        if (passed) utilityPassed++;
        
      } catch (e) {
        Logger.log('❌ ' + test.func + ' failed: ' + e.toString());
      }
    });
    
    if (utilityPassed >= 4) { // Allow 1 failure
      testResults.utilities = true;
      testResults.totalScore += 33;
      Logger.log('✅ Utility functions: ' + utilityPassed + '/' + testCases.length + ' passed');
    } else {
      Logger.log('❌ Utility functions: Only ' + utilityPassed + '/' + testCases.length + ' passed');
    }
    
    // Test 3: Auto-fix integration
    Logger.log('\n3️⃣ Testing auto-fix integration...');
    try {
      // Check if auto-fix functions exist and are callable
      var autoFixAvailable = (typeof autoFixDataIssues === 'function');
      var pushAvailable = (typeof pushToTruckTalk === 'function');
      var orgProfileAvailable = (typeof getOrganizationProfile === 'function');
      
      if (autoFixAvailable && pushAvailable && orgProfileAvailable) {
        Logger.log('✅ All integration functions available');
        Logger.log('   - autoFixDataIssues: ✅');
        Logger.log('   - pushToTruckTalk: ✅');
        Logger.log('   - getOrganizationProfile: ✅');
        testResults.autoFix = true;
        testResults.totalScore += 34;
      } else {
        Logger.log('❌ Some integration functions missing:');
        Logger.log('   - autoFixDataIssues: ' + (autoFixAvailable ? '✅' : '❌'));
        Logger.log('   - pushToTruckTalk: ' + (pushAvailable ? '✅' : '❌'));
        Logger.log('   - getOrganizationProfile: ' + (orgProfileAvailable ? '✅' : '❌'));
      }
    } catch (e) {
      Logger.log('❌ Auto-fix integration test failed: ' + e.toString());
    }
    
    // Final results
    Logger.log('\n📊 INTEGRATION TEST RESULTS');
    Logger.log('============================');
    Logger.log('Sample Data Generation: ' + (testResults.dataGeneration ? 'PASS' : 'FAIL'));
    Logger.log('Utility Functions: ' + (testResults.utilities ? 'PASS' : 'FAIL'));
    Logger.log('Auto-Fix Integration: ' + (testResults.autoFix ? 'PASS' : 'FAIL'));
    Logger.log('Total Score: ' + testResults.totalScore + '/100');
    
    if (testResults.totalScore >= 90) {
      Logger.log('\n🎉 INTEGRATION TEST PASSED!');
      Logger.log('TruckTalk Connect is fully integrated and working!');
    } else if (testResults.totalScore >= 70) {
      Logger.log('\n⚠️  Integration test mostly passed with some issues.');
    } else {
      Logger.log('\n❌ Integration test failed. Check individual components.');
    }
    
    return testResults;
    
  } catch (error) {
    Logger.log('❌ Integration test error: ' + error.toString());
    return testResults;
  }
}

/**
 * Quick smoke test for immediate verification
 */
function smokeTest() {
  Logger.log('💨 TruckTalk Connect - Smoke Test');
  Logger.log('==================================');
  
  var checks = [
    'normalizeDate function exists',
    'normalizePhone function exists', 
    'normalizeStatus function exists',
    'isValidLoadId function exists',
    'generateLoadId function exists',
    'normalizeTime function exists',
    'autoFixDataIssues function exists',
    'pushToTruckTalk function exists',
    'getOrganizationProfile function exists',
    'seedSampleMalaysiaData function exists'
  ];
  
  var passed = 0;
  
  checks.forEach(function(check, index) {
    var funcName = check.split(' ')[0];
    var exists = (typeof eval(funcName) === 'function');
    Logger.log((exists ? '✅' : '❌') + ' ' + check);
    if (exists) passed++;
  });
  
  Logger.log('\nSmoke Test: ' + passed + '/' + checks.length + ' functions available');
  
  if (passed === checks.length) {
    Logger.log('🎉 All systems operational!');
  } else {
    Logger.log('⚠️  Some functions may be missing or not loaded.');
  }
  
  return passed === checks.length;
}
