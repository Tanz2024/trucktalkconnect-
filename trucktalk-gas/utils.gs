/**
 * TruckTalk Connect - Utility Functions
 * Pure utility functions for data normalization and validation
 * Designed to be testable and reusable across the application
 */

/**
 * Normalizes a date string to ISO format (YYYY-MM-DD)
 * @param {string} dateString - The date string to normalize
 * @returns {string} ISO formatted date or empty string if invalid
 * 
 * Handles multiple input formats:
 * - "Sep 19, 2025" -> "2025-09-19"
 * - "20/09/2025" -> "2025-09-20"
 * - "September 26th, 2025" -> "2025-09-26"
 * - "2025-09-15" -> "2025-09-15" (already ISO)
 */
function normalizeDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return '';
  }
  
  var trimmed = dateString.trim();
  if (!trimmed) {
    return '';
  }
  
  // Already in ISO format (YYYY-MM-DD)
  var isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }
  
  try {
    var date = new Date(trimmed);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Format as ISO date (YYYY-MM-DD)
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    
    return year + '-' + month + '-' + day;
  } catch (error) {
    return '';
  }
}

/**
 * Normalizes a phone number to standard Malaysian format (+60XXXXXXXXX)
 * @param {string} phoneString - The phone number to normalize
 * @returns {string} Normalized phone number or empty string if invalid
 * 
 * Handles multiple input formats:
 * - "+60123456789" -> "+60123456789" (already normalized)
 * - "123456789" -> "+60123456789"
 * - "+6012-345-6789" -> "+60123456789"
 * - "01-2345-6789" -> "+60123456789"
 */
function normalizePhone(phoneString) {
  if (!phoneString || typeof phoneString !== 'string') {
    return '';
  }
  
  // Remove all non-digit characters except +
  var cleaned = phoneString.replace(/[^\d+]/g, '');
  
  if (!cleaned) {
    return '';
  }
  
  // Already in international format with +60
  if (cleaned.startsWith('+60')) {
    var digits = cleaned.substring(3);
    if (digits.length >= 9 && digits.length <= 11) {
      return '+60' + digits;
    }
    return '';
  }
  
  // Remove leading zeros and country code variations
  if (cleaned.startsWith('60')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Malaysian mobile numbers should be 9-11 digits after +60
  if (cleaned.length >= 8 && cleaned.length <= 11) {
    return '+60' + cleaned;
  }
  
  return '';
}

/**
 * Normalizes status values to standard TruckTalk status codes
 * @param {string} statusString - The status to normalize
 * @returns {string} Normalized status or empty string if invalid
 * 
 * Handles various status formats:
 * - "pending" -> "PENDING"
 * - "in transit" -> "IN_TRANSIT"
 * - "Rolling" -> "IN_TRANSIT"
 * - "delivered" -> "DELIVERED"
 * - "cancelled" -> "CANCELLED"
 */
function normalizeStatus(statusString) {
  if (!statusString || typeof statusString !== 'string') {
    return '';
  }
  
  var cleaned = statusString.trim().toUpperCase();
  
  // Direct mappings
  var statusMap = {
    'PENDING': 'PENDING',
    'SCHEDULED': 'SCHEDULED',
    'CONFIRMED': 'CONFIRMED',
    'DISPATCHED': 'DISPATCHED',
    'IN_TRANSIT': 'IN_TRANSIT',
    'ROLLING': 'IN_TRANSIT',
    'LOADING': 'LOADING',
    'DELIVERED': 'DELIVERED',
    'CANCELLED': 'CANCELLED',
    'ASSIGNED': 'SCHEDULED',
    'PRIORITY': 'SCHEDULED'
  };
  
  return statusMap[cleaned] || '';
}

/**
 * Validates if a Load ID follows the expected pattern
 * @param {string} loadId - The Load ID to validate
 * @returns {boolean} True if valid, false otherwise
 * 
 * Expected pattern: TTC + YYYY + incremental number (e.g., TTC2025001)
 */
function isValidLoadId(loadId) {
  if (!loadId || typeof loadId !== 'string') {
    return false;
  }
  
  // Pattern: TTC + 4 digits (year) + 3+ digits (sequential)
  var pattern = /^TTC\d{4}\d{3,}$/;
  return pattern.test(loadId.trim());
}

/**
 * Generates a new Load ID based on existing IDs in the sheet
 * @param {Array<Array>} existingData - The current sheet data
 * @returns {string} New unique Load ID
 */
function generateLoadId(existingData) {
  var currentYear = new Date().getFullYear();
  var prefix = 'TTC' + currentYear;
  var maxNumber = 0;
  
  // Find the highest existing number for current year
  if (existingData && existingData.length > 0) {
    for (var i = 0; i < existingData.length; i++) {
      var row = existingData[i];
      if (row.length > 0 && row[0]) {
        var loadId = String(row[0]).trim();
        if (loadId.startsWith(prefix)) {
          var numberPart = loadId.substring(prefix.length);
          var num = parseInt(numberPart, 10);
          if (!isNaN(num) && num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    }
  }
  
  // Generate next number with proper padding
  var nextNumber = maxNumber + 1;
  var paddedNumber = String(nextNumber).padStart(3, '0');
  
  return prefix + paddedNumber;
}

/**
 * Validates if a time string is in 24-hour format (HH:MM)
 * @param {string} timeString - The time string to validate
 * @returns {boolean} True if valid 24-hour format, false otherwise
 */
function isValidTime(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return false;
  }
  
  var pattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return pattern.test(timeString.trim());
}

/**
 * Normalizes time to 24-hour format (HH:MM)
 * @param {string} timeString - The time string to normalize
 * @returns {string} Normalized time or empty string if invalid
 * 
 * Handles formats:
 * - "2:45 PM" -> "14:45"
 * - "08:00" -> "08:00" (already normalized)
 * - "8:00" -> "08:00"
 */
function normalizeTime(timeString) {
  if (!timeString || typeof timeString !== 'string') {
    return '';
  }
  
  var trimmed = timeString.trim();
  
  // Already in 24-hour format
  if (isValidTime(trimmed)) {
    var parts = trimmed.split(':');
    var hours = String(parseInt(parts[0], 10)).padStart(2, '0');
    var minutes = parts[1];
    return hours + ':' + minutes;
  }
  
  // Handle 12-hour format with AM/PM
  var amPmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (amPmMatch) {
    var hours = parseInt(amPmMatch[1], 10);
    var minutes = amPmMatch[2];
    var period = amPmMatch[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return String(hours).padStart(2, '0') + ':' + minutes;
  }
  
  return '';
}
