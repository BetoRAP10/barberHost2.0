import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <a href={`${BASE}/`} className="flex items-center gap-2 font-semibold text-primary">
          <Scissors className="size-6" />
          <span>BarberHost</span>
        </a>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <a href={`${BASE}/`}>Servicios</a>
          </Button>
          <Button variant="ghost" asChild>
            <a href={`${BASE}/mis-citas/`}>Mis Citas</a>
          </Button>
          <Button asChild>
            <a href={`${BASE}/reservar/`}>Reservar Cita</a>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/30 py-8">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} BarberHost — Tu barbería de confianza</p>
      </div>
    </footer>
  );
}
