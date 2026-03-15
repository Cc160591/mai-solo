import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { List, Dog, User, Clock, Calendar, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DailyBookingsProps {
  selectedDate: string;
  isAdmin?: boolean;
}

interface BookingWithPrivacy {
  id: number;
  dogName: string | null;
  ownerName: string | null;
  email: string | null;
  serviceType: string;
  startDate: string;
  endDate: string;
  entryTime: string;
  exitTime: string;
  exactEntryTime: string | null;
  exactExitTime: string | null;
  isOwn: boolean;
}

export default function DailyBookings({ selectedDate, isAdmin = false }: DailyBookingsProps) {
  const [userEmail, setUserEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userEmail') || '';
    }
    return '';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const email = localStorage.getItem('userEmail') || '';
      setUserEmail(email);
    };

    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(() => {
      const email = localStorage.getItem('userEmail') || '';
      if (email !== userEmail) {
        setUserEmail(email);
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [userEmail]);

  const { data: bookings, isLoading } = useQuery<BookingWithPrivacy[]>({
    queryKey: ["/api/bookings", selectedDate, userEmail],
    queryFn: async () => {
      const emailParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
      const response = await fetch(`/api/bookings/${selectedDate}${emailParam}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error('Failed to fetch bookings');
      return response.json();
    },
  });

  const { data: availability } = useQuery({
    queryKey: ["/api/availability", selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/availability/${selectedDate}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error('Failed to fetch availability');
      return response.json();
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getServiceIcon = (serviceType: string) => {
    return serviceType === 'asilo' ? '☀️' : '🌙';
  };

  const getServiceLabel = (serviceType: string) => {
    return serviceType === 'asilo' ? 'Asilo' : 'Pensione';
  };

  const getServiceColor = (serviceType: string) => {
    return serviceType === 'asilo' ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-secondary';
  };

  const ownBookingsCount = bookings?.filter(b => b.isOwn).length || 0;
  const otherBookingsCount = bookings?.filter(b => !b.isOwn).length || 0;

  return (
    <Card className="bg-card rounded-xl shadow-md border border-border">
      <div className="p-6 border-b border-border">
        <h3 className="text-xl font-semibold flex items-center gap-2">
          <List className="text-primary" size={24} />
          Prenotazioni del{' '}
          <span className="text-primary" data-testid="text-selected-date">
            {formatDate(selectedDate)}
          </span>
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          <span data-testid="text-bookings-count">{bookings?.length || 0}</span> prenotazioni •{' '}
          <span data-testid="text-availability">{availability?.total || 0}</span> posti disponibili
        </p>
      </div>
      
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
                  <div className="w-12 h-12 bg-muted rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : bookings && bookings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookings.map((booking) => {
              const showDetails = booking.isOwn || isAdmin;
              return (
              <div 
                key={booking.id} 
                className={`bg-card border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
                  booking.isOwn ? 'border-primary/30 bg-primary/5' : isAdmin ? 'border-indigo-300/30 bg-indigo-50/5' : 'border-border'
                }`}
                data-testid={`booking-card-${booking.id}`}
              >
                {showDetails ? (
                  <>
                    {/* Badge servizio in cima */}
                    <div className="flex items-center justify-between mb-3">
                      <Badge
                        className={getServiceColor(booking.serviceType)}
                        data-testid={`badge-service-${booking.id}`}
                      >
                        {getServiceIcon(booking.serviceType)} {getServiceLabel(booking.serviceType)}
                      </Badge>
                      {booking.isOwn && (
                        <span className="text-xs text-primary font-medium">Tua prenotazione</span>
                      )}
                    </div>
                    {/* Info cane e proprietario */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                        <Dog className="text-primary" size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-foreground truncate" data-testid={`text-dog-name-${booking.id}`}>
                          {booking.dogName}
                        </h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate" data-testid={`text-owner-name-${booking.id}`}>
                          <User size={10} />
                          {booking.ownerName}
                        </p>
                        {isAdmin && booking.email && (
                          <p className="text-xs text-muted-foreground/60 truncate" data-testid={`text-email-${booking.id}`}>
                            {booking.email}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Date e orari */}
                    <div className="space-y-1.5 text-xs border-t border-border pt-2">
                      {booking.serviceType === 'pensione' && booking.endDate && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar size={11} />
                          <span className="truncate" data-testid={`text-date-range-${booking.id}`}>
                            {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock size={11} />
                          <span data-testid={`text-entry-time-${booking.id}`}>
                            In: <strong>{booking.entryTime}</strong>
                            {booking.exactEntryTime && (
                              <span className="text-primary"> ({booking.exactEntryTime})</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock size={11} />
                          <span data-testid={`text-exit-time-${booking.id}`}>
                            Out: <strong>{booking.exitTime}</strong>
                            {booking.exactExitTime && (
                              <span className="text-primary"> ({booking.exactExitTime})</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center gap-3 py-2">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                      <Lock className="text-muted-foreground" size={16} />
                    </div>
                    <div>
                      <Badge variant="outline" className="text-muted-foreground mb-1">
                        Riservato
                      </Badge>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {getServiceIcon(booking.serviceType)} {getServiceLabel(booking.serviceType)}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {booking.entryTime} → {booking.exitTime}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        ) : (
          <div className="text-center py-12" data-testid="empty-bookings-state">
            <Calendar className="mx-auto text-muted-foreground/30 mb-4" size={48} />
            <p className="text-muted-foreground">Nessuna prenotazione per questa data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
