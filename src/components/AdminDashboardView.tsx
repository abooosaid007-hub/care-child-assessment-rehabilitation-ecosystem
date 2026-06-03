import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import {
  Users,
  ClipboardCheck,
  Target,
  PencilLine,
  UserPlus,
  Send,
  ChevronRight,
  Calendar,
  FileText,
  MessageSquare,
  Activity,
  Phone,
} from "lucide-react";
import {
  SCHOOL_SECTIONS,
  SECTION_SHORT,
  type SchoolSection,
} from "@/lib/school-sections";

interface StudentRow {
  id: string;
  student_code: string;
  first_name: string;
  school_section: string | null;
  sub_category: string | null;
  complexity_flag: string | null;
  status: string;
  intervention_status: string | null;
  assessment_status: string;
  created_at: string;
}

interface Stats {
  totalStudents: number;
  newThisMonth: number;
  pendingAssessments: number;
  activeInterventions: number;
  todaysLogs: number;
}

interface ActivityItem {
  id: string;
  kind: "log" | "assessment" | "intervention" | "message" | "student";
  text: string;
  when: string;
  actor: string | null;
}

export function AdminDashboardView({ adminName }: { adminName: string }) {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [stats, setStats] = useState<Stats | null>(null);
  const [recentStudents, setRecentStudents] = useState<StudentRow[]>([]);
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000).toISOString();

        const [
          totalRes,
          newMonthRes,
          pendingNYARes,
          pendingIPRes,
          activeInterRes,
          todayLogsRes,
          recentStudentsRes,
          allSectionsRes,
          logsRes,
          assessRes,
          intRes,
          msgRes,
          newStudentsRes,
        ] = await Promise.all([
          supabase.from("students").select("id", { count: "exact", head: true }),
          supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .gte("created_at", thirtyDaysAgo),
          supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("assessment_status", "Not Yet Assessed"),
          supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("assessment_status", "In Progress"),
          supabase
            .from("intervention_plans")
            .select("id", { count: "exact", head: true })
            .eq("status", "Active"),
          supabase
            .from("daily_logs")
            .select("id", { count: "exact", head: true })
            .eq("log_date", todayStr),
          supabase
            .from("students")
            .select(
              "id, student_code, first_name, school_section, sub_category, complexity_flag, status, intervention_status, assessment_status, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(6),
          supabase.from("students").select("school_section"),
          supabase
            .from("daily_logs")
            .select("id, created_at, created_by, student_id, log_date")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("assessments")
            .select("id, created_at, created_by, psychologist_status, student_id")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("intervention_plans")
            .select("id, generated_at, created_by, student_id, status")
            .order("generated_at", { ascending: false })
            .limit(8),
          supabase
            .from("parent_communications")
            .select("id, sent_at, created_at, sent_by, created_by, status, student_id")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("students")
            .select("id, first_name, created_at, created_by")
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

        const firstErr =
          totalRes.error ||
          newMonthRes.error ||
          pendingNYARes.error ||
          pendingIPRes.error ||
          activeInterRes.error ||
          todayLogsRes.error ||
          recentStudentsRes.error ||
          allSectionsRes.error;
        if (firstErr) throw firstErr;

        if (cancelled) return;

        setStats({
          totalStudents: totalRes.count ?? 0,
          newThisMonth: newMonthRes.count ?? 0,
          pendingAssessments: (pendingNYARes.count ?? 0) + (pendingIPRes.count ?? 0),
          activeInterventions: activeInterRes.count ?? 0,
          todaysLogs: todayLogsRes.count ?? 0,
        });

        setRecentStudents((recentStudentsRes.data ?? []) as StudentRow[]);

        const counts: Record<string, number> = {};
        for (const s of SCHOOL_SECTIONS) counts[s] = 0;
        for (const row of allSectionsRes.data ?? []) {
          const k = (row as { school_section: string | null }).school_section;
          if (k && k in counts) counts[k] += 1;
        }
        setSectionCounts(counts);

        // Build activity feed — resolve student names + actor names lazily
        const studentIds = new Set<string>();
        const actorIds = new Set<string>();
        const collect = (
          rows: Array<{ student_id?: string | null; created_by?: string | null; sent_by?: string | null }> | null,
        ) => {
          for (const r of rows ?? []) {
            if (r.student_id) studentIds.add(r.student_id);
            if (r.created_by) actorIds.add(r.created_by);
            if (r.sent_by) actorIds.add(r.sent_by);
          }
        };
        collect(logsRes.data as any);
        collect(assessRes.data as any);
        collect(intRes.data as any);
        collect(msgRes.data as any);
        for (const s of newStudentsRes.data ?? []) {
          if ((s as any).created_by) actorIds.add((s as any).created_by);
        }

        const [studentNameRes, actorNameRes] = await Promise.all([
          studentIds.size
            ? supabase
                .from("students")
                .select("id, first_name")
                .in("id", Array.from(studentIds))
            : Promise.resolve({ data: [] as any[], error: null }),
          actorIds.size
            ? supabase
                .from("profiles")
                .select("id, full_name, email")
                .in("id", Array.from(actorIds))
            : Promise.resolve({ data: [] as any[], error: null }),
        ]);

        const studentName = new Map<string, string>();
        for (const r of studentNameRes.data ?? []) studentName.set(r.id, r.first_name);
        const actorName = new Map<string, string>();
        for (const r of actorNameRes.data ?? [])
          actorName.set(r.id, r.full_name || r.email || "Unknown");

        const items: ActivityItem[] = [];
        for (const r of (logsRes.data ?? []) as any[]) {
          items.push({
            id: `log-${r.id}`,
            kind: "log",
            text: `Daily log completed for ${studentName.get(r.student_id) ?? "student"}`,
            when: r.created_at,
            actor: r.created_by ? actorName.get(r.created_by) ?? null : null,
          });
        }
        for (const r of (assessRes.data ?? []) as any[]) {
          items.push({
            id: `as-${r.id}`,
            kind: "assessment",
            text: `Assessment ${r.psychologist_status?.toLowerCase() ?? "updated"} for ${studentName.get(r.student_id) ?? "student"}`,
            when: r.created_at,
            actor: r.created_by ? actorName.get(r.created_by) ?? null : null,
          });
        }
        for (const r of (intRes.data ?? []) as any[]) {
          items.push({
            id: `int-${r.id}`,
            kind: "intervention",
            text: `Intervention plan ${r.status?.toLowerCase() ?? "updated"} for ${studentName.get(r.student_id) ?? "student"}`,
            when: r.generated_at,
            actor: r.created_by ? actorName.get(r.created_by) ?? null : null,
          });
        }
        for (const r of (msgRes.data ?? []) as any[]) {
          const when = r.sent_at ?? r.created_at;
          items.push({
            id: `msg-${r.id}`,
            kind: "message",
            text: `Message ${r.status === "Sent" ? "sent to parents" : "drafted"} for ${studentName.get(r.student_id) ?? "student"}`,
            when,
            actor: (r.sent_by ?? r.created_by) ? actorName.get(r.sent_by ?? r.created_by) ?? null : null,
          });
        }
        for (const r of (newStudentsRes.data ?? []) as any[]) {
          items.push({
            id: `stu-${r.id}`,
            kind: "student",
            text: `New student added: ${r.first_name}`,
            when: r.created_at,
            actor: r.created_by ? actorName.get(r.created_by) ?? null : null,
          });
        }

        items.sort((a, b) => (a.when < b.when ? 1 : -1));
        setActivities(items.slice(0, 8));
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const scrollToStudents = () => {
    document.getElementById("student-overview")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-primary">
          Welcome, {adminName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administrator dashboard — overview of the entire system.
        </p>
      </div>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* Section 1 — Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          tone="navy"
          icon={<Users className="h-6 w-6" />}
          label="Total Students"
          value={stats?.totalStudents}
          subtitle={
            stats ? `+${stats.newThisMonth} this month` : "+0 this month"
          }
          loading={loading}
        />
        <StatCard
          tone="teal"
          icon={<ClipboardCheck className="h-6 w-6" />}
          label="Pending Assessments"
          value={stats?.pendingAssessments}
          subtitle="Awaiting review"
          loading={loading}
        />
        <StatCard
          tone="purple"
          icon={<Target className="h-6 w-6" />}
          label="Active Interventions"
          value={stats?.activeInterventions}
          subtitle="In progress"
          loading={loading}
        />
        <StatCard
          tone="green"
          icon={<PencilLine className="h-6 w-6" />}
          label="Today's Logs"
          value={stats?.todaysLogs}
          subtitle="Submitted today"
          loading={loading}
        />
      </section>

      {/* Section 2/3 — Student overview + Quick actions */}
      <section className="grid gap-6 lg:grid-cols-5">
        <Card id="student-overview" className="lg:col-span-3">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-semibold">Student Overview</h2>
              <button
                onClick={scrollToStudents}
                className="text-sm font-medium text-primary hover:underline"
              >
                View all students →
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recentStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentStudents.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 py-3 cursor-pointer hover:bg-muted/40 rounded-md px-2 -mx-2"
                    onClick={() =>
                      navigate({ to: "/students/$studentId", params: { studentId: s.id } })
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {s.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {s.student_code}
                      </p>
                    </div>
                    <div className="hidden sm:block text-xs text-muted-foreground min-w-[120px]">
                      {s.school_section
                        ? SECTION_SHORT[s.school_section as SchoolSection] ?? s.school_section
                        : "—"}
                      {" · "}
                      {s.sub_category ?? "—"}
                    </div>
                    <ComplexityBadge value={s.complexity_flag} />
                    <div className="hidden md:block text-xs text-muted-foreground min-w-[110px] text-right">
                      {formatWhen(s.created_at)}
                    </div>
                    <StatusBadge intervention={s.intervention_status} status={s.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <h2 className="text-lg font-heading font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <QuickActionButton
                color="teal"
                icon={<UserPlus className="h-5 w-5" />}
                label="Add New Student"
                onClick={() => setAddOpen(true)}
              />
              <QuickActionButton
                color="blue"
                icon={<ClipboardCheck className="h-5 w-5" />}
                label="New Assessment"
                onClick={scrollToStudents}
              />
              <QuickActionButton
                color="green"
                icon={<PencilLine className="h-5 w-5" />}
                label="Daily Log"
                onClick={scrollToStudents}
              />
              <QuickActionButton
                color="purple"
                icon={<Send className="h-5 w-5" />}
                label="Send Message"
                onClick={scrollToStudents}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 4 — Activity + Right column */}
      <section className="grid gap-6 lg:grid-cols-11">
        <Card className="lg:col-span-6">
          <CardContent className="p-5">
            <h2 className="text-lg font-heading font-semibold mb-4">Recent Activities</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <ul className="space-y-3">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <ActivityIcon kind={a.kind} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{a.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(a.when)}
                        {a.actor ? ` · ${a.actor}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardContent className="p-5">
              <h2 className="text-lg font-heading font-semibold mb-4">
                Upcoming Meetings & Calls
              </h2>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No meetings scheduled.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="text-lg font-heading font-semibold mb-4">Section Summary</h2>
              <ul className="space-y-2">
                {SCHOOL_SECTIONS.map((sec) => (
                  <li
                    key={sec}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0"
                  >
                    <span className="font-medium text-foreground">
                      {SECTION_SHORT[sec]} Section
                    </span>
                    <span className="text-muted-foreground">
                      {sectionCounts[sec] ?? 0} students
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <AddStudentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  icon,
  tone,
  loading,
}: {
  label: string;
  value: number | undefined;
  subtitle?: string;
  icon: React.ReactNode;
  tone: "navy" | "teal" | "purple" | "green";
  loading: boolean;
}) {
  const tones: Record<typeof tone, string> = {
    navy: "var(--gradient-navy)",
    teal: "var(--gradient-teal)",
    purple: "var(--gradient-purple)",
    green: "var(--gradient-green)",
  };
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 text-white shadow-md"
      style={{
        background: tones[tone],
        boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/80">
            {label}
          </p>
          <p className="mt-2 text-4xl font-heading font-bold leading-none">
            {loading ? "…" : (value ?? 0)}
          </p>
          {subtitle && <p className="mt-2 text-xs text-white/80">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-white/15 p-2 backdrop-blur-sm">{icon}</div>
      </div>
      <svg
        aria-hidden
        className="absolute bottom-0 left-0 right-0 w-full opacity-20"
        viewBox="0 0 200 30"
        preserveAspectRatio="none"
      >
        <path
          d="M0,20 C40,8 80,28 120,16 C160,4 180,22 200,14 L200,30 L0,30 Z"
          fill="white"
        />
      </svg>
    </div>
  );
}

function QuickActionButton({
  color,
  icon,
  label,
  onClick,
}: {
  color: "teal" | "blue" | "green" | "purple";
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const styles: Record<typeof color, string> = {
    teal: "bg-[oklch(0.72_0.13_200)] hover:brightness-110",
    blue: "bg-primary hover:brightness-110",
    green: "bg-[oklch(0.65_0.16_150)] hover:brightness-110",
    purple: "bg-[oklch(0.55_0.18_290)] hover:brightness-110",
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-xl p-4 text-white transition-all ${styles[color]} shadow-sm hover:shadow-md text-left`}
    >
      <div className="rounded-md bg-white/20 p-2">{icon}</div>
      <span className="text-sm font-semibold leading-tight">{label}</span>
    </button>
  );
}

function ComplexityBadge({ value }: { value: string | null }) {
  if (!value) return <span className="hidden sm:inline text-xs text-muted-foreground w-20" />;
  const v = value.toLowerCase();
  let cls = "bg-muted text-muted-foreground";
  if (v.includes("simple") || v.includes("low"))
    cls = "bg-[oklch(0.92_0.08_150)] text-[oklch(0.35_0.12_150)]";
  else if (v.includes("moderate") || v.includes("medium"))
    cls = "bg-[oklch(0.93_0.1_80)] text-[oklch(0.4_0.15_60)]";
  else if (v.includes("complex") || v.includes("high"))
    cls = "bg-[oklch(0.92_0.08_25)] text-[oklch(0.4_0.18_25)]";
  return (
    <span
      className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}
    >
      {value}
    </span>
  );
}

function StatusBadge({
  intervention,
  status,
}: {
  intervention: string | null;
  status: string;
}) {
  let label = status;
  let cls = "bg-muted text-muted-foreground";
  if (intervention === "Active") {
    label = "Active";
    cls = "bg-primary/10 text-primary";
  } else if (intervention === "Monitoring") {
    label = "Monitoring";
    cls = "bg-[oklch(0.93_0.08_240)] text-[oklch(0.4_0.18_240)]";
  } else if (status?.toLowerCase().includes("active")) {
    cls = "bg-primary/10 text-primary";
  } else if (status?.toLowerCase().includes("pending")) {
    cls = "bg-[oklch(0.93_0.1_80)] text-[oklch(0.4_0.15_60)]";
  }
  return (
    <span
      className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

function ActivityIcon({ kind }: { kind: ActivityItem["kind"] }) {
  const map: Record<ActivityItem["kind"], { icon: React.ReactNode; cls: string }> = {
    log: {
      icon: <PencilLine className="h-4 w-4" />,
      cls: "bg-[oklch(0.92_0.08_150)] text-[oklch(0.35_0.15_150)]",
    },
    assessment: {
      icon: <ClipboardCheck className="h-4 w-4" />,
      cls: "bg-[oklch(0.92_0.08_220)] text-[oklch(0.35_0.15_220)]",
    },
    intervention: {
      icon: <Target className="h-4 w-4" />,
      cls: "bg-[oklch(0.92_0.08_290)] text-[oklch(0.4_0.15_290)]",
    },
    message: {
      icon: <MessageSquare className="h-4 w-4" />,
      cls: "bg-[oklch(0.93_0.1_80)] text-[oklch(0.4_0.15_60)]",
    },
    student: {
      icon: <UserPlus className="h-4 w-4" />,
      cls: "bg-primary/10 text-primary",
    },
  };
  const m = map[kind];
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${m.cls}`}>
      {m.icon}
    </div>
  );
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString();
}
