import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";

export default async function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin/");
  }
  return children;
}
