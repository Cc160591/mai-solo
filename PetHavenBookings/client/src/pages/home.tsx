import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Calendar from "@/components/calendar";
import BookingForm from "@/components/booking-form";
import DailyBookings from "@/components/daily-bookings";
import IdentifyEmailDialog from "@/components/identify-email-dialog";
import OnboardingTour from "@/components/onboarding-tour";
import { Button } from "@/components/ui/button";
import { Shield, HelpCircle } from "lucide-react";

export default function Home() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const [, setLocation] = useLocation();
  const [showTour, setShowTour] = useState(false);

  const { data: adminStatus } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/status"],
    retry: false,
  });

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("onboardingComplete");
    if (!hasSeenTour) {
      setTimeout(() => setShowTour(true), 800);
    }
  }, []);

  return (
    <div className="bg-background text-foreground antialiased min-h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-4 max-w-7xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <i className="fas fa-paw text-2xl text-primary-foreground"></i>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">Centro Cinofilo Mai Solo</h1>
                <p className="text-sm text-muted-foreground">Sistema di Prenotazione</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTour(true)}
                className="gap-2 text-muted-foreground"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Guida</span>
              </Button>
              {adminStatus?.isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/admin")}
                  className="gap-2"
                  data-testid="button-admin-dashboard"
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard Admin</span>
                </Button>
              )}
              <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                <i className="far fa-clock"></i>
                <span>Lun-Dom: 8:00-18:00</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Hero Section */}
        <section className="mb-8" data-tour-step="hero">
          <div className="bg-gradient-to-br from-primary via-accent to-primary rounded-2xl p-6 md:p-8 text-primary-foreground shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Prenota il Tuo Posto</h2>
              <p className="text-primary-foreground/90 mb-6">Servizi di asilo giornaliero e pensione per i tuoi amici a quattro zampe</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <div className="text-3xl font-bold">9</div>
                  <div className="text-sm opacity-90">Capacità Max</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <div className="text-3xl font-bold">2</div>
                  <div className="text-sm opacity-90">Servizi</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <div className="text-3xl font-bold">8:00</div>
                  <div className="text-sm opacity-90">Apertura</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <div className="text-3xl font-bold">18:00</div>
                  <div className="text-sm opacity-90">Chiusura</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Grid Layout */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column: Calendar and Bookings */}
          <div className="lg:col-span-2 space-y-6">
            <div data-tour-step="calendar">
              <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
            </div>
            <IdentifyEmailDialog />
            <div data-tour-step="daily-bookings">
              <DailyBookings selectedDate={selectedDate} isAdmin={adminStatus?.isAdmin || false} />
            </div>
          </div>

          {/* Right Column: Booking Form */}
          <div className="lg:col-span-1" data-tour-step="booking-form">
            <BookingForm selectedDate={selectedDate} />
          </div>
        </div>

        {/* Features Section */}
        <section className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <i className="fas fa-shield-alt text-2xl text-primary"></i>
            </div>
            <h3 className="font-semibold text-lg mb-2">Sicurezza Garantita</h3>
            <p className="text-sm text-muted-foreground">Ambiente controllato e sicuro con personale qualificato sempre presente</p>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mb-4">
              <i className="fas fa-heart text-2xl text-accent"></i>
            </div>
            <h3 className="font-semibold text-lg mb-2">Cura Personalizzata</h3>
            <p className="text-sm text-muted-foreground">Attenzione dedicata alle esigenze specifiche di ogni cane</p>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-4">
              <i className="fas fa-clock text-2xl text-secondary"></i>
            </div>
            <h3 className="font-semibold text-lg mb-2">Orari Flessibili</h3>
            <p className="text-sm text-muted-foreground">Fasce orarie multiple per adattarsi alle tue esigenze</p>
          </div>
        </section>
      </main>

      <OnboardingTour isOpen={showTour} onClose={() => setShowTour(false)} />

      {/* Footer */}
      <footer className="bg-secondary text-secondary-foreground mt-16">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <i className="fas fa-paw"></i>
                Centro Cinofilo Mai Solo
              </h3>
              <div className="space-y-2 text-sm text-secondary-foreground/80">
                <p>🏨 Pensione</p>
                <p>☀️ Asilo</p>
                <p>🏊 Piscina</p>
                <p>🎓 Educazione Cinofila</p>
                <p>🦴 Vendita Guinzagli</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Contatti</h4>
              <div className="space-y-2 text-sm text-secondary-foreground/80">
                <p><i className="fas fa-map-marker-alt mr-2"></i> Via Alessandro Volta 51, Casnate 22070</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Orari</h4>
              <div className="space-y-2 text-sm text-secondary-foreground/80">
                <p>Lunedì - Domenica</p>
                <p className="font-medium">8:00 - 18:00</p>
                <p className="text-xs mt-3">Prenotazioni online 24/7</p>
              </div>
            </div>
          </div>
          <div className="border-t border-secondary-foreground/20 mt-8 pt-6 text-center text-sm text-secondary-foreground/60">
            <p>&copy; 2024 Centro Cinofilo Mai Solo. Tutti i diritti riservati.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
