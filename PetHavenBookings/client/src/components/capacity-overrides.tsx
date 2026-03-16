import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { CapacityOverride } from "@shared/schema";
import { insertCapacityOverrideSchema, type InsertCapacityOverride } from "@shared/schema";

export function CapacityOverrides() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data: overrides, isLoading } = useQuery<CapacityOverride[]>({
    queryKey: ["/api/admin/capacity-overrides"],
  });

  const form = useForm<InsertCapacityOverride>({
    resolver: zodResolver(insertCapacityOverrideSchema),
    defaultValues: {
      date: "",
      morningCapacity: 9,
      afternoonCapacity: 9,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCapacityOverride) => {
      const res = await apiRequest("POST", "/api/admin/capacity-overrides", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/capacity-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      toast({ title: "Override salvato", description: "La disponibilità per il giorno selezionato è stata aggiornata." });
      form.reset({ date: "", morningCapacity: 9, afternoonCapacity: 9, notes: "" });
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare l'override", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/admin/capacity-overrides/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/capacity-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar"] });
      toast({ title: "Override eliminato", description: "La capacità standard è stata ripristinata." });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile eliminare l'override", variant: "destructive" });
    },
  });

  const onSubmit = (data: InsertCapacityOverride) => {
    createMutation.mutate(data);
  };

  const handleDelete = (id: number, date: string) => {
    if (confirm(`Ripristinare la capacità standard per il ${format(new Date(date), "dd MMMM yyyy", { locale: it })}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const sortedOverrides = overrides
    ? [...overrides].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestione Posti Disponibili</CardTitle>
            <CardDescription>
              Riduci i posti disponibili per un giorno specifico senza creare una prenotazione
            </CardDescription>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Annulla" : "Modifica Posti"}
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
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="morningCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posti Mattina (0–9)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            max={9}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="afternoonCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Posti Pomeriggio (0–9)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            max={9}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note (opzionale)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Es: Fido e Rex incompatibili" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">Caricamento...</div>
        ) : sortedOverrides.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nessuna modifica alla capacità impostata
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Posti Mattina</TableHead>
                  <TableHead>Posti Pomeriggio</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOverrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell className="font-medium">
                      {format(new Date(override.date), "dd MMMM yyyy", { locale: it })}
                    </TableCell>
                    <TableCell>
                      <span className={override.morningCapacity < 9 ? "text-amber-600 font-semibold" : ""}>
                        {override.morningCapacity} / 9
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={override.afternoonCapacity < 9 ? "text-amber-600 font-semibold" : ""}>
                        {override.afternoonCapacity} / 9
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500">{override.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(override.id, override.date)}
                        disabled={deleteMutation.isPending}
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
