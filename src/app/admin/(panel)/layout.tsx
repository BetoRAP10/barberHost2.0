import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="border-b p-4 lg:hidden">
          <p className="font-semibold text-primary">BarberHost Admin</p>
        </div>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
