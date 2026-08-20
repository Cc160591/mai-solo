import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertBookingSchema, batchBookingSchema, type InsertBooking, type Booking, insertClosureSchema, insertClosureRangeSchema, insertCapacityOverrideSchema, ALL_ENTRY_SLOTS, ALL_EXIT_SLOTS, FULL_DAY_ENTRY_SLOTS, FULL_DAY_EXIT_SLOTS, entrySlotsForDate, exitSlotsForDate, isMorningEntry, isAfternoonEntry, isAfternoonExit } from "@shared/schema";
import { requireAdmin, checkAdminPassword } from "./auth";
import { z } from "zod";
import { sendBookingNotification, sendBookingConfirmation, sendBatchBookingConfirmation } from "./email";
import { checkClosureConflicts, formatShortDate } from "@shared/utils";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get availability for a specific date
  app.get("/api/availability/:date", async (req, res) => {
    try {
      const date = req.params.date;
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      const { morning, afternoon } = await storage.getAvailability(date);
      res.json({ date, morning, afternoon, total: 9 });
    } catch (error) {
      console.error("Error getting availability:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get bookings for a specific date (with privacy filtering based on email)
  app.get("/api/bookings/:date", async (req, res) => {
    try {
      const date = req.params.date;
      const userEmail = req.query.email as string | undefined;
      
      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      const bookings = await storage.getBookingsByDate(date);
      
      // Normalize user email for comparison (lowercase, trimmed)
      const normalizedUserEmail = userEmail?.toLowerCase().trim();
      const isAdmin = req.session?.isAdmin === true;
      
      // Filter booking details based on email ownership or admin status
      const filteredBookings = bookings.map(booking => {
        const isOwner = normalizedUserEmail && booking.email.toLowerCase().trim() === normalizedUserEmail;
        
        if (isOwner || isAdmin) {
          return {
            ...booking,
            isOwn: isOwner ? true : false,
          };
        } else {
          return {
            id: booking.id,
            serviceType: booking.serviceType,
            startDate: booking.startDate,
            endDate: booking.endDate,
            entryTime: booking.entryTime,
            exitTime: booking.exitTime,
            isOwn: false,
            dogName: null,
            ownerName: null,
            email: null,
            exactEntryTime: null,
            exactExitTime: null,
          };
        }
      });
      
      res.json(filteredBookings);
    } catch (error) {
      console.error("Error getting bookings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all bookings for a specific email (customer "my bookings" view)
  app.get("/api/my-bookings", async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) return res.status(400).json({ message: "Email richiesta" });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ message: "Email non valida" });
      }

      const userBookings = await storage.getBookingsByEmail(email);
      res.json(userBookings);
    } catch (error) {
      console.error("Error getting bookings by email:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get calendar data for a specific month
  app.get("/api/calendar/:year/:month", async (req, res) => {
    try {
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid year or month" });
      }
      
      const calendarData = await storage.getCalendarData(year, month);
      
      // Get closures for the month
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const closures = await storage.getClosuresInDateRange(firstDay, lastDay);
      
      // Group closures by date (can have multiple closures per day)
      const closuresByDate = new Map<string, Array<{ type: string, reason?: string | null }>>();
      for (const closure of closures) {
        if (!closuresByDate.has(closure.date)) {
          closuresByDate.set(closure.date, []);
        }
        closuresByDate.get(closure.date)!.push({
          type: closure.type,
          reason: closure.reason
        });
      }
      
      // Merge closure info with calendar data
      const enrichedData = calendarData.map(day => {
        const dayClosure = closuresByDate.get(day.date) || [];
        return {
          ...day,
          closures: dayClosure
        };
      });
      
      res.json({
        year,
        month,
        days: enrichedData
      });
    } catch (error) {
      console.error("Error getting calendar data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new booking
  app.post("/api/bookings", async (req, res) => {
    try {
      // Validate request body
      const validationResult = insertBookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid booking data", 
          errors: validationResult.error.issues 
        });
      }
      
      const bookingData = validationResult.data;
      
      // Additional validation: check if booking is for tomorrow or later
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const minDate = tomorrow.toISOString().split('T')[0];
      
      if (bookingData.startDate < minDate) {
        return res.status(400).json({ 
          message: "Le prenotazioni sono disponibili solo da domani in poi" 
        });
      }
      
      // Validate end date is not before start date
      if (bookingData.endDate < bookingData.startDate) {
        return res.status(400).json({ 
          message: "La data di fine non può essere precedente alla data di inizio" 
        });
      }
      
      // Check for closure conflicts in the booking range
      const closuresInRange = await storage.getClosuresInDateRange(
        bookingData.startDate, 
        bookingData.endDate
      );
      
      const closureCheck = checkClosureConflicts(
        bookingData.startDate,
        bookingData.endDate,
        bookingData.serviceType as 'asilo' | 'pensione',
        closuresInRange
      );
      
      if (closureCheck.hasConflict) {
        const formattedDates = closureCheck.conflictDates.map(d => formatShortDate(d)).join(', ');
        return res.status(400).json({ 
          message: `Non è possibile effettuare questa prenotazione perché ci sono giorni di chiusura nell'intervallo selezionato (${formattedDates})` 
        });
      }
      
      // Check availability for all days in the booking range
      const startDate = new Date(bookingData.startDate);
      const endDate = new Date(bookingData.endDate);
      
      const checkDates: string[] = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        checkDates.push(d.toISOString().split('T')[0]);
      }
      
      // Verify availability for all dates
      for (const checkDate of checkDates) {
        const { morning, afternoon } = await storage.getAvailability(checkDate);
        
        // Check availability based on service type and time slot
        if (bookingData.serviceType === 'pensione') {
          // Pensione requires both morning and afternoon availability
          if (morning < 1 || afternoon < 1) {
            return res.status(409).json({ 
              message: `Non ci sono posti disponibili per pensione il ${checkDate}` 
            });
          }
        } else {
          // Asilo: controlla gli slot effettivamente occupati. A giornata intera
          // (entrata mattina + uscita pomeriggio) servono entrambi.
          const occupiesMorning = isMorningEntry(bookingData.entryTime);
          const occupiesAfternoon = isAfternoonEntry(bookingData.entryTime)
            || (occupiesMorning && isAfternoonExit(bookingData.exitTime));

          if (occupiesMorning && morning < 1) {
            return res.status(409).json({
              message: `Non ci sono posti disponibili per la mattina del ${checkDate}`
            });
          } else if (occupiesAfternoon && afternoon < 1) {
            return res.status(409).json({
              message: `Non ci sono posti disponibili per il pomeriggio del ${checkDate}`
            });
          }
        }
      }
      
      // Create booking
      const booking = await storage.createBooking(bookingData);
      
      // Notify admin clients of new booking via WebSocket
      if ((app as any).notifyAdmins) {
        (app as any).notifyAdmins(booking);
      }
      
      // Send email notifications (non-blocking)
      const emailData = {
        dogName: booking.dogName,
        ownerName: booking.ownerName,
        serviceType: booking.serviceType as 'asilo' | 'pensione',
        startDate: booking.startDate,
        endDate: booking.endDate,
        entryTime: booking.entryTime,
        exitTime: booking.exitTime,
        exactEntryTime: booking.exactEntryTime,
        exactExitTime: booking.exactExitTime,
      };
      sendBookingNotification(emailData).catch(err => console.error('Admin notification error:', err));
      sendBookingConfirmation({ ...emailData, customerEmail: booking.email }).catch(err => console.error('Customer confirmation error:', err));

      res.status(201).json(booking);
      
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create multiple bookings at once (batch / recurring)
  app.post("/api/bookings/batch", async (req, res) => {
    try {
      const validationResult = batchBookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Dati prenotazione non validi",
          errors: validationResult.error.issues,
        });
      }

      const { dates, ...bookingBase } = validationResult.data;

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const minDate = tomorrow.toISOString().split('T')[0];

      const created: Booking[] = [];
      const skipped: { date: string; reason: string }[] = [];

      for (const date of dates) {
        if (date < minDate) {
          skipped.push({ date, reason: "La data deve essere da domani in poi" });
          continue;
        }

        if (bookingBase.serviceType === 'asilo') {
          const dayOfWeek = new Date(date).getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            skipped.push({ date, reason: "L'asilo è disponibile solo dal lunedì al venerdì" });
            continue;
          }
        }

        const closuresForDate = await storage.getClosuresInDateRange(date, date);
        const closureCheck = checkClosureConflicts(
          date, date,
          bookingBase.serviceType as 'asilo' | 'pensione',
          closuresForDate
        );
        if (closureCheck.hasConflict) {
          skipped.push({ date, reason: "Giorno di chiusura" });
          continue;
        }

        const { morning, afternoon } = await storage.getAvailability(date);
        if (bookingBase.serviceType === 'pensione') {
          if (morning < 1 || afternoon < 1) {
            skipped.push({ date, reason: "Nessun posto disponibile" });
            continue;
          }
        } else {
          const occupiesMorning = isMorningEntry(bookingBase.entryTime);
          const occupiesAfternoon = isAfternoonEntry(bookingBase.entryTime)
            || (occupiesMorning && isAfternoonExit(bookingBase.exitTime));

          if (occupiesMorning && morning < 1) {
            skipped.push({ date, reason: "Nessun posto disponibile per la mattina" });
            continue;
          } else if (occupiesAfternoon && afternoon < 1) {
            skipped.push({ date, reason: "Nessun posto disponibile per il pomeriggio" });
            continue;
          }
        }

        const bookingData: InsertBooking = {
          ...bookingBase,
          startDate: date,
          endDate: date,
        };

        const booking = await storage.createBooking(bookingData);
        created.push(booking);

        if ((app as any).notifyAdmins) {
          (app as any).notifyAdmins(booking);
        }

        sendBookingNotification({
          dogName: booking.dogName,
          ownerName: booking.ownerName,
          serviceType: booking.serviceType as 'asilo' | 'pensione',
          startDate: booking.startDate,
          endDate: booking.endDate,
          entryTime: booking.entryTime,
          exitTime: booking.exitTime,
          exactEntryTime: booking.exactEntryTime,
          exactExitTime: booking.exactExitTime,
        }).catch(err => console.error('Email notification error:', err));
      }

      if (created.length === 0) {
        return res.status(409).json({
          message: "Nessuna prenotazione creata. Tutte le date selezionate non sono disponibili.",
          created: [],
          skipped,
        });
      }

      // Send batch confirmation to customer (non-blocking)
      sendBatchBookingConfirmation(created, bookingBase.email).catch(err => console.error('Batch confirmation error:', err));

      res.status(201).json({
        message: `${created.length} prenotazioni create con successo${skipped.length > 0 ? `, ${skipped.length} saltate` : ''}`,
        created,
        skipped,
      });
    } catch (error) {
      console.error("Error creating batch bookings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ message: "Password richiesta" });
      }
      
      if (checkAdminPassword(password)) {
        // Regenerate session to prevent session fixation
        req.session.regenerate((err) => {
          if (err) {
            console.error("Error regenerating session:", err);
            return res.status(500).json({ message: "Errore durante il login" });
          }
          
          req.session.isAdmin = true;
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error("Error saving session:", saveErr);
              return res.status(500).json({ message: "Errore durante il login" });
            }
            return res.json({ success: true, message: "Login effettuato con successo" });
          });
        });
      } else {
        return res.status(401).json({ message: "Password non corretta" });
      }
    } catch (error) {
      console.error("Error during admin login:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Admin logout
  app.post("/api/admin/logout", async (req, res) => {
    try {
      req.session.isAdmin = false;
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Errore durante il logout" });
        }
        res.json({ success: true, message: "Logout effettuato con successo" });
      });
    } catch (error) {
      console.error("Error during admin logout:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Check admin status
  app.get("/api/admin/status", (req, res) => {
    res.json({ isAdmin: !!req.session.isAdmin });
  });

  // Get all bookings (admin only)
  app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error) {
      console.error("Error getting all bookings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update booking (admin only)
  app.patch("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID non valido" });
      }

      // For partial updates, we need to allow partial data
      const partialBookingSchema = z.object({
        dogName: z.string().min(1).optional(),
        ownerName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        serviceType: z.enum(['asilo', 'pensione']).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        // L'admin accetta tutte le fasce, comprese quelle storiche: deve poter
        // correggere le prenotazioni registrate prima del 1° settembre 2026.
        entryTime: z.enum(ALL_ENTRY_SLOTS).optional(),
        exitTime: z.enum(ALL_EXIT_SLOTS).optional(),
        exactEntryTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        exactExitTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      });

      const validationResult = partialBookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Dati prenotazione non validi",
          errors: validationResult.error.errors
        });
      }

      const booking = await storage.updateBooking(id, validationResult.data);
      res.json(booking);
    } catch (error: any) {
      if (error.message === 'Booking not found') {
        return res.status(404).json({ message: "Prenotazione non trovata" });
      }
      console.error("Error updating booking:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update booking (client - own bookings only, with deadline check)
  app.patch("/api/bookings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID non valido" });

      const { email, ...updateData } = req.body;
      if (!email) return res.status(400).json({ message: "Email richiesta per la modifica" });

      const existingBooking = await storage.getBooking(id);
      if (!existingBooking) return res.status(404).json({ message: "Prenotazione non trovata" });
      if (existingBooking.email !== email) return res.status(403).json({ message: "Non autorizzato a modificare questa prenotazione" });

      const deadline = new Date(existingBooking.startDate);
      deadline.setDate(deadline.getDate() - 1);
      deadline.setHours(20, 0, 0, 0);
      if (new Date() > deadline) {
        return res.status(403).json({ message: "Termine scaduto: modifiche consentite entro le 20:00 del giorno prima." });
      }

      const partialSchema = z.object({
        entryTime: z.enum(ALL_ENTRY_SLOTS).optional(),
        exitTime: z.enum(ALL_EXIT_SLOTS).optional(),
        exactEntryTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
        exactExitTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      });
      const validation = partialSchema.safeParse(updateData);
      if (!validation.success) return res.status(400).json({ message: "Dati non validi" });

      // Il cliente può scegliere solo le fasce ammesse per le date della sua
      // prenotazione: dal 1° settembre 2026 restano quelle a giornata intera.
      const { entryTime, exitTime } = validation.data;
      if (entryTime && !entrySlotsForDate(existingBooking.startDate).includes(entryTime)) {
        return res.status(400).json({
          message: `Fascia di entrata non disponibile per questa data. Dal 1° settembre si prenota solo a giornata intera: ${FULL_DAY_ENTRY_SLOTS.join(' o ')}.`,
        });
      }
      if (exitTime && !exitSlotsForDate(existingBooking.endDate).includes(exitTime)) {
        return res.status(400).json({
          message: `Fascia di uscita non disponibile per questa data. Dal 1° settembre si prenota solo a giornata intera: ${FULL_DAY_EXIT_SLOTS.join(' o ')}.`,
        });
      }

      const booking = await storage.updateBooking(id, validation.data);
      res.json(booking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete booking (admin only)
  app.delete("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID non valido" });
      }

      await storage.deleteBooking(id);
      res.json({ success: true, message: "Prenotazione eliminata con successo" });
    } catch (error: any) {
      if (error.message === 'Booking not found') {
        return res.status(404).json({ message: "Prenotazione non trovata" });
      }
      console.error("Error deleting booking:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all closures
  app.get("/api/admin/closures", requireAdmin, async (req, res) => {
    try {
      const closures = await storage.getAllClosures();
      res.json(closures);
    } catch (error) {
      console.error("Error getting closures:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get closures for a specific date
  app.get("/api/closures/:date", async (req, res) => {
    try {
      const date = req.params.date;
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      const closures = await storage.getClosuresByDate(date);
      res.json(closures);
    } catch (error) {
      console.error("Error getting closures:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get closures for a date range (public endpoint for booking form)
  app.get("/api/closures/range/:startDate/:endDate", async (req, res) => {
    try {
      const { startDate, endDate } = req.params;
      
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }
      
      const closures = await storage.getClosuresInDateRange(startDate, endDate);
      res.json(closures);
    } catch (error) {
      console.error("Error getting closures:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create closure (admin only) - supports both single date and date range
  app.post("/api/admin/closures", requireAdmin, async (req, res) => {
    try {
      // Try to parse as date range first
      const rangeValidation = insertClosureRangeSchema.safeParse(req.body);
      
      if (rangeValidation.success) {
        // Handle date range - create closure for each day
        const { startDate, endDate, type, reason } = rangeValidation.data;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const closures = [];
        
        // Iterate through each day in the range
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
          const dateStr = date.toISOString().split('T')[0];
          const closure = await storage.createClosure({
            date: dateStr,
            type,
            reason,
          });
          closures.push(closure);
        }
        
        return res.status(201).json({
          success: true,
          count: closures.length,
          closures,
        });
      }
      
      // If range validation failed, try single date format (for backwards compatibility)
      const singleValidation = insertClosureSchema.safeParse(req.body);
      if (!singleValidation.success) {
        return res.status(400).json({ 
          message: "Dati chiusura non validi", 
          errors: rangeValidation.error.errors 
        });
      }

      const closure = await storage.createClosure(singleValidation.data);
      res.status(201).json(closure);
    } catch (error) {
      console.error("Error creating closure:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete closure (admin only)
  app.delete("/api/admin/closures/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: "ID non valido" });
      }

      await storage.deleteClosure(id);
      res.json({ success: true, message: "Chiusura eliminata con successo" });
    } catch (error) {
      console.error("Error deleting closure:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get all capacity overrides (admin only)
  app.get("/api/admin/capacity-overrides", requireAdmin, async (req, res) => {
    try {
      const overrides = await storage.getAllCapacityOverrides();
      res.json(overrides);
    } catch (error) {
      console.error("Error getting capacity overrides:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create or update capacity override for a date (admin only)
  app.post("/api/admin/capacity-overrides", requireAdmin, async (req, res) => {
    try {
      const validation = insertCapacityOverrideSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Dati non validi", errors: validation.error.errors });
      }
      const override = await storage.setCapacityOverride(validation.data);
      res.status(201).json(override);
    } catch (error) {
      console.error("Error setting capacity override:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete capacity override (admin only)
  app.delete("/api/admin/capacity-overrides/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID non valido" });
      }
      await storage.deleteCapacityOverride(id);
      res.json({ success: true, message: "Override eliminato con successo" });
    } catch (error) {
      console.error("Error deleting capacity override:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket setup for admin notifications
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws/admin',
    verifyClient: (info, callback) => {
      // Extract session from cookies - session middleware must have run on the upgrade request
      const cookies = info.req.headers.cookie;
      if (!cookies) {
        callback(false, 401, 'Unauthorized');
        return;
      }

      // Use the session middleware to verify admin status
      const sessionMiddleware = (app as any)._router.stack
        .find((layer: any) => layer.name === 'session')?.handle;

      if (!sessionMiddleware) {
        callback(false, 500, 'Session not configured');
        return;
      }

      // Create mock response object for session middleware
      const mockRes = {
        getHeader: () => {},
        setHeader: () => {},
        end: () => {}
      } as any;

      sessionMiddleware(info.req, mockRes, () => {
        const session = (info.req as any).session;
        if (session && session.isAdmin) {
          callback(true);
        } else {
          console.log('WebSocket connection rejected: not admin');
          callback(false, 401, 'Unauthorized - Admin access required');
        }
      });
    }
  });
  
  const adminClients = new Set<WebSocket>();
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('Admin WebSocket client connected (authenticated)');
    adminClients.add(ws);
    
    ws.on('close', () => {
      console.log('Admin WebSocket client disconnected');
      adminClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      adminClients.delete(ws);
    });
  });
  
  // Function to broadcast new booking notifications to all connected admin clients
  function notifyAdmins(booking: any) {
    const message = JSON.stringify({
      type: 'new_booking',
      data: booking,
      timestamp: new Date().toISOString()
    });
    
    adminClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // Export notifyAdmins for use in routes
  (app as any).notifyAdmins = notifyAdmins;
  
  return httpServer;
}
