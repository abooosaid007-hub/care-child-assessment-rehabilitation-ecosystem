import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, dashboardPathForRole } from "@/lib/auth-context";
import { CareLogo } from "@/components/CareLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, ClipboardCheck, AlertTriangle, FileText, UserPlus, Eye } from "lucide-react";
import { AddStudentDialog } from "@/components/AddStudentDialog";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Administrator Dashboard — CARE" }],
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
}

interface Stats {
  totalStudents: number;
  assessed: number;
  pending: number;
  highComplexity: number;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, profile, profileError, loading, signOut } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<StudentRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (profile && profile.role !== "administrator") {
      navigate({ to: dashboardPathForRole(profile.role) });
    }
  }, [loading, user, profile, navigate]);

  useEffect(() => {
    if (!profile || profile.role !== "administrator") return;

    let cancelled = false;
    (async () => {
      setDataLoading(true);
      setDataError(null);
      try {
        // Stat counts via head:true count queries
        const [totalRes, assessedRes, pendingRes, complexRes, recentRes] = await Promise.all([
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
            .eq("complexity_flag", "High"),
          supabase
            .from("students")
            .select(
              "id, student_code, first_name, primary_condition, class_section, assessment_status, status, complexity_flag, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        const firstError =
          totalRes.error ||
          assessedRes.error ||
          pendingRes.error ||
          complexRes.error ||
          recentRes.error;
        if (firstError) throw firstError;

        if (cancelled) return;
        setStats({
          totalStudents: totalRes.count ?? 0,
          assessed: assessedRes.count ?? 0,
          pending: pendingRes.count ?? 0,
          highComplexity: complexRes.count ?? 0,
        });
        setRecent((recentRes.data ?? []) as StudentRow[]);
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
  }, [profile]);

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

  if (!profile || profile.role !== "administrator") return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CareLogo size={36} />
            <div>
              <p className="font-heading font-semibold text-primary leading-tight">CARE</p>
              <p className="text-xs text-muted-foreground leading-tight">
                Child Assessment and Rehabilitation Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs font-medium">
              Administrator
            </span>
            <Button onClick={signOut} variant="outline" size="sm">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">
            Welcome, {profile.full_name && profile.full_name.length > 0 ? profile.full_name : profile.email}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of students, assessments, and quick actions.
          </p>
        </div>

        {dataError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {dataError}
          </div>
        )}

        {/* Stat cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Students"
            value={stats?.totalStudents}
            loading={dataLoading}
            icon={<Users className="h-5 w-5" />}
            tone="primary"
          />
          <StatCard
            label="Assessed"
            value={stats?.assessed}
            loading={dataLoading}
            icon={<ClipboardCheck className="h-5 w-5" />}
            tone="success"
          />
          <StatCard
            label="Pending Assessment"
            value={stats?.pending}
            loading={dataLoading}
            icon={<FileText className="h-5 w-5" />}
            tone="warning"
          />
          <StatCard
            label="High Complexity"
            value={stats?.highComplexity}
            loading={dataLoading}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="destructive"
          />
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/admin">
                <UserPlus className="h-4 w-4" />
                Add Student
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin">
                <Users className="h-4 w-4" />
                View All Students
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin">
                <FileText className="h-4 w-4" />
                Assessments
              </Link>
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Add Student form and full student list will be wired up in the next milestone.
          </p>
        </section>

        {/* Recent students */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent Students
            </h2>
          </div>
          <Card>
            <CardContent className="p-0">
              {dataLoading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading students…</div>
              ) : recent.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  No students yet. Use “Add Student” to enroll the first child.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Primary Condition</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.student_code}</TableCell>
                        <TableCell className="font-medium">{s.first_name}</TableCell>
                        <TableCell>{s.primary_condition}</TableCell>
                        <TableCell>{s.class_section ?? "—"}</TableCell>
                        <TableCell>
                          <StatusPill text={s.assessment_status} />
                        </TableCell>
                        <TableCell>
                          <StatusPill text={s.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" disabled>
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
  tone,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  icon: React.ReactNode;
  tone: "primary" | "success" | "warning" | "destructive";
}) {
  const toneClasses: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-accent text-accent-foreground",
    warning: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={`rounded-md p-2 ${toneClasses[tone]}`}>{icon}</div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-heading font-bold text-foreground">
          {loading ? "…" : (value ?? 0)}
        </p>
      </CardContent>
    </Card>
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
