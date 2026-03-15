import { apiRequest } from "./queryClient";
import type { InsertBooking, Booking, BatchBooking, AvailabilityData, CalendarData } from "@shared/schema";

export type BatchBookingResult = {
  message: string;
  created: Booking[];
  skipped: { date: string; reason: string }[];
};

export const api = {
  async getAvailability(date: string): Promise<AvailabilityData> {
    const response = await apiRequest("GET", `/api/availability/${date}`);
    return response.json();
  },

  async getBookings(date: string): Promise<Booking[]> {
    const response = await apiRequest("GET", `/api/bookings/${date}`);
    return response.json();
  },

  async getCalendarData(year: number, month: number): Promise<CalendarData> {
    const response = await apiRequest("GET", `/api/calendar/${year}/${month}`);
    return response.json();
  },

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const response = await apiRequest("POST", "/api/bookings", booking);
    return response.json();
  },

  async createBatchBookings(batch: BatchBooking): Promise<BatchBookingResult> {
    const response = await apiRequest("POST", "/api/bookings/batch", batch);
    return response.json();
  },
};
