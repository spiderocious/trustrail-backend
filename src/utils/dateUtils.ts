import { format, addMonths, addWeeks, parse, isValid, differenceInMonths } from 'date-fns';

/**
 * Format date for PWA API
 * Format: YYYY-MM-DD-HH-mm-ss
 */
export const formatDateForPWA = (date: Date): string => {
  return format(date, 'yyyy-MM-dd-HH-mm-ss');
};

/**
 * Calculate next payment date based on frequency
 */
export const calculateNextPaymentDate = (
  startDate: Date,
  paymentNumber: number,
  frequency: 'weekly' | 'monthly'
): Date => {
  if (frequency === 'monthly') {
    return addMonths(startDate, paymentNumber - 1);
  } else {
    return addWeeks(startDate, paymentNumber - 1);
  }
};

/**
 * Parse various date formats from CSV
 */
export const parseCSVDate = (dateString: string): Date | null => {
  if (!dateString) return null;

  // Try common formats
  const formats = [
    'yyyy-MM-dd',
    'dd/MM/yyyy',
    'dd-MM-yyyy',
    'MM/dd/yyyy',
    'MM-dd-yyyy',
    'dd MMM yyyy',
    'dd-MMM-yyyy',
    'yyyy/MM/dd',
  ];

  for (const formatString of formats) {
    try {
      const parsed = parse(dateString.trim(), formatString, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    } catch (error) {
      continue;
    }
  }

  // Try native Date parsing as fallback
  const nativeDate = new Date(dateString);
  if (isValid(nativeDate)) {
    return nativeDate;
  }

  return null;
};

/**
 * Calculate number of months between two dates
 */
export const getMonthsBetween = (startDate: Date, endDate: Date): number => {
  return differenceInMonths(endDate, startDate);
};

/**
 * Get start of month for a date
 */
export const getStartOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

/**
 * Get end of month for a date
 */
export const getEndOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
};

/**
 * Format date for display
 */
export const formatDisplayDate = (date: Date): string => {
  return format(date, 'dd MMM yyyy');
};

/**
 * Format date with time for display
 */
export const formatDisplayDateTime = (date: Date): string => {
  return format(date, 'dd MMM yyyy HH:mm:ss');
};

/**
 * Check if date is in the past
 */
export const isInPast = (date: Date): boolean => {
  return date < new Date();
};

/**
 * Check if date is in the future
 */
export const isInFuture = (date: Date): boolean => {
  return date > new Date();
};

/**
 * Add days to a date
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Add days to a date (alias for consistency)
 */
export const addDaysToDate = (date: Date, days: number): Date => {
  return addDays(date, days);
};

/**
 * Add months to a date (alias for consistency)
 */
export const addMonthsToDate = (date: Date, months: number): Date => {
  return addMonths(date, months);
};

export default {
  formatDateForPWA,
  calculateNextPaymentDate,
  parseCSVDate,
  getMonthsBetween,
  getStartOfMonth,
  getEndOfMonth,
  formatDisplayDate,
  formatDisplayDateTime,
  isInPast,
  isInFuture,
  addDays,
  addDaysToDate,
  addMonthsToDate,
};
