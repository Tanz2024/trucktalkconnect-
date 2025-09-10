// Unit tests for parseAndNormalizeDate function
// Run with: npx ts-node test/date-normalization.test.ts

import { parseAndNormalizeDate, normalizeToCanonicalISO, isValidISODateTime } from '../api/ai';

interface TestCase {
  name: string;
  dateStr: string;
  timeStr?: string;
  timezone?: string;
  expected: {
    success: boolean;
    isoString?: string;
    wasNormalized?: boolean;
    error?: string;
  };
}

const testCases: TestCase[] = [
  // TBD and placeholder edge cases
  {
    name: 'TBD date string',
    dateStr: 'TBD',
    expected: {
      success: false,
      error: 'Cannot parse TBD or similar placeholders'
    }
  },
  {
    name: 'TBD with mixed case',
    dateStr: 'tbd',
    expected: {
      success: false,
      error: 'Cannot parse TBD or similar placeholders'
    }
  },
  {
    name: 'Date containing TBD',
    dateStr: '2025-TBD-01',
    expected: {
      success: false,
      error: 'Cannot parse TBD or similar placeholders'
    }
  },

  // Missing time edge cases
  {
    name: 'Date only, no time',
    dateStr: '2025-09-08',
    expected: {
      success: true,
      isoString: '2025-09-08T00:00:00Z',
      wasNormalized: true
    }
  },
  {
    name: 'Date with empty time string',
    dateStr: '2025-09-08',
    timeStr: '',
    expected: {
      success: true,
      isoString: '2025-09-08T00:00:00Z',
      wasNormalized: true
    }
  },
  {
    name: 'Date with whitespace-only time',
    dateStr: '2025-09-08',
    timeStr: '   ',
    expected: {
      success: true,
      isoString: '2025-09-08T00:00:00Z',
      wasNormalized: true
    }
  },

  // Asia/Kuala_Lumpur timezone cases
  {
    name: 'Local date/time with Kuala Lumpur timezone',
    dateStr: '2025-09-08',
    timeStr: '14:30',
    timezone: 'Asia/Kuala_Lumpur',
    expected: {
      success: true,
      isoString: '2025-09-08T06:30:00Z', // UTC = KL time - 8 hours
      wasNormalized: true
    }
  },
  {
    name: 'Combined datetime string with KL timezone',
    dateStr: '2025-09-08 14:30:00',
    timezone: 'Asia/Kuala_Lumpur',
    expected: {
      success: true,
      isoString: '2025-09-08T06:30:00Z',
      wasNormalized: true
    }
  },

  // Already valid ISO cases
  {
    name: 'Already valid ISO with milliseconds',
    dateStr: '2025-09-08T10:00:00.000Z',
    expected: {
      success: true,
      isoString: '2025-09-08T10:00:00Z', // Canonical format without milliseconds
      wasNormalized: true
    }
  },
  {
    name: 'Already valid ISO without milliseconds',
    dateStr: '2025-09-08T10:00:00Z',
    expected: {
      success: true,
      isoString: '2025-09-08T10:00:00Z',
      wasNormalized: false
    }
  },

  // Relaxed ISO format cases
  {
    name: 'ISO without seconds',
    dateStr: '2025-09-08T10:00Z',
    expected: {
      success: true,
      isoString: '2025-09-08T10:00:00Z',
      wasNormalized: true
    }
  },
  {
    name: 'ISO without Z suffix',
    dateStr: '2025-09-08T10:00:00',
    expected: {
      success: true,
      isoString: '2025-09-08T10:00:00Z',
      wasNormalized: true
    }
  },

  // Split date/time combinations
  {
    name: 'Separate date and time with UTC',
    dateStr: '2025-09-08',
    timeStr: '14:30:00',
    timezone: 'UTC',
    expected: {
      success: true,
      isoString: '2025-09-08T14:30:00Z',
      wasNormalized: true
    }
  },
  {
    name: 'Date and time with 24-hour format',
    dateStr: '2025-09-08',
    timeStr: '23:59',
    expected: {
      success: true,
      isoString: '2025-09-08T23:59:00Z',
      wasNormalized: true
    }
  },

  // Edge cases and error conditions
  {
    name: 'Invalid date format',
    dateStr: 'not-a-date',
    expected: {
      success: false,
      error: 'Invalid date format: not-a-date'
    }
  },
  {
    name: 'Empty date string',
    dateStr: '',
    expected: {
      success: false,
      error: 'Cannot parse TBD or similar placeholders'
    }
  },
  {
    name: 'Date with invalid time',
    dateStr: '2025-09-08',
    timeStr: '25:99:99',
    expected: {
      success: false,
      error: 'Invalid date format: 2025-09-08 25:99:99'
    }
  },

  // Other timezone cases
  {
    name: 'Singapore timezone (same as KL)',
    dateStr: '2025-09-08 16:00',
    timezone: 'Asia/Singapore',
    expected: {
      success: true,
      isoString: '2025-09-08T08:00:00Z',
      wasNormalized: true
    }
  },
  {
    name: 'Unknown timezone defaults to UTC',
    dateStr: '2025-09-08 12:00',
    timezone: 'Unknown/Timezone',
    expected: {
      success: true,
      isoString: '2025-09-08T12:00:00Z',
      wasNormalized: true
    }
  }
];

// Test helper functions
function testNormalizeToCanonicalISO() {
  console.log('\n=== Testing normalizeToCanonicalISO ===');
  
  const canonicalTests: Array<[string, string]> = [
    ['2025-09-08T10:00:00.000Z', '2025-09-08T10:00:00Z'],
    ['2025-09-08T10:00:00.123Z', '2025-09-08T10:00:00Z'],
    ['2025-09-08T10:00:00Z', '2025-09-08T10:00:00Z'],
    ['', ''],
    ['invalid', 'invalid']
  ];

  canonicalTests.forEach(([input, expected]) => {
    const result = normalizeToCanonicalISO(input);
    const pass = result === expected;
    console.log(`${pass ? '✓' : '✗'} normalizeToCanonicalISO('${input}') = '${result}' ${pass ? '' : `(expected '${expected}')`}`);
  });
}

function testIsValidISODateTime() {
  console.log('\n=== Testing isValidISODateTime ===');
  
  const validationTests: Array<[string, boolean]> = [
    ['2025-09-08T10:00:00.000Z', true],
    ['2025-09-08T10:00:00Z', true],
    ['2025-09-08T10:00:00.123Z', true],
    ['2025-09-08T10:00Z', false], // Missing seconds
    ['2025-09-08T10:00:00', false], // Missing Z
    ['invalid', false],
    ['', false],
    ['2025-13-45T25:99:99Z', false] // Invalid date values
  ];

  validationTests.forEach(([input, expected]) => {
    const result = isValidISODateTime(input);
    const pass = result === expected;
    console.log(`${pass ? '✓' : '✗'} isValidISODateTime('${input}') = ${result} ${pass ? '' : `(expected ${expected})`}`);
  });
}

// Main test runner
function runTests() {
  console.log('🧪 Running parseAndNormalizeDate unit tests...\n');
  
  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase) => {
    try {
      const result = parseAndNormalizeDate(
        testCase.dateStr, 
        testCase.timeStr, 
        testCase.timezone || 'UTC'
      );

      let pass = true;
      let errors: string[] = [];

      // Check success flag
      if (result.success !== testCase.expected.success) {
        pass = false;
        errors.push(`success: got ${result.success}, expected ${testCase.expected.success}`);
      }

      // Check ISO string if success expected
      if (testCase.expected.success && testCase.expected.isoString) {
        if (result.isoString !== testCase.expected.isoString) {
          pass = false;
          errors.push(`isoString: got '${result.isoString}', expected '${testCase.expected.isoString}'`);
        }
      }

      // Check wasNormalized flag
      if (testCase.expected.wasNormalized !== undefined) {
        if (result.wasNormalized !== testCase.expected.wasNormalized) {
          pass = false;
          errors.push(`wasNormalized: got ${result.wasNormalized}, expected ${testCase.expected.wasNormalized}`);
        }
      }

      // Check error message pattern
      if (!testCase.expected.success && testCase.expected.error) {
        if (!result.error || !result.error.includes(testCase.expected.error.split(':')[0])) {
          pass = false;
          errors.push(`error: got '${result.error}', expected to contain '${testCase.expected.error.split(':')[0]}'`);
        }
      }

      if (pass) {
        console.log(`✓ ${testCase.name}`);
        passed++;
      } else {
        console.log(`✗ ${testCase.name}: ${errors.join(', ')}`);
        console.log(`  Input: dateStr='${testCase.dateStr}', timeStr='${testCase.timeStr || ''}', timezone='${testCase.timezone || 'UTC'}'`);
        console.log(`  Got: ${JSON.stringify(result)}`);
        console.log(`  Expected: ${JSON.stringify(testCase.expected)}`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ ${testCase.name}: Threw error: ${error}`);
      failed++;
    }
  });

  // Test helper functions
  testNormalizeToCanonicalISO();
  testIsValidISODateTime();

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
  }
}

// Only run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

export { runTests };
