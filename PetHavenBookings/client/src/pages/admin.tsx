import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { api, type BatchBookingResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { LogOut, Trash2, Calendar, Bell, Edit, PlusCircle, Repeat, Info, XCircle, Loader2, Archive, Search } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBookingSchema, type Booking, type InsertBooking } from "@shared/schema";
import { ClosuresManagement } from "@/components/closures-management";
import { CapacityOverrides } from "@/components/capacity-overrides";
import { cn } from "@/lib/utils";

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

interface BookingSectionProps {
  title: string;
  description: string;
  bookings: Booking[];
  accentClass: string;
  badgeClass: string;
  onEdit: (booking: Booking) => void;
  onDelete: (id: number, dogName: string) => void;
  deleteIsPending: boolean;
}

function BookingSection({ title, description, bookings, accentClass, badgeClass, onEdit, onDelete, deleteIsPending }: BookingSectionProps) {
  return (
    <Card className={accentClass}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${badgeClass}`}>
            {bookings.length} {bookings.length === 1 ? 'prenotazione' : 'prenotazioni'}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">Nessuna prenotazione</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">ID</TableHead>
                  <TableHead>Cane</TableHead>
                  <TableHead>Proprietario</TableHead>
                  <TableHead>Data Inizio</TableHead>
                  <TableHead>Data Fine</TableHead>
                  <TableHead>Entrata</TableHead>
                  <TableHead>Uscita</TableHead>
                  <TableHead className="text-right w-20">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.reduce((rows, booking, index) => {
                  const currentDate = booking.startDate;
                  const prevDate = index > 0 ? bookings[index - 1].startDate : null;
                  if (currentDate !== prevDate) {
                    rows.push(
                      <TableRow key={`date-${currentDate}`} className="bg-violet-100 hover:bg-violet-100 dark:bg-violet-900/30">
                        <TableCell colSpan={8} className="py-2 px-4">
                          <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                            📅 {format(new Date(currentDate), "EEEE dd MMMM yyyy", { locale: it })}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  rows.push(
                    <TableRow key={booking.id} data-testid={`row-booking-${booking.id}`}>
                      <TableCell className="font-medium text-gray-400">{booking.id}</TableCell>
                      <TableCell className="font-medium" data-testid={`text-dog-${booking.id}`}>
                        {booking.dogName}
                      </TableCell>
                      <TableCell data-testid={`text-owner-${booking.id}`}>
                        {booking.ownerName}
                      </TableCell>
                      <TableCell data-testid={`text-start-date-${booking.id}`}>
                        {format(new Date(booking.startDate), "dd MMM yyyy", { locale: it })}
                      </TableCell>
                      <TableCell data-testid={`text-end-date-${booking.id}`}>
                        {booking.endDate && booking.endDate !== booking.startDate
                          ? format(new Date(booking.endDate), "dd MMM yyyy", { locale: it })
                          : <span className="text-gray-400">—</span>
                        }
                      </TableCell>
                      <TableCell data-testid={`text-entry-${booking.id}`}>
                        <span className="font-medium">{booking.entryTime}</span>
                        {booking.exactEntryTime && (
                          <span className="text-xs text-gray-400 block">({booking.exactEntryTime})</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-exit-${booking.id}`}>
                        <span className="font-medium">{booking.exitTime}</span>
                        {booking.exactExitTime && (
                          <span className="text-xs text-gray-400 block">({booking.exactExitTime})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(booking)}
                            title="Modifica prenotazione"
                            data-testid={`button-edit-${booking.id}`}
                          >
                            <Edit className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(booking.id, booking.dogName)}
                            disabled={deleteIsPending}
                            data-testid={`button-delete-${booking.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                  return rows;
                }, [] as React.ReactNode[])}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function generateRecurringDates(startFromDate: string, selectedDays: number[], numWeeks: number): string[] {
  const dates: string[] = [];
  const start = new Date(startFromDate);
  start.setDate(start.getDate() - start.getDay());

  for (let week = 0; week < numWeeks; week++) {
    for (const day of selectedDays) {
      const d = new Date(start);
      d.setDate(d.getDate() + week * 7 + day);
      const dateStr = d.toISOString().split('T')[0];
      if (dateStr >= startFromDate) {
        dates.push(dateStr);
      }
    }
  }

  return dates.sort();
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [newBookingData, setNewBookingData] = useState<any>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [numWeeks, setNumWeeks] = useState(4);
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [batchResult, setBatchResult] = useState<BatchBookingResult | null>(null);
  const [showBatchResultDialog, setShowBatchResultDialog] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');

  const { data: adminStatus, isLoading: isAdminStatusLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/status"],
  });

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ["/api/admin/bookings"],
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/admin/bookings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Prenotazione eliminata",
        description: "La prenotazione è stata eliminata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eliminare la prenotazione",
        variant: "destructive",
      });
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertBooking> }) => {
      return await apiRequest("PATCH", `/api/admin/bookings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setShowEditDialog(false);
      setEditingBooking(null);
      toast({
        title: "Prenotazione aggiornata",
        description: "La prenotazione è stata modificata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare la prenotazione",
        variant: "destructive",
      });
    },
  });

  const createBookingMutation = useMutation({
    mutationFn: api.createBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setShowNewDialog(false);
      resetNewForm();
      toast({
        title: "Prenotazione creata",
        description: "La prenotazione è stata creata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile creare la prenotazione",
        variant: "destructive",
      });
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: api.createBatchBookings,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      setShowNewDialog(false);
      resetNewForm();
      setBatchResult(result);
      setShowBatchResultDialog(true);
      toast({
        title: "Prenotazioni ricorrenti create",
        description: result.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile creare le prenotazioni",
        variant: "destructive",
      });
    },
  });

  const editForm = useForm<InsertBooking>({
    resolver: zodResolver(insertBookingSchema),
    defaultValues: {
      dogName: '',
      ownerName: '',
      email: '',
      serviceType: 'asilo',
      startDate: '',
      endDate: '',
      entryTime: '7:30',
      exitTime: '11:30-12:00',
      exactEntryTime: '',
      exactExitTime: '',
    },
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const newForm = useForm<InsertBooking>({
    resolver: zodResolver(insertBookingSchema),
    defaultValues: {
      dogName: '',
      ownerName: '',
      email: '',
      serviceType: 'asilo',
      startDate: minDate,
      endDate: minDate,
      entryTime: '7:30',
      exitTime: '11:30-12:00',
      exactEntryTime: '',
      exactExitTime: '',
    },
  });

  const newServiceType = newForm.watch('serviceType');

  const effectiveRecurringStart = recurringStartDate && recurringStartDate >= minDate ? recurringStartDate : minDate;

  const recurringDates = useMemo(() => {
    if (!isRecurring || selectedDays.length === 0) return [];
    return generateRecurringDates(effectiveRecurringStart, selectedDays, numWeeks);
  }, [isRecurring, selectedDays, numWeeks, effectiveRecurringStart]);

  const resetNewForm = () => {
    newForm.reset({
      dogName: '',
      ownerName: '',
      email: '',
      serviceType: 'asilo',
      startDate: minDate,
      endDate: minDate,
      entryTime: '7:30',
      exitTime: '11:30-12:00',
      exactEntryTime: '',
      exactExitTime: '',
    });
    setIsRecurring(false);
    setSelectedDays([]);
    setNumWeeks(4);
    setRecurringStartDate('');
  };

  useEffect(() => {
    if (adminStatus && !adminStatus.isAdmin) {
      setLocation("/admin-login");
    }
  }, [adminStatus, setLocation]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to admin notifications');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'new_booking') {
        setNotifications(prev => [message, ...prev]);
        setNewBookingData(message.data);
        setShowNotificationDialog(true);
        queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Disconnected from admin notifications');
    };

    return () => {
      ws.close();
    };
  }, [toast]);

  useEffect(() => {
    if (isRecurring && recurringDates.length > 0) {
      newForm.setValue('startDate', recurringDates[0]);
      newForm.setValue('endDate', recurringDates[0]);
    }
  }, [isRecurring, recurringDates, newForm]);

  if (isAdminStatusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (adminStatus && !adminStatus.isAdmin) {
    return null;
  }

  const handleDelete = (id: number, dogName: string) => {
    if (confirm(`Sei sicuro di voler eliminare la prenotazione per ${dogName}?`)) {
      deleteBookingMutation.mutate(id);
    }
  };

  const handleEdit = (booking: Booking) => {
    setEditingBooking(booking);
    editForm.reset({
      dogName: booking.dogName,
      ownerName: booking.ownerName,
      email: booking.email || '',
      serviceType: booking.serviceType as 'asilo' | 'pensione',
      startDate: booking.startDate,
      endDate: booking.endDate || booking.startDate,
      entryTime: booking.entryTime as '7:30' | '8:00-9:00' | '13:30-14:00',
      exitTime: booking.exitTime as '8:00-9:00' | '11:30-12:00' | '17:00-18:00',
      exactEntryTime: booking.exactEntryTime || '',
      exactExitTime: booking.exactExitTime || '',
    });
    setShowEditDialog(true);
  };

  const onSubmitEdit = (data: InsertBooking) => {
    if (editingBooking) {
      updateBookingMutation.mutate({
        id: editingBooking.id,
        data,
      });
    }
  };

  const onSubmitNew = (data: InsertBooking) => {
    if (isRecurring) {
      if (recurringDates.length === 0) {
        toast({
          title: "Errore",
          description: "Seleziona almeno un giorno della settimana.",
          variant: "destructive",
        });
        return;
      }
      createBatchMutation.mutate({
        dogName: data.dogName,
        ownerName: data.ownerName,
        email: data.email,
        serviceType: data.serviceType as 'asilo' | 'pensione',
        entryTime: data.entryTime as '7:30' | '8:00-9:00' | '13:30-14:00',
        exitTime: data.exitTime as '8:00-9:00' | '11:30-12:00' | '17:00-18:00',
        exactEntryTime: data.exactEntryTime,
        exactExitTime: data.exactExitTime,
        dates: recurringDates,
      });
    } else {
      createBookingMutation.mutate(data);
    }
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const sortedBookings = bookings ? [...bookings].sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  }) : [];

  const todayStr = new Date().toISOString().split('T')[0];
  const activeBookings = sortedBookings.filter(b => b.endDate >= todayStr);
  const archivedBookings = sortedBookings
    .filter(b => b.endDate < todayStr)
    .reverse(); // più recenti prima

  const filteredArchive = archivedBookings.filter(b => {
    if (!archiveSearch.trim()) return true;
    const q = archiveSearch.toLowerCase();
    return b.dogName.toLowerCase().includes(q) || b.ownerName.toLowerCase().includes(q) || b.email?.toLowerCase().includes(q);
  });

  const isNewPending = createBookingMutation.isPending || createBatchMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Dashboard Amministrativa
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Centro Cinofilo Mai Solo
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {notifications.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setNotifications([])}
                data-testid="button-clear-notifications"
                size="sm"
              >
                <Bell className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{notifications.length} nuove</span>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-view-calendar"
              size="sm"
            >
              <Calendar className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Visualizza Calendario</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
              size="sm"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="bookings" className="space-y-4">
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="bookings" data-testid="tab-bookings" className="text-xs sm:text-sm">
              Prenotazioni
            </TabsTrigger>
            <TabsTrigger value="archive" data-testid="tab-archive" className="text-xs sm:text-sm">
              <Archive className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Archivio
              {archivedBookings.length > 0 && (
                <span className="ml-1.5 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {archivedBookings.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="closures" data-testid="tab-closures" className="text-xs sm:text-sm">
              Chiusure
            </TabsTrigger>
            <TabsTrigger value="capacity" data-testid="tab-capacity" className="text-xs sm:text-sm">
              Posti
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-4">
            {/* Top bar */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Prenotazioni Attive
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activeBookings.length} prenotazioni in corso o future
                </p>
              </div>
              <Button
                onClick={() => { resetNewForm(); setShowNewDialog(true); }}
                data-testid="button-new-booking"
                size="sm"
              >
                <PlusCircle className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nuova Prenotazione</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12">Caricamento...</div>
            ) : (
              <Tabs defaultValue="pensione">
                <TabsList className="mb-4">
                  <TabsTrigger value="pensione">🌙 Pensione</TabsTrigger>
                  <TabsTrigger value="asilo">☀️ Asilo</TabsTrigger>
                </TabsList>
                <TabsContent value="pensione">
                  <BookingSection
                    title="🌙 Pensione"
                    description="Soggiorni notturni e multi-giorno"
                    bookings={activeBookings.filter(b => b.serviceType === 'pensione')}
                    accentClass="border-l-4 border-l-indigo-500"
                    badgeClass="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    deleteIsPending={deleteBookingMutation.isPending}
                  />
                </TabsContent>
                <TabsContent value="asilo">
                  <BookingSection
                    title="☀️ Asilo"
                    description="Servizio giornaliero lunedì-venerdì"
                    bookings={activeBookings.filter(b => b.serviceType === 'asilo')}
                    accentClass="border-l-4 border-l-amber-500"
                    badgeClass="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    deleteIsPending={deleteBookingMutation.isPending}
                  />
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="archive" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Archivio Prenotazioni
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Prenotazioni concluse — archiviate automaticamente
                </p>
              </div>
              {archivedBookings.length > 0 && (
                <div className="flex gap-3">
                  <div className="text-center bg-indigo-50 dark:bg-indigo-900/30 rounded-lg px-4 py-2">
                    <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                      {archivedBookings.filter(b => b.serviceType === 'pensione').length}
                    </p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">Pensioni</p>
                  </div>
                  <div className="text-center bg-amber-50 dark:bg-amber-900/30 rounded-lg px-4 py-2">
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                      {archivedBookings.filter(b => b.serviceType === 'asilo').length}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">Asili</p>
                  </div>
                  <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2">
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                      {archivedBookings.length}
                    </p>
                    <p className="text-xs text-gray-500">Totale</p>
                  </div>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cerca per cane, proprietario o email..."
                value={archiveSearch}
                onChange={e => setArchiveSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-12">Caricamento...</div>
            ) : archivedBookings.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Archive className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground font-medium">Nessuna prenotazione archiviata</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Le prenotazioni passate appariranno qui automaticamente
                  </p>
                </CardContent>
              </Card>
            ) : filteredArchive.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nessun risultato per "{archiveSearch}"</p>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="all">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">Tutte ({filteredArchive.length})</TabsTrigger>
                  <TabsTrigger value="pensione">🌙 Pensione ({filteredArchive.filter(b => b.serviceType === 'pensione').length})</TabsTrigger>
                  <TabsTrigger value="asilo">☀️ Asilo ({filteredArchive.filter(b => b.serviceType === 'asilo').length})</TabsTrigger>
                </TabsList>
                {(['all', 'pensione', 'asilo'] as const).map(tab => (
                  <TabsContent key={tab} value={tab}>
                    <BookingSection
                      title={tab === 'all' ? '📦 Tutte le prenotazioni archiviate' : tab === 'pensione' ? '🌙 Pensione archiviate' : '☀️ Asilo archiviate'}
                      description={`${filteredArchive.filter(b => tab === 'all' || b.serviceType === tab).length} prenotazioni concluse`}
                      bookings={filteredArchive.filter(b => tab === 'all' || b.serviceType === tab)}
                      accentClass={tab === 'pensione' ? 'border-l-4 border-l-indigo-300 opacity-90' : tab === 'asilo' ? 'border-l-4 border-l-amber-300 opacity-90' : 'border-l-4 border-l-gray-300 opacity-90'}
                      badgeClass="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      deleteIsPending={deleteBookingMutation.isPending}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="closures" className="space-y-4">
            <ClosuresManagement />
          </TabsContent>

          <TabsContent value="capacity" className="space-y-4">
            <CapacityOverrides />
          </TabsContent>
        </Tabs>

        {/* Edit Booking Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-booking">
            <DialogHeader>
              <DialogTitle>Modifica Prenotazione</DialogTitle>
            </DialogHeader>

            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="dogName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Cane *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-dog-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="ownerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proprietario *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-owner-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-edit-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo Servizio *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-service-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="asilo">Asilo</SelectItem>
                            <SelectItem value="pensione">Pensione</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="entryTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario Entrata *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-entry-time">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="7:30">7:30</SelectItem>
                            <SelectItem value="8:00-9:00">8:00-9:00</SelectItem>
                            <SelectItem value="13:30-14:00">13:30-14:00</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="exitTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario Uscita *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-exit-time">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="11:30-12:00">11:30-12:00</SelectItem>
                            <SelectItem value="17:00-18:00">17:00-18:00</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Inizio *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-edit-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Fine *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-edit-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="exactEntryTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario Esatto Arrivo *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-edit-exact-entry-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="exactExitTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario Esatto Ritiro *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-edit-exact-exit-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditDialog(false)}
                    data-testid="button-cancel-edit"
                  >
                    Annulla
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateBookingMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    {updateBookingMutation.isPending ? "Salvataggio..." : "Salva Modifiche"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* New Booking Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-new-booking">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                Nuova Prenotazione
              </DialogTitle>
            </DialogHeader>

            <Form {...newForm}>
              <form onSubmit={newForm.handleSubmit(onSubmitNew)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={newForm.control}
                    name="dogName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Cane *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Es. Max" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newForm.control}
                    name="ownerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proprietario *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Es. Mario Rossi" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="Es. mario@email.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newForm.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo Servizio *</FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            if (isRecurring && val === 'asilo') {
                              setSelectedDays(prev => prev.filter(d => d >= 1 && d <= 5));
                            }
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="asilo">Asilo</SelectItem>
                            <SelectItem value="pensione">Pensione</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newForm.control}
                    name="entryTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario Entrata *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="7:30">7:30</SelectItem>
                            <SelectItem value="8:00-9:00">8:00-9:00</SelectItem>
                            <SelectItem value="13:30-14:00">13:30-14:00</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newForm.control}
                    name="exitTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario Uscita *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="8:00-9:00">8:00-9:00</SelectItem>
                            <SelectItem value="11:30-12:00">11:30-12:00</SelectItem>
                            <SelectItem value="17:00-18:00">17:00-18:00</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border-2 border-border rounded-lg p-4 space-y-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setIsRecurring(!isRecurring)}
                  >
                    <div className="flex items-center gap-2">
                      <Repeat size={16} className={cn("transition-colors", isRecurring ? "text-primary" : "text-muted-foreground")} />
                      <span className="font-medium">Prenotazione Ricorrente</span>
                    </div>
                    <button
                      type="button"
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        isRecurring ? "bg-primary" : "bg-muted"
                      )}
                      onClick={(e) => { e.stopPropagation(); setIsRecurring(!isRecurring); }}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                        isRecurring ? "translate-x-6" : "translate-x-1"
                      )} />
                    </button>
                  </div>

                  {isRecurring && (
                    <div className="space-y-4 pt-2 border-t border-border">
                      <div>
                        <p className="text-sm font-medium mb-2">Data inizio ricorrenza</p>
                        <Input
                          type="date"
                          min={minDate}
                          value={recurringStartDate}
                          onChange={(e) => setRecurringStartDate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Le prenotazioni verranno create a partire da questa data
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Giorni della settimana</p>
                        <div className="flex flex-wrap gap-2">
                          {DAY_NAMES.map((name, index) => {
                            const isWeekend = index === 0 || index === 6;
                            const isDisabled = newServiceType === 'asilo' && isWeekend;
                            return (
                              <button
                                key={index}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => toggleDay(index)}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all",
                                  selectedDays.includes(index)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border bg-card hover:border-primary/50",
                                  isDisabled && "opacity-40 cursor-not-allowed hover:border-border"
                                )}
                              >
                                {name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Numero di settimane</p>
                        <div className="flex gap-2">
                          {[2, 3, 4, 5, 6, 7, 8].map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setNumWeeks(w)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all",
                                numWeeks === w
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border bg-card hover:border-primary/50"
                              )}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>

                      {recurringDates.length > 0 && (
                        <div className="bg-primary/5 rounded-lg p-3">
                          <p className="text-sm font-medium mb-2">
                            {recurringDates.length} date selezionate:
                          </p>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {recurringDates.map((date) => (
                              <span
                                key={date}
                                className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md"
                              >
                                {formatDateShort(date)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!isRecurring && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={newForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Inizio *</FormLabel>
                          <FormControl>
                            <Input type="date" min={minDate} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={newForm.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Fine *</FormLabel>
                          <FormControl>
                            <Input type="date" min={newForm.watch('startDate') || minDate} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={newForm.control}
                    name="exactEntryTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario Esatto Arrivo *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newForm.control}
                    name="exactExitTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orario Esatto Ritiro *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowNewDialog(false)}
                  >
                    Annulla
                  </Button>
                  <Button
                    type="submit"
                    disabled={isNewPending || (isRecurring && recurringDates.length === 0)}
                  >
                    {isNewPending
                      ? "Creazione..."
                      : isRecurring
                        ? `Crea ${recurringDates.length} Prenotazioni`
                        : "Crea Prenotazione"
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Batch Result Dialog */}
        <Dialog open={showBatchResultDialog} onOpenChange={setShowBatchResultDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Risultato Prenotazioni Ricorrenti</DialogTitle>
            </DialogHeader>
            {batchResult && (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    {batchResult.created.length} prenotazioni create
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {batchResult.created.map((b) => (
                      <span key={b.id} className="text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 px-2 py-1 rounded-md">
                        {formatDateShort(b.startDate)}
                      </span>
                    ))}
                  </div>
                </div>
                {batchResult.skipped.length > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                      {batchResult.skipped.length} date saltate:
                    </p>
                    <div className="space-y-1">
                      {batchResult.skipped.map((s, i) => (
                        <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                          <XCircle size={12} className="text-orange-500" />
                          {formatDateShort(s.date)} - {s.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button onClick={() => setShowBatchResultDialog(false)} className="w-full">
                  Chiudi
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Notification Dialog for new bookings */}
      <AlertDialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6 text-primary" />
              </div>
              <AlertDialogTitle className="text-2xl">Nuova Prenotazione!</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base space-y-4 pt-4">
              {newBookingData && (
                <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nome Cane</p>
                      <p className="text-lg font-semibold text-foreground">{newBookingData.dogName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Proprietario</p>
                      <p className="text-lg font-semibold text-foreground">{newBookingData.ownerName}</p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Servizio</p>
                        <p className="text-base font-medium text-foreground">
                          {newBookingData.serviceType === 'asilo' ? '☀️ Asilo' : '🏨 Pensione'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="text-base font-medium text-foreground">
                          {format(new Date(newBookingData.startDate), 'dd/MM/yyyy', { locale: it })}
                          {newBookingData.endDate && newBookingData.endDate !== newBookingData.startDate &&
                            ` - ${format(new Date(newBookingData.endDate), 'dd/MM/yyyy', { locale: it })}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Orario Arrivo</p>
                        <p className="text-base font-medium text-foreground">
                          {newBookingData.entryTime}
                          {newBookingData.exactEntryTime && ` (${newBookingData.exactEntryTime})`}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Orario Ritiro</p>
                        <p className="text-base font-medium text-foreground">
                          {newBookingData.exitTime}
                          {newBookingData.exactExitTime && ` (${newBookingData.exactExitTime})`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="w-full sm:w-auto"
              onClick={() => setShowNotificationDialog(false)}
              data-testid="button-close-notification"
            >
              Ho Capito!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}
