import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, dashboardPathForRole } from "@/lib/auth-context";
import { CareLogo } from "@/components/CareLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — CARE" },
      { name: "description", content: "Sign in to CARE — Child Assessment and Rehabilitation Engine." },
    ],
  }),
  component: LoginPage,
});

type Lang = "en" | "ur";

function LoginPage() {
  const navigate = useNavigate();
  const { user, profile, profileError, loading } = useAuth();
  const [lang, setLang] = useState<Lang>("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If a session+profile already exists, redirect to that role's dashboard
  useEffect(() => {
    if (!loading && user && profile) {
      navigate({ to: dashboardPathForRole(profile.role) });
    }
  }, [loading, user, profile, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    // Auth listener in AuthProvider will load the profile; the effect above will redirect.
  };

  const t = (en: string, ur: string) => (lang === "en" ? en : ur);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <CareLogo size={36} />
          <span className="font-heading font-semibold text-primary">CARE</span>
        </div>
        <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-sm shadow-sm">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-3 py-1 rounded-full transition-colors ${
              lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
            aria-pressed={lang === "en"}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("ur")}
            className={`px-3 py-1 rounded-full transition-colors ${
              lang === "ur" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
            aria-pressed={lang === "ur"}
          >
            اردو
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center text-center mb-8">
            <CareLogo size={64} />
            <h1 className="mt-5 text-3xl font-heading font-bold tracking-tight text-primary">
              CARE
            </h1>
            <p className="mt-2 text-sm font-medium text-foreground">
              {t(
                "Child Assessment and Rehabilitation Engine",
                "Child Assessment and Rehabilitation Engine"
              )}
            </p>
            <p
              className="mt-1 text-base text-muted-foreground"
              dir="rtl"
              lang="ur"
              style={{ fontFamily: "'Noto Nastaliq Urdu', serif" }}
            >
              بچوں کی تشخیص اور بحالی کا نظام
            </p>
          </div>

          <div
            className="bg-card rounded-2xl p-6 sm:p-8 border border-border"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">{t("Email", "ای میل")}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("Password", "پاس ورڈ")}</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {errorMsg}
                </div>
              )}

              {profileError && user && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {profileError}
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-11 text-base font-medium"
              >
                {submitting ? t("Signing in…", "سائن ان…") : t("Sign in", "سائن ان")}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t(
              "New accounts are created by your administrator.",
              "نئے اکاؤنٹس آپ کے ایڈمنسٹریٹر کے ذریعے بنائے جاتے ہیں۔"
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
