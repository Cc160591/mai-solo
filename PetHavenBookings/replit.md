# Dog Daycare & Boarding Booking System

## Overview

This is a web application for managing bookings at a dog daycare and boarding facility ("Centro Cinofilo Mai Solo"). The system allows users to view availability, make reservations for daily daycare ("asilo") or multi-day boarding ("pensione"), and see existing bookings. The application supports up to 5 dogs per day with fixed entry and exit time slots, and prevents same-day bookings (only accepts reservations starting from tomorrow onwards).

The system includes an admin section with password-based authentication for managing bookings, setting closure dates, and receiving real-time notifications via WebSocket when new bookings are made.

## Recent Changes

**January 9, 2026 - Email-Based Privacy Feature:**
- Added email field to booking form (required for all new bookings)
- Implemented privacy system: users only see full details of their own bookings (matching email)
- Other users' bookings appear as "Prenotazione esistente" with anonymized details
- IdentifyEmailDialog component allows users to identify themselves on different devices
- LocalStorage persistence with key 'userEmail' (normalized to lowercase)
- DailyBookings uses storage event listener + 500ms polling for cross-component synchronization
- GET /api/bookings/:date accepts optional ?email= query parameter for filtering
- Own bookings display with purple border, full details, "La tua prenotazione" label
- Anonymous bookings display with lock icon, "Riservato" badge

**October 16, 2025 - Closure Conflict Validation:**
- Implemented booking validation to prevent reservations when closure days exist within the selected date range
- Added `checkClosureConflicts` utility function in `shared/utils.ts` for detecting closure conflicts based on service type and closure type
- Enhanced backend POST /api/bookings with closure validation that blocks conflicting bookings with detailed error messages
- Added public GET /api/closures/range/:startDate/:endDate endpoint for fetching closures in date intervals
- Updated BookingForm with real-time closure checking, visual alerts showing specific conflicting dates, and automatic submit button disabling
- Alert displays formatted dates (e.g., "22 ottobre 2025") and guides users to modify dates to avoid closures
- Validated end-to-end flow with playwright tests confirming alert appearance/disappearance and submit button state management

**October 14, 2025 - Database Migration to PostgreSQL:**
- Migrated from SQLite to PostgreSQL using Replit's built-in PostgreSQL database for persistent storage across app updates
- Updated Drizzle schema from `sqliteTable` to `pgTable` with PostgreSQL-specific column types (`serial`, `timestamp`)
- Updated database driver from `better-sqlite3` to `@neondatabase/serverless` (Neon)
- Modified storage layer to use async/await pattern instead of SQLite's synchronous `.get()`/`.all()` methods
- Fixed date range queries to work with PostgreSQL semantics (removed NULL checks since `endDate` is always required)
- Successfully tested booking creation, availability calculation, and calendar data retrieval with new database

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript
- Vite as the build tool and development server
- Wouter for client-side routing
- TanStack Query (React Query) for server state management
- shadcn/ui component library with Radix UI primitives
- Tailwind CSS for styling

**Design Decisions:**
- **Component-based UI:** Uses shadcn/ui components for consistent design and accessibility
- **Form validation:** React Hook Form with Zod resolver for type-safe form validation
- **State management:** TanStack Query manages server state with caching and automatic refetching
- **Styling approach:** Utility-first CSS with Tailwind, custom CSS variables for theming
- **Admin authentication:** Password-based authentication with Express sessions for admin access
- **Admin navigation:** Authenticated admins see a "Dashboard Admin" button in the homepage header for seamless navigation between calendar and admin dashboard without re-authentication
- **Real-time updates:** WebSocket connection for admin notifications on new bookings

**Key Components:**
- `Calendar`: Monthly view with split-day visualization showing separate morning/afternoon availability with color-coded indicators (green 3-5 spots, yellow 2 spots, red 1 spot, gray 0 spots)
- `BookingForm`: Form for creating new reservations with validation
- `DailyBookings`: List view of all bookings for a selected date

### Backend Architecture

**Technology Stack:**
- Node.js with Express
- TypeScript with ESM modules
- PostgreSQL with node-postgres (pg) driver
- Drizzle ORM for database operations
- Zod for runtime validation

**Design Decisions:**
- **RESTful API design:** Simple HTTP endpoints for availability, bookings, and calendar data
- **Persistent PostgreSQL database:** Uses Replit's built-in PostgreSQL database that persists across app updates and restarts
- **Storage abstraction:** Interface-based storage layer (`IStorage`) allows for future database swaps
- **No authentication middleware:** Open access to all endpoints per requirements
- **Type safety:** Shared schema between frontend and backend ensures type consistency

**API Endpoints:**
- `GET /api/availability/:date` - Get available spots for a specific date (returns morning and afternoon counts)
- `GET /api/bookings/:date` - Get all bookings for a specific date
- `GET /api/calendar/:year/:month` - Get availability data for entire month (includes morning/afternoon breakdown and closures)
- `POST /api/bookings` - Create a new booking with closure validation (automatically sends email notification, blocks if conflicts exist)
- `POST /api/admin/login` - Admin login with password
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/status` - Check admin authentication status
- `GET /api/admin/bookings` - Get all bookings (admin only)
- `PATCH /api/admin/bookings/:id` - Update booking (admin only)
- `DELETE /api/admin/bookings/:id` - Delete booking (admin only)
- `GET /api/admin/closures` - Get all closures (admin only)
- `GET /api/closures/:date` - Get closures for specific date (public)
- `GET /api/closures/range/:startDate/:endDate` - Get closures for date range (public, used for booking validation)
- `POST /api/admin/closures` - Create closure or closure range (admin only, supports date intervals)
- `DELETE /api/admin/closures/:id` - Delete closure (admin only)
- `WebSocket /ws/admin` - Real-time admin notifications (authenticated)

**Email Notifications:**
- Automatic email sent to NOTIFICATION_EMAIL when a new booking is created
- Email includes: dog name, owner name, service type, dates, time slots (entryTime/exitTime), and exact times (exactEntryTime/exactExitTime)
- Non-blocking: booking succeeds even if email fails
- Uses Resend API with sandbox sender (onboarding@resend.dev) - requires verified domain for production

### Data Storage

**Database:**
- PostgreSQL with node-postgres (pg) driver (asynchronous operations)
- Drizzle ORM for type-safe queries
- Two main tables: `bookings` and `closures`

**Schema Design:**
- Simple denormalized structure optimized for read performance
- Date ranges handled with `start_date` and required `end_date` (can be same for single-day bookings)
- Fixed time slots stored as string enums
- Auto-incrementing serial primary key
- Closures table stores facility closure dates with type (asilo/pensione/both)

**Data Integrity:**
- Zod schemas validate data at API boundary
- Database constraints ensure required fields
- Application logic enforces business rules (max capacity, date restrictions)
- Required exact arrival/departure times (exactEntryTime, exactExitTime) for precise scheduling within time slots

### Business Logic

**Core Rules:**
- **Half-day capacity management:** 5 spots for morning (7:30 or 8:00-9:00 entry) and 5 spots for afternoon (13:30-14:00 entry) independently
- Two service types: "asilo" (daycare) and "pensione" (boarding)
- **Weekday restriction for Asilo:** Asilo service is available only Monday-Friday; weekends (Saturday-Sunday) are blocked for asilo bookings
- **Pensione available all days:** Pensione service can be booked on any day including weekends
- Fixed entry times: 7:30, 8:00-9:00 AM or 1:30-2:00 PM
- Fixed exit times: 11:30 AM-12:00 PM or 5:00-6:00 PM
- No same-day bookings allowed (minimum tomorrow)
- Operating hours: Monday-Sunday, 7:30 AM - 6:00 PM
- **End date is always required:** Can be same as start date for single-day bookings

**Availability Calculation:**
- Separate availability tracking for morning and afternoon slots
- **Asilo bookings:** 
  - Entry 8:00-9:00 + Exit 11:30-12:00 = occupies only morning slot
  - Entry 13:30-14:00 + Exit 17:00-18:00 = occupies only afternoon slot
  - Entry 8:00-9:00 + Exit 17:00-18:00 = occupies BOTH morning and afternoon slots (full day)
- **Pensione bookings:** Occupy BOTH morning AND afternoon slots for all days in their range
- All bookings require both start_date and end_date (can be same for single-day bookings)

**Closure Management:**
- Admin can create closures for single days or date ranges
- **Date range support:** When creating a closure with startDate and endDate, the system automatically creates a closure entry for each day in the interval
- Closures can be partial (asilo only, pensione only) or complete (both)
- Form includes auto-sync: endDate automatically matches startDate when startDate changes (if endDate is empty or before startDate)
- Success feedback shows count: "N giorni di chiusura aggiunti con successo" for ranges, or single message for individual days

**Closure Conflict Validation:**
- Bookings are automatically validated against facility closures before creation
- **Backend validation:** POST /api/bookings checks for closure conflicts and returns 400 error with conflicting dates if any exist
- **Frontend validation:** BookingForm fetches closures for the selected date range via GET /api/closures/range/:startDate/:endDate
- **Visual feedback:** Red alert displays when conflicts are detected, showing formatted dates (e.g., "22 ottobre 2025") and instructions to modify dates
- **Submit blocking:** Submit button is automatically disabled when closure conflicts exist
- **Conflict logic:** 
  - Closures with type 'both' block all bookings (asilo and pensione)
  - Closures with type 'asilo' block only asilo bookings
  - Closures with type 'pensione' block only pensione bookings
- Users must adjust their booking dates to avoid closed days before submission is allowed

## External Dependencies

**Runtime Dependencies:**
- `pg`: Standard PostgreSQL client for Node.js
- `drizzle-orm`: Type-safe ORM supporting multiple SQL databases
- `express`: Web server framework
- `@tanstack/react-query`: Async state management for React
- `react-hook-form`: Form state management with validation
- `zod`: Runtime type validation and schema definition
- `@radix-ui/*`: Unstyled, accessible UI component primitives
- `tailwindcss`: Utility-first CSS framework
- `wouter`: Minimalist client-side router
- `resend`: Email API service for sending booking notifications

**Development Dependencies:**
- `vite`: Build tool and dev server
- `typescript`: Type checking and compilation
- `tsx`: TypeScript execution for Node.js
- `esbuild`: JavaScript bundler for production builds
- `drizzle-kit`: Database migration and schema management CLI

**Third-party Services:**
- **Resend**: Email notification service for sending booking confirmations to facility owners
  - Free tier: 3,000 emails/month
  - Requires: RESEND_API_KEY (stored in secrets)
  - Current sender: onboarding@resend.dev (sandbox - requires verified domain for production)

**Font Dependencies:**
- Google Fonts: Inter, DM Sans, Geist Mono, Architects Daughter, Fira Code

**Build Configuration:**
- Path aliases for cleaner imports (`@/`, `@shared/`, `@assets/`)
- Separate client and server build processes
- Development mode with HMR (Hot Module Replacement)
- Production build bundles frontend static assets and backend into `dist/`