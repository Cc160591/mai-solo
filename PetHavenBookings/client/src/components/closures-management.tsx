import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Closure } from "@shared/schema";
import { insertClosureRangeSchema } from "@shared/schema";

type ClosureFormData = z.infer<typeof insertClosureRangeSchema>;

export function ClosuresManagement() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data: closures, isLoading } = useQuery<Closure[]>({
    queryKey: ["/api/admin/closures"],
  });

  const form = useForm<ClosureFormData>({
    resolver: zodResolver(insertClosureRangeSchema),
    defaultValues: {
      startDate: "",
      endDate: "",
      type: "both",
      reason: "",
    },
  });

  // Auto-sync endDate with startDate when startDate changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'startDate' && value.startDate) {
        const currentEndDate = value.endDate;
        // If endDate is empty or before startDate, sync it with startDate
        if (!currentEndDate || currentEndDate < value.startDate) {
          form.setValue('endDate', value.startDate);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const createClosureMutation = useMutation({
    mutationFn: async (data: ClosureFormData) => {
      const res = await apiRequest("POST", "/api/admin/closures", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/closures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      const count = data.count || 1;
      toast({
        title: "Chiusura aggiunta",
        description: count > 1 
          ? `${count} giorni di chiusura aggiunti con successo`
          : "La chiusura è stata aggiunta con successo",
      });
      form.reset();
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiungere la chiusura",
        variant: "destructive",
      });
    },
  });

  const deleteClosureMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/admin/closures/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/closures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      toast({
        title: "Chiusura eliminata",
        description: "La chiusura è stata eliminata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eliminare la chiusura",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ClosureFormData) => {
    createClosureMutation.mutate(data);
  };

  const handleDelete = (id: number, date: string) => {
    if (confirm(`Sei sicuro di voler eliminare la chiusura del ${format(new Date(date), "dd MMMM yyyy", { locale: it })}?`)) {
      deleteClosureMutation.mutate(id);
    }
  };

  const sortedClosures = closures ? [...closures].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  }) : [];

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'asilo':
        return 'Solo Asilo';
      case 'pensione':
        return 'Solo Pensione';
      case 'both':
        return 'Entrambi';
      default:
        return type;
    }
  };

  const getTypeVariant = (type: string): "default" | "secondary" | "destructive" => {
    switch (type) {
      case 'both':
        return 'destructive';
      case 'pensione':
        return 'default';
      case 'asilo':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestione Chiusure</CardTitle>
            <CardDescription>
              Imposta i giorni di chiusura del centro
            </CardDescription>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            data-testid="button-toggle-closure-form"
          >
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Annulla" : "Aggiungi Chiusura"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showForm && (
          <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Inizio</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            data-testid="input-closure-start-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Fine</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            data-testid="input-closure-end-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo Chiusura</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-closure-type">
                              <SelectValue placeholder="Seleziona tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="both">Entrambi (Asilo + Pensione)</SelectItem>
                            <SelectItem value="asilo">Solo Asilo</SelectItem>
                            <SelectItem value="pensione">Solo Pensione</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motivo (opzionale)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Es: Festività, Manutenzione..."
                            data-testid="input-closure-reason"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={createClosureMutation.isPending}
                  data-testid="button-submit-closure"
                >
                  {createClosureMutation.isPending ? "Aggiunta in corso..." : "Aggiungi Chiusura"}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">Caricamento...</div>
        ) : sortedClosures.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nessuna chiusura programmata
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo Chiusura</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedClosures.map((closure) => (
                  <TableRow key={closure.id} data-testid={`row-closure-${closure.id}`}>
                    <TableCell className="font-medium" data-testid={`text-closure-date-${closure.id}`}>
                      {format(new Date(closure.date), "dd MMMM yyyy", { locale: it })}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={getTypeVariant(closure.type)}
                        data-testid={`badge-closure-type-${closure.id}`}
                      >
                        {getTypeLabel(closure.type)}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-closure-reason-${closure.id}`}>
                      {closure.reason || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(closure.id, closure.date)}
                        disabled={deleteClosureMutation.isPending}
                        data-testid={`button-delete-closure-${closure.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
