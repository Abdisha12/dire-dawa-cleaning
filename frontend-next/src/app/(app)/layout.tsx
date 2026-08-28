import { AuthProvider } from "@/lib/auth-context";
import { KebeleProvider } from "@/lib/kebele-context";
import { AppShell } from "@/components/layout/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <KebeleProvider>
        <AppShell>{children}</AppShell>
      </KebeleProvider>
    </AuthProvider>
  );
}
