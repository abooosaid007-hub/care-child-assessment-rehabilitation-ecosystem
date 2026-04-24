import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  studentId: string;
  studentName: string;
  priorityDomain: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

const RATINGS: { v: 1 | 2 | 3; emoji: string; label: string }[] = [
  { v: 1, emoji: "😐", label: "Low" },
  { v: 2, emoji: "🙂", label: "Medium" },
  { v: 3, emoji: "😊", label: "High" },
];
const TRIGGERS = ["Transition", "Noise", "Task", "Tired", "Home issue", "Unknown"];
const STRATEGY = ["Yes", "No", "Partially"];
const NON_COMPLIANCE_REASONS = [
  "Time constraint",
  "Child resistance",
  "Forgot",
  "Not suitable",
  "Other",
];

function PillButton({
  active,
  onClick,
  children,
  className = "",
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-md text-sm border transition-colors ${
        active
          ? "bg-teal-600 text-white border-teal-600"
          : "bg-background border-border hover:bg-muted"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function DailyLogOverlay({
  studentId,
  studentName,
  priorityDomain,
  onClose,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [rating, setRating] = useState<1 | 2 | 3 | null>(null);
  const [trigger, setTrigger] = useState<string>("");
  const [incident, setIncident] = useState<"Yes" | "No" | null>(null);
  const [incidentDesc, setIncidentDesc] = useState("");
  const [strategy, setStrategy] = useState<string>("");
  const [nonComplianceReason, setNonComplianceReason] = useState<string>("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unknownWarning, setUnknownWarning] = useState<{
    pct: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Data quality check: if >40% of last 7 days of logs used "Unknown" trigger, warn.
  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data } = await supabase
        .from("daily_logs")
        .select("context_trigger")
        .eq("student_id", studentId)
        .gte("log_date", since.toISOString().slice(0, 10));
      if (!data || data.length === 0) return;
      const unknown = data.filter((r) => r.context_trigger === "Unknown").length;
      const pct = (unknown / data.length) * 100;
      if (pct > 40) setUnknownWarning({ pct: Math.round(pct), total: data.length });
    })();
  }, [studentId]);

  const submit = async () => {
    setError(null);
    if (!user) return setError("Not authenticated.");
    if (rating === null) return setError("Please select Domain Performance.");
    if (!trigger) return setError("Please select a Context Trigger.");
    if (!incident) return setError("Please indicate if there was a behavioral incident.");
    if (!strategy) return setError("Please indicate if the intervention strategy was used.");
    if ((strategy === "No" || strategy === "Partially") && !nonComplianceReason) {
      return setError("Please select a reason the strategy was not fully used.");
    }

    setSaving(true);
    const { error: insErr } = await supabase.from("daily_logs").insert({
      student_id: studentId,
      created_by: user.id,
      log_date: today,
      domain: priorityDomain,
      rating,
      context_trigger: trigger,
      incident_yes_no: incident === "Yes",
      incident_description: incident === "Yes" ? incidentDesc || null : null,
      behavioral_incidents: incident === "Yes" ? 1 : 0,
      strategy_used: strategy,
      non_compliance_reason:
        strategy === "No" || strategy === "Partially" ? nonComplianceReason : null,
      teacher_notes: note || null,
    });
    setSaving(false);
    if (insErr) {
      setError(`Save failed: ${insErr.message}`);
      return;
    }
    toast.success(`Log recorded for ${studentName} on ${today}`);
    onSaved?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Daily Log"
    >
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Daily Log — {studentName}</p>
            <p className="text-xs text-muted-foreground">
              Priority Domain: {priorityDomain ?? "Not set"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-28">
        <Card>
          <CardHeader>
            <CardTitle>{today}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!priorityDomain && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                No priority domain selected for this student. Ask the psychologist to select one
                before logging.
              </div>
            )}

            {unknownWarning && (
              <div className="rounded-md border-2 border-orange-400 bg-orange-50 p-3 text-sm text-orange-900">
                <p className="font-semibold">⚠ Data quality flag</p>
                <p>
                  {unknownWarning.pct}% of the last {unknownWarning.total} logs used "Unknown" as
                  the trigger. Please pick a specific trigger when possible.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
                {error}
              </div>
            )}

            <div>
              <Label>How was {priorityDomain ?? "the priority domain"} today?</Label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {RATINGS.map((r) => (
                  <PillButton
                    key={r.v}
                    active={rating === r.v}
                    onClick={() => setRating(r.v)}
                    className="py-5 text-base flex flex-col items-center gap-1"
                  >
                    <span className="text-2xl">{r.emoji}</span>
                    <span>{r.label}</span>
                  </PillButton>
                ))}
              </div>
            </div>

            <div>
              <Label>What was happening during low/medium performance?</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TRIGGERS.map((t) => (
                  <PillButton key={t} active={trigger === t} onClick={() => setTrigger(t)}>
                    {t}
                  </PillButton>
                ))}
              </div>
            </div>

            <div>
              <Label>Behavioral incident today?</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <PillButton
                  active={incident === "Yes"}
                  onClick={() => setIncident("Yes")}
                  className="py-4"
                >
                  Yes
                </PillButton>
                <PillButton
                  active={incident === "No"}
                  onClick={() => setIncident("No")}
                  className="py-4"
                >
                  No
                </PillButton>
              </div>
              {incident === "Yes" && (
                <div className="mt-3">
                  <Label htmlFor="idesc">Quick description (optional)</Label>
                  <Input
                    id="idesc"
                    value={incidentDesc}
                    onChange={(e) => setIncidentDesc(e.target.value)}
                    placeholder="What happened?"
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Was today's intervention strategy used?</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {STRATEGY.map((s) => (
                  <PillButton
                    key={s}
                    active={strategy === s}
                    onClick={() => {
                      setStrategy(s);
                      if (s === "Yes") setNonComplianceReason("");
                    }}
                  >
                    {s}
                  </PillButton>
                ))}
              </div>
              {(strategy === "No" || strategy === "Partially") && (
                <div className="mt-3">
                  <Label htmlFor="ncr">Why not used?</Label>
                  <select
                    id="ncr"
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={nonComplianceReason}
                    onChange={(e) => setNonComplianceReason(e.target.value)}
                  >
                    <option value="">Select reason…</option>
                    {NON_COMPLIANCE_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="note">Teacher Note (optional)</Label>
              <Textarea
                id="note"
                rows={3}
                placeholder="One sentence observation (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <Button
                size="lg"
                className="bg-teal-600 hover:bg-teal-700 text-white flex-1"
                onClick={submit}
                disabled={saving || !priorityDomain}
              >
                {saving ? "Saving…" : "SUBMIT LOG"}
              </Button>
              <Button size="lg" variant="outline" onClick={onClose} disabled={saving}>
                CANCEL
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
