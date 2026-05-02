import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, RefreshCw, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
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

// Required section markers for AI output validation
const REQUIRED_SECTIONS: { label: string; pattern: RegExp }[] = [
  { label: "MAIN DIFFICULTY", pattern: /MAIN DIFFICULTY/i },
  { label: "MOST LIKELY TRIGGER", pattern: /MOST LIKELY TRIGGER/i },
  { label: "PSYCHOLOGICAL INTERPRETATION", pattern: /PSYCHOLOGICAL INTERPRETATION/i },
  { label: "ACTION OPTIONS", pattern: /ACTION OPTIONS/i },
  { label: "Option A", pattern: /OPTION\s+A\b/i },
  { label: "Option B", pattern: /OPTION\s+B\b/i },
  { label: "Option C", pattern: /OPTION\s+C\b/i },
  { label: "FINAL RECOMMENDATION", pattern: /FINAL RECOMMENDATION/i },
  { label: "CONFIDENCE LEVEL", pattern: /CONFIDENCE LEVEL/i },
  { label: "OPTION D", pattern: /OPTION\s+D\b/i },
];

function validateAiOutput(text: string): string[] {
  return REQUIRED_SECTIONS.filter((s) => !s.pattern.test(text)).map((s) => s.label);
}

type Phase =
  | "checking"           // initial validation in progress
  | "no_assessment"      // blocked: no approved assessment
  | "needs_replace_confirm" // blocked: existing active plan, need user confirm
  | "ready"              // validations passed, ready to generate
  | "generating"
  | "validation_failed"  // AI output missing sections
  | "ready_to_approve";

export function InterventionOptionsOverlay({
  studentId,
  studentName,
  priorityDomain,
  onClose,
  onApproved,
}: Props) {
  const { profile } = useAuth();

  const [phase, setPhase] = useState<Phase>("checking");
  const [output, setOutput] = useState<string | null>(null);
  const [missingSections, setMissingSections] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<AssessmentRow | null>(null);
  const [hasActivePlan, setHasActivePlan] = useState(false);
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

  // Initial validation: assessment exists, priority domain set, check active plan.
  useEffect(() => {
    (async () => {
      setError(null);

      if (!priorityDomain) {
        setError("❌ Priority domain not selected.");
        setPhase("no_assessment");
        return;
      }

      const { data: a, error: aErr } = await supabase
        .from("assessments")
        .select("id, ai_draft_output")
        .eq("student_id", studentId)
        .eq("psychologist_status", "Approved")
        .order("approved_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (aErr) {
        setError(`Could not load assessment: ${aErr.message}`);
        setPhase("no_assessment");
        return;
      }
      if (!a || !a.ai_draft_output) {
        setError("❌ No approved assessment found. Please complete and approve assessment first.");
        setPhase("no_assessment");
        return;
      }
      setAssessment(a);

      const { data: existing } = await supabase
        .from("intervention_plans")
        .select("id")
        .eq("student_id", studentId)
        .eq("status", "Active")
        .limit(1);
      if (existing && existing.length > 0) {
        setHasActivePlan(true);
        setPhase("needs_replace_confirm");
        return;
      }

      setPhase("ready");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async (regenFeedback?: string) => {
    if (!assessment) return;
    setError(null);
    setOutput(null);
    setMissingSections([]);
    setPhase("generating");

    const { data, error: fnErr } = await supabase.functions.invoke(
      "generate-intervention-options",
      {
        body: {
          studentSummary: { id: studentId, name: studentName },
          approvedAssessment: assessment.ai_draft_output,
          priorityDomain,
          feedback: regenFeedback ?? null,
        },
      },
    );
    if (fnErr || !data?.output) {
      setError(`Generation failed: ${fnErr?.message ?? data?.error ?? "Unknown error"}`);
      setPhase("ready");
      return;
    }
    const text = data.output as string;
    const missing = validateAiOutput(text);
    setOutput(text);
    if (missing.length > 0) {
      setMissingSections(missing);
      setPhase("validation_failed");
      return;
    }
    setPhase("ready_to_approve");
  };

  const approveOption = async () => {
    if (!pickedOption || !assessment) return;
    setError(null);
    setWorking(true);
    const today = new Date().toISOString().slice(0, 10);
    const strategyName = `Option ${pickedOption}`;

    // Compute next plan_version for this student
    const { data: vRows } = await supabase
      .from("intervention_plans")
      .select("plan_version")
      .eq("student_id", studentId)
      .order("plan_version", { ascending: false })
      .limit(1);
    const nextVersion =
      vRows && vRows.length > 0 && typeof (vRows[0] as { plan_version?: number }).plan_version === "number"
        ? ((vRows[0] as { plan_version: number }).plan_version ?? 0) + 1
        : 1;

    // Archive lingering Draft/Deferred so non-selected options never linger.
    await supabase
      .from("intervention_plans")
      .update({ status: "Replaced", replaced_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .in("status", ["Draft", "Deferred"]);

    // Insert new active plan — trigger replaces previous Active rows automatically.
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
      cycle_length_days: 14,
      plan_version: nextVersion,
      approved_by: profile?.id ?? null,
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
    toast.success("✅ Intervention strategy approved and activated. Previous plan replaced.");
    onApproved?.();
    onClose();
  };

  const defer = async () => {
    if (!assessment) return;
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
              Generate Intervention Options — {studentName}
            </p>
            <p className="text-xs text-muted-foreground">
              Priority Domain: {priorityDomain} · 14-Day Cycle
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
            {error}
          </div>
        )}

        {phase === "checking" && (
          <p className="text-sm text-muted-foreground">Validating prerequisites…</p>
        )}

        {phase === "no_assessment" && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Cannot generate options</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={onClose}>
                Back
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "needs_replace_confirm" && (
          <Card className="border-amber-400 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Active intervention exists
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-900">
                Generating new options will replace the current active plan once you approve a new
                strategy. Continue?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setPhase("ready")}
                >
                  Continue
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "ready" && (
          <Card>
            <CardHeader>
              <CardTitle>Ready to generate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasActivePlan && (
                <p className="text-xs text-amber-700">
                  Note: an active plan exists and will be replaced on approval.
                </p>
              )}
              <Button onClick={() => generate()} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Sparkles /> Generate Options
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "generating" && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              🤖 AI analyzing profile… Please wait.
            </CardContent>
          </Card>
        )}

        {(phase === "validation_failed" || phase === "ready_to_approve") && output && (
          <>
            <div className="rounded-md border-2 border-red-500 bg-red-50 p-4 text-sm font-semibold text-red-800">
              DRAFT OPTIONS — PSYCHOLOGIST REVIEW REQUIRED
            </div>

            {phase === "validation_failed" && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-destructive">
                    ❌ AI output incomplete or malformed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-destructive">
                    Missing sections: {missingSections.join(", ")}
                  </p>
                  <Button onClick={() => generate()} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <RefreshCw /> Retry Generation
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Strategy Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border bg-muted/30 p-4 max-h-[50vh] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {output}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {phase === "ready_to_approve" && output && !showRegen && (
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
                          ? o === "A"
                            ? "bg-green-600 text-white border-green-600"
                            : o === "D"
                              ? "bg-amber-600 text-white border-amber-600"
                              : "bg-blue-600 text-white border-blue-600"
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
                  disabled={working}
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
                <Button onClick={submitRegen}>Regenerate</Button>
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

// Local icon import shim — Sparkles is used inline above.
import { Sparkles } from "lucide-react";
