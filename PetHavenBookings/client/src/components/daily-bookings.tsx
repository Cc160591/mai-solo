import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { List, Dog, User, Clock, Calendar, Lock, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  entrySlotsForDate,
  exitSlotsForDate,
  entrySlotOptionsWithCurrent,
  exitSlotOptionsWithCurrent,
} from "@shared/schema";

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

function isEditAllowed(startDate: string): boolean {
  const d = new Date(startDate);
  d.setDate(d.getDate() - 1);
  d.setHours(20, 0, 0, 0);
  return new Date() <= d;
}

export default function DailyBookings({ selectedDate, isAdmin = false }: DailyBookingsProps) {
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userEmail') || '';
    }
    return '';
  });
  const [editingBooking, setEditingBooking] = useState<BookingWithPrivacy | null>(null);
  const [editForm, setEditForm] = useState({ entryTime: '', exitTime: '', exactEntryTime: '', exactExitTime: '' });

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

  const editMutation = useMutation({
    mutationFn: async (data: { id: number; payload: Record<string, string> }) => {
      const endpoint = isAdmin ? `/api/admin/bookings/${data.id}` : `/api/bookings/${data.id}`;
      const body = isAdmin ? data.payload : { ...data.payload, email: userEmail };
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Errore durante la modifica');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", selectedDate, userEmail] });
      setEditingBooking(null);
      toast({ title: "Prenotazione aggiornata", description: "Le modifiche sono state salvate." });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const openEdit = (booking: BookingWithPrivacy) => {
    setEditingBooking(booking);
    setEditForm({
      entryTime: booking.entryTime,
      exitTime: booking.exitTime,
      exactEntryTime: booking.exactEntryTime || '',
      exactExitTime: booking.exactExitTime || '',
    });
  };

  // L'admin vede anche la fascia storica già salvata e può lasciarla invariata;
  // il cliente sceglie solo fra quelle ammesse per le date della prenotazione.
  const editEntryOptions = editingBooking
    ? (isAdmin
        ? entrySlotOptionsWithCurrent(editingBooking.startDate, editingBooking.entryTime)
        : [...entrySlotsForDate(editingBooking.startDate)])
    : [];
  const editExitOptions = editingBooking
    ? (isAdmin
        ? exitSlotOptionsWithCurrent(editingBooking.endDate || editingBooking.startDate, editingBooking.exitTime)
        : [...exitSlotsForDate(editingBooking.endDate || editingBooking.startDate)])
    : [];

  const submitEdit = () => {
    if (!editingBooking) return;
    const payload: Record<string, string> = { entryTime: editForm.entryTime, exitTime: editForm.exitTime };
    if (editForm.exactEntryTime) payload.exactEntryTime = editForm.exactEntryTime;
    if (editForm.exactExitTime) payload.exactExitTime = editForm.exactExitTime;
    editMutation.mutate({ id: editingBooking.id, payload });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getServiceIcon = (serviceType: string) => serviceType === 'asilo' ? '☀️' : '🌙';
  const getServiceLabel = (serviceType: string) => serviceType === 'asilo' ? 'Asilo' : 'Pensione';
  const getServiceColor = (serviceType: string) =>
    serviceType === 'asilo' ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-secondary';

  return (
    <>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                const canEdit = (booking.isOwn || isAdmin) && isEditAllowed(booking.startDate);
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
                      {/* Badge servizio + tasto modifica */}
                      <div className="flex items-center justify-between mb-3">
                        <Badge
                          className={getServiceColor(booking.serviceType)}
                          data-testid={`badge-service-${booking.id}`}
                        >
                          {getServiceIcon(booking.serviceType)} {getServiceLabel(booking.serviceType)}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {booking.isOwn && (
                            <span className="text-xs text-primary font-medium">Tua prenotazione</span>
                          )}
                          {(booking.isOwn || isAdmin) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              disabled={!canEdit}
                              title={canEdit ? "Modifica prenotazione" : "Termine scaduto (entro le 20:00 del giorno prima)"}
                              onClick={() => openEdit(booking)}
                            >
                              <Pencil size={13} className={canEdit ? "text-primary" : "text-muted-foreground"} />
                            </Button>
                          )}
                        </div>
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

      {/* Dialog modifica */}
      {editingBooking && (
        <Dialog open={!!editingBooking} onOpenChange={() => setEditingBooking(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica prenotazione — {editingBooking.dogName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fascia entrata</Label>
                  <Select value={editForm.entryTime} onValueChange={(v) => setEditForm(f => ({ ...f, entryTime: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleziona fascia" /></SelectTrigger>
                    <SelectContent>
                      {editEntryOptions.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fascia uscita</Label>
                  <Select value={editForm.exitTime} onValueChange={(v) => setEditForm(f => ({ ...f, exitTime: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleziona fascia" /></SelectTrigger>
                    <SelectContent>
                      {editExitOptions.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Orario esatto entrata</Label>
                  <Input
                    type="time"
                    value={editForm.exactEntryTime}
                    onChange={(e) => setEditForm(f => ({ ...f, exactEntryTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Orario esatto uscita</Label>
                  <Input
                    type="time"
                    value={editForm.exactExitTime}
                    onChange={(e) => setEditForm(f => ({ ...f, exactExitTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingBooking(null)}>Annulla</Button>
              <Button onClick={submitEdit} disabled={editMutation.isPending}>
                {editMutation.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
