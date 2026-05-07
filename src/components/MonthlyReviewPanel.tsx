import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { BarChart3, Eye, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  studentId: string;
  studentName: string;
  studentCode: string;
  primaryCondition: string;
  priorityDomain: string | null;
  priorityDomainStartDate: string | null;
  interventionStatus: string | null;
  interventionCycleCount?: number | null;
  onChanged?: () => void;
}

interface MonthlyReview {
  id: string;
  created_at: string;
  cycle_start_date: string;
  cycle_end_date: string;
  priority_domain: string;
  overall_trend: string | null;
  ai_review_output: string;
  recommended_option: string | null;
  confidence_level: string | null;
  decision_made: string | null;
  decided_at: string | null;
}

interface ProgressReport {
  id: string;
  report_week_start: string;
  report_week_end: string;
  avg_rating: number | null;
  incident_rate: number | null;
  strategy_compliance: number | null;
  rating_trend: string | null;
  confidence_level: string | null;
  recommended_action: string | null;
  created_at: string;
}

interface ActivePlan {
  id: string;
  priority_domain: string | null;
  selected_strategy: string | null;
  start_date: string | null;
  plan_version: number | null;
}

function daysBetween(a: string, b: Date) {
  const d = new Date(a);
  return Math.floor((b.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function avg(nums: (number | null)[]) {
  const v = nums.filter((n): n is number => typeof n === "number");
  if (!v.length) return null;
  return Number((v.reduce((s, n) => s + n, 0) / v.length).toFixed(2));
}

function consistency(nums: (number | null)[]): "High" | "Medium" | "Low" {
  const v = nums.filter((n): n is number => typeof n === "number");
  if (v.length < 2) return "Low";
  const m = v.reduce((s, n) => s + n, 0) / v.length;
  const variance = v.reduce((s, n) => s + Math.pow(n - m, 2), 0) / v.length;
  if (variance < 0.15) return "High";
  if (variance < 0.5) return "Medium";
  return "Low";
}

function parseSection(text: string, sectionRegex: RegExp): string {
  const m = text.match(sectionRegex);
  return m ? m[1].trim() : "";
}

export function MonthlyReviewPanel(props: Props) {
  const { profile, user } = useAuth();
  const canDecide = profile?.role === "psychologist" || profile?.role === "administrator";

  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [latestReview, setLatestReview] = useState<MonthlyReview | null>(null);
  const [history, setHistory] = useState<MonthlyReview[]>([]);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [output, setOutput] = useState<string>("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [viewing, setViewing] = useState<MonthlyReview | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingMetrics, setPendingMetrics] = useState<{
    overall_trend: string;
    average_rating_month: number | null;
    baseline_rating: number | null;
    current_rating: number | null;
    change_from_baseline: number | null;
    incident_trend: string;
    strategy_compliance: number | null;
    consistency: string;
    redFlags: string[];
    recommended_option: string | null;
    confidence_level: string | null;
    cycleStart: string;
    cycleEnd: string;
  } | null>(null);

  const hasActiveIntervention = (props.interventionStatus ?? "").toLowerCase().includes("active");
  const daysSinceStart = props.priorityDomainStartDate ? daysBetween(props.priorityDomainStartDate, new Date()) : 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase
        .from("intervention_plans")
        .select("id, priority_domain, selected_strategy, start_date, plan_version")
        .eq("student_id", props.studentId)
        .eq("status", "Active")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setActivePlan((p as ActivePlan) ?? null);

      let cycleStart = (p as ActivePlan | null)?.start_date ?? props.priorityDomainStartDate;
      if (cycleStart) {
        const { data: r } = await supabase
          .from("progress_reports")
          .select("id, report_week_start, report_week_end, avg_rating, incident_rate, strategy_compliance, rating_trend, confidence_level, recommended_action, created_at")
          .eq("student_id", props.studentId)
          .gte("report_week_start", cycleStart)
          .order("report_week_start", { ascending: true });
        if (!cancelled) setReports((r as ProgressReport[]) ?? []);
      }

      const { data: hist } = await supabase
        .from("monthly_reviews")
        .select("id, created_at, cycle_start_date, cycle_end_date, priority_domain, overall_trend, ai_review_output, recommended_option, confidence_level, decision_made, decided_at")
        .eq("student_id", props.studentId)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const all = (hist as MonthlyReview[]) ?? [];
      setHistory(all);
      setLatestReview(all[0] ?? null);
    })();
    return () => { cancelled = true; };
  }, [props.studentId, props.priorityDomainStartDate, refreshKey]);

  const reportCount = reports.length;
  const meetsTimeOrReports = daysSinceStart >= 28 || reportCount >= 2;
  const eligible = canDecide && hasActiveIntervention && !!props.priorityDomain && meetsTimeOrReports;

  const computeMetrics = () => {
    const ratings = reports.map((r) => r.avg_rating);
    const baseline = reports[0]?.avg_rating ?? null;
    const current = reports[reports.length - 1]?.avg_rating ?? null;
    const change = baseline !== null && current !== null ? Number((current - baseline).toFixed(2)) : null;
    const compliance = avg(reports.map((r) => r.strategy_compliance));
    const incidents1 = reports[0]?.incident_rate ?? null;
    const incidentsLast = reports[reports.length - 1]?.incident_rate ?? null;

    let trend = "Stable";
    if (change !== null) {
      if (change >= 0.3) trend = "Improving";
      else if (change <= -0.3) trend = "Declining";
    }

    const redFlags: string[] = [];
    let consecutiveDeclining = 0;
    let maxDeclining = 0;
    reports.forEach((r) => {
      if (r.rating_trend === "Declining") {
        consecutiveDeclining++;
        maxDeclining = Math.max(maxDeclining, consecutiveDeclining);
      } else {
        consecutiveDeclining = 0;
      }
    });
    if (maxDeclining >= 3) redFlags.push("Declining trend for 3+ consecutive weeks");
    const monthAvg = avg(ratings);
    if (monthAvg !== null && monthAvg < 1.5) redFlags.push(`Average rating ${monthAvg} is below 1.5`);
    if (compliance !== null && compliance < 50) redFlags.push(`Strategy compliance ${compliance}% is below 50%`);
    const changeImplemented = reports.filter((r) => (r.recommended_action ?? "").toLowerCase().includes("change")).length;
    if (changeImplemented >= 2) redFlags.push("Multiple changes implemented in same cycle (instability)");

    const incidentTrendStr = incidents1 !== null && incidentsLast !== null
      ? `Week 1: ${incidents1}% -> Week ${reports.length}: ${incidentsLast}%`
      : "Insufficient data";

    return {
      overall_trend: trend,
      average_rating_month: monthAvg,
      baseline_rating: baseline,
      current_rating: current,
      change_from_baseline: change,
      incident_trend: incidentTrendStr,
      strategy_compliance: compliance,
      consistency: consistency(ratings),
      redFlags,
    };
  };

  const handleGenerate = async () => {
    if (!eligible || !props.priorityDomain) return;
    if (reportCount < 2) {
      const ok = window.confirm("Limited data — only " + reportCount + " weekly report(s) found. Continue anyway?");
      if (!ok) return;
    }
    setGenerating(true);
    setErrorMsg(null);
    setOutput("");
    setReviewOpen(true);

    const m = computeMetrics();
    const cycleStart = activePlan?.start_date ?? props.priorityDomainStartDate ?? new Date().toISOString().slice(0, 10);
    const cycleEnd = new Date().toISOString().slice(0, 10);

    const weeklyLines = reports.map((r, i) =>
      `Week ${i + 1} (${r.report_week_start} -> ${r.report_week_end}): Avg ${r.avg_rating ?? "—"}, Trend ${r.rating_trend ?? "—"}, Confidence ${r.confidence_level ?? "—"}, Compliance ${r.strategy_compliance ?? "—"}%`
    );

    const { data: parentComms } = await supabase
      .from("parent_communications")
      .select("response_type, status")
      .eq("student_id", props.studentId)
      .gte("week_start", cycleStart);
    const sent = (parentComms ?? []).filter((c: any) => c.status === "Sent").length;
    const responses = (parentComms ?? []).map((c: any) => c.response_type).filter(Boolean);
    const parentResponse = responses.length ? responses.join(", ") : "None";

    try {
      const { data, error } = await supabase.functions.invoke("generate-monthly-review", {
        body: {
          studentName: props.studentName,
          studentCode: props.studentCode,
          primaryCondition: props.primaryCondition,
          priorityDomain: props.priorityDomain,
          selectedStrategy: activePlan?.selected_strategy ?? "—",
          cycleStart,
          cycleEnd,
          daysElapsed: daysSinceStart,
          planVersion: activePlan?.plan_version ?? 1,
          metrics: m,
          weeklyLines,
          redFlags: m.redFlags,
          parentSummariesSent: sent,
          parentResponse,
        },
      });
      if (error) throw new Error(error.message);
      const text = (data as any)?.output ?? "";
      if (!text) throw new Error("Empty AI output");
      setOutput(text);

      // Parse recommendation + confidence
      const recMatch = text.match(/6\.\s*FINAL RECOMMENDATION[\s\S]*?Option\s*([ABCD])/i);
      const confMatch = text.match(/7\.\s*CONFIDENCE LEVEL\s*\n?\s*(LOW|MEDIUM|HIGH)/i);

      setPendingMetrics({
        ...m,
        recommended_option: recMatch?.[1] ?? null,
        confidence_level: (confMatch?.[1]?.toUpperCase() as any) ?? null,
        cycleStart,
        cycleEnd,
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const saveReview = async (decision: "Continue" | "Modify" | "Switch" | "Reduce" | null) => {
    if (!pendingMetrics || !output || !user) return null;
    const insert = {
      student_id: props.studentId,
      intervention_plan_id: activePlan?.id ?? null,
      cycle_start_date: pendingMetrics.cycleStart,
      cycle_end_date: pendingMetrics.cycleEnd,
      priority_domain: props.priorityDomain!,
      days_in_cycle: daysSinceStart,
      overall_trend: pendingMetrics.overall_trend as any,
      average_rating_month: pendingMetrics.average_rating_month,
      baseline_rating: pendingMetrics.baseline_rating,
      current_rating: pendingMetrics.current_rating,
      change_from_baseline: pendingMetrics.change_from_baseline,
      incident_trend: pendingMetrics.incident_trend,
      strategy_compliance: pendingMetrics.strategy_compliance,
      red_flags: pendingMetrics.redFlags.length ? pendingMetrics.redFlags.join("; ") : "None",
      ai_review_output: output,
      confidence_level: pendingMetrics.confidence_level,
      recommended_option: pendingMetrics.recommended_option,
      decision_made: decision,
      decided_by: decision ? user.id : null,
      decided_at: decision ? new Date().toISOString() : null,
      created_by: user.id,
    };
    const { data, error } = await supabase.from("monthly_reviews").insert(insert).select().single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data;
  };

  const autoParentSummary = async (decisionLabel: string) => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const english = `MONTHLY UPDATE:\n${props.studentName} completed one month of ${props.priorityDomain} intervention.\n\nPROGRESS:\n${pendingMetrics?.overall_trend === "Improving" ? "Improved" : pendingMetrics?.overall_trend === "Declining" ? "Needs more work" : "Stable"} — average rating ${pendingMetrics?.average_rating_month ?? "—"} / 3.0\n\nNEXT MONTH:\n${decisionLabel}\n\nMEETING:\nMonthly review meeting scheduled — please contact school.`;
    const urdu = `ماہانہ اپڈیٹ:\n${props.studentName} نے ${props.priorityDomain} مداخلت کا ایک مہینہ مکمل کیا۔\n\nترقی: ${pendingMetrics?.overall_trend === "Improving" ? "بہتری" : pendingMetrics?.overall_trend === "Declining" ? "مزید کام درکار" : "مستحکم"}\n\nاگلا مہینہ: ${decisionLabel}\n\nملاقات: ماہانہ جائزہ ملاقات مقرر ہے — اسکول سے رابطہ کریں۔`;
    await supabase.from("parent_communications").insert({
      student_id: props.studentId,
      week_start: weekStart,
      week_end: today,
      summary_english: english,
      summary_urdu: urdu,
      status: "Draft",
      created_by: user.id,
    });
  };

  const executeDecision = async (decision: "Continue" | "Modify" | "Switch" | "Reduce") => {
    if (!pendingMetrics || !user) return;
    setSavingDecision(true);
    try {
      const saved = await saveReview(decision);
      if (!saved) return;

      const today = new Date().toISOString().slice(0, 10);
      let decisionLabel = "";
      if (decision === "Continue") {
        decisionLabel = "We will continue the current strategy";
        // Reset cycle: increment count, reset start_date
        await supabase
          .from("students")
          .update({
            priority_domain_start_date: today,
            intervention_cycle_count: (props.interventionCycleCount ?? 0) + 1,
          })
          .eq("id", props.studentId);
      } else if (decision === "Modify") {
        decisionLabel = "We will modify the strategy while keeping the same focus area";
        if (activePlan?.id) {
          await supabase
            .from("intervention_plans")
            .update({ status: "Replaced", replaced_at: new Date().toISOString() })
            .eq("id", activePlan.id);
        }
      } else if (decision === "Switch") {
        decisionLabel = "We will change the focus area";
        if (activePlan?.id) {
          await supabase
            .from("intervention_plans")
            .update({ status: "Completed", replaced_at: new Date().toISOString() })
            .eq("id", activePlan.id);
        }
        await supabase
          .from("students")
          .update({
            priority_domain: null,
            priority_domain_start_date: null,
            intervention_status: null,
            intervention_cycle_count: (props.interventionCycleCount ?? 0) + 1,
          })
          .eq("id", props.studentId);
      } else if (decision === "Reduce") {
        decisionLabel = "We will reduce active support and move to monitoring";
        if (activePlan?.id) {
          await supabase
            .from("intervention_plans")
            .update({ status: "Completed", replaced_at: new Date().toISOString() })
            .eq("id", activePlan.id);
        }
        await supabase
          .from("students")
          .update({
            intervention_status: "Monitoring Only",
            intervention_cycle_count: (props.interventionCycleCount ?? 0) + 1,
          })
          .eq("id", props.studentId);
      }

      await autoParentSummary(decisionLabel);
      toast.success(`Decision recorded: ${decision}`);
      setReviewOpen(false);
      setOutput("");
      setPendingMetrics(null);
      setRefreshKey((k) => k + 1);
      props.onChanged?.();
    } finally {
      setSavingDecision(false);
    }
  };

  const deferDecision = async () => {
    setSavingDecision(true);
    try {
      const saved = await saveReview(null);
      if (saved) {
        toast.success("Draft saved");
        setReviewOpen(false);
        setOutput("");
        setPendingMetrics(null);
        setRefreshKey((k) => k + 1);
      }
    } finally {
      setSavingDecision(false);
    }
  };

  const cycleDay = props.priorityDomainStartDate ? Math.min(daysSinceStart + 1, 30) : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Monthly Cycle Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Current Cycle</p>
              <p className="font-medium mt-1">
                {props.priorityDomainStartDate ? `Day ${cycleDay} of 30` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Cycle #</p>
              <p className="font-medium mt-1">{(props.interventionCycleCount ?? 0) + (hasActiveIntervention ? 1 : 0)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Last Review</p>
              <p className="font-medium mt-1">{latestReview ? new Date(latestReview.created_at).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Decision</p>
              <p className="font-medium mt-1">{latestReview?.decision_made ?? "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {latestReview && (
              <Button variant="outline" onClick={() => setViewing(latestReview)}>
                <Eye className="h-4 w-4" /> View Review
              </Button>
            )}
            {canDecide && (
              <div title={!eligible
                ? !hasActiveIntervention ? "Active intervention required"
                  : !props.priorityDomain ? "Priority domain required"
                  : !meetsTimeOrReports ? "Monthly review available after 28 days of intervention or 2+ weekly reports"
                  : ""
                : ""}>
                <Button
                  className="bg-blue-900 hover:bg-blue-950 text-white disabled:opacity-50"
                  disabled={!eligible || generating}
                  onClick={handleGenerate}
                >
                  <BarChart3 className="h-4 w-4" />
                  {generating ? "Generating…" : "Generate Monthly Review"}
                </Button>
              </div>
            )}
          </div>

          {canDecide && !eligible && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Monthly review available after 28 days of intervention or 2+ weekly reports.
              {props.priorityDomainStartDate && ` (Day ${daysSinceStart} of cycle, ${reportCount} weekly report${reportCount === 1 ? "" : "s"})`}
            </p>
          )}

          {history.length > 0 && (
            <div className="pt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Previous Monthly Reviews</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-border rounded-md">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Domain</th>
                      <th className="text-left px-3 py-2">Trend</th>
                      <th className="text-left px-3 py-2">Decision</th>
                      <th className="text-left px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-t border-border">
                        <td className="px-3 py-2">{new Date(h.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{h.priority_domain}</td>
                        <td className="px-3 py-2">{h.overall_trend ?? "—"}</td>
                        <td className="px-3 py-2">{h.decision_made ?? "Deferred"}</td>
                        <td className="px-3 py-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewing(h)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="sticky top-0 bg-purple-700 text-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold">📊 MONTHLY CYCLE REVIEW — STRATEGIC DECISION REQUIRED</p>
              <Button variant="outline" onClick={() => { setReviewOpen(false); setOutput(""); setPendingMetrics(null); }}>
                Close
              </Button>
            </div>
          </div>
          <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-4">
            {generating && (
              <Card>
                <CardContent className="pt-6 flex items-center gap-3 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  📊 Generating monthly review... This may take 30 seconds.
                </CardContent>
              </Card>
            )}
            {errorMsg && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    {errorMsg}
                  </div>
                  <Button onClick={handleGenerate}>Retry</Button>
                </CardContent>
              </Card>
            )}
            {output && !generating && (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {editing ? (
                    <Textarea
                      value={output}
                      onChange={(e) => setOutput(e.target.value)}
                      className="min-h-[400px] font-mono text-xs"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{output}</pre>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setEditing((v) => !v)}>
                      {editing ? "Done Editing" : "Edit Review Before Approving"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {output && !generating && canDecide && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Psychologist Decision (Select ONE)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white h-auto py-4 flex-col items-start"
                      disabled={savingDecision}
                      onClick={() => executeDecision("Continue")}
                    >
                      <span className="font-semibold">1. Continue Current Plan</span>
                      <span className="text-xs opacity-90">Reset cycle, no changes</span>
                    </Button>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white h-auto py-4 flex-col items-start"
                      disabled={savingDecision}
                      onClick={() => executeDecision("Modify")}
                    >
                      <span className="font-semibold">2. Modify Strategy</span>
                      <span className="text-xs opacity-90">Same domain, new options</span>
                    </Button>
                    <Button
                      className="bg-orange-600 hover:bg-orange-700 text-white h-auto py-4 flex-col items-start"
                      disabled={savingDecision}
                      onClick={() => executeDecision("Switch")}
                    >
                      <span className="font-semibold">3. Switch Domain</span>
                      <span className="text-xs opacity-90">Pick a new priority domain</span>
                    </Button>
                    <Button
                      className="bg-gray-600 hover:bg-gray-700 text-white h-auto py-4 flex-col items-start"
                      disabled={savingDecision}
                      onClick={() => executeDecision("Reduce")}
                    >
                      <span className="font-semibold">4. Reduce Support</span>
                      <span className="text-xs opacity-90">Move to monitoring only</span>
                    </Button>
                  </div>
                  <div className="pt-2">
                    <Button variant="outline" disabled={savingDecision} onClick={deferDecision}>
                      Defer Decision (save draft)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="sticky top-0 bg-card border-b border-border">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Monthly Review — {viewing.cycle_start_date} → {viewing.cycle_end_date}</p>
                <p className="text-xs text-muted-foreground">
                  Domain: {viewing.priority_domain} · Decision: {viewing.decision_made ?? "Deferred"}
                </p>
              </div>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
          <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
            <Card>
              <CardContent className="pt-6">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{viewing.ai_review_output}</pre>
              </CardContent>
            </Card>
          </main>
        </div>
      )}
    </>
  );
}
