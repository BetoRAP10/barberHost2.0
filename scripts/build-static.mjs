/**
 * Build estático para ~/public/ (nginx).
 * Temporalmente oculta API y middleware — no compatibles con output: export.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");

const stashes = [
  ["app/api", "app/_api_stash"],
  ["middleware.ts", "middleware.ts.bak"],
  ["app/admin/(panel)/layout.tsx", "app/admin/(panel)/layout.server.tsx.bak"],
  ["app/admin/login/layout.tsx", "app/admin/login/layout.tsx.bak"],
];

const panelClientLayout = `import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminMobileNav } from "@/components/layout/admin-mobile-nav";
import { AdminGuard } from "@/components/layout/admin-guard";

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-auto">
          <AdminMobileNav />
          <main className="p-4 md:p-8">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
`;

function p(...parts) {
  return path.join(root, ...parts);
}

function exists(rel) {
  return fs.existsSync(p(rel));
}

function move(from, to) {
  if (!exists(from)) return;
  if (exists(to)) fs.rmSync(p(to), { recursive: true, force: true });
  fs.renameSync(p(from), p(to));
}

function restoreAll() {
  if (exists("app/admin/(panel)/layout.tsx") && !exists("app/admin/(panel)/layout.server.tsx.bak")) {
    // layout.tsx actual es el cliente temporal del export
    fs.rmSync(p("app/admin/(panel)/layout.tsx"), { force: true });
  }
  for (const [from, to] of [...stashes].reverse()) {
    move(to, from);
  }
}

let stashed = false;
try {
  for (const [from, to] of stashes) move(from, to);
  stashed = true;

  fs.writeFileSync(p("app/admin/(panel)/layout.tsx"), panelClientLayout, "utf8");

  console.log("> Building static export...");
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_STATIC_EXPORT: "1" },
  });
  console.log("> Static export OK → out/");

  const adminDir = p("out/admin");
  if (exists("out/admin")) {
    console.log("> out/admin incluye panel completo (protegido por AdminGuard + API)");
  }
} catch (err) {
  console.error("> Static export failed:", err.message);
  process.exitCode = 1;
} finally {
  if (stashed) restoreAll();
}
