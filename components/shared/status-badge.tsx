import { ESTADOS_CITA, type EstadoCita } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function EstadoBadge({ estado }: { estado: EstadoCita }) {
  const label = ESTADOS_CITA.find((e) => e.value === estado)?.label ?? estado;
  const variant =
    estado === "confirmada"
      ? "default"
      : estado === "completada"
        ? "success"
        : estado === "cancelada"
          ? "destructive"
          : "secondary";

  return <Badge variant={variant}>{label}</Badge>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function LoadingState({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
