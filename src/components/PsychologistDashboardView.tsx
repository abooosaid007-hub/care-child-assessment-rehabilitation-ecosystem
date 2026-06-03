import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  Target,
  BarChart3,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
} from "lucide-react";
import { SECTION_SHORT, type SchoolSection } from "@/lib/school-sections";

interface Counts {
  pendingAssessments: number;
  interventionApprovals: number;
  weeklyPending: number;
  parentDraft: number;
}

interface PendingAssessmentRow {
  id: string;
  student_id: string;
  assessment_date: string | null;
  consultant_name: string | null;
  created_at: string;
  student: {
    first_name: string;
    student_code: string;
    school_section: string | null;
    complexity_flag: string | null;
  } | null;
}

interface ActiveInterventionRow {
  id: string;
  student_id: string;
  priority_domain: string | null;
  selected_strategy: string | null;
  start_date: string | null;
  generated_at: string;
  cycle_length_days: number;
  student: { first_name: string; student_code: string } | null;
  compliance: number | null;
}

interface WeeklyPendingRow {
  id: string;
  student_id: string;
  report_week_start: string;
  report_week_end: string;
  rating_trend: string | null;
  student: { first_name: string } | null;
}

interface RiskAlert {
  studentId: string;
  studentName: string;
  reason: string;
  severity: "amber" | "red";
}

export function PsychologistDashboardView({ name }: { name: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [counts, setCounts] = useState<Counts | null>(null);
  const [pendingAssessments, setPendingAssessments] = useState<PendingAssessmentRow[]>([]);
  const [activeInterventions, setActiveInterventions] = useState<ActiveInterventionRow[]>([]);
  const [weeklyPending, setWeeklyPending] = useState<WeeklyPendingRow[]>([]);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [
          pendAssCount,
          intApprovCount,
          weeklyCount,
          parentDraftCount,
          pendAssList,
          activeIntList,
          weeklyList,
          declining,
          lowCompliance,
          concernedParents,
        ] = await Promise.all([
          supabase
            .from("assessments")
            .select("id", { count: "exact", head: true })
            .eq("psychologist_status", "Pending Review"),
          supabase
            .from("intervention_plans")
            .select("id", { count: "exact", head: true })
            .is("approved_by", null),
          supabase
            .from("progress_reports")
            .select("id", { count: "exact", head: true })
            .eq("psychologist_status", "Pending"),
          supabase
            .from("parent_communications")
            .select("id", { count: "exact", head: true })
            .in("status", ["Draft", "Approved"]),
          supabase
            .from("assessments")
            .select(
              "id, student_id, assessment_date, consultant_name, created_at",
            )
            .eq("psychologist_status", "Pending Review")
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("intervention_plans")
            .select(
              "id, student_id, priority_domain, selected_strategy, start_date, generated_at, cycle_length_days",
            )
            .eq("status", "Active")
            .order("start_date", { ascending: false, nullsFirst: false })
            .limit(20),
          supabase
            .from("progress_reports")
            .select(
              "id, student_id, report_week_start, report_week_end, rating_trend",
            )
            .eq("psychologist_status", "Pending")
            .order("report_week_end", { ascending: false })
            .limit(10),
          supabase
            .from("progress_reports")
            .select("student_id, rating_trend, report_week_end")
            .eq("rating_trend", "Declining")
            .order("report_week_end", { ascending: false })
            .limit(60),
          supabase
            .from("progress_reports")
            .select("student_id, strategy_compliance, report_week_end")
            .lt("strategy_compliance", 0.5)
            .order("report_week_end", { ascending: false })
            .limit(20),
          supabase
            .from("parent_communications")
            .select("student_id, response_type, created_at")
            .eq("response_type", "Concerned")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        const firstErr =
          pendAssCount.error ||
          intApprovCount.error ||
          weeklyCount.error ||
          parentDraftCount.error ||
          pendAssList.error ||
          activeIntList.error ||
          weeklyList.error;
        if (firstErr) throw firstErr;

        if (cancelled) return;

        setCounts({
          pendingAssessments: pendAssCount.count ?? 0,
          interventionApprovals: intApprovCount.count ?? 0,
          weeklyPending: weeklyCount.count ?? 0,
          parentDraft: parentDraftCount.count ?? 0,
        });

        // Resolve student names
        const studentIds = new Set<string>();
        for (const a of pendAssList.data ?? []) studentIds.add(a.student_id);
        for (const i of activeIntList.data ?? []) studentIds.add(i.student_id);
        for (const w of weeklyList.data ?? []) studentIds.add(w.student_id);
        for (const d of declining.data ?? []) studentIds.add(d.student_id);
        for (const l of lowCompliance.data ?? []) studentIds.add(l.student_id);
        for (const c of concernedParents.data ?? []) studentIds.add(c.student_id);

        const studentsRes = studentIds.size
          ? await supabase
              .from("students")
              .select("id, first_name, student_code, school_section, complexity_flag")
              .in("id", Array.from(studentIds))
          : { data: [] as any[], error: null };

        const studentMap = new Map<string, any>();
        for (const s of studentsRes.data ?? []) studentMap.set(s.id, s);

        setPendingAssessments(
          (pendAssList.data ?? []).map((a) => ({
            ...a,
            student: studentMap.get(a.student_id) ?? null,
          })) as PendingAssessmentRow[],
        );

        setWeeklyPending(
          (weeklyList.data ?? []).map((w) => ({
            ...w,
            student: studentMap.get(w.student_id) ?? null,
          })) as WeeklyPendingRow[],
        );

        // Compute compliance for active interventions: % of last 7 days with at least one log
        const intRows = (activeIntList.data ?? []) as any[];
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
          .toISOString()
          .slice(0, 10);
        const logsRes = intRows.length
          ? await supabase
              .from("daily_logs")
              .select("student_id, log_date")
              .in("student_id", intRows.map((r) => r.student_id))
              .gte("log_date", sevenDaysAgo)
          : { data: [] as any[], error: null };
        const logsByStudent = new Map<string, Set<string>>();
        for (const l of logsRes.data ?? []) {
          if (!logsByStudent.has(l.student_id))
            logsByStudent.set(l.student_id, new Set());
          logsByStudent.get(l.student_id)!.add(l.log_date);
        }
        setActiveInterventions(
          intRows.map((r) => ({
            ...r,
            student: studentMap.get(r.student_id) ?? null,
            compliance: logsByStudent.has(r.student_id)
              ? Math.round((logsByStudent.get(r.student_id)!.size / 7) * 100)
              : 0,
          })) as ActiveInterventionRow[],
        );

        // Risk alerts
        const declineByStudent = new Map<string, number>();
        for (const d of declining.data ?? []) {
          declineByStudent.set(
            d.student_id,
            (declineByStudent.get(d.student_id) ?? 0) + 1,
          );
        }
        const ra: RiskAlert[] = [];
        const seen = new Set<string>();
        for (const [sid, cnt] of declineByStudent) {
          if (cnt >= 3) {
            const s = studentMap.get(sid);
            if (s) {
              ra.push({
                studentId: sid,
                studentName: s.first_name,
                reason: `Declining trend for ${cnt} weeks`,
                severity: "red",
              });
              seen.add(sid);
            }
          }
        }
        const lowSeen = new Set<string>();
        for (const l of lowCompliance.data ?? []) {
          if (lowSeen.has(l.student_id) || seen.has(l.student_id)) continue;
          lowSeen.add(l.student_id);
          const s = studentMap.get(l.student_id);
          if (s) {
            ra.push({
              studentId: l.student_id,
              studentName: s.first_name,
              reason: `Strategy compliance ${Math.round((l.strategy_compliance ?? 0) * 100)}%`,
              severity: "amber",
            });
            seen.add(l.student_id);
          }
        }
        const parentSeen = new Set<string>();
        for (const p of concernedParents.data ?? []) {
          if (parentSeen.has(p.student_id) || seen.has(p.student_id)) continue;
          parentSeen.add(p.student_id);
          const s = studentMap.get(p.student_id);
          if (s) {
            ra.push({
              studentId: p.student_id,
              studentName: s.first_name,
              reason: "Parent reported concern",
              severity: "amber",
            });
          }
        }
        setAlerts(ra.slice(0, 8));
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goToStudent = (id: string) =>
    navigate({ to: "/students/$studentId", params: { studentId: id } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-primary">
          Welcome, {name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clinical workspace — your reviews, approvals, and risk monitoring.
        </p>
      </div>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* Section 1 — Priority queue */}
      <section>
        <h2 className="text-lg font-heading font-semibold">Your Clinical Review Queue</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Items requiring your attention today
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PriorityCard
            tone="red"
            icon={<ClipboardCheck className="h-6 w-6" />}
            label="Pending Assessment Reviews"
            value={counts?.pendingAssessments}
            loading={loading}
            button="Review Now"
            onClick={() =>
              document.getElementById("pending-assessments")?.scrollIntoView({
                behavior: "smooth",
              })
            }
          />
          <PriorityCard
            tone="orange"
            icon={<Target className="h-6 w-6" />}
            label="Intervention Approvals"
            value={counts?.interventionApprovals}
            loading={loading}
            button="View Approvals"
            onClick={() =>
              document.getElementById("intervention-monitor")?.scrollIntoView({
                behavior: "smooth",
              })
            }
          />
          <PriorityCard
            tone="purple"
            icon={<BarChart3 className="h-6 w-6" />}
            label="Weekly Analysis Pending"
            value={counts?.weeklyPending}
            loading={loading}
            button="Review Analysis"
            onClick={() =>
              document.getElementById("weekly-analysis")?.scrollIntoView({
                behavior: "smooth",
              })
            }
          />
          <PriorityCard
            tone="teal"
            icon={<MessageSquare className="h-6 w-6" />}
            label="Parent Summaries Awaiting"
            value={counts?.parentDraft}
            loading={loading}
            button="Review Summaries"
            onClick={() =>
              document.getElementById("weekly-analysis")?.scrollIntoView({
                behavior: "smooth",
              })
            }
          />
        </div>
      </section>

      {/* Section 2 — Pending assessments */}
      <Card id="pending-assessments">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-semibold">
              Assessments Awaiting Review
            </h2>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : pendingAssessments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assessments awaiting review.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pendingAssessments.slice(0, 5).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-medium text-foreground">
                      {a.student?.first_name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {a.student?.school_section
                        ? SECTION_SHORT[a.student.school_section as SchoolSection] ??
                          a.student.school_section
                        : "—"}{" "}
                      · {a.student?.student_code ?? "—"}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground min-w-[110px]">
                    {a.assessment_date
                      ? new Date(a.assessment_date).toLocaleDateString()
                      : new Date(a.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground min-w-[120px]">
                    {a.consultant_name ?? "—"}
                  </div>
                  <ComplexityBadge value={a.student?.complexity_flag ?? null} />
                  <Button size="sm" onClick={() => goToStudent(a.student_id)}>
                    Review
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {pendingAssessments.length > 5 && (
            <p className="text-xs text-muted-foreground mt-3">
              Showing 5 of {pendingAssessments.length}+
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 3 — Intervention monitor */}
      <Card id="intervention-monitor">
        <CardContent className="p-5">
          <h2 className="text-lg font-heading font-semibold mb-4">
            Intervention Cycle Monitor
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activeInterventions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active interventions.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Domain</th>
                    <th className="py-2 pr-3">Strategy</th>
                    <th className="py-2 pr-3">Cycle Day</th>
                    <th className="py-2 pr-3">Compliance</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {activeInterventions.map((r) => {
                    const cycleDay = calcCycleDay(r.start_date, r.generated_at);
                    const cycleLen = r.cycle_length_days || 14;
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="py-3 pr-3 font-medium">
                          {r.student?.first_name ?? "—"}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {r.priority_domain ?? "—"}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground truncate max-w-[200px]">
                          {r.selected_strategy ?? "—"}
                        </td>
                        <td className="py-3 pr-3">
                          <CycleBadge day={cycleDay} length={cycleLen} />
                        </td>
                        <td className="py-3 pr-3">
                          <ComplianceBar value={r.compliance ?? 0} />
                        </td>
                        <td className="py-3 pr-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => goToStudent(r.student_id)}
                          >
                            View <ChevronRight className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4 — Weekly Analysis + Risk Alerts */}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card id="weekly-analysis">
          <CardContent className="p-5">
            <h2 className="text-lg font-heading font-semibold mb-4">
              Weekly Analysis Summary
            </h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : weeklyPending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No weekly analyses pending.
              </p>
            ) : (
              <ul className="space-y-3">
                {weeklyPending.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center gap-3 rounded-md border border-border p-3"
                  >
                    <TrendIcon trend={w.rating_trend} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">
                        {w.student?.first_name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(w.report_week_start).toLocaleDateString()} –{" "}
                        {new Date(w.report_week_end).toLocaleDateString()}
                      </p>
                    </div>
                    <TrendBadge trend={w.rating_trend} />
                    <Button size="sm" onClick={() => goToStudent(w.student_id)}>
                      Review
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-heading font-semibold mb-4">High-Risk Alerts</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active alerts.</p>
            ) : (
              <ul className="space-y-3">
                {alerts.map((a) => (
                  <li
                    key={`${a.studentId}-${a.reason}`}
                    className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:brightness-95 ${
                      a.severity === "red"
                        ? "bg-[oklch(0.96_0.04_25)] border-[oklch(0.7_0.18_25)]"
                        : "bg-[oklch(0.96_0.06_80)] border-[oklch(0.7_0.15_70)]"
                    }`}
                    onClick={() => goToStudent(a.studentId)}
                  >
                    <AlertTriangle
                      className={`h-5 w-5 ${
                        a.severity === "red"
                          ? "text-[oklch(0.5_0.2_25)]"
                          : "text-[oklch(0.5_0.18_60)]"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">
                        {a.studentName}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.reason}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function PriorityCard({
  tone,
  icon,
  label,
  value,
  loading,
  button,
  onClick,
}: {
  tone: "red" | "orange" | "purple" | "teal";
  icon: React.ReactNode;
  label: string;
  value: number | undefined;
  loading: boolean;
  button: string;
  onClick: () => void;
}) {
  const tones: Record<typeof tone, string> = {
    red: "linear-gradient(135deg, oklch(0.55 0.22 25), oklch(0.65 0.2 35))",
    orange: "linear-gradient(135deg, oklch(0.62 0.2 50), oklch(0.72 0.17 65))",
    purple: "linear-gradient(135deg, oklch(0.5 0.2 290), oklch(0.62 0.17 300))",
    teal: "linear-gradient(135deg, oklch(0.55 0.13 200), oklch(0.7 0.14 195))",
  };
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 text-white shadow-md flex flex-col"
      style={{ background: tones[tone] }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/85">
            {label}
          </p>
          <p className="mt-2 text-4xl font-heading font-bold leading-none">
            {loading ? "…" : value ?? 0}
          </p>
        </div>
        <div className="rounded-lg bg-white/15 p-2 backdrop-blur-sm">{icon}</div>
      </div>
      <button
        onClick={onClick}
        className="mt-4 self-start rounded-md bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-colors"
      >
        {button} →
      </button>
    </div>
  );
}

function ComplexityBadge({ value }: { value: string | null }) {
  if (!value) return null;
  const v = value.toLowerCase();
  let cls = "bg-muted text-muted-foreground";
  if (v.includes("simple") || v.includes("low"))
    cls = "bg-[oklch(0.92_0.08_150)] text-[oklch(0.35_0.12_150)]";
  else if (v.includes("moderate"))
    cls = "bg-[oklch(0.93_0.1_80)] text-[oklch(0.4_0.15_60)]";
  else if (v.includes("complex") || v.includes("high"))
    cls = "bg-[oklch(0.92_0.08_25)] text-[oklch(0.4_0.18_25)]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {value}
    </span>
  );
}

function calcCycleDay(start: string | null, generated: string): number {
  const base = start ?? generated;
  const baseDate = new Date(base);
  const now = new Date();
  const days = Math.floor((now.getTime() - baseDate.getTime()) / 86400000) + 1;
  return Math.max(1, days);
}

function CycleBadge({ day, length }: { day: number; length: number }) {
  if (day > length) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold bg-[oklch(0.55_0.22_25)] text-white animate-pulse">
        CYCLE COMPLETE — REVIEW
      </span>
    );
  }
  let cls = "bg-[oklch(0.92_0.08_150)] text-[oklch(0.35_0.15_150)]";
  if (day >= 12) cls = "bg-[oklch(0.92_0.08_25)] text-[oklch(0.4_0.18_25)]";
  else if (day >= 8) cls = "bg-[oklch(0.93_0.1_80)] text-[oklch(0.4_0.15_60)]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      Day {day} of {length}
    </span>
  );
}

function ComplianceBar({ value }: { value: number }) {
  const color =
    value >= 70
      ? "oklch(0.65 0.16 150)"
      : value >= 40
        ? "oklch(0.72 0.15 70)"
        : "oklch(0.6 0.2 25)";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">
        {value}%
      </span>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string | null }) {
  if (trend === "Improving")
    return <TrendingUp className="h-5 w-5 text-[oklch(0.5_0.18_150)]" />;
  if (trend === "Declining")
    return <TrendingDown className="h-5 w-5 text-[oklch(0.5_0.2_25)]" />;
  return <Minus className="h-5 w-5 text-muted-foreground" />;
}

function TrendBadge({ trend }: { trend: string | null }) {
  const t = trend ?? "Stable";
  let cls = "bg-muted text-muted-foreground";
  if (t === "Improving") cls = "bg-[oklch(0.92_0.08_150)] text-[oklch(0.35_0.15_150)]";
  else if (t === "Declining") cls = "bg-[oklch(0.92_0.08_25)] text-[oklch(0.4_0.18_25)]";
  else if (t === "Stable") cls = "bg-[oklch(0.93_0.04_240)] text-[oklch(0.4_0.1_240)]";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {t}
    </span>
  );
}
