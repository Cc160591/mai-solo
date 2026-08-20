import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, BookOpen, Calendar, Clock, Dog, User, Search, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { entrySlotsForDate, exitSlotsForDate } from "@shared/schema";

interface Booking {
  id: number;
  dogName: string;
  ownerName: string;
  email: string;
  serviceType: string;
  startDate: string;
  endDate: string;
  entryTime: string;
  exitTime: string;
  exactEntryTime: string;
  exactExitTime: string;
  createdAt: string;
}

function isEditAllowed(startDate: string): boolean {
  const [year, month, day] = startDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() - 1);
  d.setHours(20, 0, 0, 0);
  return new Date() <= d;
}

function isUpcoming(startDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = startDate.split('-').map(Number);
  return new Date(year, month - 1, day) >= today;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export default function MyBookings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [emailInput, setEmailInput] = useState(() => localStorage.getItem('userEmail') || '');
  const [searchEmail, setSearchEmail] = useState(() => localStorage.getItem('userEmail') || '');
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editForm, setEditForm] = useState({ entryTime: '', exitTime: '', exactEntryTime: '', exactExitTime: '' });

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/my-bookings", searchEmail],
    queryFn: async () => {
      if (!searchEmail) return [];
      const response = await fetch(`/api/my-bookings?email=${encodeURIComponent(searchEmail)}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error('Errore nel caricamento delle prenotazioni');
      return response.json();
    },
    enabled: !!searchEmail,
  });

  const editMutation = useMutation({
    mutationFn: async (data: { id: number; payload: Record<string, string> }) => {
      const response = await fetch(`/api/bookings/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data.payload, email: searchEmail }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Errore durante la modifica');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-bookings", searchEmail] });
      setEditingBooking(null);
      toast({ title: "Prenotazione aggiornata", description: "Le modifiche sono state salvate." });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    const normalized = emailInput.toLowerCase().trim();
    setSearchEmail(normalized);
    localStorage.setItem('userEmail', normalized);
  };

  const openEdit = (booking: Booking) => {
    setEditingBooking(booking);
    setEditForm({
      entryTime: booking.entryTime,
      exitTime: booking.exitTime,
      exactEntryTime: booking.exactEntryTime || '',
      exactExitTime: booking.exactExitTime || '',
    });
  };

  // Il cliente può scegliere solo le fasce ammesse per le date della sua
  // prenotazione: dal 1° settembre 2026 restano quelle a giornata intera.
  const editEntryOptions = editingBooking ? entrySlotsForDate(editingBooking.startDate) : [];
  const editExitOptions = editingBooking
    ? exitSlotsForDate(editingBooking.endDate || editingBooking.startDate)
    : [];

  const submitEdit = () => {
    if (!editingBooking) return;
    const payload: Record<string, string> = {
      entryTime: editForm.entryTime,
      exitTime: editForm.exitTime,
    };
    if (editForm.exactEntryTime) payload.exactEntryTime = editForm.exactEntryTime;
    if (editForm.exactExitTime) payload.exactExitTime = editForm.exactExitTime;
    editMutation.mutate({ id: editingBooking.id, payload });
  };

  const getServiceIcon = (t: string) => t === 'asilo' ? '☀️' : '🌙';
  const getServiceLabel = (t: string) => t === 'asilo' ? 'Asilo' : 'Pensione';
  const getServiceColor = (t: string) =>
    t === 'asilo' ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-secondary';

  const upcomingBookings = (bookings ?? []).filter(b => isUpcoming(b.startDate));
  const pastBookings = (bookings ?? [])
    .filter(b => !isUpcoming(b.startDate))
    .reverse(); // più recenti prima

  const BookingCard = ({ booking }: { booking: Booking }) => {
    const upcoming = isUpcoming(booking.startDate);
    const canEdit = upcoming && isEditAllowed(booking.startDate);
    const isSingleDay = booking.startDate === booking.endDate;

    return (
      <div className={`bg-card border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
        upcoming ? 'border-primary/30 bg-primary/5' : 'border-border opacity-70'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <Badge className={getServiceColor(booking.serviceType)}>
            {getServiceIcon(booking.serviceType)} {getServiceLabel(booking.serviceType)}
          </Badge>
          {upcoming && (
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

        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <Dog className="text-primary" size={16} />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-foreground truncate">{booking.dogName}</h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
              <User size={10} /> {booking.ownerName}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 text-xs border-t border-border pt-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar size={11} />
            <span>
              {isSingleDay
                ? formatDate(booking.startDate)
                : `${formatDate(booking.startDate)} → ${formatDate(booking.endDate)}`}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock size={11} />
              <span>
                In: <strong>{booking.entryTime}</strong>
                {booking.exactEntryTime && <span className="text-primary"> ({booking.exactEntryTime})</span>}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock size={11} />
              <span>
                Out: <strong>{booking.exitTime}</strong>
                {booking.exactExitTime && <span className="text-primary"> ({booking.exactExitTime})</span>}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background text-foreground antialiased min-h-screen">
      <header className="bg-card border-b border-border sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-4 max-w-4xl">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/')} className="gap-2">
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Torna alla home</span>
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <BookOpen className="text-primary-foreground" size={18} />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold text-foreground">Le mie prenotazioni</h1>
                <p className="text-xs text-muted-foreground">Centro Cinofilo Mai Solo</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-1">Cerca le tue prenotazioni</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Inserisci l'email che hai usato durante la prenotazione
            </p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="email"
                placeholder="es. mario.rossi@email.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="flex-1"
                required
              />
              <Button type="submit" className="gap-2">
                <Search size={16} />
                Cerca
              </Button>
            </form>
            {searchEmail && (
              <p className="text-xs text-muted-foreground mt-2">
                Risultati per: <strong>{searchEmail}</strong>
              </p>
            )}
          </CardContent>
        </Card>

        {searchEmail && (
          <>
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-card border border-border rounded-lg p-4 h-40" />
                ))}
              </div>
            ) : !bookings || bookings.length === 0 ? (
              <div className="text-center py-16">
                <Calendar className="mx-auto text-muted-foreground/30 mb-4" size={48} />
                <p className="text-muted-foreground font-medium">Nessuna prenotazione trovata</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Verifica di aver inserito l'email corretta
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {upcomingBookings.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                      Prossime prenotazioni ({upcomingBookings.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {upcomingBookings.map(b => <BookingCard key={b.id} booking={b} />)}
                    </div>
                  </section>
                )}
                {pastBookings.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" />
                      Prenotazioni passate ({pastBookings.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {pastBookings.map(b => <BookingCard key={b.id} booking={b} />)}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>

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
    </div>
  );
}
