import { type Booking, type InsertBooking, bookings, type Closure, type InsertClosure, closures, type CapacityOverride, type InsertCapacityOverride, capacityOverrides } from "@shared/schema";
import { database } from "./database";
import { eq, and, gte, lte, sql, asc } from "drizzle-orm";

export interface IStorage {
  getBooking(id: number): Promise<Booking | undefined>;
  getBookingsByDate(date: string): Promise<Booking[]>;
  getBookingsByEmail(email: string): Promise<Booking[]>;
  getBookingsInDateRange(startDate: string, endDate: string): Promise<Booking[]>;
  getAllBookings(): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, booking: Partial<InsertBooking>): Promise<Booking>;
  deleteBooking(id: number): Promise<void>;
  getAvailability(date: string): Promise<{morning: number, afternoon: number}>;
  getCalendarData(year: number, month: number): Promise<Array<{date: string, morning: number, afternoon: number}>>;
  
  // Closure management
  getClosure(id: number): Promise<Closure | undefined>;
  getClosuresByDate(date: string): Promise<Closure[]>;
  getClosuresInDateRange(startDate: string, endDate: string): Promise<Closure[]>;
  createClosure(closure: InsertClosure): Promise<Closure>;
  deleteClosure(id: number): Promise<void>;
  getAllClosures(): Promise<Closure[]>;

  // Capacity override management
  getCapacityOverrideByDate(date: string): Promise<CapacityOverride | undefined>;
  getAllCapacityOverrides(): Promise<CapacityOverride[]>;
  setCapacityOverride(data: InsertCapacityOverride): Promise<CapacityOverride>;
  deleteCapacityOverride(id: number): Promise<void>;
}

export class SQLiteStorage implements IStorage {
  async getBooking(id: number): Promise<Booking | undefined> {
    const result = await database.select().from(bookings).where(eq(bookings.id, id));
    return result[0] as Booking | undefined;
  }

  async getBookingsByDate(date: string): Promise<Booking[]> {
    const result = await database.select().from(bookings)
      .where(
        and(
          lte(bookings.startDate, date),
          gte(bookings.endDate, date)
        )
      );
    return result as Booking[];
  }

  async getBookingsByEmail(email: string): Promise<Booking[]> {
    const normalizedEmail = email.toLowerCase().trim();
    const result = await database.select().from(bookings)
      .where(sql`LOWER(${bookings.email}) = ${normalizedEmail}`)
      .orderBy(asc(bookings.startDate));
    return result as Booking[];
  }

  async getBookingsInDateRange(startDate: string, endDate: string): Promise<Booking[]> {
    const result = await database.select().from(bookings)
      .where(
        and(
          lte(bookings.startDate, endDate),
          gte(bookings.endDate, startDate)
        )
      );
    return result as Booking[];
  }

  async getAllBookings(): Promise<Booking[]> {
    const result = await database.select().from(bookings);
    return result as Booking[];
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const result = await database.insert(bookings).values(booking).returning();
    return result[0] as Booking;
  }

  async updateBooking(id: number, booking: Partial<InsertBooking>): Promise<Booking> {
    const result = await database.update(bookings)
      .set(booking)
      .where(eq(bookings.id, id))
      .returning();
    
    if (!result || result.length === 0) {
      throw new Error('Booking not found');
    }
    
    return result[0] as Booking;
  }

  async deleteBooking(id: number): Promise<void> {
    const result = await database.delete(bookings)
      .where(eq(bookings.id, id))
      .returning();
    
    if (!result || result.length === 0) {
      throw new Error('Booking not found');
    }
  }

  async getAvailability(date: string): Promise<{morning: number, afternoon: number}> {
    const [bookingsForDate, override] = await Promise.all([
      this.getBookingsByDate(date),
      this.getCapacityOverrideByDate(date),
    ]);

    const morningCapacity = override ? override.morningCapacity : 9;
    const afternoonCapacity = override ? override.afternoonCapacity : 9;

    // Count bookings for morning (7:30 or 8:00-9:00) and afternoon (13:30-14:00)
    // Pensione occupies both morning and afternoon
    // Asilo that enters in morning and exits in afternoon occupies both slots
    let morningOccupied = 0;
    let afternoonOccupied = 0;

    for (const booking of bookingsForDate) {
      if (booking.serviceType === 'pensione') {
        // Pensione always occupies both slots
        morningOccupied++;
        afternoonOccupied++;
      } else if ((booking.entryTime === '7:30' || booking.entryTime === '8:00-9:00') && booking.exitTime === '17:00-18:00') {
        // Asilo: enters in morning (7:30 or 8:00-9:00) and exits in afternoon = occupies both slots
        morningOccupied++;
        afternoonOccupied++;
      } else if (booking.entryTime === '7:30' || booking.entryTime === '8:00-9:00') {
        // Asilo: enters and exits in morning = only morning slot
        morningOccupied++;
      } else if (booking.entryTime === '13:30-14:00') {
        // Asilo: enters and exits in afternoon = only afternoon slot
        afternoonOccupied++;
      }
    }

    return {
      morning: Math.max(0, morningCapacity - morningOccupied),
      afternoon: Math.max(0, afternoonCapacity - afternoonOccupied)
    };
  }

  async getCalendarData(year: number, month: number): Promise<Array<{date: string, morning: number, afternoon: number}>> {
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendarData: Array<{date: string, morning: number, afternoon: number}> = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const { morning, afternoon } = await this.getAvailability(date);
      calendarData.push({ date, morning, afternoon });
    }
    
    return calendarData;
  }

  // Closure management methods
  async getClosure(id: number): Promise<Closure | undefined> {
    const result = await database.select().from(closures).where(eq(closures.id, id));
    return result[0] as Closure | undefined;
  }

  async getClosuresByDate(date: string): Promise<Closure[]> {
    const result = await database.select().from(closures)
      .where(eq(closures.date, date));
    return result as Closure[];
  }

  async getClosuresInDateRange(startDate: string, endDate: string): Promise<Closure[]> {
    const result = await database.select().from(closures)
      .where(
        and(
          gte(closures.date, startDate),
          lte(closures.date, endDate)
        )
      );
    return result as Closure[];
  }

  async createClosure(closure: InsertClosure): Promise<Closure> {
    const result = await database.insert(closures).values(closure).returning();
    return result[0] as Closure;
  }

  async deleteClosure(id: number): Promise<void> {
    await database.delete(closures).where(eq(closures.id, id));
  }

  async getAllClosures(): Promise<Closure[]> {
    const result = await database.select().from(closures);
    return result as Closure[];
  }

  // Capacity override management methods
  async getCapacityOverrideByDate(date: string): Promise<CapacityOverride | undefined> {
    const result = await database.select().from(capacityOverrides).where(eq(capacityOverrides.date, date));
    return result[0] as CapacityOverride | undefined;
  }

  async getAllCapacityOverrides(): Promise<CapacityOverride[]> {
    const result = await database.select().from(capacityOverrides);
    return result as CapacityOverride[];
  }

  async setCapacityOverride(data: InsertCapacityOverride): Promise<CapacityOverride> {
    // Upsert: if override for this date already exists, update it
    const existing = await this.getCapacityOverrideByDate(data.date);
    if (existing) {
      const result = await database.update(capacityOverrides)
        .set({ morningCapacity: data.morningCapacity, afternoonCapacity: data.afternoonCapacity, notes: data.notes })
        .where(eq(capacityOverrides.id, existing.id))
        .returning();
      return result[0] as CapacityOverride;
    }
    const result = await database.insert(capacityOverrides).values(data).returning();
    return result[0] as CapacityOverride;
  }

  async deleteCapacityOverride(id: number): Promise<void> {
    await database.delete(capacityOverrides).where(eq(capacityOverrides.id, id));
  }
}

export const storage = new SQLiteStorage();
