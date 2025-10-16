import {
  differenceInDays,
  isAfter,
  isBefore,
  isEqual,
  startOfDay,
  endOfDay,
  parseISO,
  isValid,
} from 'date-fns';

/**
 * Date utility functions for leave request calculations
 * 
 * This module provides type-safe date manipulation utilities specifically
 * designed for leave management operations. All functions handle edge cases
 * including timezone considerations, same-day ranges, and invalid inputs.
 * 
 * @module utils/date
 */

/**
 * Date range interface for overlap checking
 */
export interface DateRange {
  /**
   * Start date of the range (inclusive)
   */
  readonly start: Date;

  /**
   * End date of the range (inclusive)
   */
  readonly end: Date;
}

/**
 * Result of date range validation
 */
export interface DateRangeValidationResult {
  /**
   * Whether the date range is valid
   */
  readonly isValid: boolean;

  /**
   * Array of validation errors (empty if valid)
   */
  readonly errors: string[];
}

/**
 * Calculate the number of days between two dates (inclusive)
 * 
 * Calculates the total number of days between start and end dates,
 * including both the start and end dates. Handles same-day ranges
 * and normalizes dates to start of day for consistent calculations.
 * 
 * @param {Date} startDate - Start date (inclusive)
 * @param {Date} endDate - End date (inclusive)
 * @returns {number} Number of days between dates (minimum 1 for same day)
 * 
 * @example
 * // Same day returns 1
 * calculateDaysBetween(new Date('2024-01-01'), new Date('2024-01-01')); // 1
 * 
 * @example
 * // Multiple days
 * calculateDaysBetween(new Date('2024-01-01'), new Date('2024-01-05')); // 5
 * 
 * @throws {Error} If either date is invalid
 */
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  // Validate inputs
  if (!(startDate instanceof Date) || !isValid(startDate)) {
    throw new Error('Invalid start date provided');
  }

  if (!(endDate instanceof Date) || !isValid(endDate)) {
    throw new Error('Invalid end date provided');
  }

  // Normalize dates to start of day to avoid time component issues
  const normalizedStart = startOfDay(startDate);
  const normalizedEnd = startOfDay(endDate);

  // Calculate difference in days
  const daysDifference = differenceInDays(normalizedEnd, normalizedStart);

  // Add 1 to include both start and end dates (inclusive range)
  // For same day, this returns 1
  const totalDays = daysDifference + 1;

  // Ensure we never return negative or zero days
  return Math.max(1, totalDays);
}

/**
 * Check if a date is in the future
 * 
 * Compares the provided date against the current date/time.
 * Normalizes both dates to start of day for consistent comparison.
 * 
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is in the future, false otherwise
 * 
 * @example
 * isDateInFuture(new Date('2025-01-01')); // true (if current date is before 2025)
 * isDateInFuture(new Date('2020-01-01')); // false
 * 
 * @throws {Error} If date is invalid
 */
export function isDateInFuture(date: Date): boolean {
  // Validate input
  if (!(date instanceof Date) || !isValid(date)) {
    throw new Error('Invalid date provided');
  }

  // Get current date normalized to start of day
  const now = startOfDay(new Date());

  // Normalize input date to start of day
  const normalizedDate = startOfDay(date);

  // Check if date is after current date
  return isAfter(normalizedDate, now);
}

/**
 * Validate that start date is before or equal to end date
 * 
 * Checks if a date range is valid by ensuring the start date
 * comes before or equals the end date. Normalizes dates to
 * start of day for consistent comparison.
 * 
 * @param {Date} startDate - Start date of range
 * @param {Date} endDate - End date of range
 * @returns {boolean} True if start date <= end date, false otherwise
 * 
 * @example
 * isDateRangeValid(new Date('2024-01-01'), new Date('2024-01-05')); // true
 * isDateRangeValid(new Date('2024-01-05'), new Date('2024-01-01')); // false
 * isDateRangeValid(new Date('2024-01-01'), new Date('2024-01-01')); // true (same day)
 * 
 * @throws {Error} If either date is invalid
 */
export function isDateRangeValid(startDate: Date, endDate: Date): boolean {
  // Validate inputs
  if (!(startDate instanceof Date) || !isValid(startDate)) {
    throw new Error('Invalid start date provided');
  }

  if (!(endDate instanceof Date) || !isValid(endDate)) {
    throw new Error('Invalid end date provided');
  }

  // Normalize dates to start of day
  const normalizedStart = startOfDay(startDate);
  const normalizedEnd = startOfDay(endDate);

  // Check if start is before or equal to end
  return isBefore(normalizedStart, normalizedEnd) || isEqual(normalizedStart, normalizedEnd);
}

/**
 * Check if two date ranges overlap
 * 
 * Determines if two date ranges have any overlapping days.
 * Handles all edge cases including:
 * - Partial overlaps
 * - Complete containment
 * - Adjacent ranges (no overlap)
 * - Same-day ranges
 * 
 * @param {DateRange} range1 - First date range
 * @param {DateRange} range2 - Second date range
 * @returns {boolean} True if ranges overlap, false otherwise
 * 
 * @example
 * // Overlapping ranges
 * checkDateOverlap(
 *   { start: new Date('2024-01-01'), end: new Date('2024-01-05') },
 *   { start: new Date('2024-01-03'), end: new Date('2024-01-07') }
 * ); // true
 * 
 * @example
 * // Non-overlapping ranges
 * checkDateOverlap(
 *   { start: new Date('2024-01-01'), end: new Date('2024-01-05') },
 *   { start: new Date('2024-01-06'), end: new Date('2024-01-10') }
 * ); // false
 * 
 * @example
 * // One range contains the other
 * checkDateOverlap(
 *   { start: new Date('2024-01-01'), end: new Date('2024-01-10') },
 *   { start: new Date('2024-01-03'), end: new Date('2024-01-05') }
 * ); // true
 * 
 * @throws {Error} If any date in either range is invalid
 */
export function checkDateOverlap(range1: DateRange, range2: DateRange): boolean {
  // Validate range1
  if (!(range1.start instanceof Date) || !isValid(range1.start)) {
    throw new Error('Invalid start date in range1');
  }
  if (!(range1.end instanceof Date) || !isValid(range1.end)) {
    throw new Error('Invalid end date in range1');
  }

  // Validate range2
  if (!(range2.start instanceof Date) || !isValid(range2.start)) {
    throw new Error('Invalid start date in range2');
  }
  if (!(range2.end instanceof Date) || !isValid(range2.end)) {
    throw new Error('Invalid end date in range2');
  }

  // Normalize all dates to start of day
  const range1Start = startOfDay(range1.start);
  const range1End = startOfDay(range1.end);
  const range2Start = startOfDay(range2.start);
  const range2End = startOfDay(range2.end);

  // Validate that each range is valid (start <= end)
  if (isAfter(range1Start, range1End)) {
    throw new Error('Invalid range1: start date is after end date');
  }
  if (isAfter(range2Start, range2End)) {
    throw new Error('Invalid range2: start date is after end date');
  }

  // Check for overlap using interval logic
  // Two ranges overlap if:
  // - range1.start <= range2.end AND range2.start <= range1.end
  const range1StartsBeforeRange2Ends =
    isBefore(range1Start, range2End) || isEqual(range1Start, range2End);
  const range2StartsBeforeRange1Ends =
    isBefore(range2Start, range1End) || isEqual(range2Start, range1End);

  return range1StartsBeforeRange2Ends && range2StartsBeforeRange1Ends;
}

/**
 * Validate a date range with detailed error reporting
 * 
 * Performs comprehensive validation of a date range including:
 * - Date validity checks
 * - Start date <= end date validation
 * - Future date validation (optional)
 * - Maximum duration validation (optional)
 * 
 * @param {DateRange} range - Date range to validate
 * @param {Object} options - Validation options
 * @param {boolean} [options.requireFutureDates=false] - Require dates to be in future
 * @param {number} [options.maxDurationDays] - Maximum allowed duration in days
 * @returns {DateRangeValidationResult} Validation result with errors
 * 
 * @example
 * validateDateRange(
 *   { start: new Date('2024-01-01'), end: new Date('2024-01-05') },
 *   { requireFutureDates: true, maxDurationDays: 30 }
 * );
 */
export function validateDateRange(
  range: DateRange,
  options?: {
    readonly requireFutureDates?: boolean;
    readonly maxDurationDays?: number;
  }
): DateRangeValidationResult {
  const errors: string[] = [];

  try {
    // Validate start date
    if (!(range.start instanceof Date) || !isValid(range.start)) {
      errors.push('Start date is invalid');
    }

    // Validate end date
    if (!(range.end instanceof Date) || !isValid(range.end)) {
      errors.push('End date is invalid');
    }

    // If dates are invalid, return early
    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    // Normalize dates
    const normalizedStart = startOfDay(range.start);
    const normalizedEnd = startOfDay(range.end);

    // Check if start date is before or equal to end date
    if (isAfter(normalizedStart, normalizedEnd)) {
      errors.push('Start date must be before or equal to end date');
    }

    // Check if dates are in future (if required)
    if (options?.requireFutureDates) {
      const now = startOfDay(new Date());

      if (isBefore(normalizedStart, now)) {
        errors.push('Start date must be in the future');
      }

      if (isBefore(normalizedEnd, now)) {
        errors.push('End date must be in the future');
      }
    }

    // Check maximum duration (if specified)
    if (options?.maxDurationDays !== undefined && options.maxDurationDays > 0) {
      const duration = calculateDaysBetween(range.start, range.end);

      if (duration > options.maxDurationDays) {
        errors.push(
          `Date range duration (${duration} days) exceeds maximum allowed (${options.maxDurationDays} days)`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Validation error: ${errorMessage}`);

    return {
      isValid: false,
      errors,
    };
  }
}

/**
 * Parse a date string safely with validation
 * 
 * Attempts to parse a date string using ISO 8601 format.
 * Returns null if parsing fails or date is invalid.
 * 
 * @param {string} dateString - Date string to parse (ISO 8601 format)
 * @returns {Date | null} Parsed date or null if invalid
 * 
 * @example
 * parseDateSafely('2024-01-01'); // Date object
 * parseDateSafely('invalid'); // null
 */
export function parseDateSafely(dateString: string): Date | null {
  try {
    if (typeof dateString !== 'string' || dateString.trim().length === 0) {
      return null;
    }

    const parsed = parseISO(dateString);

    if (!isValid(parsed)) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

/**
 * Get the start of day for a date (timezone-safe)
 * 
 * Returns a new Date object set to the start of the day (00:00:00.000)
 * for the provided date. Useful for normalizing dates for comparison.
 * 
 * @param {Date} date - Date to normalize
 * @returns {Date} Date set to start of day
 * 
 * @throws {Error} If date is invalid
 */
export function getStartOfDay(date: Date): Date {
  if (!(date instanceof Date) || !isValid(date)) {
    throw new Error('Invalid date provided');
  }

  return startOfDay(date);
}

/**
 * Get the end of day for a date (timezone-safe)
 * 
 * Returns a new Date object set to the end of the day (23:59:59.999)
 * for the provided date. Useful for inclusive date range queries.
 * 
 * @param {Date} date - Date to normalize
 * @returns {Date} Date set to end of day
 * 
 * @throws {Error} If date is invalid
 */
export function getEndOfDay(date: Date): Date {
  if (!(date instanceof Date) || !isValid(date)) {
    throw new Error('Invalid date provided');
  }

  return endOfDay(date);
}

/**
 * Check if a date falls within a date range (inclusive)
 * 
 * Determines if a specific date falls within the provided date range,
 * including the start and end dates.
 * 
 * @param {Date} date - Date to check
 * @param {DateRange} range - Date range to check against
 * @returns {boolean} True if date is within range, false otherwise
 * 
 * @example
 * isDateInRange(
 *   new Date('2024-01-03'),
 *   { start: new Date('2024-01-01'), end: new Date('2024-01-05') }
 * ); // true
 * 
 * @throws {Error} If any date is invalid
 */
export function isDateInRange(date: Date, range: DateRange): boolean {
  // Validate inputs
  if (!(date instanceof Date) || !isValid(date)) {
    throw new Error('Invalid date provided');
  }

  if (!(range.start instanceof Date) || !isValid(range.start)) {
    throw new Error('Invalid start date in range');
  }

  if (!(range.end instanceof Date) || !isValid(range.end)) {
    throw new Error('Invalid end date in range');
  }

  // Normalize all dates to start of day
  const normalizedDate = startOfDay(date);
  const normalizedStart = startOfDay(range.start);
  const normalizedEnd = startOfDay(range.end);

  // Check if date is within range (inclusive)
  const isAfterOrEqualStart =
    isAfter(normalizedDate, normalizedStart) || isEqual(normalizedDate, normalizedStart);
  const isBeforeOrEqualEnd =
    isBefore(normalizedDate, normalizedEnd) || isEqual(normalizedDate, normalizedEnd);

  return isAfterOrEqualStart && isBeforeOrEqualEnd;
}

export default {
  calculateDaysBetween,
  isDateInFuture,
  isDateRangeValid,
  checkDateOverlap,
  validateDateRange,
  parseDateSafely,
  getStartOfDay,
  getEndOfDay,
  isDateInRange,
};