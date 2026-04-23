import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ClipboardList, NotebookPen } from "lucide-react";
import { AssessmentOverlay } from "@/components/AssessmentOverlay";
import { DailyLogOverlay } from "@/components/DailyLogOverlay";

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

function StudentProfilePage() {
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const { profile, loading: authLoading, user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("students")
        .select(
          "id, student_code, first_name, date_of_birth, gender, class_section, primary_condition, comorbid_conditions, under_observation, observation_notes, severity, complexity_flag, status, assessment_status, enrollment_date",
        )
        .eq("id", studentId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else if (!data) {
        setError("Student not found.");
      } else {
        setStudent(data as Student);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const canSeeNotes = profile?.role === "administrator" || profile?.role === "psychologist";

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <span className="text-xs font-mono text-muted-foreground">{student.student_code}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Section 1 — Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-muted-foreground">{student.student_code}</p>
                <h1 className="text-2xl font-heading font-bold text-primary mt-1">
                  {student.first_name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {calcAge(student.date_of_birth)} · {student.gender ?? "—"} ·{" "}
                  {student.class_section ?? "No class"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${complexityClasses(student.complexity_flag)}`}
                >
                  {student.complexity_flag ?? "Unspecified"}
                </span>
                <span className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-3 py-1 text-xs font-semibold">
                  {student.assessment_status}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2 — Disability Picture */}
        <Card>
          <CardHeader>
            <CardTitle>Disability Picture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Primary Condition
              </p>
              <span className="inline-flex items-center rounded-md bg-blue-900 text-white px-3 py-1 text-sm font-medium">
                {student.primary_condition}
              </span>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
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
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Under Observation (Unconfirmed)
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
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
                <p className="text-xs font-semibold uppercase text-yellow-900 mb-1">
                  Observation Notes
                </p>
                <p className="text-sm text-yellow-900 whitespace-pre-wrap">
                  {student.observation_notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3 — Clinical Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Clinical Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Complete the 9-section intake form to generate AI assessment.
            </p>
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => setAssessmentOpen(true)}
            >
              <ClipboardList className="h-5 w-5" /> Start Assessment
            </Button>
          </CardContent>
        </Card>

        {/* Section 4 — Enrollment */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Status</dt>
                <dd className="font-medium mt-1">{student.status}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Severity</dt>
                <dd className="font-medium mt-1">{student.severity ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Enrollment Date</dt>
                <dd className="font-medium mt-1">{student.enrollment_date ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </main>

      {assessmentOpen && (
        <AssessmentOverlay student={student} onClose={() => setAssessmentOpen(false)} />
      )}
    </div>
  );
}
