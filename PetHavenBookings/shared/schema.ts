import { sql } from "drizzle-orm";
import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  dogName: text("dog_name").notNull(),
  ownerName: text("owner_name").notNull(),
  email: text("email").notNull(), // User email for privacy-based booking identification
  serviceType: text("service_type").notNull(), // 'asilo' or 'pensione'
  startDate: text("start_date").notNull(), // DATE format YYYY-MM-DD
  endDate: text("end_date").notNull(), // Required for all bookings (can be same as startDate for single-day)
  entryTime: text("entry_time").notNull(), // '7:30', '8:00-9:00' or '13:30-14:00'
  exitTime: text("exit_time").notNull(), // '8:00-9:00', '11:30-12:00' or '17:00-18:00'
  exactEntryTime: text("exact_entry_time").notNull(), // Required exact time like '8:10', '8:30', etc.
  exactExitTime: text("exact_exit_time").notNull(), // Required exact time like '11:45', '17:30', etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
}).extend({
  dogName: z.string().min(1, "Il nome del cane è obbligatorio"),
  ownerName: z.string().min(1, "Il nome del proprietario è obbligatorio"),
  email: z.string().email("Inserisci un indirizzo email valido").min(1, "L'email è obbligatoria"),
  serviceType: z.enum(['asilo', 'pensione']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La data di fine è obbligatoria"),
  entryTime: z.enum(['7:30', '8:00-9:00', '13:30-14:00']),
  exitTime: z.enum(['8:00-9:00', '11:30-12:00', '17:00-18:00']),
  exactEntryTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Inserisci un orario valido (es. 8:30)")
    .min(1, "L'orario esatto di arrivo è obbligatorio"),
  exactExitTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Inserisci un orario valido (es. 17:30)")
    .min(1, "L'orario esatto di ritiro è obbligatorio"),
}).refine(
  (data) => {
    // Skip validation if serviceType is 'pensione' (pensione is available on all days)
    if (data.serviceType === 'pensione') return true;
    
    // For 'asilo', check that all dates in the range are weekdays (Mon-Fri)
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    
    let current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay(); // 0=Sunday, 6=Saturday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return false; // Weekend day found
      }
      current.setDate(current.getDate() + 1);
    }
    
    return true;
  },
  {
    message: "L'asilo è disponibile solo dal lunedì al venerdì",
    path: ["startDate"], // Show error on startDate field
  }
);

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// API response types
export type AvailabilityData = {
  date: string;
  morning: number;
  afternoon: number;
  total: number;
};

export type CalendarData = {
  year: number;
  month: number;
  days: AvailabilityData[];
};

// Closures table for admin-managed closure dates
export const closures = pgTable("closures", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // DATE format YYYY-MM-DD
  reason: text("reason"), // Optional reason like "Holidays", "Maintenance", etc.
  type: text("type").notNull(), // 'asilo', 'pensione', or 'both'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClosureSchema = createInsertSchema(closures).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.string().optional()
  ),
  type: z.enum(['asilo', 'pensione', 'both']),
});

// Schema for creating closure range (used by the form)
export const insertClosureRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data di inizio non valida"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data di fine non valida"),
  reason: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.string().optional()
  ),
  type: z.enum(['asilo', 'pensione', 'both']),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  {
    message: "La data di fine deve essere uguale o successiva alla data di inizio",
    path: ["endDate"],
  }
);

export type InsertClosure = z.infer<typeof insertClosureSchema>;
export type InsertClosureRange = z.infer<typeof insertClosureRangeSchema>;
export type Closure = typeof closures.$inferSelect;
