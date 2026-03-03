import { type Closure } from './schema';

/**
 * Check if a booking has closure conflicts in its date range
 * @param startDate - Booking start date (YYYY-MM-DD)
 * @param endDate - Booking end date (YYYY-MM-DD)
 * @param serviceType - Type of service (asilo or pensione)
 * @param closures - Array of closures to check against
 * @returns Object with conflict status and list of conflicting dates
 */
export function checkClosureConflicts(
  startDate: string,
  endDate: string,
  serviceType: 'asilo' | 'pensione',
  closures: Closure[]
): { hasConflict: boolean; conflictDates: string[] } {
  const conflictDates: string[] = [];
  
  // Generate all dates in the booking range
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    
    // Check if this date has a conflicting closure
    const closure = closures.find(c => c.date === dateStr);
    
    if (closure) {
      // A closure blocks the booking if:
      // 1. Closure type is 'both' (blocks everything)
      // 2. Closure type matches the service type (asilo blocks asilo, pensione blocks pensione)
      if (closure.type === 'both' || closure.type === serviceType) {
        conflictDates.push(dateStr);
      }
    }
  }
  
  return {
    hasConflict: conflictDates.length > 0,
    conflictDates
  };
}

/**
 * Format a date string from YYYY-MM-DD to DD/MM format
 */
export function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}
