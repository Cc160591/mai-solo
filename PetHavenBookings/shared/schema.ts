import { sql } from "drizzle-orm";
import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- Fasce orarie ----------------------------------------------------------
// Dal 1° settembre 2026 si prenota solo a giornata intera: niente ingresso
// pomeridiano (13:30-14:00) né uscita a metà mattina (11:30-12:00), e l'uscita
// pomeridiana si allarga da 17:00-18:00 a 16:00-18:00.
// Le prenotazioni con date precedenti continuano a usare le fasce storiche, così
// quelle già registrate restano valide e modificabili senza toccare il database.
export const FULL_DAY_ONLY_FROM = '2026-09-01';

export const LEGACY_ENTRY_SLOTS = ['7:30', '8:00-9:00', '13:30-14:00'] as const;
export const LEGACY_EXIT_SLOTS = ['8:00-9:00', '11:30-12:00', '17:00-18:00'] as const;

export const FULL_DAY_ENTRY_SLOTS = ['7:30', '8:00-9:00'] as const;
export const FULL_DAY_EXIT_SLOTS = ['8:00-9:00', '16:00-18:00'] as const;

// Unione di tutte le fasce mai esistite: usata dagli enum di validazione, che
// devono accettare anche i valori storici presenti nel database.
export const ALL_ENTRY_SLOTS = ['7:30', '8:00-9:00', '13:30-14:00'] as const;
export const ALL_EXIT_SLOTS = ['8:00-9:00', '11:30-12:00', '16:00-18:00', '17:00-18:00'] as const;

export type EntrySlot = typeof ALL_ENTRY_SLOTS[number];
export type ExitSlot = typeof ALL_EXIT_SLOTS[number];

/** Fasce di entrata selezionabili per una data (formato YYYY-MM-DD). */
export function entrySlotsForDate(date: string): readonly EntrySlot[] {
  return date >= FULL_DAY_ONLY_FROM ? FULL_DAY_ENTRY_SLOTS : LEGACY_ENTRY_SLOTS;
}

/** Fasce di uscita selezionabili per una data (formato YYYY-MM-DD). */
export function exitSlotsForDate(date: string): readonly ExitSlot[] {
  return date >= FULL_DAY_ONLY_FROM ? FULL_DAY_EXIT_SLOTS : LEGACY_EXIT_SLOTS;
}

// Fasce da mostrare in un menù di modifica lato admin: quelle valide per la
// data più, se diverso, il valore già salvato. Senza questo un'operatrice non
// potrebbe riaprire una prenotazione storica senza esserne costretta a
// cambiare gli orari.
export function entrySlotOptionsWithCurrent(date: string, current?: string): string[] {
  const options = entrySlotsForDate(date);
  return current && !options.includes(current as EntrySlot) ? [...options, current] : [...options];
}

export function exitSlotOptionsWithCurrent(date: string, current?: string): string[] {
  const options = exitSlotsForDate(date);
  return current && !options.includes(current as ExitSlot) ? [...options, current] : [...options];
}

// Helper per il calcolo dei posti occupati. Vanno usati al posto del confronto
// diretto con la stringa, perché l'uscita pomeridiana ha due valori possibili:
// '17:00-18:00' (storico) e '16:00-18:00' (dal 1° settembre 2026).
export function isMorningEntry(entryTime: string): boolean {
  return entryTime === '7:30' || entryTime === '8:00-9:00';
}

export function isAfternoonEntry(entryTime: string): boolean {
  return entryTime === '13:30-14:00';
}

export function isAfternoonExit(exitTime: string): boolean {
  return exitTime === '17:00-18:00' || exitTime === '16:00-18:00';
}

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  dogName: text("dog_name").notNull(),
  ownerName: text("owner_name").notNull(),
  email: text("email").notNull(), // User email for privacy-based booking identification
  serviceType: text("service_type").notNull(), // 'asilo' or 'pensione'
  startDate: text("start_date").notNull(), // DATE format YYYY-MM-DD
  endDate: text("end_date").notNull(), // Required for all bookings (can be same as startDate for single-day)
  entryTime: text("entry_time").notNull(), // vedi ALL_ENTRY_SLOTS
  exitTime: text("exit_time").notNull(), // vedi ALL_EXIT_SLOTS
  exactEntryTime: text("exact_entry_time").notNull(), // Required exact time like '8:10', '8:30', etc.
  exactExitTime: text("exact_exit_time").notNull(), // Required exact time like '11:45', '17:30', etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const bookingBaseSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
}).extend({
  dogName: z.string().min(1, "Il nome del cane è obbligatorio"),
  ownerName: z.string().min(1, "Il nome del proprietario è obbligatorio"),
  email: z.string().email("Inserisci un indirizzo email valido").min(1, "L'email è obbligatoria"),
  serviceType: z.enum(['asilo', 'pensione']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La data di fine è obbligatoria"),
  entryTime: z.enum(ALL_ENTRY_SLOTS),
  exitTime: z.enum(ALL_EXIT_SLOTS),
  exactEntryTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Inserisci un orario valido (es. 8:30)")
    .min(1, "L'orario esatto di arrivo è obbligatorio"),
  exactExitTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Inserisci un orario valido (es. 17:30)")
    .min(1, "L'orario esatto di ritiro è obbligatorio"),
});

function isAsiloOnWeekdaysOnly(data: { serviceType: string; startDate: string; endDate: string }) {
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
}

const WEEKDAY_ONLY_ISSUE = {
  message: "L'asilo è disponibile solo dal lunedì al venerdì",
  path: ["startDate"], // Show error on startDate field
};

export const insertBookingSchema = bookingBaseSchema.refine(
  (data) => entrySlotsForDate(data.startDate).includes(data.entryTime),
  {
    message: `Fascia di entrata non disponibile per questa data. Dal 1° settembre si prenota solo a giornata intera: ${FULL_DAY_ENTRY_SLOTS.join(' o ')}.`,
    path: ["entryTime"],
  }
).refine(
  // L'uscita si valuta sulla data di fine: in una pensione a cavallo del 1°
  // settembre l'ingresso segue le regole vecchie e l'uscita quelle nuove.
  (data) => exitSlotsForDate(data.endDate).includes(data.exitTime),
  {
    message: `Fascia di uscita non disponibile per questa data. Dal 1° settembre si prenota solo a giornata intera: ${FULL_DAY_EXIT_SLOTS.join(' o ')}.`,
    path: ["exitTime"],
  }
).refine(isAsiloOnWeekdaysOnly, WEEKDAY_ONLY_ISSUE);

// Schema per il pannello admin: identico, ma senza il vincolo sulle fasce per
// data. Serve a poter correggere le prenotazioni registrate prima del
// 1° settembre 2026 senza essere costretti a cambiarne gli orari.
export const adminBookingSchema = bookingBaseSchema.refine(isAsiloOnWeekdaysOnly, WEEKDAY_ONLY_ISSUE);

export const batchBookingSchema = z.object({
  dogName: z.string().min(1, "Il nome del cane è obbligatorio"),
  ownerName: z.string().min(1, "Il nome del proprietario è obbligatorio"),
  email: z.string().email("Inserisci un indirizzo email valido").min(1, "L'email è obbligatoria"),
  serviceType: z.enum(['asilo', 'pensione']),
  entryTime: z.enum(ALL_ENTRY_SLOTS),
  exitTime: z.enum(ALL_EXIT_SLOTS),
  exactEntryTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Inserisci un orario valido (es. 8:30)")
    .min(1, "L'orario esatto di arrivo è obbligatorio"),
  exactExitTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Inserisci un orario valido (es. 17:30)")
    .min(1, "L'orario esatto di ritiro è obbligatorio"),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, "Seleziona almeno una data").max(50),
}).refine(
  // Le fasce scelte valgono per ogni data della serie: devono essere ammesse su
  // tutte, altrimenti una serie a cavallo del 1° settembre passerebbe in parte.
  (data) => data.dates.every((date) => entrySlotsForDate(date).includes(data.entryTime)),
  {
    message: `Fascia di entrata non disponibile per una o più date selezionate. Dal 1° settembre si prenota solo a giornata intera: ${FULL_DAY_ENTRY_SLOTS.join(' o ')}.`,
    path: ["entryTime"],
  }
).refine(
  (data) => data.dates.every((date) => exitSlotsForDate(date).includes(data.exitTime)),
  {
    message: `Fascia di uscita non disponibile per una o più date selezionate. Dal 1° settembre si prenota solo a giornata intera: ${FULL_DAY_EXIT_SLOTS.join(' o ')}.`,
    path: ["exitTime"],
  }
);

export type BatchBooking = z.infer<typeof batchBookingSchema>;

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

// Capacity overrides table for admin-managed per-day capacity reduction
export const capacityOverrides = pgTable("capacity_overrides", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(), // DATE format YYYY-MM-DD
  morningCapacity: integer("morning_capacity").notNull(), // 0-9
  afternoonCapacity: integer("afternoon_capacity").notNull(), // 0-9
  notes: text("notes"), // Optional reason
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCapacityOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida"),
  morningCapacity: z.number().int().min(0).max(9),
  afternoonCapacity: z.number().int().min(0).max(9),
  notes: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.string().optional()
  ),
});

export type InsertCapacityOverride = z.infer<typeof insertCapacityOverrideSchema>;
export type CapacityOverride = typeof capacityOverrides.$inferSelect;
