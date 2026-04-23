import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowLeft, Download, Printer, FileText } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

export const Route = createFileRoute("/students/$studentId/plans")({
  head: () => ({ meta: [{ title: "Intervention Plans — CARE" }] }),
  component: PlansPage,
});

interface Plan {
  id: string;
  plan_type: string;
  title: string;
  content: string;
  generated_at: string;
  assessment_id: string;
}

interface StudentLite {
  id: string;
  first_name: string;
  student_code: string;
}

const PLAN_ORDER = [
  "educational_iep",
  "behavioral",
  "nutritional",
  "physical_activity",
  "therapy",
];

function sortPlans(plans: Plan[]): Plan[] {
  return [...plans].sort(
    (a, b) => PLAN_ORDER.indexOf(a.plan_type) - PLAN_ORDER.indexOf(b.plan_type),
  );
}

function PlansPage() {
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [student, setStudent] = useState<StudentLite | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [{ data: s, error: sErr }, { data: p, error: pErr }] = await Promise.all([
        supabase
          .from("students")
          .select("id, first_name, student_code")
          .eq("id", studentId)
          .maybeSingle(),
        supabase
          .from("intervention_plans")
          .select("id, plan_type, title, content, generated_at, assessment_id")
          .eq("student_id", studentId)
          .order("generated_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (sErr) setError(sErr.message);
      else if (!s) setError("Student not found");
      else setStudent(s as StudentLite);
      if (pErr) setError(pErr.message);
      else if (p) {
        const latestAssessmentId = (p[0] as Plan | undefined)?.assessment_id;
        const filtered = latestAssessmentId
          ? (p as Plan[]).filter((x) => x.assessment_id === latestAssessmentId)
          : [];
        setPlans(sortPlans(filtered));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const printPlan = (plan: Plan) => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) {
      toast.error("Pop-up blocked. Allow pop-ups to print.");
      return;
    }
    w.document.write(`<!doctype html><html><head><title>${plan.title}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:32px;color:#111;line-height:1.6;max-width:760px;margin:auto}
        h1{color:#0f766e;border-bottom:2px solid #0f766e;padding-bottom:8px}
        pre{white-space:pre-wrap;font-family:inherit;font-size:14px}
        .meta{color:#666;font-size:12px;margin-bottom:16px}
      </style></head><body>
      <h1>${plan.title}</h1>
      <div class="meta">${student?.first_name ?? ""} · ${student?.student_code ?? ""} · Generated ${new Date(plan.generated_at).toLocaleString()}</div>
      <pre>${plan.content.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const downloadAllPdf = () => {
    if (plans.length === 0) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    const maxW = pageW - margin * 2;
    let y = margin;

    const writeLine = (text: string, size: number, bold = false) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, maxW) as string[];
      for (const line of lines) {
        if (y > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += size * 1.35;
      }
    };

    writeLine("CARE — Intervention Plans", 18, true);
    writeLine(
      `${student?.first_name ?? ""} (${student?.student_code ?? ""}) · ${new Date().toLocaleString()}`,
      10,
    );
    y += 12;

    plans.forEach((plan, idx) => {
      if (idx > 0) {
        doc.addPage();
        y = margin;
      }
      writeLine(plan.title, 16, true);
      writeLine(`Generated: ${new Date(plan.generated_at).toLocaleString()}`, 9);
      y += 8;
      writeLine(plan.content, 11);
    });

    doc.save(`${student?.student_code ?? "student"}-plans.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading plans…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Could not load plans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-destructive break-words">{error}</p>
              <Button variant="outline" asChild>
                <Link to="/students/$studentId" params={{ studentId }}>
                  <ArrowLeft className="h-4 w-4" /> Back to student
                </Link>
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
            <Link to="/students/$studentId" params={{ studentId }}>
              <ArrowLeft className="h-4 w-4" /> Student profile
            </Link>
          </Button>
          <span className="text-xs font-mono text-muted-foreground">
            {student?.student_code}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="rounded-lg bg-green-600 text-white px-4 py-3 text-center font-semibold text-sm sm:text-base">
          PLANS GENERATED FROM APPROVED ASSESSMENT — READY FOR IMPLEMENTATION
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Intervention Plans — {student?.first_name}
              </span>
              <Button
                onClick={downloadAllPdf}
                disabled={plans.length === 0}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Download className="h-4 w-4" /> Download All Plans as PDF
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {plans.length === 0 ? (
              <div className="rounded-md border border-border bg-muted/30 p-6 text-sm text-muted-foreground flex items-start gap-3">
                <FileText className="h-5 w-5 mt-0.5" />
                <div>
                  No plans yet. Plans are generated automatically when a psychologist approves
                  this student's clinical assessment.
                </div>
              </div>
            ) : (
              <Accordion type="multiple" defaultValue={plans.map((p) => p.id)} className="w-full">
                {plans.map((plan) => (
                  <AccordionItem key={plan.id} value={plan.id}>
                    <AccordionTrigger className="text-left">
                      <span className="flex-1 font-semibold">{plan.title}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => printPlan(plan)}
                          >
                            <Printer className="h-4 w-4" /> Print
                          </Button>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-4">
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {plan.content}
                          </pre>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Generated {new Date(plan.generated_at).toLocaleString()}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
