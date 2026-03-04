import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { insertBookingSchema, type InsertBooking } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Dog, User, Calendar, Clock, Info, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkClosureConflicts, formatShortDate } from "@shared/utils";

interface BookingFormProps {
  selectedDate: string;
}

const timeSlots = {
  entry: ['7:30', '8:00-9:00', '13:30-14:00'] as const,
  exit: ['8:00-9:00', '11:30-12:00', '17:00-18:00'] as const,
};

export default function BookingForm({ selectedDate }: BookingFormProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get saved email from localStorage
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

  // Watch form values
  const formStartDate = form.watch('startDate');
  const formEndDate = form.watch('endDate');
  const formServiceType = form.watch('serviceType');
  const formEntryTime = form.watch('entryTime');
  const formExitTime = form.watch('exitTime');

  // Fetch closures for the date range
  const { data: closures } = useQuery<any[]>({
    queryKey: ["/api/closures/range", formStartDate, formEndDate],
    queryFn: async () => {
      if (!formStartDate || !formEndDate) return [];
      const response = await fetch(`/api/closures/range/${formStartDate}/${formEndDate}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error('Failed to fetch closures');
      return response.json();
    },
    enabled: !!(formStartDate && formEndDate),
  });

  // Check for closure conflicts in the booking range
  const closureConflict = formStartDate && formEndDate && closures ? 
    checkClosureConflicts(
      formStartDate,
      formEndDate,
      formServiceType as 'asilo' | 'pensione',
      closures
    ) : { hasConflict: false, conflictDates: [] };

  // Update startDate when selectedDate changes
  useEffect(() => {
    form.setValue('startDate', selectedDate);
    form.setValue('endDate', selectedDate);
  }, [selectedDate, form]);

  // Auto-update endDate when startDate changes
  useEffect(() => {
    const startDate = form.watch('startDate');
    const endDate = form.watch('endDate');
    
    // If endDate is empty or before startDate, set it to startDate
    if (!endDate || endDate < startDate) {
      form.setValue('endDate', startDate);
    }
  }, [formStartDate, form]);

  const createBookingMutation = useMutation({
    mutationFn: api.createBooking,
    onSuccess: (booking) => {
      // Save email to localStorage for privacy-based booking identification
      if (booking.email) {
        localStorage.setItem('userEmail', booking.email);
      }
      setConfirmedBooking(booking);
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

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    setConfirmedBooking(null);
    // Reset form after closing modal (keep the email)
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

  const onSubmit = (data: InsertBooking) => {
    // Validation is done via closureConflict check and disabled submit button
    // Backend will also validate and reject if there are conflicts
    createBookingMutation.mutate(data);
  };

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

  // Get tomorrow's date for min attribute
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

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
          {/* Closure Conflict Warning */}
          {closureConflict.hasConflict && (
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
              
              {/* Dog Name */}
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

              {/* Owner Name */}
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

              {/* Email */}
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

              {/* Service Type */}
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo di Servizio <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <RadioGroup 
                        onValueChange={field.onChange} 
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

              {/* Start Date */}
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

              {/* End Date (required) */}
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

              {/* Entry Time */}
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
                          onClick={() => form.setValue('entryTime', time as any)}
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

              {/* Exact Entry Time */}
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

              {/* Exit Time */}
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
                          onClick={() => form.setValue('exitTime', time as any)}
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

              {/* Exact Exit Time */}
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

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={createBookingMutation.isPending || closureConflict.hasConflict}
                data-testid="button-submit-booking"
              >
                <CheckCircle size={16} className="mr-2" />
                {createBookingMutation.isPending ? "Prenotando..." : "Conferma Prenotazione"}
              </Button>

              {/* Info Alert */}
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

      {/* Confirmation Modal */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-lg" data-testid="dialog-confirmation">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="text-primary" size={24} />
              Prenotazione Confermata
            </DialogTitle>
          </DialogHeader>
          
          {confirmedBooking && (
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
                    <p className="font-medium text-accent-foreground mb-1">Cosa portare:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Libretto sanitario aggiornato</li>
                      <li>• Ciotola personale (opzionale)</li>
                      <li>• Giochi preferiti</li>
                    </ul>
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
