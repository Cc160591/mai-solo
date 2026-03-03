import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, Mail, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function IdentifyEmailDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('userEmail');
    setSavedEmail(stored);
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const normalizedEmail = email.toLowerCase().trim();
    localStorage.setItem('userEmail', normalizedEmail);
    setSavedEmail(normalizedEmail);
    
    window.dispatchEvent(new Event('storage'));
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    
    toast({
      title: "Email salvata",
      description: "Ora puoi vedere i dettagli delle tue prenotazioni.",
    });
    
    setEmail("");
    setIsOpen(false);
  };

  const handleClear = () => {
    localStorage.removeItem('userEmail');
    setSavedEmail(null);
    
    window.dispatchEvent(new Event('storage'));
    queryClient.invalidateQueries({ queryKey: ['/api/bookings'] });
    
    toast({
      title: "Email rimossa",
      description: "I dettagli delle prenotazioni sono ora nascosti.",
    });
  };

  return (
    <Card className="bg-card/50 border border-border rounded-xl mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <KeyRound className="text-primary" size={18} />
            </div>
            <div>
              {savedEmail ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Identificato come: <span className="text-primary">{savedEmail}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Puoi vedere i dettagli delle tue prenotazioni
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Vuoi vedere le tue prenotazioni?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Inserisci la tua email per visualizzare i dettagli
                  </p>
                </>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {savedEmail && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="gap-1"
                data-testid="button-clear-email"
              >
                <X size={14} />
                Rimuovi
              </Button>
            )}
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  variant={savedEmail ? "outline" : "default"}
                  size="sm"
                  className="gap-2"
                  data-testid="button-identify-email"
                >
                  <Mail size={14} />
                  {savedEmail ? "Cambia email" : "Identifica"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" data-testid="dialog-identify-email">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <KeyRound className="text-primary" size={20} />
                    Identifica le tue prenotazioni
                  </DialogTitle>
                  <DialogDescription>
                    Inserisci l'email che hai usato per prenotare. 
                    Potrai vedere i dettagli delle tue prenotazioni.
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">La tua email</label>
                    <Input
                      type="email"
                      placeholder="es. mario.rossi@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="input-identify-email"
                      required
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                    >
                      Annulla
                    </Button>
                    <Button
                      type="submit"
                      className="gap-2"
                      data-testid="button-confirm-identify"
                    >
                      <Check size={14} />
                      Conferma
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
