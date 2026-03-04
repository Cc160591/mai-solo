import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, ChevronRight, ChevronLeft, CalendarDays, ClipboardList, ListChecks, PawPrint } from "lucide-react";

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position: "top" | "bottom" | "left" | "right" | "center";
}

const tourSteps: TourStep[] = [
  {
    targetSelector: "[data-tour-step='hero']",
    title: "Benvenuto al Centro Cinofilo Mai Solo!",
    description: "Qui puoi prenotare un posto per il tuo cane nel nostro asilo giornaliero o nella pensione. Ti guidiamo passo passo nel processo di prenotazione.",
    icon: <PawPrint className="w-6 h-6" />,
    position: "bottom",
  },
  {
    targetSelector: "[data-tour-step='calendar']",
    title: "Calendario Disponibilit\u00e0",
    description: "Qui vedi la disponibilit\u00e0 per ogni giorno. Ogni giorno \u00e8 diviso in Mattina (M) e Pomeriggio (P). I colori indicano i posti liberi: verde = tanti posti, giallo = pochi, rosso = quasi pieno, grigio = completo. Clicca su un giorno per selezionarlo.",
    icon: <CalendarDays className="w-6 h-6" />,
    position: "right",
  },
  {
    targetSelector: "[data-tour-step='booking-form']",
    title: "Modulo di Prenotazione",
    description: "Compila questo modulo per prenotare. Inserisci il nome del cane, il tuo nome, la tua email, scegli il tipo di servizio (Asilo o Pensione), le date e gli orari di entrata e uscita.",
    icon: <ClipboardList className="w-6 h-6" />,
    position: "left",
  },
  {
    targetSelector: "[data-tour-step='daily-bookings']",
    title: "Prenotazioni del Giorno",
    description: "Qui puoi vedere le prenotazioni gi\u00e0 fatte per il giorno selezionato. Le tue prenotazioni mostrano tutti i dettagli, mentre quelle di altri utenti sono riservate per privacy.",
    icon: <ListChecks className="w-6 h-6" />,
    position: "top",
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingTour({ isOpen, onClose }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const updateTargetRect = useCallback(() => {
    const step = tourSteps[currentStep];
    const target = document.querySelector(step.targetSelector);
    if (target) {
      setTargetRect(target.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  const positionTooltip = useCallback(() => {
    const step = tourSteps[currentStep];
    const target = document.querySelector(step.targetSelector);

    if (!target) {
      setTooltipStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const rect = target.getBoundingClientRect();
    const tooltipWidth = 380;
    const tooltipHeight = 250;
    const gap = 16;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case "center":
        top = window.innerHeight / 2 - tooltipHeight / 2;
        left = window.innerWidth / 2 - tooltipWidth / 2;
        break;
    }

    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setTooltipStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
    });
  }, [currentStep]);

  useEffect(() => {
    if (!isOpen) return;

    const step = tourSteps[currentStep];
    const target = document.querySelector(step.targetSelector);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        updateTargetRect();
        positionTooltip();
        cardRef.current?.focus();
      }, 400);
    } else {
      updateTargetRect();
      positionTooltip();
      cardRef.current?.focus();
    }

    const handleResizeOrScroll = () => {
      updateTargetRect();
      positionTooltip();
    };
    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
    };
  }, [currentStep, isOpen, positionTooltip, updateTargetRect]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("onboardingComplete", "true");
    setCurrentStep(0);
    onClose();
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isOpen) return null;

  const step = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" aria-label="Tutorial guidato">
      <svg className="fixed inset-0 w-full h-full" style={{ pointerEvents: "none" }} aria-hidden="true">
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#tour-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={handleSkip}
        />
      </svg>

      {targetRect && (
        <div
          className="fixed border-2 border-primary rounded-xl pointer-events-none"
          aria-hidden="true"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: "0 0 0 4px rgba(139, 92, 246, 0.3)",
            zIndex: 10000,
          }}
        />
      )}

      <Card
        ref={cardRef}
        tabIndex={-1}
        className="shadow-2xl border-2 border-primary/20 z-[10001] outline-none"
        style={tooltipStyle}
        aria-live="polite"
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 text-primary">
              {step.icon}
              <span className="text-xs font-medium text-muted-foreground">
                {currentStep + 1} / {tourSteps.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleSkip}
              aria-label="Chiudi tutorial"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <h3 className="font-bold text-lg mb-2">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {step.description}
          </p>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Salta
            </Button>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Indietro
                </Button>
              )}
              <Button size="sm" onClick={handleNext}>
                {currentStep === tourSteps.length - 1 ? (
                  "Fine"
                ) : (
                  <>
                    Avanti
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex justify-center gap-1.5 mt-3" aria-hidden="true">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all ${
                  index === currentStep
                    ? "w-6 bg-primary"
                    : index < currentStep
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
