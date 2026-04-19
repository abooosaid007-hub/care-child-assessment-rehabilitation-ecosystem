import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, dashboardPathForRole } from "@/lib/auth-context";
import { CareLogo } from "@/components/CareLogo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administrator Dashboard — CARE" }],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, profile, profileError, loading, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (profile && profile.role !== "administrator") {
      navigate({ to: dashboardPathForRole(profile.role) });
    }
  }, [loading, user, profile, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (user && profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full bg-card border border-destructive/30 rounded-xl p-6 text-center">
          <h1 className="text-lg font-heading font-semibold text-destructive">
            Account setup incomplete
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{profileError}</p>
          <Button onClick={signOut} variant="outline" className="mt-4">
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== "administrator") return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CareLogo size={36} />
            <div>
              <p className="font-heading font-semibold text-primary leading-tight">CARE</p>
              <p className="text-xs text-muted-foreground leading-tight">
                Child Assessment and Rehabilitation Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
              Administrator
            </span>
            <Button onClick={signOut} variant="outline" size="sm">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-heading font-bold text-primary">
          Welcome, {profile.full_name ?? profile.email}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Milestone 1 complete — login and role-based redirect are working. Milestone 2
          (dashboard stats, student list, quick actions) will be built next.
        </p>
      </main>
    </div>
  );
}
