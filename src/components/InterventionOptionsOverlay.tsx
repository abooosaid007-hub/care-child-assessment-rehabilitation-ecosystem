import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Pencil,
  Wand2,
} from "lucide-react";
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

const OPTIONS = ["A", "B", "C"] as const;
type OptionLetter = (typeof OPTIONS)[number];
type Difficulty = "LOW" | "MEDIUM" | "HIGH";

interface ParsedOption {
  letter: OptionLetter;
  strategyName: string;
  whenItWorks: string;
  whenItFails: string;
  difficulty: Difficulty;
  action: string;
  raw: string;
}

interface OptionState extends ParsedOption {
  edited: boolean;
  modificationType: "Minor" | "Major" | null;
  original: ParsedOption;
}

const REQUIRED_SECTIONS: { label: string; pattern: RegExp }[] = [
  { label: "MAIN DIFFICULTY", pattern: /MAIN DIFFICULTY/i },
  { label: "MOST LIKELY TRIGGER", pattern: /MOST LIKELY TRIGGER/i },
  { label: "PSYCHOLOGICAL INTERPRETATION", pattern: /PSYCHOLOGICAL INTERPRETATION/i },
  { label: "ACTION OPTIONS", pattern: /ACTION OPTIONS/i },
  { label: "Option A", pattern: /OPTION\s+A\b/i },
  { label: "Option B", pattern: /OPTION\s+B\b/i },
  { label: "Option C", pattern: /OPTION\s+C\b/i },
  { label: "FINAL RECOMMENDATION", pattern: /FINAL RECOMMENDATION/i },
];

function validateAiOutput(text: string): string[] {
  return REQUIRED_SECTIONS.filter((s) => !s.pattern.test(text)).map((s) => s.label);
}

function extractField(block: string, label: RegExp): string {
  const m = block.match(label);
  if (!m) return "";
  const start = m.index! + m[0].length;
  // capture until next "When ", "Difficulty", "Action", or end of block
  const rest = block.slice(start);
  const stop = rest.search(/\n\s*(When it (works|fails)|Difficulty|Action)\s*[:\-]/i);
  return (stop === -1 ? rest : rest.slice(0, stop)).replace(/^[:\-\s]+/, "").trim();
}

function parseOption(text: string, letter: OptionLetter): ParsedOption {
  // Find "OPTION X" header, capture until next "OPTION " or "FINAL RECOMMENDATION"
  const re = new RegExp(`OPTION\\s+${letter}\\b([\\s\\S]*?)(?=OPTION\\s+[A-D]\\b|FINAL RECOMMENDATION|CONFIDENCE LEVEL|$)`, "i");
  const m = text.match(re);
  const block = m ? m[1] : "";
  const firstLine = block.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const strategyName = firstLine.replace(/^[:\-—\s]+/, "").slice(0, 200) || `Option ${letter}`;
  const whenItWorks = extractField(block, /When it works\s*[:\-]?/i);
  const whenItFails = extractField(block, /When it fails\s*[:\-]?/i);
  const diffRaw = extractField(block, /Difficulty\s*[:\-]?/i).toUpperCase();
  const difficulty: Difficulty =
    diffRaw.includes("HIGH") ? "HIGH" : diffRaw.includes("LOW") ? "LOW" : "MEDIUM";
  const action = extractField(block, /Action\s*[:\-]?/i);
  return { letter, strategyName, whenItWorks, whenItFails, difficulty, action, raw: block.trim() };
}

function serializeOption(o: OptionState): string {
  return `OPTION ${o.letter}: ${o.strategyName}
- When it works: ${o.whenItWorks}
- When it fails: ${o.whenItFails}
- Difficulty: ${o.difficulty}
- Action: ${o.action}`;
}

type Phase =
  | "checking"
  | "no_assessment"
  | "needs_replace_confirm"
  | "ready"
  | "generating"
  | "validation_failed"
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
  const [originalOutput, setOriginalOutput] = useState<string | null>(null);
  const [missingSections, setMissingSections] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<AssessmentRow | null>(null);
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [refinementCount, setRefinementCount] = useState(0);
  const [isRefined, setIsRefined] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [options, setOptions] = useState<OptionState[]>([]);
  const [editingLetter, setEditingLetter] = useState<OptionLetter | null>(null);
  const [editDraft, setEditDraft] = useState<ParsedOption | null>(null);
  const [pendingModType, setPendingModType] = useState<OptionLetter | null>(null);

  const [pickedOption, setPickedOption] = useState<OptionLetter | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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
          previousOptions: regenFeedback ? output : null,
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
    if (!originalOutput) setOriginalOutput(text);
    if (regenFeedback) {
      setIsRefined(true);
      setRefinementCount((c) => c + 1);
    }
    if (missing.length > 0) {
      setMissingSections(missing);
      setPhase("validation_failed");
      return;
    }
    // Parse into options
    const parsed = OPTIONS.map((l) => parseOption(text, l));
    setOptions(
      parsed.map((p) => ({
        ...p,
        edited: false,
        modificationType: null,
        original: p,
      })),
    );
    setPickedOption(null);
    setPhase("ready_to_approve");
  };

  const startEdit = (letter: OptionLetter) => {
    const o = options.find((x) => x.letter === letter);
    if (!o) return;
    setEditingLetter(letter);
    setEditDraft({
      letter: o.letter,
      strategyName: o.strategyName,
      whenItWorks: o.whenItWorks,
      whenItFails: o.whenItFails,
      difficulty: o.difficulty,
      action: o.action,
      raw: o.raw,
    });
  };

  const saveEdit = () => {
    if (!editDraft || !editingLetter) return;
    setOptions((prev) =>
      prev.map((o) =>
        o.letter === editingLetter
          ? { ...o, ...editDraft, edited: true, modificationType: o.modificationType }
          : o,
      ),
    );
    setPendingModType(editingLetter);
    setEditingLetter(null);
    setEditDraft(null);
  };

  const setModType = (letter: OptionLetter, t: "Minor" | "Major") => {
    setOptions((prev) =>
      prev.map((o) => (o.letter === letter ? { ...o, modificationType: t } : o)),
    );
    setPendingModType(null);
    toast.success(`${t} adjustment recorded`);
  };

  const submitRefine = async () => {
    if (!feedback.trim()) {
      setError("Please describe the constraint or change before requesting refinement.");
      return;
    }
    if (refinementCount >= 2) return;
    setShowRefine(false);
    const fb = feedback;
    setFeedback("");
    await generate(fb);
  };

  const approveOption = async () => {
    if (!pickedOption || !assessment) return;
    const chosen = options.find((o) => o.letter === pickedOption);
    if (!chosen) return;
    setError(null);
    setWorking(true);

    const finalText = serializeOption(chosen);
    const finalSource: "AI_Original" | "Psychologist_Edit" | "AI_Refined" = chosen.edited
      ? "Psychologist_Edit"
      : isRefined
        ? "AI_Refined"
        : "AI_Original";

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

    await supabase
      .from("intervention_plans")
      .update({ status: "Replaced", replaced_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .in("status", ["Draft", "Deferred"]);

    const today = new Date().toISOString().slice(0, 10);
    const strategyName = `Option ${chosen.letter}: ${chosen.strategyName}`.slice(0, 250);

    const editsPayload = chosen.edited
      ? {
          letter: chosen.letter,
          original: chosen.original,
          edited: {
            strategyName: chosen.strategyName,
            whenItWorks: chosen.whenItWorks,
            whenItFails: chosen.whenItFails,
            difficulty: chosen.difficulty,
            action: chosen.action,
          },
        }
      : null;

    const { error: insErr } = await supabase.from("intervention_plans").insert({
      student_id: studentId,
      assessment_id: assessment.id,
      plan_type: "active_strategy",
      title: `${priorityDomain} — Option ${chosen.letter} (Active)`,
      content: finalText,
      priority_domain: priorityDomain,
      selected_strategy: strategyName,
      start_date: today,
      status: "Active",
      cycle_length_days: 14,
      plan_version: nextVersion,
      approved_by: profile?.id ?? null,
      created_by: profile?.id ?? null,
      ai_original_output: originalOutput ?? output ?? "",
      psychologist_edits: editsPayload as never,
      modification_type: chosen.edited ? chosen.modificationType : null,
      refinement_count: refinementCount,
      final_version_source: finalSource,
      custom_modified: chosen.edited,
    });
    if (insErr) {
      setWorking(false);
      setError(`Saving strategy failed: ${insErr.message}`);
      return;
    }
    const { error: stuErr } = await supabase
      .from("students")
      .update({ intervention_status: `Active - Option ${chosen.letter}` })
      .eq("id", studentId);
    setWorking(false);
    if (stuErr) {
      setError(`Saved strategy but failed to update student: ${stuErr.message}`);
      return;
    }
    toast.success(`✅ Strategy approved (${finalSource.replace("_", " ")})`);
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
      ai_original_output: originalOutput ?? output ?? "",
      refinement_count: refinementCount,
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

  const refineDisabled = refinementCount >= 2;

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
              {isRefined && (
                <span className="ml-2 inline-flex items-center rounded-full bg-purple-600 text-white px-2 py-0.5 text-[10px] font-semibold">
                  🔄 Refined ({refinementCount}/2)
                </span>
              )}
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
              <Button variant="outline" onClick={onClose}>Back</Button>
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
                Generating new options will replace the current active plan once you approve a new strategy. Continue?
              </p>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setPhase("ready")}>
                  Continue
                </Button>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {phase === "ready" && (
          <Card>
            <CardHeader><CardTitle>Ready to generate</CardTitle></CardHeader>
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

        {phase === "validation_failed" && output && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">❌ AI output incomplete or malformed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-destructive">Missing sections: {missingSections.join(", ")}</p>
              <Button onClick={() => generate()} className="bg-blue-600 hover:bg-blue-700 text-white">
                <RefreshCw /> Retry Generation
              </Button>
            </CardContent>
          </Card>
        )}

        {phase === "ready_to_approve" && options.length > 0 && (
          <>
            <div className="rounded-md border-2 border-red-500 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {isRefined ? `🔄 Refined Options (Attempt ${refinementCount}/2)` : "DRAFT OPTIONS — PSYCHOLOGIST REVIEW REQUIRED"}
            </div>

            {options.map((o) => {
              const isPicked = pickedOption === o.letter;
              const isEditing = editingLetter === o.letter;
              return (
                <Card
                  key={o.letter}
                  className={isPicked ? "border-2 border-green-600" : ""}
                >
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <span>OPTION {o.letter}: {o.strategyName}</span>
                        {o.edited && (
                          <span className="inline-flex items-center rounded-full bg-amber-500 text-white px-2 py-0.5 text-[10px] font-semibold">
                            ✏️ Modified by Psychologist{o.modificationType ? ` · ${o.modificationType}` : ""}
                          </span>
                        )}
                      </CardTitle>
                    </div>
                    {!isEditing && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(o.letter)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {!isEditing ? (
                      <>
                        <p><span className="font-semibold">When it works:</span> {o.whenItWorks || "—"}</p>
                        <p><span className="font-semibold">When it fails:</span> {o.whenItFails || "—"}</p>
                        <p><span className="font-semibold">Difficulty:</span> {o.difficulty}</p>
                        <p><span className="font-semibold">Action:</span> {o.action || "—"}</p>
                        <Button
                          size="sm"
                          variant={isPicked ? "default" : "outline"}
                          className={isPicked ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                          onClick={() => setPickedOption(o.letter)}
                        >
                          {isPicked ? "✓ Selected" : `Select Option ${o.letter}`}
                        </Button>
                      </>
                    ) : (
                      editDraft && (
                        <div className="space-y-3">
                          <div>
                            <Label>Strategy Name</Label>
                            <Input
                              value={editDraft.strategyName}
                              onChange={(e) => setEditDraft({ ...editDraft, strategyName: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>When it works</Label>
                            <Textarea rows={2} value={editDraft.whenItWorks}
                              onChange={(e) => setEditDraft({ ...editDraft, whenItWorks: e.target.value })} />
                          </div>
                          <div>
                            <Label>When it fails</Label>
                            <Textarea rows={2} value={editDraft.whenItFails}
                              onChange={(e) => setEditDraft({ ...editDraft, whenItFails: e.target.value })} />
                          </div>
                          <div>
                            <Label>Difficulty</Label>
                            <select
                              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                              value={editDraft.difficulty}
                              onChange={(e) => setEditDraft({ ...editDraft, difficulty: e.target.value as Difficulty })}
                            >
                              <option value="LOW">LOW</option>
                              <option value="MEDIUM">MEDIUM</option>
                              <option value="HIGH">HIGH</option>
                            </select>
                          </div>
                          <div>
                            <Label>Action</Label>
                            <Textarea rows={3} value={editDraft.action}
                              onChange={(e) => setEditDraft({ ...editDraft, action: e.target.value })} />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit}>Save Edits</Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingLetter(null); setEditDraft(null); }}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )
                    )}

                    {pendingModType === o.letter && (
                      <div className="rounded-md border border-amber-400 bg-amber-50 p-3 space-y-2">
                        <p className="text-sm font-semibold text-amber-900">What type of modification did you make?</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setModType(o.letter, "Minor")}>
                            Minor Adjustment
                          </Button>
                          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setModType(o.letter, "Major")}>
                            Major Change
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <Card>
              <CardContent className="p-4 space-y-3">
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
                    className="h-auto py-4 border-purple-500 text-purple-700 hover:bg-purple-50"
                    onClick={() => { setFeedback(""); setShowRefine(true); }}
                    disabled={working || refineDisabled}
                  >
                    <Wand2 className="h-5 w-5" /> REQUEST AI REFINEMENT
                  </Button>
                  <Button size="lg" variant="outline" className="h-auto py-4" onClick={defer} disabled={working}>
                    <Clock className="h-5 w-5" /> DEFER DECISION
                  </Button>
                </div>
                {refineDisabled && (
                  <p className="text-xs text-amber-700">
                    Maximum refinements reached. Please approve an option or edit manually.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {showRefine && (
          <Card className="border-purple-400">
            <CardHeader>
              <CardTitle className="text-purple-800">Request AI Refinement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="fb">Provide specific feedback for AI to refine options</Label>
              <Textarea
                id="fb"
                rows={5}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  "e.g.\n• Child responds poorly to token systems, focus on intrinsic motivation\n• Family cannot implement home activities, school-only strategies\n• Sensory strategies not working, try behavioral approach"
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={submitRefine}>
                  Refine Options
                </Button>
                <Button variant="outline" onClick={() => setShowRefine(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
