import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ActivePlan {
  id: string;
  selected_strategy: string | null;
  start_date: string | null;
  priority_domain: string | null;
  content: string | null;
  plan_version: number | null;
  cycle_length_days: number | null;
  ai_original_output: string | null;
  modification_type: string | null;
  refinement_count: number | null;
  final_version_source: string | null;
  custom_modified: boolean | null;
}

interface Props {
  studentId: string;
  priorityDomain: string;
  onDomainChanged?: () => void;
}

const SCORE_OPTIONS = [
  { v: -2, label: "−2 Significant regression" },
  { v: -1, label: "−1 Mild regression" },
  { v: 0, label: " 0 No change" },
  { v: 1, label: "+1 Improvement" },
  { v: 2, label: "+2 Strong improvement" },
];

export function InterventionReviewPanel({ studentId, priorityDomain, onDomainChanged }: Props) {
  const { profile } = useAuth();
  const canEditScore =
    profile?.role === "psychologist" || profile?.role === "administrator";
  const canChangeDomain = canEditScore;

  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [latestScore, setLatestScore] = useState<{
    score: number;
    period_month: string;
  } | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showFullPlan, setShowFullPlan] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [confirmChange, setConfirmChange] = useState(false);
  const [discontinuing, setDiscontinuing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from("intervention_plans")
        .select("id, selected_strategy, start_date, priority_domain, content, plan_version, cycle_length_days")
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

  const cycle = plan?.cycle_length_days ?? 14;
  const daysActive = plan?.start_date
    ? Math.floor(
        (Date.now() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24),
      )
    : null;

  const reviewDue = daysActive !== null && daysActive >= cycle;

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

  const discontinueAndReopen = async () => {
    setDiscontinuing(true);
    setErr(null);

    // Mark active plan(s) as Discontinued mid-cycle.
    const { error: ie } = await supabase
      .from("intervention_plans")
      .update({ status: "Discontinued", replaced_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .eq("status", "Active");

    // Clear priority domain on student so selector reopens.
    const { error: se } = await supabase
      .from("students")
      .update({
        priority_domain: null,
        priority_domain_start_date: null,
        intervention_status: "Discontinued — Mid-Cycle Change",
      })
      .eq("id", studentId);

    setDiscontinuing(false);
    setConfirmChange(false);

    if (ie || se) {
      setErr(`Could not change domain: ${(ie ?? se)?.message}`);
      return;
    }
    toast.success("Current intervention discontinued. Select a new priority domain.");
    onDomainChanged?.();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Current Intervention Plan</CardTitle>
        {canChangeDomain && (
          <Button
            variant="outline"
            size="sm"
            className="border-amber-400 text-amber-800 hover:bg-amber-50"
            onClick={() => setConfirmChange(true)}
          >
            <RefreshCw className="h-4 w-4" /> Change Priority Domain
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!plan && (
          <p className="text-sm text-muted-foreground">
            No active intervention plan yet. Generate intervention options to create one.
          </p>
        )}

        {plan && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Priority Domain</p>
                <span className="inline-flex items-center rounded-full bg-purple-600 text-white px-3 py-1 text-xs font-semibold mt-1">
                  {plan.priority_domain ?? priorityDomain}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Strategy</p>
                <p className="font-medium mt-1">{plan.selected_strategy ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Started</p>
                <p className="font-medium mt-1">{plan.start_date ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Cycle</p>
                <p className="font-medium mt-1">
                  Day {Math.max(0, daysActive ?? 0)} of {cycle}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Status</p>
                <span className="inline-flex items-center rounded-full bg-green-600 text-white px-3 py-1 text-xs font-semibold mt-1">
                  Active
                </span>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Plan Version</p>
                <p className="font-medium mt-1">v{plan.plan_version ?? 1}</p>
              </div>
            </div>

            {reviewDue && (
              <div className="rounded-md border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">⏰ Cycle Complete — Review Required</p>
                <p>
                  Review trend evidence before any change. Options: continue (improvement),
                  continue + monitor (no change), recommend change (regression), or extend
                  another {cycle} days. Psychologist approval required.
                </p>
              </div>
            )}

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFullPlan((v) => !v)}
              >
                {showFullPlan ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showFullPlan ? "Hide full plan" : "View full plan"}
              </Button>
              {showFullPlan && (
                <div className="mt-3 rounded-md border border-border bg-muted/30 p-4 max-h-[40vh] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {plan.content ?? "No content stored."}
                  </pre>
                </div>
              )}
            </div>
          </>
        )}

        {latestScore && (
          <p className="text-xs text-muted-foreground">
            Last monthly progress score:{" "}
            <span className="font-semibold">
              {latestScore.score > 0 ? `+${latestScore.score}` : latestScore.score}
            </span>{" "}
            (period {latestScore.period_month})
          </p>
        )}

        {canEditScore && plan && (
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
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button onClick={saveScore} disabled={saving || score === null}>
              {saving ? "Saving…" : "Save monthly score"}
            </Button>
          </div>
        )}

        {confirmChange && (
          <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center px-4">
            <Card className="w-full max-w-md border-amber-400">
              <CardHeader>
                <CardTitle className="text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Change Priority Domain
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  ⚠️ CAUTION: Changing the priority domain will discontinue the current
                  intervention and start a new {cycle}-day cycle. Only do this if there has
                  been no progress after 2+ weeks of implementation. Continue?
                </p>
                {err && <p className="text-destructive">{err}</p>}
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setConfirmChange(false)}
                    disabled={discontinuing}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={discontinueAndReopen}
                    disabled={discontinuing}
                  >
                    {discontinuing ? "Working…" : "Confirm Change"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
