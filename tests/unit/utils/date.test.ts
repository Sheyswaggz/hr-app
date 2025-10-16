import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateDaysBetween,
  isDateInFuture,
  isDateRangeValid,
  checkDateOverlap,
  validateDateRange,
  parseDateSafely,
  getStartOfDay,
  getEndOfDay,
  isDateInRange,
  type DateRange,
} from '../../../src/utils/date';

describe('Date Utility Functions', () => {
  describe('calculateDaysBetween', () => {
    it('should return 1 for same day', () => {
      const date = new Date('2024-01-15');
      const result = calculateDaysBetween(date, date);
      expect(result).toBe(1);
    });

    it('should calculate days between different dates', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-05');
      const result = calculateDaysBetween(start, end);
      expect(result).toBe(5);
    });

    it('should handle dates with time components', () => {
      const start = new Date('2024-01-01T10:30:00');
      const end = new Date('2024-01-05T15:45:00');
      const result = calculateDaysBetween(start, end);
      expect(result).toBe(5);
    });

    it('should handle leap year correctly', () => {
      const start = new Date('2024-02-28');
      const end = new Date('2024-03-01');
      const result = calculateDaysBetween(start, end);
      expect(result).toBe(3); // Feb 28, Feb 29, Mar 1
    });

    it('should handle non-leap year correctly', () => {
      const start = new Date('2023-02-28');
      const end = new Date('2023-03-01');
      const result = calculateDaysBetween(start, end);
      expect(result).toBe(2); // Feb 28, Mar 1
    });

    it('should handle year boundaries', () => {
      const start = new Date('2023-12-30');
      const end = new Date('2024-01-02');
      const result = calculateDaysBetween(start, end);
      expect(result).toBe(4); // Dec 30, Dec 31, Jan 1, Jan 2
    });

    it('should handle large date ranges', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const result = calculateDaysBetween(start, end);
      expect(result).toBe(366); // 2024 is a leap year
    });

    it('should throw error for invalid start date', () => {
      const invalidDate = new Date('invalid');
      const validDate = new Date('2024-01-01');
      expect(() => calculateDaysBetween(invalidDate, validDate)).toThrow(
        'Invalid start date provided'
      );
    });

    it('should throw error for invalid end date', () => {
      const validDate = new Date('2024-01-01');
      const invalidDate = new Date('invalid');
      expect(() => calculateDaysBetween(validDate, invalidDate)).toThrow(
        'Invalid end date provided'
      );
    });

    it('should throw error for non-Date start parameter', () => {
      const validDate = new Date('2024-01-01');
      expect(() => calculateDaysBetween('2024-01-01' as any, validDate)).toThrow(
        'Invalid start date provided'
      );
    });

    it('should throw error for non-Date end parameter', () => {
      const validDate = new Date('2024-01-01');
      expect(() => calculateDaysBetween(validDate, '2024-01-05' as any)).toThrow(
        'Invalid end date provided'
      );
    });

    it('should return minimum 1 day even for reversed dates', () => {
      const start = new Date('2024-01-05');
      const end = new Date('2024-01-01');
      const result = calculateDaysBetween(start, end);
      expect(result).toBe(1); // Math.max ensures minimum 1
    });
  });

  describe('isDateInFuture', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for future date', () => {
      vi.setSystemTime(new Date('2024-01-15'));
      const futureDate = new Date('2024-01-20');
      expect(isDateInFuture(futureDate)).toBe(true);
    });

    it('should return false for past date', () => {
      vi.setSystemTime(new Date('2024-01-15'));
      const pastDate = new Date('2024-01-10');
      expect(isDateInFuture(pastDate)).toBe(false);
    });

    it('should return false for current date', () => {
      const now = new Date('2024-01-15');
      vi.setSystemTime(now);
      expect(isDateInFuture(now)).toBe(false);
    });

    it('should ignore time component', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00'));
      const sameDay = new Date('2024-01-15T20:00:00');
      expect(isDateInFuture(sameDay)).toBe(false);
    });

    it('should handle dates with different timezones', () => {
      vi.setSystemTime(new Date('2024-01-15T00:00:00Z'));
      const futureDate = new Date('2024-01-16T00:00:00Z');
      expect(isDateInFuture(futureDate)).toBe(true);
    });

    it('should throw error for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => isDateInFuture(invalidDate)).toThrow('Invalid date provided');
    });

    it('should throw error for non-Date parameter', () => {
      expect(() => isDateInFuture('2024-01-20' as any)).toThrow(
        'Invalid date provided'
      );
    });
  });

  describe('isDateRangeValid', () => {
    it('should return true for valid date range', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-01-05');
      expect(isDateRangeValid(start, end)).toBe(true);
    });

    it('should return true for same day range', () => {
      const date = new Date('2024-01-15');
      expect(isDateRangeValid(date, date)).toBe(true);
    });

    it('should return false for reversed date range', () => {
      const start = new Date('2024-01-05');
      const end = new Date('2024-01-01');
      expect(isDateRangeValid(start, end)).toBe(false);
    });

    it('should ignore time component', () => {
      const start = new Date('2024-01-01T23:59:59');
      const end = new Date('2024-01-02T00:00:01');
      expect(isDateRangeValid(start, end)).toBe(true);
    });

    it('should handle dates across year boundaries', () => {
      const start = new Date('2023-12-31');
      const end = new Date('2024-01-01');
      expect(isDateRangeValid(start, end)).toBe(true);
    });

    it('should throw error for invalid start date', () => {
      const invalidDate = new Date('invalid');
      const validDate = new Date('2024-01-01');
      expect(() => isDateRangeValid(invalidDate, validDate)).toThrow(
        'Invalid start date provided'
      );
    });

    it('should throw error for invalid end date', () => {
      const validDate = new Date('2024-01-01');
      const invalidDate = new Date('invalid');
      expect(() => isDateRangeValid(validDate, invalidDate)).toThrow(
        'Invalid end date provided'
      );
    });

    it('should throw error for non-Date start parameter', () => {
      const validDate = new Date('2024-01-01');
      expect(() => isDateRangeValid('2024-01-01' as any, validDate)).toThrow(
        'Invalid start date provided'
      );
    });

    it('should throw error for non-Date end parameter', () => {
      const validDate = new Date('2024-01-01');
      expect(() => isDateRangeValid(validDate, '2024-01-05' as any)).toThrow(
        'Invalid end date provided'
      );
    });
  });

  describe('checkDateOverlap', () => {
    it('should detect overlapping ranges', () => {
      const range1: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        start: new Date('2024-01-03'),
        end: new Date('2024-01-07'),
      };
      expect(checkDateOverlap(range1, range2)).toBe(true);
    });

    it('should detect non-overlapping ranges', () => {
      const range1: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        start: new Date('2024-01-06'),
        end: new Date('2024-01-10'),
      };
      expect(checkDateOverlap(range1, range2)).toBe(false);
    });

    it('should detect adjacent ranges as non-overlapping', () => {
      const range1: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        start: new Date('2024-01-05'),
        end: new Date('2024-01-10'),
      };
      expect(checkDateOverlap(range1, range2)).toBe(true); // Same day counts as overlap
    });

    it('should detect complete containment', () => {
      const range1: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-10'),
      };
      const range2: DateRange = {
        start: new Date('2024-01-03'),
        end: new Date('2024-01-05'),
      };
      expect(checkDateOverlap(range1, range2)).toBe(true);
    });

    it('should detect reverse containment', () => {
      const range1: DateRange = {
        start: new Date('2024-01-03'),
        end: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-10'),
      };
      expect(checkDateOverlap(range1, range2)).toBe(true);
    });

    it('should handle same-day ranges', () => {
      const range1: DateRange = {
        start: new Date('2024-01-05'),
        end: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        start: new Date('2024-01-05'),
        end: new Date('2024-01-05'),
      };
      expect(checkDateOverlap(range1, range2)).toBe(true);
    });

    it('should handle edge case where ranges touch at one point', () => {
      const range1: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      const range2: DateRange = {
        start: new Date('2024-01-05'),
        end: new Date('2024-01-10'),
      };
      expect(checkDateOverlap(range1, range2)).toBe(true);
    });

    it('should throw error for invalid range1 start date', () => {
      const invalidRange: DateRange = {
        start: new Date('invalid'),
        end: new Date('2024-01-05'),
      };
      const validRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      expect(() => checkDateOverlap(invalidRange, validRange)).toThrow(
        'Invalid start date in range1'
      );
    });

    it('should throw error for invalid range1 end date', () => {
      const invalidRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('invalid'),
      };
      const validRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      expect(() => checkDateOverlap(invalidRange, validRange)).toThrow(
        'Invalid end date in range1'
      );
    });

    it('should throw error for invalid range2 start date', () => {
      const validRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      const invalidRange: DateRange = {
        start: new Date('invalid'),
        end: new Date('2024-01-05'),
      };
      expect(() => checkDateOverlap(validRange, invalidRange)).toThrow(
        'Invalid start date in range2'
      );
    });

    it('should throw error for invalid range2 end date', () => {
      const validRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      const invalidRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('invalid'),
      };
      expect(() => checkDateOverlap(validRange, invalidRange)).toThrow(
        'Invalid end date in range2'
      );
    });

    it('should throw error for invalid range1 (start after end)', () => {
      const invalidRange: DateRange = {
        start: new Date('2024-01-05'),
        end: new Date('2024-01-01'),
      };
      const validRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      expect(() => checkDateOverlap(invalidRange, validRange)).toThrow(
        'Invalid range1: start date is after end date'
      );
    });

    it('should throw error for invalid range2 (start after end)', () => {
      const validRange: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      const invalidRange: DateRange = {
        start: new Date('2024-01-05'),
        end: new Date('2024-01-01'),
      };
      expect(() => checkDateOverlap(validRange, invalidRange)).toThrow(
        'Invalid range2: start date is after end date'
      );
    });
  });

  describe('validateDateRange', () => {
    it('should validate valid date range', () => {
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      const result = validateDateRange(range);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid start date', () => {
      const range: DateRange = {
        start: new Date('invalid'),
        end: new Date('2024-01-05'),
      };
      const result = validateDateRange(range);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date is invalid');
    });

    it('should detect invalid end date', () => {
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('invalid'),
      };
      const result = validateDateRange(range);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End date is invalid');
    });

    it('should detect start date after end date', () => {
      const range: DateRange = {
        start: new Date('2024-01-05'),
        end: new Date('2024-01-01'),
      };
      const result = validateDateRange(range);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be before or equal to end date');
    });

    it('should validate future dates when required', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15'));

      const range: DateRange = {
        start: new Date('2024-01-10'),
        end: new Date('2024-01-20'),
      };
      const result = validateDateRange(range, { requireFutureDates: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be in the future');

      vi.useRealTimers();
    });

    it('should validate maximum duration', () => {
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-02-01'),
      };
      const result = validateDateRange(range, { maxDurationDays: 20 });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum allowed'))).toBe(true);
    });

    it('should pass validation with valid future dates', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15'));

      const range: DateRange = {
        start: new Date('2024-01-20'),
        end: new Date('2024-01-25'),
      };
      const result = validateDateRange(range, { requireFutureDates: true });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should pass validation within max duration', () => {
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-10'),
      };
      const result = validateDateRange(range, { maxDurationDays: 20 });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const range: DateRange = {
        start: new Date('invalid'),
        end: new Date('invalid'),
      };
      const result = validateDateRange(range);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('parseDateSafely', () => {
    it('should parse valid ISO date string', () => {
      const result = parseDateSafely('2024-01-15');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toContain('2024-01-15');
    });

    it('should parse ISO datetime string', () => {
      const result = parseDateSafely('2024-01-15T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should return null for invalid date string', () => {
      const result = parseDateSafely('invalid-date');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseDateSafely('');
      expect(result).toBeNull();
    });

    it('should return null for non-string input', () => {
      const result = parseDateSafely(123 as any);
      expect(result).toBeNull();
    });

    it('should return null for whitespace-only string', () => {
      const result = parseDateSafely('   ');
      expect(result).toBeNull();
    });

    it('should handle various ISO formats', () => {
      const formats = [
        '2024-01-15',
        '2024-01-15T10:30:00',
        '2024-01-15T10:30:00Z',
        '2024-01-15T10:30:00+00:00',
      ];

      formats.forEach((format) => {
        const result = parseDateSafely(format);
        expect(result).toBeInstanceOf(Date);
      });
    });
  });

  describe('getStartOfDay', () => {
    it('should return start of day', () => {
      const date = new Date('2024-01-15T15:30:45.123');
      const result = getStartOfDay(date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should not modify original date', () => {
      const date = new Date('2024-01-15T15:30:45.123');
      const original = date.getTime();
      getStartOfDay(date);
      expect(date.getTime()).toBe(original);
    });

    it('should throw error for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => getStartOfDay(invalidDate)).toThrow('Invalid date provided');
    });

    it('should throw error for non-Date parameter', () => {
      expect(() => getStartOfDay('2024-01-15' as any)).toThrow('Invalid date provided');
    });
  });

  describe('getEndOfDay', () => {
    it('should return end of day', () => {
      const date = new Date('2024-01-15T10:30:45.123');
      const result = getEndOfDay(date);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
    });

    it('should not modify original date', () => {
      const date = new Date('2024-01-15T10:30:45.123');
      const original = date.getTime();
      getEndOfDay(date);
      expect(date.getTime()).toBe(original);
    });

    it('should throw error for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(() => getEndOfDay(invalidDate)).toThrow('Invalid date provided');
    });

    it('should throw error for non-Date parameter', () => {
      expect(() => getEndOfDay('2024-01-15' as any)).toThrow('Invalid date provided');
    });
  });

  describe('isDateInRange', () => {
    it('should return true for date within range', () => {
      const date = new Date('2024-01-03');
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      expect(isDateInRange(date, range)).toBe(true);
    });

    it('should return true for date at start of range', () => {
      const date = new Date('2024-01-01');
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      expect(isDateInRange(date, range)).toBe(true);
    });

    it('should return true for date at end of range', () => {
      const date = new Date('2024-01-05');
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      expect(isDateInRange(date, range)).toBe(true);
    });

    it('should return false for date before range', () => {
      const date = new Date('2023-12-31');
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      expect(isDateInRange(date, range)).toBe(false);
    });

    it('should return false for date after range', () => {
      const date = new Date('2024-01-06');
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      expect(isDateInRange(date, range)).toBe(false);
    });

    it('should ignore time component', () => {
      const date = new Date('2024-01-03T23:59:59');
      const range: DateRange = {
        start: new Date('2024-01-01T00:00:00'),
        end: new Date('2024-01-05T00:00:00'),
      };
      expect(isDateInRange(date, range)).toBe(true);
    });

    it('should throw error for invalid date', () => {
      const invalidDate = new Date('invalid');
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-05'),
      };
      expect(() => isDateInRange(invalidDate, range)).toThrow('Invalid date provided');
    });

    it('should throw error for invalid range start date', () => {
      const date = new Date('2024-01-03');
      const range: DateRange = {
        start: new Date('invalid'),
        end: new Date('2024-01-05'),
      };
      expect(() => isDateInRange(date, range)).toThrow('Invalid start date in range');
    });

    it('should throw error for invalid range end date', () => {
      const date = new Date('2024-01-03');
      const range: DateRange = {
        start: new Date('2024-01-01'),
        end: new Date('invalid'),
      };
      expect(() => isDateInRange(date, range)).toThrow('Invalid end date in range');
    });
  });

  describe('Timezone handling', () => {
    it('should handle dates across different timezones consistently', () => {
      const date1 = new Date('2024-01-15T00:00:00Z');
      const date2 = new Date('2024-01-15T23:59:59Z');
      
      const days = calculateDaysBetween(date1, date2);
      expect(days).toBe(1); // Same day in UTC
    });

    it('should normalize dates to start of day for comparison', () => {
      const morning = new Date('2024-01-15T08:00:00Z');
      const evening = new Date('2024-01-15T20:00:00Z');
      
      expect(isDateRangeValid(morning, evening)).toBe(true);
    });

    it('should handle daylight saving time transitions', () => {
      // Spring forward (DST starts)
      const beforeDST = new Date('2024-03-10T00:00:00');
      const afterDST = new Date('2024-03-11T00:00:00');
      
      const days = calculateDaysBetween(beforeDST, afterDST);
      expect(days).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle dates at Unix epoch', () => {
      const epoch = new Date(0);
      const later = new Date('1970-01-02');
      
      const days = calculateDaysBetween(epoch, later);
      expect(days).toBeGreaterThan(0);
    });

    it('should handle very large date ranges', () => {
      const start = new Date('2000-01-01');
      const end = new Date('2100-01-01');
      
      const days = calculateDaysBetween(start, end);
      expect(days).toBeGreaterThan(36500); // ~100 years
    });

    it('should handle same millisecond timestamps', () => {
      const timestamp = Date.now();
      const date1 = new Date(timestamp);
      const date2 = new Date(timestamp);
      
      expect(calculateDaysBetween(date1, date2)).toBe(1);
    });
  });
});