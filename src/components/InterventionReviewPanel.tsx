import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ActivePlan {
  id: string;
  selected_strategy: string | null;
  start_date: string | null;
  priority_domain: string | null;
}

interface Props {
  studentId: string;
  priorityDomain: string;
}

const SCORE_OPTIONS = [
  { v: -2, label: "−2 Significant regression" },
  { v: -1, label: "−1 Mild regression" },
  { v: 0, label: " 0 No change" },
  { v: 1, label: "+1 Improvement" },
  { v: 2, label: "+2 Strong improvement" },
];

export function InterventionReviewPanel({ studentId, priorityDomain }: Props) {
  const { profile } = useAuth();
  const canEditScore =
    profile?.role === "psychologist" || profile?.role === "administrator";

  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [latestScore, setLatestScore] = useState<{
    score: number;
    period_month: string;
  } | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from("intervention_plans")
        .select("id, selected_strategy, start_date, priority_domain")
        .eq("student_id", studentId)
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPlan((p as ActivePlan) ?? null);

      const { data: s } = await supabase
        .from("domain_progress_scores")
        .select("score, period_month")
        .eq("student_id", studentId)
        .eq("priority_domain", priorityDomain)
        .order("period_month", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (s) setLatestScore(s as { score: number; period_month: string });
    })();
  }, [studentId, priorityDomain]);

  const daysActive = plan?.start_date
    ? Math.floor(
        (Date.now() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  const reviewDue = daysActive !== null && daysActive >= 14;

  const saveScore = async () => {
    setErr(null);
    if (score === null) return setErr("Pick a score from −2 to +2.");
    setSaving(true);
    const month = new Date();
    const periodMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
    const { error } = await supabase.from("domain_progress_scores").insert({
      student_id: studentId,
      priority_domain: priorityDomain,
      period_month: periodMonth,
      score,
      notes: notes || null,
      created_by: profile?.id ?? null,
    });
    setSaving(false);
    if (error) {
      setErr(`Save failed: ${error.message}`);
      return;
    }
    toast.success("Monthly progress score saved");
    setLatestScore({ score, period_month: periodMonth });
    setScore(null);
    setNotes("");
  };

  if (!plan) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intervention Review (14-day cycle)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm">
          <p>
            <span className="font-semibold">Active strategy:</span>{" "}
            {plan.selected_strategy ?? "—"}
          </p>
          <p className="text-muted-foreground">
            Started {plan.start_date} · {daysActive} day(s) active
          </p>
        </div>

        {reviewDue ? (
          <div className="rounded-md border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">⏱ 14-day review due</p>
            <p>
              Review trend evidence before any change. Options: continue (improvement),
              continue + monitor (no change), recommend change (regression), or extend
              another 14 days (insufficient data). Psychologist approval required.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Next review at day 14. No intervention change without psychologist approval
            and visible trend evidence.
          </div>
        )}

        {latestScore && (
          <p className="text-xs text-muted-foreground">
            Last monthly progress score: <span className="font-semibold">{latestScore.score > 0 ? `+${latestScore.score}` : latestScore.score}</span>{" "}
            (period {latestScore.period_month})
          </p>
        )}

        {canEditScore && (
          <div className="space-y-3 pt-3 border-t border-border">
            <Label>Record monthly domain progress score (trend-based, not single day)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {SCORE_OPTIONS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setScore(o.v)}
                  className={`px-2 py-2 rounded-md text-xs font-semibold border transition-colors ${
                    score === o.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              placeholder="Trend notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {err && (
              <p className="text-sm text-destructive">{err}</p>
            )}
            <Button onClick={saveScore} disabled={saving || score === null}>
              {saving ? "Saving…" : "Save monthly score"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
