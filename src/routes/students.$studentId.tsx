import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ClipboardList,
  NotebookPen,
  Sparkles,
  Target,
  FileText,
  MessageSquare,
  BarChart3,
} from "lucide-react";
import { AssessmentOverlay } from "@/components/AssessmentOverlay";
import { DailyLogOverlay } from "@/components/DailyLogOverlay";
import { PriorityDomainOverlay } from "@/components/PriorityDomainOverlay";
import { InterventionOptionsOverlay } from "@/components/InterventionOptionsOverlay";
import { InterventionReviewPanel } from "@/components/InterventionReviewPanel";
import { WeeklyAnalysisPanel } from "@/components/WeeklyAnalysisPanel";
import { ParentSummaryPanel } from "@/components/ParentSummaryPanel";
import { DailyLogHistory } from "@/components/DailyLogHistory";
import { MonthlyReviewPanel } from "@/components/MonthlyReviewPanel";

export const Route = createFileRoute("/students/$studentId")({
  head: () => ({ meta: [{ title: "Student Profile — CARE" }] }),
  component: StudentProfilePage,
});

interface Student {
  id: string;
  student_code: string;
  first_name: string;
  date_of_birth: string;
  gender: string | null;
  class_section: string | null;
  primary_condition: string;
  comorbid_conditions: string[];
  under_observation: string[];
  observation_notes: string | null;
  severity: string | null;
  complexity_flag: string | null;
  status: string;
  assessment_status: string;
  enrollment_date: string | null;
  priority_domain: string | null;
  priority_domain_start_date: string | null;
  intervention_status: string | null;
  school_section: string | null;
  sub_category: string | null;
  intervention_cycle_count: number | null;
}

function calcAge(dob: string): string {
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return `${age} yrs`;
}

function complexityClasses(flag: string | null): string {
  switch (flag) {
    case "Simple":
      return "bg-green-100 text-green-800 border-green-300";
    case "Moderate":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "Complex":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function cycleDay(startDate: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;
  const ms = Date.now() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

function cycleDayClasses(day: number | null): string {
  if (day === null) return "bg-muted text-muted-foreground";
  if (day >= 15) return "bg-red-600 text-white animate-pulse";
  if (day >= 12) return "bg-red-500 text-white";
  if (day >= 8) return "bg-amber-500 text-white";
  return "bg-green-600 text-white";
}

const STUDENT_COLS =
  "id, student_code, first_name, date_of_birth, gender, class_section, primary_condition, comorbid_conditions, under_observation, observation_notes, severity, complexity_flag, status, assessment_status, enrollment_date, priority_domain, priority_domain_start_date, intervention_status, school_section, sub_category, intervention_cycle_count";

function StudentProfilePage() {
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const { profile, loading: authLoading, user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("overview");

  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Week summary
  const [weekLogCount, setWeekLogCount] = useState<number | null>(null);
  const [todayLogged, setTodayLogged] = useState<boolean>(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
  }, [authLoading, user, navigate]);

  const refetchStudent = async () => {
    const { data } = await supabase
      .from("students")
      .select(STUDENT_COLS)
      .eq("id", studentId)
      .maybeSingle();
    if (data) setStudent(data as Student);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("students")
        .select(STUDENT_COLS)
        .eq("id", studentId)
        .maybeSingle();
      if (cancelled) return;
      if (error) setError(error.message);
      else if (!data) setError("Student not found.");
      else setStudent(data as Student);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // Load week summary
  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    (async () => {
      const today = new Date();
      const day = today.getDay(); // 0 Sun .. 6 Sat
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((day + 6) % 7));
      const mondayStr = monday.toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("daily_logs")
        .select("log_date")
        .eq("student_id", student.id)
        .gte("log_date", mondayStr);
      if (cancelled) return;
      const rows = data ?? [];
      setWeekLogCount(rows.length);
      setTodayLogged(rows.some((r) => r.log_date === todayStr));
    })();
    return () => {
      cancelled = true;
    };
  }, [student]);

  const canSeeNotes = profile?.role === "administrator" || profile?.role === "psychologist";
  const canPickDomain = profile?.role === "psychologist" || profile?.role === "administrator";
  const isTeacher = profile?.role === "teacher" || profile?.role === "speech_therapist";

  const day = useMemo(
    () => (student ? cycleDay(student.priority_domain_start_date) : null),
    [student],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading student…</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Could not load student</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-destructive break-words">{error ?? "Unknown error"}</p>
              <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <span className="text-xs font-mono text-muted-foreground">{student.student_code}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Sticky Student Header */}
        <Card className="sticky top-0 z-20 shadow-md">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-mono text-muted-foreground">{student.student_code}</p>
                <h1 className="text-2xl font-heading font-bold text-primary mt-1 break-words">
                  {student.first_name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {calcAge(student.date_of_birth)} · {student.gender ?? "—"} ·{" "}
                  {student.class_section ?? "No class"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {student.school_section ? (
                  <span className="inline-flex items-center rounded-md bg-purple-600 text-white px-3 py-1 text-xs font-semibold">
                    {student.school_section}
                    {student.sub_category ? ` — ${student.sub_category}` : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-muted text-muted-foreground border px-3 py-1 text-xs font-semibold">
                    Uncategorized
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${complexityClasses(student.complexity_flag)}`}
                >
                  {student.complexity_flag ?? "Unspecified"}
                </span>
                <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold">
                  {student.assessment_status}
                </span>
                {student.priority_domain && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-700 text-white px-3 py-1 text-xs font-semibold">
                    <Target className="h-3 w-3" /> {student.priority_domain}
                  </span>
                )}
                {student.intervention_status && (
                  <span className="inline-flex items-center rounded-full bg-blue-600 text-white px-3 py-1 text-xs font-semibold">
                    {student.intervention_status}
                  </span>
                )}
                {day !== null && (
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cycleDayClasses(day)}`}
                  >
                    {day >= 15 ? "Cycle Complete — Review" : `Day ${day} of 14`}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-border rounded-none overflow-x-auto flex-nowrap">
            {[
              { v: "overview", label: "Overview" },
              { v: "clinical", label: "Clinical" },
              { v: "logs", label: "Daily Logs" },
              { v: "analysis", label: "Analysis & Reports" },
              { v: "comms", label: "Communication" },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#00B4D8] data-[state=active]:text-[#00B4D8] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Student Identity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm">
                      <span className="font-semibold">{student.first_name}</span> · {calcAge(student.date_of_birth)} · {student.gender ?? "—"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                        Primary Condition
                      </p>
                      <span className="inline-flex items-center rounded-md bg-blue-900 text-white px-3 py-1 text-sm font-medium">
                        {student.primary_condition}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                        Comorbid Conditions
                      </p>
                      {student.comorbid_conditions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None recorded</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {student.comorbid_conditions.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center rounded-md bg-teal-100 text-teal-900 px-3 py-1 text-sm"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                        Under Observation
                      </p>
                      {student.under_observation.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {student.under_observation.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center rounded-md bg-amber-100 text-amber-900 px-3 py-1 text-sm"
                            >
                              {c} — Unconfirmed
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {canSeeNotes && student.observation_notes && (
                      <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                        <p className="text-xs font-semibold uppercase text-yellow-900 mb-1">
                          Observation Notes
                        </p>
                        <p className="text-sm text-yellow-900 whitespace-pre-wrap">
                          {student.observation_notes}
                        </p>
                      </div>
                    )}
                    <dl className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Enrollment</dt>
                        <dd className="font-medium">{student.enrollment_date ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Severity</dt>
                        <dd className="font-medium">{student.severity ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Status</dt>
                        <dd className="font-medium">{student.status}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase text-muted-foreground">Section</dt>
                        <dd className="font-medium">
                          {student.school_section ?? "—"}
                          {student.sub_category ? ` · ${student.sub_category}` : ""}
                        </dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Current Clinical Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase text-muted-foreground">Assessment:</span>
                      <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold">
                        {student.assessment_status}
                      </span>
                    </div>
                    {student.priority_domain && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase text-muted-foreground">Priority Domain:</span>
                        <span className="inline-flex items-center rounded-full bg-purple-600 text-white px-3 py-1 text-xs font-semibold">
                          {student.priority_domain}
                        </span>
                      </div>
                    )}
                    {student.intervention_status && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase text-muted-foreground">Intervention:</span>
                        <span className="inline-flex items-center rounded-full bg-blue-600 text-white px-3 py-1 text-xs font-semibold">
                          {student.intervention_status}
                        </span>
                      </div>
                    )}
                    {day !== null && (
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-muted-foreground">
                            14-Day Cycle Progress
                          </span>
                          <span className={`px-2 py-0.5 rounded text-white ${cycleDayClasses(day)}`}>
                            {day >= 15 ? "Review Required" : `Day ${day} of 14`}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className={
                              day >= 15
                                ? "bg-red-600 animate-pulse h-full"
                                : day >= 12
                                  ? "bg-red-500 h-full"
                                  : day >= 8
                                    ? "bg-amber-500 h-full"
                                    : "bg-green-600 h-full"
                            }
                            style={{ width: `${Math.min(100, (day / 14) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {!isTeacher &&
                      (student.assessment_status === "Not Yet Assessed" ||
                        student.assessment_status === "In Progress") && (
                        <Button
                          className="w-full justify-start bg-teal-600 hover:bg-teal-700 text-white"
                          onClick={() => setAssessmentOpen(true)}
                        >
                          <ClipboardList className="h-4 w-4" />
                          {student.assessment_status === "In Progress"
                            ? "Continue Assessment"
                            : "Start Assessment"}
                        </Button>
                      )}
                    <Button
                      className="w-full justify-start bg-teal-500 hover:bg-teal-600 text-white"
                      onClick={() => setLogOpen(true)}
                      disabled={!student.priority_domain}
                    >
                      <NotebookPen className="h-4 w-4" /> Log Daily Observation
                    </Button>
                    {canPickDomain && !student.priority_domain &&
                      student.assessment_status === "Diagnosis Confirmed" && (
                        <Button
                          className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => setPriorityOpen(true)}
                        >
                          <Target className="h-4 w-4" /> Select Priority Domain
                        </Button>
                      )}
                    {!isTeacher && student.priority_domain && (
                      <Button
                        className="w-full justify-start bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setOptionsOpen(true)}
                      >
                        <Sparkles className="h-4 w-4" /> Generate Intervention Options
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setTab("analysis")}
                    >
                      <BarChart3 className="h-4 w-4" /> Weekly / Monthly Analysis
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setTab("comms")}
                    >
                      <MessageSquare className="h-4 w-4" /> Parent Summary
                    </Button>
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <Link to="/students/$studentId/plans" params={{ studentId: student.id }}>
                        <FileText className="h-4 w-4" /> View Intervention Plans
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>This Week</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Logs this week</span>
                      <span className="font-semibold">{weekLogCount ?? "—"} / 7</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Today</span>
                      <span
                        className={`font-semibold ${todayLogged ? "text-green-700" : "text-amber-700"}`}
                      >
                        {todayLogged ? "Logged ✅" : "Not logged ⚠️"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* CLINICAL */}
          <TabsContent value="clinical" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold">
                    {student.assessment_status}
                  </span>
                </div>
                {!isTeacher && (student.assessment_status === "Not Yet Assessed" ||
                  student.assessment_status === "In Progress") && (
                  <Button
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => setAssessmentOpen(true)}
                  >
                    <ClipboardList className="h-4 w-4" />
                    {student.assessment_status === "In Progress"
                      ? "Continue Assessment"
                      : "Start Assessment"}
                  </Button>
                )}
                {student.assessment_status === "Pending Review" && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                    Awaiting psychologist review.
                  </div>
                )}
                {(student.assessment_status === "Diagnosis Confirmed" ||
                  student.assessment_status === "Assessed") && (
                  <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-900">
                    Assessment approved.
                  </div>
                )}
              </CardContent>
            </Card>

            {student.priority_domain ? (
              <InterventionReviewPanel
                studentId={student.id}
                priorityDomain={student.priority_domain}
                onDomainChanged={async () => {
                  await refetchStudent();
                  if (canPickDomain) setPriorityOpen(true);
                }}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Intervention Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    No active intervention — complete assessment and select a priority domain first.
                  </p>
                  {canPickDomain && student.assessment_status === "Diagnosis Confirmed" && (
                    <Button
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => setPriorityOpen(true)}
                    >
                      <Target className="h-4 w-4" /> Select Priority Domain
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DAILY LOGS */}
          <TabsContent value="logs" className="mt-6 space-y-6">
            <Card>
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                {todayLogged ? (
                  <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-900 flex-1 min-w-[200px]">
                    Logged Today ✅
                  </div>
                ) : (
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 flex-1 min-w-[200px]">
                    Not Logged Today ⚠️
                  </div>
                )}
                <Button
                  size="lg"
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => setLogOpen(true)}
                  disabled={!student.priority_domain}
                >
                  <NotebookPen className="h-5 w-5" /> Log Now
                </Button>
              </CardContent>
            </Card>

            <DailyLogHistory
              studentId={student.id}
              studentName={student.first_name}
              priorityDomain={student.priority_domain}
            />
          </TabsContent>

          {/* ANALYSIS & REPORTS */}
          <TabsContent value="analysis" className="mt-6 space-y-6">
            <WeeklyAnalysisPanel
              studentId={student.id}
              studentName={student.first_name}
              studentCode={student.student_code}
              schoolSection={student.school_section}
              subCategory={student.sub_category}
              priorityDomain={student.priority_domain}
              interventionStatus={student.intervention_status}
            />
            <MonthlyReviewPanel
              studentId={student.id}
              studentName={student.first_name}
              studentCode={student.student_code}
              primaryCondition={student.primary_condition}
              priorityDomain={student.priority_domain}
              priorityDomainStartDate={student.priority_domain_start_date}
              interventionStatus={student.intervention_status}
              interventionCycleCount={student.intervention_cycle_count}
              onChanged={async () => {
                await refetchStudent();
                if (canPickDomain && !student.priority_domain) setPriorityOpen(true);
              }}
            />
          </TabsContent>

          {/* COMMUNICATION */}
          <TabsContent value="comms" className="mt-6 space-y-6">
            <ParentSummaryPanel
              studentId={student.id}
              studentName={student.first_name}
              priorityDomain={student.priority_domain}
            />
          </TabsContent>
        </Tabs>
      </main>

      {assessmentOpen && (
        <AssessmentOverlay
          student={student}
          onClose={() => setAssessmentOpen(false)}
          onApproved={async (info) => {
            await refetchStudent();
            if (info.triggerPriorityDomain && canPickDomain) setPriorityOpen(true);
          }}
        />
      )}

      {logOpen && (
        <DailyLogOverlay
          studentId={student.id}
          studentName={student.first_name}
          priorityDomain={student.priority_domain}
          onClose={() => setLogOpen(false)}
        />
      )}

      {priorityOpen && (
        <PriorityDomainOverlay
          studentId={student.id}
          studentName={student.first_name}
          onClose={() => setPriorityOpen(false)}
          onSelected={async () => {
            await refetchStudent();
            setOptionsOpen(true);
          }}
        />
      )}

      {optionsOpen && student.priority_domain && (
        <InterventionOptionsOverlay
          studentId={student.id}
          studentName={student.first_name}
          priorityDomain={student.priority_domain}
          onClose={() => setOptionsOpen(false)}
          onApproved={() => refetchStudent()}
        />
      )}
    </div>
  );
}
