import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, dashboardPathForRole } from "@/lib/auth-context";
import { CareLogo } from "@/components/CareLogo";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
    } else if (profile) {
      navigate({ to: dashboardPathForRole(profile.role) });
    }
  }, [loading, user, profile, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-5 px-4">
      <CareLogo size={96} />
      <div className="text-center">
        <h1 className="font-heading font-bold text-2xl text-foreground">CARE System</h1>
        <p className="text-sm text-muted-foreground mt-1">Loading CARE System…</p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 bg-primary animate-pulse rounded-full" />
      </div>
    </div>
  );
}
