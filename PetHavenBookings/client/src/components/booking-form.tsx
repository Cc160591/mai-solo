import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, type BatchBookingResult } from "@/lib/api";
import { insertBookingSchema, type InsertBooking, type Booking } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Dog, User, Calendar, Clock, Info, CheckCircle, XCircle, AlertTriangle, Repeat, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkClosureConflicts, formatShortDate } from "@shared/utils";

interface BookingFormProps {
  selectedDate: string;
}

const timeSlots = {
  entry: ['7:30', '8:00-9:00', '13:30-14:00'] as const,
  exit: ['8:00-9:00', '11:30-12:00', '17:00-18:00'] as const,
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const DAY_NAMES_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

function generateRecurringDates(startFromDate: string, selectedDays: number[], numWeeks: number): string[] {
  const dates: string[] = [];
  const [year, month, day] = startFromDate.split('-').map(Number);
  // Use local-time constructor to avoid UTC/DST offset issues
  const start = new Date(year, month - 1, day);
  start.setDate(start.getDate() - start.getDay());

  for (let week = 0; week < numWeeks; week++) {
    for (const dayOfWeek of selectedDays) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + dayOfWeek);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dateStr >= startFromDate) {
        dates.push(dateStr);
      }
    }
  }

  return dates.sort();
}

export default function BookingForm({ selectedDate }: BookingFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [batchResult, setBatchResult] = useState<BatchBookingResult | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [numWeeks, setNumWeeks] = useState(4);
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getSavedEmail = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userEmail') || '';
    }
    return '';
  };

  const form = useForm<InsertBooking>({
    resolver: zodResolver(insertBookingSchema),
    defaultValues: {
      dogName: '',
      ownerName: '',
      email: getSavedEmail(),
      serviceType: 'asilo',
      startDate: selectedDate,
      endDate: selectedDate,
      entryTime: '7:30',
      exitTime: '8:00-9:00',
      exactEntryTime: '',
      exactExitTime: '',
    },
  });

  const formStartDate = form.watch('startDate');
  const formEndDate = form.watch('endDate');
  const formServiceType = form.watch('serviceType');
  const formEntryTime = form.watch('entryTime');
  const formExitTime = form.watch('exitTime');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const effectiveRecurringStart = recurringStartDate && recurringStartDate >= minDate ? recurringStartDate : minDate;

  const recurringDates = useMemo(() => {
    if (!isRecurring || selectedDays.length === 0) return [];
    return generateRecurringDates(effectiveRecurringStart, selectedDays, numWeeks);
  }, [isRecurring, selectedDays, numWeeks, effectiveRecurringStart]);

  const effectiveStartDate = isRecurring && recurringDates.length > 0 ? recurringDates[0] : formStartDate;
  const effectiveEndDate = isRecurring && recurringDates.length > 0 ? recurringDates[recurringDates.length - 1] : formEndDate;

  const { data: closures } = useQuery<any[]>({
    queryKey: ["/api/closures/range", effectiveStartDate, effectiveEndDate],
    queryFn: async () => {
      if (!effectiveStartDate || !effectiveEndDate) return [];
      const response = await fetch(`/api/closures/range/${effectiveStartDate}/${effectiveEndDate}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error('Failed to fetch closures');
      return response.json();
    },
    enabled: !!(effectiveStartDate && effectiveEndDate),
  });

  const closureConflict = !isRecurring && formStartDate && formEndDate && closures ?
    checkClosureConflicts(
      formStartDate,
      formEndDate,
      formServiceType as 'asilo' | 'pensione',
      closures
    ) : { hasConflict: false, conflictDates: [] };

  useEffect(() => {
    form.setValue('startDate', selectedDate);
    form.setValue('endDate', selectedDate);
  }, [selectedDate, form]);

  useEffect(() => {
    const startDate = form.watch('startDate');
    const endDate = form.watch('endDate');
    if (!endDate || endDate < startDate) {
      form.setValue('endDate', startDate);
    }
  }, [formStartDate, form]);

  const createBookingMutation = useMutation({
    mutationFn: api.createBooking,
    onSuccess: (booking) => {
      if (booking.email) {
        localStorage.setItem('userEmail', booking.email);
      }
      setConfirmedBooking(booking);
      setBatchResult(null);
      setShowConfirmation(true);
      queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/availability'], refetchType: 'all' });
      toast({
        title: "Prenotazione confermata!",
        description: "La prenotazione è stata registrata con successo.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante la prenotazione.",
        variant: "destructive",
      });
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: api.createBatchBookings,
    onSuccess: (result) => {
      if (result.created.length > 0 && result.created[0].email) {
        localStorage.setItem('userEmail', result.created[0].email);
      }
      setConfirmedBooking(null);
      setBatchResult(result);
      setShowConfirmation(true);
      queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
      queryClient.invalidateQueries({ queryKey: ['/api/bookings'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['/api/availability'], refetchType: 'all' });
      toast({
        title: "Prenotazioni ricorrenti create!",
        description: result.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Si è verificato un errore durante la prenotazione.",
        variant: "destructive",
      });
    },
  });

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    setConfirmedBooking(null);
    setBatchResult(null);
    setIsRecurring(false);
    setSelectedDays([]);
    setNumWeeks(4);
    setRecurringStartDate('');
    form.reset({
      dogName: '',
      ownerName: '',
      email: getSavedEmail(),
      serviceType: 'asilo',
      startDate: selectedDate,
      endDate: selectedDate,
      entryTime: '7:30',
      exitTime: '8:00-9:00',
      exactEntryTime: '',
      exactExitTime: '',
    });
  };

  useEffect(() => {
    if (isRecurring && recurringDates.length > 0) {
      form.setValue('startDate', recurringDates[0]);
      form.setValue('endDate', recurringDates[0]);
    }
  }, [isRecurring, recurringDates, form]);

  const onSubmit = (data: InsertBooking) => {
    if (isRecurring) {
      if (recurringDates.length === 0) {
        toast({
          title: "Errore",
          description: "Seleziona almeno un giorno della settimana per la prenotazione ricorrente.",
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

  const isPending = createBookingMutation.isPending || createBatchMutation.isPending;

  const TimeSlotButton = ({
    value,
    selected,
    onClick,
    children,
    testId
  }: {
    value: string;
    selected: boolean;
    onClick: () => void;
    children: React.ReactNode;
    testId: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg border-2 border-border bg-card text-foreground transition-all duration-200 hover:border-primary hover:bg-primary/5",
        selected && "bg-primary text-primary-foreground border-primary"
      )}
      data-testid={testId}
    >
      <Clock size={14} className="inline mr-1" />
      {children}
    </button>
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <>
      <Card className="bg-card rounded-xl shadow-md border border-border sticky top-24">
        <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <PlusCircle className="text-primary" size={24} />
            Nuova Prenotazione
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Compila il modulo per prenotare</p>
        </div>

        <CardContent className="p-6">
          {!isRecurring && closureConflict.hasConflict && (
            <Alert variant="destructive" className="mb-4" data-testid="alert-closure-conflict">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Impossibile prenotare</AlertTitle>
              <AlertDescription>
                Non è possibile effettuare questa prenotazione perché ci sono giorni di chiusura nell'intervallo selezionato:
                <div className="font-semibold mt-2">
                  {closureConflict.conflictDates.map(d => formatDate(d)).join(', ')}
                </div>
                <p className="text-xs mt-2">
                  Modifica le date della prenotazione per evitare i giorni di chiusura.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              <FormField
                control={form.control}
                name="dogName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Dog size={16} />
                      Nome del Cane <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Es. Max"
                        data-testid="input-dog-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ownerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User size={16} />
                      Nome del Proprietario <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Es. Mario Rossi"
                        data-testid="input-owner-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      📧 Email <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="Es. mario.rossi@email.com"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Per visualizzare i dettagli delle tue prenotazioni
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo di Servizio <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(val) => {
                          field.onChange(val);
                          if (isRecurring && val === 'asilo') {
                            setSelectedDays(prev => prev.filter(d => d >= 1 && d <= 5));
                          }
                        }}
                        value={field.value}
                        className="space-y-3"
                      >
                        <div className="flex items-center space-x-2 p-3 border-2 border-border rounded-lg hover:border-primary transition-all">
                          <RadioGroupItem
                            value="asilo"
                            id="asilo"
                            data-testid="radio-asilo"
                          />
                          <label htmlFor="asilo" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">☀️</span>
                              <span className="font-medium">Asilo</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Servizio giornaliero (Lun-Ven)</p>
                          </label>
                        </div>

                        <div className="flex items-center space-x-2 p-3 border-2 border-border rounded-lg hover:border-primary transition-all">
                          <RadioGroupItem
                            value="pensione"
                            id="pensione"
                            data-testid="radio-pensione"
                          />
                          <label htmlFor="pensione" className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🌙</span>
                              <span className="font-medium">Pensione</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Più giorni consecutivi</p>
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                    <p className="text-xs text-muted-foreground">
                      Seleziona la data di inizio, i giorni della settimana e per quante settimane ripetere.
                    </p>

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
                          const isDisabled = formServiceType === 'asilo' && isWeekend;
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
                      {formServiceType === 'asilo' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          L'asilo è disponibile solo dal lunedì al venerdì
                        </p>
                      )}
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
                        <p className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Calendar size={14} />
                          {recurringDates.length} date selezionate:
                        </p>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
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

                    {isRecurring && selectedDays.length === 0 && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Seleziona almeno un giorno della settimana per vedere l'anteprima delle date.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>

              {!isRecurring && (
                <>
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar size={16} />
                          Data Inizio <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            min={minDate}
                            {...field}
                            data-testid="input-start-date"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Le prenotazioni sono disponibili da domani</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar size={16} />
                          Data Fine <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            min={form.watch('startDate') || minDate}
                            {...field}
                            data-testid="input-end-date"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Può essere uguale alla data di inizio per prenotazioni di un solo giorno
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="entryTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fascia Oraria di Entrata <span className="text-destructive">*</span></FormLabel>
                    <div className="grid grid-cols-3 gap-3">
                      {timeSlots.entry.map((time) => (
                        <TimeSlotButton
                          key={time}
                          value={time}
                          selected={formEntryTime === time}
                          onClick={() => form.setValue('entryTime', time)}
                          testId={`button-entry-${time}`}
                        >
                          {time}
                        </TimeSlotButton>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exactEntryTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock size={16} />
                      Orario Esatto di Arrivo <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        placeholder="Es. 8:10"
                        data-testid="input-exact-entry-time"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Specifica l'orario preciso di arrivo (es. 8:10, 8:30)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exitTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fascia Oraria di Uscita <span className="text-destructive">*</span></FormLabel>
                    <div className="grid grid-cols-3 gap-3">
                      {timeSlots.exit.map((time) => (
                        <TimeSlotButton
                          key={time}
                          value={time}
                          selected={formExitTime === time}
                          onClick={() => form.setValue('exitTime', time)}
                          testId={`button-exit-${time}`}
                        >
                          {time}
                        </TimeSlotButton>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exactExitTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock size={16} />
                      Orario Esatto di Ritiro <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        placeholder="Es. 11:45"
                        data-testid="input-exact-exit-time"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Specifica l'orario preciso di ritiro (es. 11:45, 17:30)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={isPending || (!isRecurring && closureConflict.hasConflict) || (isRecurring && recurringDates.length === 0)}
                data-testid="button-submit-booking"
              >
                <CheckCircle size={16} className="mr-2" />
                {isPending
                  ? "Prenotando..."
                  : isRecurring
                    ? `Conferma ${recurringDates.length} Prenotazioni`
                    : "Conferma Prenotazione"
                }
              </Button>

              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 flex gap-3">
                <Info className="text-accent mt-0.5" size={16} />
                <div className="text-sm text-accent-foreground">
                  <p className="font-medium mb-1">Informazioni importanti</p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>• Massimo 9 posti disponibili al giorno</li>
                    <li>• Verifica la disponibilità nel calendario</li>
                    <li>• Orari di apertura: 8:00-18:00</li>
                  </ul>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-lg" data-testid="dialog-confirmation">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="text-primary" size={24} />
              {batchResult ? "Prenotazioni Ricorrenti Confermate" : "Prenotazione Confermata"}
            </DialogTitle>
          </DialogHeader>

          {batchResult ? (
            <div className="space-y-4">
              <div className="bg-primary/5 rounded-lg p-6">
                <p className="font-semibold text-lg mb-3">
                  {batchResult.created.length} prenotazioni create
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto mb-3">
                  {batchResult.created.map((b) => (
                    <span key={b.id} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-md">
                      {formatDateShort(b.startDate)}
                    </span>
                  ))}
                </div>
                {batchResult.skipped.length > 0 && (
                  <div className="border-t border-border pt-3 mt-3">
                    <p className="text-sm font-medium text-orange-600 mb-2">
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
              </div>

              <Button
                onClick={handleCloseConfirmation}
                className="w-full"
                data-testid="button-close-confirmation"
              >
                Chiudi
              </Button>
            </div>
          ) : confirmedBooking ? (
            <div className="space-y-4">
              <div className="bg-primary/5 rounded-lg p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Dog className="text-primary" size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg" data-testid="text-confirmed-dog-name">
                      {confirmedBooking.dogName}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Proprietario: {confirmedBooking.ownerName}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-t border-border">
                    <span className="text-muted-foreground">Servizio:</span>
                    <span className="font-medium">
                      {confirmedBooking.serviceType === 'asilo' ? 'Asilo' : 'Pensione'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-border">
                    <span className="text-muted-foreground">Data:</span>
                    <span className="font-medium">
                      {confirmedBooking.endDate
                        ? `${formatDate(confirmedBooking.startDate)} - ${formatDate(confirmedBooking.endDate)}`
                        : formatDate(confirmedBooking.startDate)
                      }
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-border">
                    <span className="text-muted-foreground">Orario Entrata:</span>
                    <span className="font-medium">
                      {confirmedBooking.entryTime}
                      {confirmedBooking.exactEntryTime && (
                        <span className="ml-2 text-primary">({confirmedBooking.exactEntryTime})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-border">
                    <span className="text-muted-foreground">Orario Uscita:</span>
                    <span className="font-medium">
                      {confirmedBooking.exitTime}
                      {confirmedBooking.exactExitTime && (
                        <span className="ml-2 text-primary">({confirmedBooking.exactExitTime})</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                <div className="flex gap-3">
                  <Info className="text-accent mt-0.5" size={16} />
                  <div className="text-sm">
                    <p className="text-xs text-muted-foreground">Ricorda di portare la pappa se prevista dalla loro routine.</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCloseConfirmation}
                className="w-full"
                data-testid="button-close-confirmation"
              >
                Chiudi
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
