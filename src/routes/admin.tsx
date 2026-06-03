import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { CareLogo } from "@/components/CareLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, ClipboardCheck, AlertTriangle, UserPlus, Eye, Target } from "lucide-react";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { AdminDashboardView } from "@/components/AdminDashboardView";
import { PsychologistDashboardView } from "@/components/PsychologistDashboardView";
import {
  SCHOOL_SECTIONS,
  SECTION_LABELS,
  SECTION_SHORT,
  ASD_SUBS,
  MCC_SUBS,
  CLASS_SUBS,
  type SchoolSection,
} from "@/lib/school-sections";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Dashboard — CARE" }],
  }),
  component: AdminDashboard,
});

interface StudentRow {
  id: string;
  student_code: string;
  first_name: string;
  primary_condition: string;
  class_section: string | null;
  assessment_status: string;
  status: string;
  complexity_flag: string | null;
  created_at: string;
  school_section: string | null;
  sub_category: string | null;
  intervention_status: string | null;
  created_by: string | null;
}

interface Stats {
  totalStudents: number;
  assessed: number;
  pending: number;
  highComplexity: number;
}

const STUDENT_COLS =
  "id, student_code, first_name, primary_condition, class_section, assessment_status, status, complexity_flag, created_at, school_section, sub_category, intervention_status, created_by";

type RoleView = "all" | "mine";

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, profile, profileError, loading, signOut } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Filters (psychologist & admin)
  const [filterSection, setFilterSection] = useState<string>("__all");
  const [filterAssessment, setFilterAssessment] = useState<string>("__all");
  const [filterIntervention, setFilterIntervention] = useState<string>("__all");

  // Active tab
  const role = profile?.role ?? null;
  const isAdmin = role === "administrator";
  const isPsych = role === "psychologist";
  const isTeacher = role === "teacher" || role === "speech_therapist";

  const [tab, setTab] = useState<string>("all");
  useEffect(() => {
    if (isTeacher) setTab("mine");
    else setTab("all");
  }, [isTeacher]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!profile) return;

    let cancelled = false;
    (async () => {
      setDataLoading(true);
      setDataError(null);
      try {
        const [totalRes, assessedRes, pendingRes, complexRes, listRes] = await Promise.all([
          supabase.from("students").select("id", { count: "exact", head: true }),
          supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("assessment_status", "Assessed"),
          supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("assessment_status", "Not Yet Assessed"),
          supabase
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("complexity_flag", "Complex"),
          supabase
            .from("students")
            .select(STUDENT_COLS)
            .order("created_at", { ascending: false }),
        ]);

        const firstError =
          totalRes.error ||
          assessedRes.error ||
          pendingRes.error ||
          complexRes.error ||
          listRes.error;
        if (firstError) throw firstError;

        if (cancelled) return;
        setStats({
          totalStudents: totalRes.count ?? 0,
          assessed: assessedRes.count ?? 0,
          pending: pendingRes.count ?? 0,
          highComplexity: complexRes.count ?? 0,
        });
        setStudents((listRes.data ?? []) as StudentRow[]);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load dashboard data";
          setDataError(msg);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, reloadKey]);

  // Apply top-level filters (psych & admin)
  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (filterSection !== "__all" && s.school_section !== filterSection) return false;
      if (filterAssessment !== "__all" && s.assessment_status !== filterAssessment) return false;
      if (filterIntervention !== "__all") {
        const hasActive = !!s.intervention_status;
        if (filterIntervention === "Active" && !hasActive) return false;
        if (filterIntervention === "None" && hasActive) return false;
      }
      return true;
    });
  }, [students, filterSection, filterAssessment, filterIntervention]);

  const myStudents = useMemo(
    () => filtered.filter((s) => s.created_by === user?.id),
    [filtered, user?.id],
  );

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

  if (!profile) return null;

  if (isAdmin) {
    return (
      <div className="min-h-full bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <AdminDashboardView
            adminName={
              profile.full_name && profile.full_name.length > 0
                ? profile.full_name
                : profile.email ?? "Administrator"
            }
          />
        </div>
      </div>
    );
  }

  const roleLabel =
    role === "psychologist"
      ? "Psychologist"
      : role === "teacher"
        ? "Teacher"
        : role === "speech_therapist"
          ? "Speech Therapist"
          : "User";

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">
            Welcome,{" "}
            {profile.full_name && profile.full_name.length > 0
              ? profile.full_name
              : profile.email}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Students grouped by school section. Each child shown with full identity.
          </p>
        </div>

        {dataError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {dataError}
          </div>
        )}

        {/* Stat cards (admin only) */}
        {isAdmin && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Students" value={stats?.totalStudents} loading={dataLoading} icon={<Users className="h-6 w-6" />} tone="navy" subtitle="Across all sections" />
            <StatCard label="Assessments" value={stats?.assessed} loading={dataLoading} icon={<ClipboardCheck className="h-6 w-6" />} tone="teal" subtitle="Completed" />
            <StatCard label="Active Interventions" value={stats?.pending} loading={dataLoading} icon={<Target className="h-6 w-6" />} tone="purple" subtitle="In progress" />
            <StatCard label="High Complexity" value={stats?.highComplexity} loading={dataLoading} icon={<AlertTriangle className="h-6 w-6" />} tone="green" subtitle="Needs attention" />
          </section>
        )}

        {/* Quick actions (admin only) */}
        {isAdmin && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus className="h-4 w-4" /> Add Student
              </Button>
            </div>
          </section>
        )}

        {/* Filters (admin & psychologist) */}
        {(isAdmin || isPsych) && (
          <section className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Filter by Section
              </label>
              <Select value={filterSection} onValueChange={setFilterSection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All sections</SelectItem>
                  {SCHOOL_SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{SECTION_LABELS[s]}</SelectItem>
                  ))}
                  <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Filter by Assessment Status
              </label>
              <Select value={filterAssessment} onValueChange={setFilterAssessment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All</SelectItem>
                  <SelectItem value="Not Yet Assessed">Not Yet Assessed</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Pending Review">Pending Review</SelectItem>
                  <SelectItem value="Diagnosis Confirmed">Diagnosis Confirmed</SelectItem>
                  <SelectItem value="Assessed">Assessed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Filter by Intervention Status
              </label>
              <Select value={filterIntervention} onValueChange={setFilterIntervention}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All</SelectItem>
                  <SelectItem value="Active">Has active strategy</SelectItem>
                  <SelectItem value="None">No active strategy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        )}

        {/* Tabbed section views */}
        <section>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="flex flex-wrap gap-1 h-auto">
              {isTeacher && (
                <TabsTrigger value="mine">
                  My Students <Badge n={myStudents.length} />
                </TabsTrigger>
              )}
              <TabsTrigger value="all">
                All Students <Badge n={filtered.length} />
              </TabsTrigger>
              {SCHOOL_SECTIONS.map((sec) => {
                const count = filtered.filter((s) => s.school_section === sec).length;
                return (
                  <TabsTrigger key={sec} value={sec}>
                    {SECTION_SHORT[sec]} Section <Badge n={count} />
                  </TabsTrigger>
                );
              })}
              <TabsTrigger value="Uncategorized">
                Uncategorized{" "}
                <Badge n={filtered.filter((s) => !s.school_section).length} />
              </TabsTrigger>
            </TabsList>

            {isTeacher && (
              <TabsContent value="mine" className="mt-4">
                <FlatList rows={myStudents} loading={dataLoading} navigate={navigate} />
              </TabsContent>
            )}

            <TabsContent value="all" className="mt-4">
              <FlatList rows={filtered} loading={dataLoading} navigate={navigate} />
            </TabsContent>

            {SCHOOL_SECTIONS.map((sec) => (
              <TabsContent key={sec} value={sec} className="mt-4">
                <GroupedSectionList
                  section={sec}
                  rows={filtered.filter((s) => s.school_section === sec)}
                  loading={dataLoading}
                  navigate={navigate}
                />
              </TabsContent>
            ))}

            <TabsContent value="Uncategorized" className="mt-4">
              <FlatList
                rows={filtered.filter((s) => !s.school_section)}
                loading={dataLoading}
                navigate={navigate}
                emptyText="No uncategorized students."
              />
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <AddStudentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
      {n}
    </span>
  );
}

function GroupedSectionList({
  section,
  rows,
  loading,
  navigate,
}: {
  section: SchoolSection;
  rows: StudentRow[];
  loading: boolean;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const groups: readonly string[] =
    section === "ASD Section"
      ? ASD_SUBS
      : section === "MCC"
        ? MCC_SUBS
        : CLASS_SUBS;

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No students in {SECTION_LABELS[section]}.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const items = rows.filter((r) => r.sub_category === g);
        if (items.length === 0) return null;
        return (
          <div key={g}>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {g} <span className="text-muted-foreground">({items.length})</span>
            </h3>
            <FlatList rows={items} loading={false} navigate={navigate} compact />
          </div>
        );
      })}
      {/* Any rows with sub_category outside the standard list */}
      {(() => {
        const others = rows.filter((r) => !groups.includes(r.sub_category as never));
        if (others.length === 0) return null;
        return (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">
              Other / Unspecified ({others.length})
            </h3>
            <FlatList rows={others} loading={false} navigate={navigate} compact />
          </div>
        );
      })()}
    </div>
  );
}

function FlatList({
  rows,
  loading,
  navigate,
  emptyText,
  compact,
}: {
  rows: StudentRow[];
  loading: boolean;
  navigate: ReturnType<typeof useNavigate>;
  emptyText?: string;
  compact?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading students…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            {emptyText ?? "No students match the current filters."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Sub-Category</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Primary Condition</TableHead>
                {!compact && <TableHead>Assessment</TableHead>}
                {!compact && <TableHead>Status</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    navigate({ to: "/students/$studentId", params: { studentId: s.id } })
                  }
                >
                  <TableCell className="font-medium">
                    {s.first_name}
                    <div className="text-[11px] text-muted-foreground">
                      {(s.school_section
                        ? SECTION_SHORT[s.school_section as SchoolSection] ?? s.school_section
                        : "Uncategorized")}
                      {" | "}
                      {s.sub_category ?? "—"}
                      {" | ID: "}
                      {s.student_code}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.school_section ? (
                      <span className="inline-flex items-center rounded-md bg-indigo-100 text-indigo-900 px-2 py-0.5 text-xs font-medium">
                        {SECTION_SHORT[s.school_section as SchoolSection] ?? s.school_section}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Uncategorized</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{s.sub_category ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                  <TableCell>{s.primary_condition}</TableCell>
                  {!compact && (
                    <TableCell>
                      <StatusPill text={s.assessment_status} />
                    </TableCell>
                  )}
                  {!compact && (
                    <TableCell>
                      <StatusPill text={s.status} />
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link to="/students/$studentId" params={{ studentId: s.id }}>
                        <Eye className="h-4 w-4" /> View
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
  tone,
  subtitle,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: React.ReactNode;
  tone: "navy" | "teal" | "purple" | "green";
  subtitle?: string;
}) {
  const toneStyles: Record<typeof tone, string> = {
    navy: "var(--gradient-navy)",
    teal: "var(--gradient-teal)",
    purple: "var(--gradient-purple)",
    green: "var(--gradient-green)",
  };
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 text-white shadow-md"
      style={{
        background: toneStyles[tone],
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
          {subtitle && (
            <p className="mt-2 text-xs text-white/70">{subtitle}</p>
          )}
        </div>
        <div className="rounded-lg bg-white/15 p-2 backdrop-blur-sm">{icon}</div>
      </div>
      {/* Decorative wave */}
      <svg
        aria-hidden
        className="absolute bottom-0 left-0 right-0 w-full opacity-25"
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

function StatusPill({ text }: { text: string }) {
  const lower = text.toLowerCase();
  let cls = "bg-muted text-muted-foreground";
  if (lower.includes("assessed") && !lower.includes("not")) cls = "bg-accent text-accent-foreground";
  else if (lower.includes("pending") || lower.includes("not yet")) cls = "bg-secondary text-secondary-foreground";
  else if (lower.includes("active")) cls = "bg-primary/10 text-primary";
  else if (lower.includes("inactive") || lower.includes("withdrawn"))
    cls = "bg-destructive/10 text-destructive";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {text}
    </span>
  );
}
