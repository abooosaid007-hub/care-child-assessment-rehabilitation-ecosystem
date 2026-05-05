import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { X, Sparkles, AlertTriangle, CheckCircle2, Edit3, Clock } from "lucide-react";
import { toast } from "sonner";

interface ActivePlan {
  id: string;
  selected_strategy: string | null;
  start_date: string | null;
  priority_domain: string | null;
  content: string | null;
  plan_version: number;
  cycle_length_days: number;
  change_count: number | null;
}

interface DailyLog {
  log_date: string;
  rating: number | null;
  context_trigger: string | null;
  incident_yes_no: boolean | null;
  incident_description: string | null;
  strategy_used: string | null;
  non_compliance_reason: string | null;
  teacher_notes: string | null;
  log_form_type: string | null;
  field1_value: string | null;
  field2_value: string | null;
  field3_value: string | null;
  field4_value: string | null;
  teacher_confidence: string | null;
}

interface Props {
  studentId: string;
  studentName: string;
  studentCode: string;
  schoolSection: string | null;
  subCategory: string | null;
  priorityDomain: string;
  onClose: () => void;
  onSaved?: () => void;
}

type Phase = "preview" | "loading" | "review" | "edit" | "error";

function fmt(n: number, d = 1) {
  return Number.isFinite(n) ? n.toFixed(d) : "—";
}

function validateOutput(text: string): string | null {
  const checks: Array<[string, RegExp]> = [
    ["TEACHER-REPORTED ISSUE", /TEACHER-REPORTED ISSUE/i],
    ["1. MAIN DIFFICULTY", /1\.\s*MAIN DIFFICULTY/i],
    ["2. MOST LIKELY TRIGGER", /2\.\s*MOST LIKELY TRIGGER/i],
    ["3. PSYCHOLOGICAL INTERPRETATION", /3\.\s*PSYCHOLOGICAL INTERPRETATION/i],
    ["4. ACTION OPTIONS", /4\.\s*ACTION OPTIONS/i],
    ["Option A", /Option\s*A/i],
    ["Option B", /Option\s*B/i],
    ["Option C", /Option\s*C\s*[—-]\s*Continue Current Strategy/i],
    ["5. FINAL RECOMMENDATION", /5\.\s*FINAL RECOMMENDATION/i],
    ["6. CONFIDENCE LEVEL", /6\.\s*CONFIDENCE LEVEL/i],
    ["7. BASELINE vs SPIKE", /7\.\s*BASELINE\s*vs\s*SPIKE/i],
    ["BASELINE TREND", /BASELINE TREND/i],
    ["THIS WEEK SPIKES", /THIS WEEK SPIKES/i],
    ["SIGNAL", /SIGNAL/i],
  ];
  for (const [label, re] of checks) {
    if (!re.test(text)) return `Missing section: ${label}`;
  }
  return null;
}

function extractRecommendation(text: string): "A" | "B" | "C" | null {
  const m = text.match(/5\.\s*FINAL RECOMMENDATION[\s\S]*?Option\s*([ABC])/i);
  return m ? (m[1].toUpperCase() as "A" | "B" | "C") : null;
}

function extractConfidence(text: string): "LOW" | "MEDIUM" | "HIGH" | null {
  const m = text.match(/6\.\s*CONFIDENCE LEVEL[\s\S]*?\b(LOW|MEDIUM|HIGH)\b/i);
  return m ? (m[1].toUpperCase() as "LOW" | "MEDIUM" | "HIGH") : null;
}

function extractOptionText(text: string, opt: "A" | "B"): string {
  const re = new RegExp(`Option\\s*${opt}[\\s\\S]*?(?=Option\\s*[ABC]|5\\.\\s*FINAL|$)`, "i");
  const m = text.match(re);
  return m ? m[0].trim() : `Option ${opt}`;
}

export function WeeklyAnalysisOverlay({
  studentId, studentName, studentCode, schoolSection, subCategory,
  priorityDomain, onClose, onSaved,
}: Props) {
  const { profile } = useAuth();
  const [phase, setPhase] = useState<Phase>("preview");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [historicalAvg, setHistoricalAvg] = useState<number | null>(null);
  const [output, setOutput] = useState<string>("");
  const [editedOutput, setEditedOutput] = useState<string>("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const [confirmChange, setConfirmChange] = useState(false);
  const [changeWarning, setChangeWarning] = useState<string | null>(null);
  const initRef = useRef(false);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Load active plan + logs on mount
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    (async () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      const isoStart = sevenDaysAgo.toISOString().slice(0, 10);

      const { data: pData, error: pErr } = await supabase
        .from("intervention_plans")
        .select("id, selected_strategy, start_date, priority_domain, content, plan_version, cycle_length_days, change_count")
        .eq("student_id", studentId)
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pErr) { setError(pErr.message); setPhase("error"); return; }
      if (!pData) { setError("No active intervention plan."); setPhase("error"); return; }
      setPlan(pData as ActivePlan);

      const { data: lData, error: lErr } = await supabase
        .from("daily_logs")
        .select("log_date, rating, context_trigger, incident_yes_no, incident_description, strategy_used, non_compliance_reason, teacher_notes, log_form_type, field1_value, field2_value, field3_value, field4_value, teacher_confidence")
        .eq("student_id", studentId)
        .gte("log_date", isoStart)
        .order("log_date", { ascending: true });
      if (lErr) { setError(lErr.message); setPhase("error"); return; }
      const week = (lData ?? []) as DailyLog[];
      setLogs(week);

      // Historical baseline (all logs older than this week)
      const { data: hData } = await supabase
        .from("daily_logs")
        .select("rating")
        .eq("student_id", studentId)
        .lt("log_date", isoStart);
      if (hData && hData.length > 0) {
        const ratings = (hData as { rating: number | null }[])
          .map((r) => r.rating)
          .filter((r): r is number => typeof r === "number");
        if (ratings.length > 0) {
          setHistoricalAvg(ratings.reduce((a, b) => a + b, 0) / ratings.length);
        }
      }

      if (week.length < 5) {
        setError(`Insufficient data. Need at least 5 daily logs (found ${week.length}).`);
        setPhase("error");
      }
    })();
  }, [studentId]);

  const metrics = useMemo(() => {
    if (logs.length === 0) return null;
    const ratings = logs.map((l) => l.rating ?? 0);
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const incidents = logs.filter((l) => l.incident_yes_no === true).length;
    const incidentRate = (incidents / 7) * 100;
    const compliance = (logs.filter((l) => (l.strategy_used ?? "").toLowerCase() === "yes").length / 7) * 100;

    const triggerCounts = new Map<string, number>();
    for (const l of logs) {
      const t = l.context_trigger || "Unknown";
      triggerCounts.set(t, (triggerCounts.get(t) ?? 0) + 1);
    }
    let dom = "Unknown", domCount = 0;
    for (const [k, v] of triggerCounts) if (v > domCount) { dom = k; domCount = v; }

    const sortedByDate = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date));
    const first3 = sortedByDate.slice(0, 3).map((l) => l.rating ?? 0);
    const last3 = sortedByDate.slice(-3).map((l) => l.rating ?? 0);
    const f3 = first3.length ? first3.reduce((a, b) => a + b, 0) / first3.length : 0;
    const l3 = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0;
    let trend: "Improving" | "Stable" | "Declining" = "Stable";
    if (l3 - f3 >= 0.3) trend = "Improving";
    else if (f3 - l3 >= 0.3) trend = "Declining";

    const change = historicalAvg !== null ? avg - historicalAvg : null;

    return {
      avg_rating: fmt(avg, 1),
      incident_rate: fmt(incidentRate, 0),
      strategy_compliance: fmt(compliance, 0),
      dominant_trigger: `${dom} (occurred ${domCount} times)`,
      dominant_trigger_name: dom,
      rating_trend: trend,
      baseline_from_history: historicalAvg !== null ? fmt(historicalAvg, 1) : null,
      change_from_baseline: change !== null ? `${change >= 0 ? "+" : ""}${fmt(change, 1)} points` : null,
      _avg_num: avg,
      _incident_num: incidentRate,
      _compliance_num: compliance,
    };
  }, [logs, historicalAvg]);

  const teacherIssue = useMemo(() => {
    const notes = logs.map((l) => l.teacher_notes?.trim()).filter(Boolean) as string[];
    if (notes.length === 0) return "No explicit issue reported - analysis based on behavioral patterns from logs";
    return notes.join(" | ");
  }, [logs]);

  const dailyLogLines = useMemo(() => {
    return logs.map((l, i) => {
      const ratingTxt = l.rating === 3 ? "High(3)" : l.rating === 2 ? "Medium(2)" : l.rating === 1 ? "Low(1)" : "—";
      const formInfo = l.log_form_type
        ? ` | Form=${l.log_form_type} | F1=${l.field1_value ?? "—"} | F2=${l.field2_value ?? "—"} | F3=${l.field3_value ?? "—"} | F4=${l.field4_value ?? "—"}`
        : "";
      const conf = l.teacher_confidence ? ` | Confidence=${l.teacher_confidence}` : "";
      return `Day ${i + 1} (${l.log_date}): Rating=${ratingTxt}, Trigger=${l.context_trigger ?? "—"}, Incident=${l.incident_yes_no ? "Yes" : "No"}, Strategy Used=${l.strategy_used ?? "—"}, Note=${l.teacher_notes ?? "—"}${formInfo}${conf}`;
    });
  }, [logs]);

  const cycleDay = plan?.start_date
    ? Math.max(1, Math.floor((Date.now() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 1;
  const cycleLen = plan?.cycle_length_days ?? 14;
  const weekEnd = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const callAI = async (): Promise<{ ok: true; text: string } | { ok: false; error: string }> => {
    if (!plan || !metrics) return { ok: false, error: "Missing plan or metrics" };
    const { data, error } = await supabase.functions.invoke("generate-weekly-analysis", {
      body: {
        studentName,
        studentCode,
        section: schoolSection
          ? `${schoolSection}${subCategory ? ` — ${subCategory}` : ""}`
          : null,
        priorityDomain,
        activeStrategy: plan.selected_strategy,
        cycleDay,
        cycleLength: cycleLen,
        planVersion: plan.plan_version,
        weekStart,
        weekEnd,
        teacherReportedIssue: teacherIssue,
        dailyLogLines,
        metrics: {
          avg_rating: metrics.avg_rating,
          incident_rate: metrics.incident_rate,
          strategy_compliance: metrics.strategy_compliance,
          dominant_trigger: metrics.dominant_trigger,
          rating_trend: metrics.rating_trend,
          baseline_from_history: metrics.baseline_from_history,
          change_from_baseline: metrics.change_from_baseline,
        },
      },
    });
    if (error) return { ok: false, error: error.message };
    if ((data as { error?: string })?.error) return { ok: false, error: (data as { error: string }).error };
    const text = (data as { output?: string })?.output ?? "";
    if (!text) return { ok: false, error: "Empty AI output" };
    return { ok: true, text };
  };

  const generate = async () => {
    setPhase("loading");
    setError(null);
    setRetried(false);
    let result = await callAI();
    if (result.ok) {
      const validation = validateOutput(result.text);
      if (validation) {
        setRetried(true);
        const second = await callAI();
        if (!second.ok) { setError(second.error); setPhase("error"); return; }
        const v2 = validateOutput(second.text);
        if (v2) { setError(`Validation failed after retry: ${v2}`); setPhase("error"); return; }
        result = second;
      }
    } else {
      setError(result.error); setPhase("error"); return;
    }

    // Save draft to progress_reports
    if (!metrics || !plan) { setError("Missing data"); setPhase("error"); return; }
    const recommended = extractRecommendation(result.text);
    const confidence = extractConfidence(result.text);
    const { data: insertData, error: insErr } = await supabase
      .from("progress_reports")
      .insert({
        student_id: studentId,
        intervention_plan_id: plan.id,
        report_week_start: weekStart,
        report_week_end: weekEnd,
        priority_domain: priorityDomain,
        avg_rating: Number(metrics.avg_rating),
        incident_rate: Number(metrics.incident_rate),
        strategy_compliance: Number(metrics.strategy_compliance),
        dominant_trigger: metrics.dominant_trigger_name,
        rating_trend: metrics.rating_trend,
        baseline_comparison: historicalAvg !== null ? Number((metrics._avg_num - historicalAvg).toFixed(2)) : null,
        ai_analysis_output: result.text,
        teacher_reported_issue: teacherIssue,
        confidence_level: confidence,
        recommended_action: recommended ? `Option ${recommended}` : null,
        psychologist_status: "Pending",
        created_by: profile?.id ?? null,
      })
      .select("id")
      .single();
    if (insErr) { setError(`Save failed: ${insErr.message}`); setPhase("error"); return; }
    setReportId((insertData as { id: string }).id);
    setOutput(result.text);
    setEditedOutput(result.text);
    setPhase("review");
    toast.success("Weekly analysis generated");
  };

  const updateReport = async (patch: Record<string, unknown>) => {
    if (!reportId) return false;
    const { error: e } = await supabase
      .from("progress_reports")
      .update({ ...patch, reviewed_by: profile?.id ?? null, reviewed_at: new Date().toISOString() })
      .eq("id", reportId);
    if (e) { toast.error(`Update failed: ${e.message}`); return false; }
    return true;
  };

  const approveAsAnalyzed = async () => {
    if (await updateReport({ psychologist_status: "Approved" })) {
      toast.success("Analysis approved");
      onSaved?.(); onClose();
    }
  };

  const approveModified = async () => {
    if (!editedOutput.trim()) { toast.error("Edited output cannot be empty"); return; }
    if (await updateReport({ psychologist_status: "Modified", ai_analysis_output: editedOutput })) {
      toast.success("Modified analysis saved");
      onSaved?.(); onClose();
    }
  };

  const deferReview = async () => {
    if (await updateReport({ psychologist_status: "Deferred" })) {
      toast.success("Deferred for later review");
      onSaved?.(); onClose();
    }
  };

  const recommended = useMemo(() => extractRecommendation(output), [output]);
  const recommendedOptionText = useMemo(() => {
    if (!recommended || recommended === "C") return "";
    return extractOptionText(output, recommended);
  }, [output, recommended]);

  const openImplementChange = async () => {
    // Check change frequency
    if (!plan) return;
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("intervention_plans")
      .select("id, created_at")
      .eq("student_id", studentId)
      .gte("created_at", since);
    if (recent && recent.length > 1) {
      setChangeWarning("⚠️ Frequent intervention changes may reduce effectiveness. Consider continuing the current plan longer.");
    } else {
      setChangeWarning(null);
    }
    setConfirmChange(true);
  };

  const implementChange = async () => {
    if (!plan || !recommended || recommended === "C") return;
    // Mark current as Revised, create new plan with version+1, change_count++
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const { error: rErr } = await supabase
      .from("intervention_plans")
      .update({ status: "Revised - Weekly Analysis", replaced_at: now })
      .eq("id", plan.id);
    if (rErr) { toast.error(`Revise failed: ${rErr.message}`); return; }

    const { error: nErr } = await supabase.from("intervention_plans").insert({
      student_id: studentId,
      assessment_id: plan.id, // reuse — schema requires non-null
      plan_type: "Domain Intervention",
      title: `Weekly Analysis Revision — Option ${recommended}`,
      content: recommendedOptionText || `Option ${recommended} (from weekly analysis)`,
      priority_domain: priorityDomain,
      selected_strategy: `Option ${recommended} — ${recommendedOptionText.split("\n")[0] ?? ""}`.slice(0, 500),
      start_date: today,
      status: "Active",
      plan_version: plan.plan_version + 1,
      cycle_length_days: plan.cycle_length_days,
      change_count: (plan.change_count ?? 0) + 1,
      approved_by: profile?.id ?? null,
      created_by: profile?.id ?? null,
    });
    if (nErr) { toast.error(`Create new plan failed: ${nErr.message}`); return; }

    await supabase
      .from("students")
      .update({ intervention_status: `Active — Option ${recommended} (Weekly Revision)` })
      .eq("id", studentId);

    await updateReport({ psychologist_status: "Change Implemented" });
    toast.success("Strategy change implemented; 14-day cycle restarted");
    setConfirmChange(false);
    onSaved?.(); onClose();
  };

  const canEdit = profile?.role === "psychologist" || profile?.role === "administrator";

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto" role="dialog" aria-modal="true">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Weekly Progress Analysis — {studentName}</p>
            <p className="text-xs text-muted-foreground">Domain: {priorityDomain} · Week {weekStart} → {weekEnd}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
        {phase === "error" && error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-6 space-y-3">
              <p className="text-destructive font-semibold">{error}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Close</Button>
                {logs.length >= 5 && plan && (
                  <Button onClick={generate}>Retry</Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "preview" && metrics && plan && (
          <>
            <Card>
              <CardHeader><CardTitle>Pre-Computed Weekly Metrics</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Metric label="Average Performance" value={`${metrics.avg_rating} / 3.0`} />
                <Metric label="Incident Rate" value={`${metrics.incident_rate}%`} />
                <Metric label="Strategy Compliance" value={`${metrics.strategy_compliance}% of days`} />
                <Metric label="Primary Trigger" value={metrics.dominant_trigger} />
                <Metric label="Weekly Trend" value={metrics.rating_trend} />
                <Metric label="Historical Baseline" value={metrics.baseline_from_history ? `${metrics.baseline_from_history} / 3.0` : "First week — no baseline"} />
                {metrics.change_from_baseline && <Metric label="Change from Baseline" value={metrics.change_from_baseline} />}
                <Metric label="Logs Used" value={`${logs.length} of past 7 days`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Teacher-Reported Issue</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{teacherIssue}</p>
              </CardContent>
            </Card>

            <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={generate}>
              <Sparkles className="h-5 w-5" /> Generate Weekly Analysis
            </Button>
          </>
        )}

        {phase === "loading" && (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-lg">🤖 Analyzing weekly data…</p>
              <p className="text-sm text-muted-foreground">This may take 30 seconds.{retried && " Retrying once for valid output…"}</p>
            </CardContent>
          </Card>
        )}

        {(phase === "review" || phase === "edit") && (
          <>
            <Card className="border-2 border-red-300">
              <CardHeader className="bg-red-600 text-white">
                <CardTitle className="text-base">DRAFT ANALYSIS — PSYCHOLOGIST REVIEW REQUIRED</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {phase === "edit" ? (
                  <Textarea rows={20} value={editedOutput} onChange={(e) => setEditedOutput(e.target.value)} />
                ) : (
                  <div className="max-h-[55vh] overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{output}</pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {canEdit && (
              <Card>
                <CardHeader><CardTitle>Decision</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {phase === "review" ? (
                    <>
                      <Button className="bg-green-600 hover:bg-green-700 text-white h-auto py-4" onClick={approveAsAnalyzed}>
                        <CheckCircle2 className="h-5 w-5" /> APPROVE AS ANALYZED
                      </Button>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white h-auto py-4" onClick={() => setPhase("edit")}>
                        <Edit3 className="h-5 w-5" /> APPROVE WITH MODIFICATION
                      </Button>
                      {recommended && recommended !== "C" && (
                        <Button className="bg-orange-600 hover:bg-orange-700 text-white h-auto py-4 sm:col-span-2" onClick={openImplementChange}>
                          <Sparkles className="h-5 w-5" /> IMPLEMENT RECOMMENDED CHANGE (Option {recommended})
                        </Button>
                      )}
                      <Button variant="outline" className="h-auto py-4 sm:col-span-2" onClick={deferReview}>
                        <Clock className="h-5 w-5" /> DEFER REVIEW
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white h-auto py-4" onClick={approveModified}>
                        Save Modified Analysis
                      </Button>
                      <Button variant="outline" className="h-auto py-4" onClick={() => setPhase("review")}>Back</Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {confirmChange && plan && (
          <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center px-4">
            <Card className="w-full max-w-lg border-amber-400">
              <CardHeader>
                <CardTitle className="text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Confirm Strategy Change
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Current Strategy</p>
                  <p className="mt-1 whitespace-pre-wrap">{plan.selected_strategy ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Recommended Strategy (Option {recommended})</p>
                  <pre className="mt-1 whitespace-pre-wrap font-sans text-sm bg-muted/30 p-2 rounded max-h-40 overflow-y-auto">{recommendedOptionText}</pre>
                </div>
                <p className="text-amber-800">⚠️ This will replace your current intervention and restart the 14-day cycle.</p>
                {changeWarning && <p className="text-red-700 font-medium">{changeWarning}</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setConfirmChange(false)}>Cancel</Button>
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={implementChange}>Confirm Change</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold mt-1">{value}</p>
    </div>
  );
}
