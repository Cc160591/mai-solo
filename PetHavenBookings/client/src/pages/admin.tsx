import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { LogOut, Trash2, Calendar, Bell, Edit } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBookingSchema, type Booking, type InsertBooking } from "@shared/schema";
import { ClosuresManagement } from "@/components/closures-management";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [newBookingData, setNewBookingData] = useState<any>(null);

  const { data: adminStatus } = useQuery<{ isAdmin: boolean }>({
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
      toast({
        title: "Logout effettuato",
        description: "Sei stato disconnesso dall'area admin",
      });
      setLocation("/");
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

  const editForm = useForm<InsertBooking>({
    resolver: zodResolver(insertBookingSchema),
    defaultValues: {
      dogName: '',
      ownerName: '',
      serviceType: 'asilo',
      startDate: '',
      endDate: '',
      entryTime: '7:30',
      exitTime: '11:30-12:00',
      exactEntryTime: '',
      exactExitTime: '',
    },
  });

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

  if (!adminStatus?.isAdmin) {
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
      serviceType: booking.serviceType as 'asilo' | 'pensione',
      startDate: booking.startDate,
      endDate: booking.endDate || booking.startDate,
      entryTime: booking.entryTime as any,
      exitTime: booking.exitTime as any,
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

  const sortedBookings = bookings ? [...bookings].sort((a, b) => {
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  }) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Dashboard Amministrativa
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Centro Cinofilo Mai Solo
            </p>
          </div>
          <div className="flex gap-2">
            {notifications.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setNotifications([])}
                data-testid="button-clear-notifications"
              >
                <Bell className="h-4 w-4 mr-2" />
                {notifications.length} nuove
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-view-calendar"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Visualizza Calendario
            </Button>
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="bookings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bookings" data-testid="tab-bookings">
              Prenotazioni
            </TabsTrigger>
            <TabsTrigger value="closures" data-testid="tab-closures">
              Chiusure
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tutte le Prenotazioni</CardTitle>
                <CardDescription>
                  Gestisci e visualizza tutte le prenotazioni
                </CardDescription>
              </CardHeader>
              <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Caricamento...</div>
            ) : sortedBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nessuna prenotazione trovata
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Cane</TableHead>
                      <TableHead>Proprietario</TableHead>
                      <TableHead>Servizio</TableHead>
                      <TableHead>Data Inizio</TableHead>
                      <TableHead>Data Fine</TableHead>
                      <TableHead>Entrata</TableHead>
                      <TableHead>Uscita</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBookings.map((booking) => (
                      <TableRow key={booking.id} data-testid={`row-booking-${booking.id}`}>
                        <TableCell className="font-medium">{booking.id}</TableCell>
                        <TableCell data-testid={`text-dog-${booking.id}`}>
                          {booking.dogName}
                        </TableCell>
                        <TableCell data-testid={`text-owner-${booking.id}`}>
                          {booking.ownerName}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={booking.serviceType === 'pensione' ? 'default' : 'secondary'}
                            data-testid={`badge-service-${booking.id}`}
                          >
                            {booking.serviceType === 'pensione' ? 'Pensione' : 'Asilo'}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-start-date-${booking.id}`}>
                          {format(new Date(booking.startDate), "dd MMM yyyy", { locale: it })}
                        </TableCell>
                        <TableCell data-testid={`text-end-date-${booking.id}`}>
                          {booking.endDate 
                            ? format(new Date(booking.endDate), "dd MMM yyyy", { locale: it })
                            : '-'
                          }
                        </TableCell>
                        <TableCell data-testid={`text-entry-${booking.id}`}>
                          {booking.entryTime}
                          {booking.exactEntryTime && (
                            <span className="text-xs text-gray-500 block">
                              ({booking.exactEntryTime})
                            </span>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-exit-${booking.id}`}>
                          {booking.exitTime}
                          {booking.exactExitTime && (
                            <span className="text-xs text-gray-500 block">
                              ({booking.exactExitTime})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(booking)}
                              data-testid={`button-edit-${booking.id}`}
                            >
                              <Edit className="h-4 w-4 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(booking.id, booking.dogName)}
                              disabled={deleteBookingMutation.isPending}
                              data-testid={`button-delete-${booking.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="closures" className="space-y-4">
            <ClosuresManagement />
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
