# Design Guidelines: Mai Solo Dog Training Center Booking System

## Design Approach
**Reference-Based Approach** drawing from Airbnb's booking experience and modern SaaS aesthetics (Linear, Notion). The purple color scheme creates a distinctive, trust-building brand identity that stands out in the pet care industry.

## Core Design Elements

### A. Color Palette

**Light Mode:**
- Primary Purple: 270 60% 50% (rich, professional violet)
- Purple Light: 270 50% 95% (subtle backgrounds)
- Purple Medium: 270 55% 70% (hover states)
- Accent Warm: 320 45% 60% (secondary actions, highlights)
- Neutrals: Slate 215 20% 15% (text), 215 15% 95% (backgrounds)

**Dark Mode:**
- Primary Purple: 270 55% 60% (brighter for contrast)
- Purple Dark: 270 40% 12% (backgrounds)
- Purple Accent: 270 65% 75% (highlights)
- Accent Warm: 320 50% 65%
- Neutrals: Slate 215 20% 85% (text), 215 25% 10% (backgrounds)

### B. Typography
- **Primary Font:** Inter (Google Fonts) - clean, professional
- **Headings:** 700 weight, tracking-tight
- **Body:** 400/500 weight, leading-relaxed
- **Scale:** text-sm to text-5xl, responsive scaling

### C. Layout System
**Spacing Units:** Tailwind 4, 6, 8, 12, 16, 24, 32
- Card padding: p-6 to p-8
- Section spacing: py-16 to py-24
- Component gaps: gap-4 to gap-8
- Max container: max-w-7xl

### D. Component Library

**Navigation:**
- Sticky top header with logo left, nav center, CTA right
- Background: backdrop-blur with subtle purple tint
- Mobile: Hamburger menu with smooth slide-in drawer

**Hero Section:**
- Full-width split layout: 50% content, 50% hero image
- Height: min-h-[600px] on desktop
- Image: Professional dog training photo with warm lighting
- CTA buttons: Primary solid purple, Secondary outline with blur background
- Include trust badges: "10+ anni esperienza", "500+ cani felici"

**Calendar Component:**
- Grid-based interactive calendar with purple highlights for available dates
- Selected dates: solid purple background
- Hover states: purple-light background
- Disabled dates: opacity-40 with slash-through styling
- Month/year navigation with smooth transitions

**Booking Form:**
- Multi-step wizard with progress indicator (purple gradient)
- Steps: Service Selection → Date/Time → Dog Details → Confirmation
- Form fields: Soft rounded corners (rounded-lg), purple focus rings
- Validation: Inline with gentle purple error states
- Success state: Purple checkmark animation

**Service Cards:**
- Grid layout: 3 columns desktop, 2 tablet, 1 mobile
- Card design: Subtle shadow, hover lift effect (translate-y-1)
- Icons: Heroicons for service types
- Pricing: Bold text with purple accent

**Admin Dashboard:**
- Sidebar navigation with purple active states
- Data tables: Alternating row backgrounds, purple header
- Status badges: Color-coded (purple=confirmed, amber=pending, gray=cancelled)
- Charts: Purple gradient fills for statistics

**Testimonials:**
- Card-based carousel with dog photos
- Circular avatar images with purple ring border
- Star ratings in purple
- Quote marks in light purple

**Footer:**
- Three-column layout: About, Quick Links, Contact
- Newsletter signup with purple button
- Social icons with purple hover states
- Background: Dark purple gradient

### E. Animations
**Minimal, purposeful motion:**
- Page transitions: Subtle fade (duration-200)
- Calendar date selection: Scale bounce effect
- Form submission: Purple progress bar
- Button hovers: Gentle scale-105
- Card interactions: Shadow-lg on hover

## Images

**Hero Image:**
- Location: Hero section (50% viewport width, right side)
- Description: High-quality photo of trainer working with happy dog in outdoor setting, warm natural lighting, shallow depth of field focusing on dog-trainer connection
- Treatment: Subtle purple color overlay at 10% opacity

**Service Icons/Photos:**
- Small circular images (96px) for each service type
- Show dogs in training activities: agility, obedience, socialization
- Consistent lighting and professional quality

**Testimonial Photos:**
- Client photos with their dogs (circular, 64px avatars)
- Natural, candid shots showing happiness and trust

**Admin Dashboard (optional):**
- Placeholder dog illustrations for empty states in purple line art style

## Key Interactions

**Booking Flow:**
1. Service card click → Smooth scroll to calendar
2. Date selection → Time slots appear with stagger animation
3. Form fill → Real-time validation with purple indicators
4. Submit → Loading state with purple spinner → Success modal

**Calendar Behavior:**
- Click date: Immediate purple highlight
- Hover: Light purple background preview
- Range selection: Gradient fill between dates
- Mobile: Swipe gesture for month navigation

**Admin Features:**
- Quick action buttons with purple icons
- Inline editing with purple focus states
- Bulk actions with purple checkboxes
- Export data button with purple download icon

## Responsive Strategy
- Desktop: Full multi-column layouts, sidebar admin
- Tablet (md:): 2-column grids, collapsible sidebar
- Mobile: Stacked single column, bottom navigation for admin, simplified calendar view with date picker fallback

This design system creates a cohesive, professional booking experience that builds trust through consistent purple branding while maintaining excellent usability across all user types (clients and administrators).