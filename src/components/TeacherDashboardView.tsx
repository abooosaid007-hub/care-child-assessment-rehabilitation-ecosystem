import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotebookPen, Pencil, Users, ClipboardCheck, AlertTriangle, TrendingUp } from "lucide-react";
import { DailyLogOverlay } from "@/components/DailyLogOverlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MyStudent {
  id: string;
  student_code: string;
  first_name: string;
  school_section: string | null;
  sub_category: string | null;
  priority_domain: string | null;
}

interface LogRow {
  student_id: string;
  log_date: string;
  rating: number | null;
  created_by: string | null;
}

const SECTION_TONE: Record<string, string> = {
  "ASD Section": "bg-[#1B3A6B]",
  MCC: "bg-[#00B4D8]",
  HIC: "bg-green-600",
  VIC: "bg-purple-600",
  PHC: "bg-amber-500",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TeacherDashboardView() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<MyStudent[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState<MyStudent | null>(null);
  const [fabPickerOpen, setFabPickerOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: stuRes, error: stuErr } = await supabase
          .from("students")
          .select(
            "id, student_code, first_name, school_section, sub_category, priority_domain, created_by",
          )
          .eq("created_by", user.id)
          .order("first_name", { ascending: true });
        if (stuErr) throw stuErr;

        const stuList = (stuRes ?? []) as MyStudent[];
        if (cancelled) return;
        setStudents(stuList);

        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        const mondayStr = monday.toISOString().slice(0, 10);

        if (stuList.length > 0) {
          const { data: lgRes, error: lgErr } = await supabase
            .from("daily_logs")
            .select("student_id, log_date, rating, created_by")
            .in("student_id", stuList.map((s) => s.id))
            .gte("log_date", mondayStr);
          if (lgErr) throw lgErr;
          if (!cancelled) setLogs((lgRes ?? []) as LogRow[]);
        } else {
          setLogs([]);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, reloadKey]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const loggedTodayIds = useMemo(() => {
    const s = new Set<string>();
    for (const l of logs) if (l.log_date === todayStr) s.add(l.student_id);
    return s;
  }, [logs, todayStr]);

  const loggedTodayByMe = useMemo(
    () =>
      logs.filter((l) => l.log_date === todayStr && l.created_by === user?.id).length,
    [logs, todayStr, user?.id],
  );

  const pendingToday = students.filter((s) => !loggedTodayIds.has(s.id));

  const weekAvg = useMemo(() => {
    const ratings = logs.map((l) => l.rating).filter((r): r is number => typeof r === "number");
    if (ratings.length === 0) return null;
    return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
  }, [logs]);

  const teacherName =
    profile?.full_name && profile.full_name.length > 0
      ? profile.full_name
      : profile?.email ?? "Teacher";

  return (
    <div className="min-h-full bg-background pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Welcome, {teacherName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your assigned students and today's logs.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="My Students"
            value={loading ? "…" : students.length}
            icon={<Users className="h-5 w-5" />}
            gradient="linear-gradient(135deg, #00B4D8 0%, #0096B8 100%)"
          />
          <StatCard
            label="Logged Today"
            value={loading ? "…" : loggedTodayByMe}
            icon={<ClipboardCheck className="h-5 w-5" />}
            gradient="linear-gradient(135deg, #52B788 0%, #3D9A6E 100%)"
          />
          <StatCard
            label="Pending Logs"
            value={loading ? "…" : pendingToday.length}
            icon={<AlertTriangle className="h-5 w-5" />}
            gradient="linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
          />
          <StatCard
            label="Week Avg"
            value={loading ? "…" : weekAvg ?? "—"}
            icon={<TrendingUp className="h-5 w-5" />}
            gradient="linear-gradient(135deg, #7B2D8B 0%, #9B3DAB 100%)"
          />
        </section>

        {/* My Students */}
        <section>
          <h2 className="text-lg font-semibold text-foreground">My Students</h2>
          <p className="text-sm text-muted-foreground mb-3">Tap any student to view or log</p>

          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : students.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No students assigned to you yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {students.map((s) => {
                const logged = loggedTodayIds.has(s.id);
                const tone =
                  (s.school_section && SECTION_TONE[s.school_section]) ?? "bg-muted-foreground";
                return (
                  <Card key={s.id} className="overflow-hidden">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-12 w-12 rounded-full ${tone} text-white flex items-center justify-center font-bold`}
                        >
                          {initials(s.first_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{s.first_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {s.school_section ?? "—"}
                            {s.sub_category ? ` · ${s.sub_category}` : ""}
                          </p>
                        </div>
                      </div>
                      {s.priority_domain && (
                        <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-xs font-medium">
                          {s.priority_domain}
                        </span>
                      )}
                      <div
                        className={`text-xs font-semibold ${logged ? "text-green-700" : "text-amber-700"}`}
                      >
                        {logged ? "Logged ✅" : "Log Now ⚠️"}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                          onClick={() => setLogOpen(s)}
                        >
                          <NotebookPen className="h-4 w-4" /> Log Now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate({ to: "/students/$studentId", params: { studentId: s.id } })
                          }
                        >
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Pending Today */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-3">Pending Logs Today</h2>
          {loading ? null : pendingToday.length === 0 ? (
            <Card className="border-green-300 bg-green-50">
              <CardContent className="p-6 text-center text-green-800 font-medium">
                ✅ All students logged today! Great work.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {pendingToday.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.first_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.school_section ?? "—"}
                        {s.sub_category ? ` · ${s.sub_category}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={() => setLogOpen(s)}
                    >
                      <NotebookPen className="h-4 w-4" /> Log Now
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setFabPickerOpen((v) => !v)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg flex items-center justify-center z-30"
        aria-label="Quick log"
      >
        <Pencil className="h-6 w-6" />
      </button>

      {fabPickerOpen && (
        <div className="fixed bottom-24 right-6 w-72 bg-card border rounded-lg shadow-xl p-3 z-30">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            Quick log for…
          </p>
          <Select
            onValueChange={(v) => {
              const s = students.find((x) => x.id === v);
              if (s) {
                setLogOpen(s);
                setFabPickerOpen(false);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.first_name} · {s.school_section ?? "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {logOpen && (
        <DailyLogOverlay
          studentId={logOpen.id}
          studentName={logOpen.first_name}
          priorityDomain={logOpen.priority_domain}
          onClose={() => {
            setLogOpen(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  gradient,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Card className="border-0 text-white overflow-hidden" style={{ background: gradient }}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase font-semibold opacity-90">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className="opacity-80">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
