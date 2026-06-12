"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

type CalendarProps = DayPickerProps & {
  className?: string;
};

export function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={es}
      className={cn("rounded-lg border p-3 bg-card", className)}
      modifiersClassNames={{
        selected: "bg-primary text-primary-foreground rounded-md",
        today: "font-bold text-primary",
        disabled: "opacity-30 cursor-not-allowed",
        ...props.modifiersClassNames,
      }}
      {...props}
    />
  );
}
