import { ChevronRight, Home } from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function PublicBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
      <a href={`${BASE}/`} className="flex items-center hover:text-primary transition-colors">
        <Home className="size-4" />
      </a>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="size-4 shrink-0" />
          {item.href ? (
            <a href={`${BASE}${item.href}`} className="hover:text-primary transition-colors">
              {item.label}
            </a>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
