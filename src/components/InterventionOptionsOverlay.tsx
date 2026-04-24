import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, RefreshCw, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  studentId: string;
  studentName: string;
  priorityDomain: string;
  onClose: () => void;
  onApproved?: () => void;
}

interface AssessmentRow {
  id: string;
  ai_draft_output: string | null;
}

const OPTIONS = ["A", "B", "C", "D"] as const;
type OptionLetter = (typeof OPTIONS)[number];

export function InterventionOptionsOverlay({
  studentId,
  studentName,
  priorityDomain,
  onClose,
  onApproved,
}: Props) {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessmentRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [showRegen, setShowRegen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [pickedOption, setPickedOption] = useState<OptionLetter | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const generate = async (regenFeedback?: string) => {
    setError(null);
    setGenerating(true);
    setOutput(null);

    // Fetch latest approved assessment
    const { data: a, error: aErr } = await supabase
      .from("assessments")
      .select("id, ai_draft_output")
      .eq("student_id", studentId)
      .eq("psychologist_status", "Approved")
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (aErr || !a || !a.ai_draft_output) {
      setGenerating(false);
      setError(
        aErr?.message ?? "No approved assessment found. Approve an assessment before generating options.",
      );
      return;
    }
    setAssessment(a);

    const { data, error: fnErr } = await supabase.functions.invoke(
      "generate-intervention-options",
      {
        body: {
          studentSummary: { id: studentId, name: studentName },
          approvedAssessment: a.ai_draft_output,
          priorityDomain,
          feedback: regenFeedback ?? null,
        },
      },
    );
    setGenerating(false);
    if (fnErr || !data?.output) {
      setError(`Generation failed: ${fnErr?.message ?? data?.error ?? "Unknown error"}`);
      return;
    }
    setOutput(data.output);
  };

  // Initial generation
  useEffect(() => {
    (async () => {
      setLoading(false);
      await generate();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveOption = async () => {
    if (!pickedOption) {
      setError("Pick an option (A, B, C, or D) to approve.");
      return;
    }
    if (!assessment) {
      setError("Assessment context missing.");
      return;
    }
    setError(null);
    setWorking(true);
    const today = new Date().toISOString().slice(0, 10);
    const strategyName = `Option ${pickedOption}`;

    // Enforce single active strategy: supersede any existing active plans for this student.
    const { error: supErr } = await supabase
      .from("intervention_plans")
      .update({ status: "Superseded" })
      .eq("student_id", studentId)
      .eq("status", "Active");
    if (supErr) {
      setWorking(false);
      setError(`Could not retire previous active strategy: ${supErr.message}`);
      return;
    }

    const { error: insErr } = await supabase.from("intervention_plans").insert({
      student_id: studentId,
      assessment_id: assessment.id,
      plan_type: "active_strategy",
      title: `${priorityDomain} — ${strategyName} (Active)`,
      content: output ?? "",
      priority_domain: priorityDomain,
      selected_strategy: strategyName,
      start_date: today,
      status: "Active",
      created_by: profile?.id ?? null,
    });
    if (insErr) {
      setWorking(false);
      setError(`Saving strategy failed: ${insErr.message}`);
      return;
    }
    const { error: stuErr } = await supabase
      .from("students")
      .update({ intervention_status: `Active - ${strategyName}` })
      .eq("id", studentId);
    setWorking(false);
    if (stuErr) {
      setError(`Saved strategy but failed to update student: ${stuErr.message}`);
      return;
    }
    toast.success(`${strategyName} approved and active`);
    onApproved?.();
    onClose();
  };

  const defer = async () => {
    if (!assessment) {
      setError("Assessment context missing.");
      return;
    }
    setError(null);
    setWorking(true);
    const today = new Date().toISOString().slice(0, 10);
    const { error: insErr } = await supabase.from("intervention_plans").insert({
      student_id: studentId,
      assessment_id: assessment.id,
      plan_type: "domain_strategy_draft",
      title: `${priorityDomain} — Draft Options (Deferred)`,
      content: output ?? "",
      priority_domain: priorityDomain,
      selected_strategy: null,
      start_date: today,
      status: "Deferred",
      created_by: profile?.id ?? null,
    });
    setWorking(false);
    if (insErr) {
      setError(`Saving draft failed: ${insErr.message}`);
      return;
    }
    toast.success("Draft saved for later review");
    onClose();
  };

  const submitRegen = async () => {
    if (!feedback.trim()) {
      setError("Please describe what to change before regenerating.");
      return;
    }
    setShowRegen(false);
    await generate(feedback);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Intervention Options"
    >
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              Intervention Options — {studentName}
            </p>
            <p className="text-xs text-muted-foreground">Priority Domain: {priorityDomain}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
        <div className="rounded-md border-2 border-red-500 bg-red-50 p-4 text-sm font-semibold text-red-800">
          DRAFT OPTIONS — PSYCHOLOGIST REVIEW REQUIRED
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>AI-Generated Strategy Options</CardTitle>
          </CardHeader>
          <CardContent>
            {(loading || generating) && (
              <p className="text-sm text-muted-foreground">Generating options…</p>
            )}
            {!generating && output && (
              <div className="rounded-md border border-border bg-muted/30 p-4 max-h-[50vh] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {output}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {output && !showRegen && (
          <Card>
            <CardHeader>
              <CardTitle>Psychologist Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Select option to approve</Label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {OPTIONS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setPickedOption(o)}
                      className={`px-3 py-3 rounded-md text-sm font-semibold border transition-colors ${
                        pickedOption === o
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                    >
                      OPTION {o}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white h-auto py-4"
                  onClick={approveOption}
                  disabled={working || !pickedOption}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {working ? "Saving…" : `APPROVE OPTION ${pickedOption ?? ""}`.trim()}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-auto py-4"
                  onClick={() => {
                    setFeedback("");
                    setShowRegen(true);
                  }}
                  disabled={working || generating}
                >
                  <RefreshCw className="h-5 w-5" /> REQUEST DIFFERENT OPTIONS
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-auto py-4"
                  onClick={defer}
                  disabled={working}
                >
                  <Clock className="h-5 w-5" /> DEFER DECISION
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showRegen && (
          <Card>
            <CardHeader>
              <CardTitle>Regenerate with Feedback</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="fb">What should be different?</Label>
              <Textarea
                id="fb"
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Focus on lower-difficulty options, include sensory breaks…"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={submitRegen} disabled={generating}>
                  {generating ? "Generating…" : "Regenerate"}
                </Button>
                <Button variant="outline" onClick={() => setShowRegen(false)}>
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
