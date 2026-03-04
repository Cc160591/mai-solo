import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

export default function Calendar({ selectedDate, onDateSelect }: CalendarProps) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const { data: calendarData, isLoading } = useQuery({
    queryKey: ["/api/calendar", currentDate.getFullYear(), currentDate.getMonth() + 1],
    queryFn: () => api.getCalendarData(currentDate.getFullYear(), currentDate.getMonth() + 1),
  });

  const monthNames = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getAvailabilityColor = (available: number) => {
    if (available >= 3) return "bg-green-500";
    if (available === 2) return "bg-yellow-500";
    if (available === 1) return "bg-red-500";
    return "bg-gray-500";
  };

  const getAvailabilityTextColor = (available: number) => {
    if (available >= 3) return "text-green-700";
    if (available === 2) return "text-yellow-700";
    if (available === 1) return "text-red-700";
    return "text-gray-700";
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get first day of week (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // Convert to Monday = 0
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const isDateDisabled = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date <= today;
  };

  const formatDate = (day: number) => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const days = getDaysInMonth();

  return (
    <Card className="bg-card rounded-xl shadow-md border border-border overflow-hidden">
      <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="text-primary" size={24} />
            Calendario Disponibilità
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              data-testid="button-previous-month"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="font-semibold px-4" data-testid="text-current-month">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>3-9 posti</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded"></div>
              <span>2 posti</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>1 posto</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-500 rounded"></div>
              <span>Completo</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-red-600 dark:text-red-400 font-bold">✕</span>
              <span>Chiuso</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Ogni giorno mostra disponibilità per mattina (M) e pomeriggio (P)
          </div>
        </div>
      </div>
      
      <CardContent className="p-6">
        {/* Days of week */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {dayNames.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="h-20 md:h-24"></div>;
            }
            
            const date = formatDate(day);
            const isDisabled = isDateDisabled(day);
            const isSelected = date === selectedDate;
            const dayData = calendarData?.days.find(d => d.date === date);
            const morning = dayData?.morning ?? 0;
            const afternoon = dayData?.afternoon ?? 0;
            const closures = (dayData as any)?.closures || [];
            const hasClosure = closures.length > 0;
            const hasAsiloClosure = closures.some((c: any) => c.type === 'asilo' || c.type === 'both');
            const hasPensioneClosure = closures.some((c: any) => c.type === 'pensione' || c.type === 'both');
            // A day is fully closed if there's a 'both' closure OR if there are separate asilo and pensione closures
            const hasFullClosure = closures.some((c: any) => c.type === 'both') || (hasAsiloClosure && hasPensioneClosure);
            
            return (
              <div
                key={day}
                className={cn(
                  "relative h-20 md:h-24 border border-border rounded-lg overflow-hidden transition-all duration-200 cursor-pointer",
                  isDisabled && "opacity-50 cursor-not-allowed bg-muted",
                  hasFullClosure && "bg-red-100 dark:bg-red-950 opacity-60",
                  isSelected && "ring-2 ring-primary shadow-lg",
                  !isDisabled && !hasFullClosure && "hover:shadow-md hover:scale-105"
                )}
                onClick={() => !isDisabled && !hasFullClosure && onDateSelect(date)}
                data-testid={`calendar-day-${date}`}
              >
                {/* Day number */}
                <div className={cn(
                  "absolute top-1 left-1 text-xs font-medium z-10",
                  isSelected && "text-primary",
                  isDisabled && "text-muted-foreground",
                  hasFullClosure && "text-red-600 dark:text-red-400"
                )}>
                  {day}
                </div>
                
                {/* Closure indicator */}
                {hasClosure && (
                  <div className="absolute top-1 right-1 text-xs font-bold text-red-600 dark:text-red-400 z-10">
                    ✕
                  </div>
                )}
                
                {!isDisabled ? (
                  hasFullClosure ? (
                    <div className="h-full flex items-center justify-center">
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">
                        CHIUSO
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* Morning (top half) */}
                      <div className={cn(
                        "h-1/2 flex items-center justify-center border-b border-border/50",
                        hasAsiloClosure ? "bg-red-100 dark:bg-red-950/50" : "bg-white/50"
                      )}>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-muted-foreground font-medium">M</span>
                          {hasAsiloClosure ? (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400">✕</span>
                          ) : (
                            <span 
                              className={cn(
                                "w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold",
                                getAvailabilityColor(morning)
                              )}
                              data-testid={`availability-morning-${date}`}
                            >
                              {isLoading ? "?" : morning}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Afternoon (bottom half) */}
                      <div className={cn(
                        "h-1/2 flex items-center justify-center",
                        hasPensioneClosure ? "bg-red-100 dark:bg-red-950/50" : "bg-white/30"
                      )}>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-muted-foreground font-medium">P</span>
                          {hasPensioneClosure ? (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400">✕</span>
                          ) : (
                            <span 
                              className={cn(
                                "w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold",
                                getAvailabilityColor(afternoon)
                              )}
                              data-testid={`availability-afternoon-${date}`}
                            >
                              {isLoading ? "?" : afternoon}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )
                ) : (
                  <div className="h-full"></div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
