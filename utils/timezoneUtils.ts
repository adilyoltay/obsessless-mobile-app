/**
 * 🌍 TIMEZONE-AWARE UTILITIES
 * 
 * Provides timezone-safe date operations for mood tracking and analysis
 * to prevent entries from being assigned to wrong days across different timezones.
 */

/**
 * Get user's current timezone offset in minutes
 * Positive for timezones ahead of UTC, negative for behind
 */
export function getUserTimezoneOffset(): number {
  return new Date().getTimezoneOffset();
}

/**
 * Get user's timezone identifier (e.g., "Europe/Istanbul", "America/New_York")
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Fallback to UTC if Intl is not available
    return 'UTC';
  }
}

/**
 * 📅 TIMEZONE-AWARE: Convert date to user's local date (start of day)
 * This ensures mood entries are grouped by the correct day in user's timezone
 */
export function toUserLocalDate(date: Date | string): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Get user's timezone offset
  const timezoneOffsetMinutes = getUserTimezoneOffset();
  
  // Create date in user's timezone (start of day)
  const userDate = new Date(dateObj.getTime() - (timezoneOffsetMinutes * 60 * 1000));
  
  // Set to start of day in user's timezone
  const userStartOfDay = new Date(
    userDate.getFullYear(), 
    userDate.getMonth(), 
    userDate.getDate(),
    0, 0, 0, 0
  );
  
  return userStartOfDay;
}

/**
 * 📊 TIMEZONE-AWARE: Get start and end of day in user's timezone
 */
export function getUserDayBounds(date: Date | string): { start: Date; end: Date } {
  const userStartOfDay = toUserLocalDate(date);
  const userEndOfDay = new Date(userStartOfDay.getTime() + 24 * 60 * 60 * 1000);
  
  return {
    start: userStartOfDay,
    end: userEndOfDay
  };
}

/**
 * 🗓️ TIMEZONE-AWARE: Check if two dates are on the same day in user's timezone
 */
export function isSameDayInUserTimezone(date1: Date | string, date2: Date | string): boolean {
  const userDate1 = toUserLocalDate(date1);
  const userDate2 = toUserLocalDate(date2);
  
  return userDate1.getTime() === userDate2.getTime();
}

/**
 * 📆 TIMEZONE-AWARE: Get date string in user's timezone (YYYY-MM-DD format)
 */
export function getUserDateString(date: Date | string): string {
  const userDate = toUserLocalDate(date);
  
  const year = userDate.getFullYear();
  const month = String(userDate.getMonth() + 1).padStart(2, '0');
  const day = String(userDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 📈 TIMEZONE-AWARE: Group entries by day in user's timezone
 */
export function groupEntriesByUserDay<T extends { created_at: string }>(entries: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  
  for (const entry of entries) {
    const dayString = getUserDateString(entry.created_at);
    
    if (!grouped.has(dayString)) {
      grouped.set(dayString, []);
    }
    
    grouped.get(dayString)!.push(entry);
  }
  
  return grouped;
}

/**
 * 🏃 TIMEZONE-AWARE: Calculate streak of consecutive days with entries
 */
export function calculateStreakInUserTimezone<T extends { created_at: string }>(entries: T[]): number {
  if (entries.length === 0) return 0;
  
  // Group entries by user's local dates
  const entriesByDay = groupEntriesByUserDay(entries);
  const daysWithEntries = Array.from(entriesByDay.keys()).sort().reverse(); // Most recent first
  
  let streak = 0;
  const today = getUserDateString(new Date());
  
  // Check if there's an entry today, if not, start from yesterday
  let checkDate = daysWithEntries.includes(today) ? today : getPreviousDay(today);
  
  // Count consecutive days backwards from today/yesterday
  while (daysWithEntries.includes(checkDate)) {
    streak++;
    checkDate = getPreviousDay(checkDate);
  }
  
  return streak;
}

/**
 * 📅 HELPER: Get previous day in YYYY-MM-DD format
 */
function getPreviousDay(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - 1);
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 🔍 TIMEZONE-AWARE: Filter entries for specific time ranges in user's timezone
 */
export function filterEntriesByUserTimeRange<T extends { created_at: string }>(
  entries: T[],
  range: 'today' | 'week' | 'month'
): T[] {
  const now = new Date();
  const today = toUserLocalDate(now);
  
  let startDate: Date;
  
  switch (range) {
    case 'today':
      startDate = today;
      break;
    case 'week':
      startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }
  
  return entries.filter(entry => {
    const entryUserDate = toUserLocalDate(entry.created_at);
    return entryUserDate >= startDate;
  });
}

/**
 * 🏷️ TIMEZONE-AWARE: Format date for display in user's timezone
 */
export function formatDateInUserTimezone(date: Date | string, format: 'short' | 'medium' | 'long' = 'short'): string {
  const userDate = toUserLocalDate(date);
  
  switch (format) {
    case 'short':
      return `${userDate.getDate()}/${userDate.getMonth() + 1}`;
    case 'medium':
      const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
      return `${userDate.getDate()} ${months[userDate.getMonth()]}`;
    case 'long':
      const longMonths = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                          'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      return `${userDate.getDate()} ${longMonths[userDate.getMonth()]} ${userDate.getFullYear()}`;
    default:
      return userDate.toLocaleDateString('tr-TR');
  }
}
