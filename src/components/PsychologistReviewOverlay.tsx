import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, CheckCircle2, Edit3, HelpCircle, UserPlus2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  assessmentId: string;
  studentId: string;
  studentName: string;
  aiDraftOutput: string;
  initialPsychologistNotes?: string | null;
  onClose: () => void;
  onApproved?: (info: { triggerPriorityDomain: boolean }) => void;
}

type Mode = "menu" | "modify" | "request_data" | "refer";

export function PsychologistReviewOverlay({
  assessmentId,
  studentId,
  studentName,
  aiDraftOutput,
  initialPsychologistNotes,
  onClose,
  onApproved,
}: Props) {
  const { profile } = useAuth();
  const canSeeNotes = profile?.role === "psychologist" || profile?.role === "administrator";

  const [mode, setMode] = useState<Mode>("menu");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editedDraft, setEditedDraft] = useState(aiDraftOutput);
  const [requestText, setRequestText] = useState("");
  const [referralText, setReferralText] = useState("");

  const [notes, setNotes] = useState(initialPsychologistNotes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedAt, setNotesSavedAt] = useState<Date | null>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Auto-save notes every 2 minutes
  useEffect(() => {
    if (!canSeeNotes) return;
    const i = setInterval(async () => {
      const v = notesRef.current;
      setNotesSaving(true);
      const { error } = await supabase
        .from("assessments")
        .update({ psychologist_notes: v })
        .eq("id", assessmentId);
      setNotesSaving(false);
      if (!error) setNotesSavedAt(new Date());
    }, 2 * 60 * 1000);
    return () => clearInterval(i);
  }, [assessmentId, canSeeNotes]);

  const saveNotesNow = async () => {
    setNotesSaving(true);
    const { error } = await supabase
      .from("assessments")
      .update({ psychologist_notes: notesRef.current })
      .eq("id", assessmentId);
    setNotesSaving(false);
    if (error) {
      toast.error(`Notes save failed: ${error.message}`);
      return false;
    }
    setNotesSavedAt(new Date());
    toast.success("Notes saved");
    return true;
  };

  const approveAsDrafted = async () => {
    setError(null);
    setWorking(true);
    const now = new Date().toISOString();
    const { error: aErr } = await supabase
      .from("assessments")
      .update({
        psychologist_status: "Approved",
        approved_at: now,
        psychologist_notes: notesRef.current || null,
      })
      .eq("id", assessmentId);
    if (aErr) {
      setWorking(false);
      setError(`Approve failed: ${aErr.message}`);
      return;
    }
    const { error: sErr } = await supabase
      .from("students")
      .update({ assessment_status: "Diagnosis Confirmed" })
      .eq("id", studentId);
    setWorking(false);
    if (sErr) {
      setError(`Approved but failed to update student: ${sErr.message}`);
      return;
    }
    toast.success("Profile confirmed and approved");
    onApproved?.({ triggerPriorityDomain: true });
    onClose();
  };

  const approveModified = async () => {
    setError(null);
    if (!editedDraft.trim()) {
      setError("Edited draft cannot be empty.");
      return;
    }
    setWorking(true);
    const now = new Date().toISOString();
    const { error: aErr } = await supabase
      .from("assessments")
      .update({
        psychologist_status: "Approved",
        approved_at: now,
        ai_draft_output: editedDraft,
        psychologist_notes: notesRef.current || null,
      })
      .eq("id", assessmentId);
    if (aErr) {
      setWorking(false);
      setError(`Approve failed: ${aErr.message}`);
      return;
    }
    const { error: sErr } = await supabase
      .from("students")
      .update({ assessment_status: "Diagnosis Confirmed" })
      .eq("id", studentId);
    setWorking(false);
    if (sErr) {
      setError(`Approved but failed to update student: ${sErr.message}`);
      return;
    }
    toast.success("Modified profile approved");
    onApproved?.({ triggerPriorityDomain: true });
    onClose();
  };

  const requestMoreData = async () => {
    setError(null);
    if (!requestText.trim()) {
      setError("Please describe the additional information needed.");
      return;
    }
    setWorking(true);
    const stamped = `[Data Request — ${new Date().toLocaleString()}]\n${requestText}\n\n---\n${notesRef.current ?? ""}`;
    const { error: aErr } = await supabase
      .from("assessments")
      .update({
        psychologist_status: "Needs More Data",
        psychologist_notes: stamped,
      })
      .eq("id", assessmentId);
    setWorking(false);
    if (aErr) {
      setError(`Request failed: ${aErr.message}`);
      return;
    }
    await supabase
      .from("students")
      .update({ assessment_status: "Awaiting Additional Data" })
      .eq("id", studentId);
    toast.success("Data request sent to consultant");
    onClose();
  };

  const referToSpecialist = async () => {
    setError(null);
    if (!referralText.trim()) {
      setError("Please enter the specialist type and reason for referral.");
      return;
    }
    setWorking(true);
    const stamped = `[Referral — ${new Date().toLocaleString()}]\n${referralText}\n\n---\n${notesRef.current ?? ""}`;
    const { error: aErr } = await supabase
      .from("assessments")
      .update({
        psychologist_status: "Referred",
        psychologist_notes: stamped,
      })
      .eq("id", assessmentId);
    setWorking(false);
    if (aErr) {
      setError(`Referral failed: ${aErr.message}`);
      return;
    }
    await supabase
      .from("students")
      .update({ assessment_status: "Referred to Specialist" })
      .eq("id", studentId);
    toast.success("Referral recorded");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Psychologist Review"
    >
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Psychologist Review — {studentName}</p>
            <p className="text-xs text-muted-foreground">Review AI draft and decide on next action</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close review">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
        {/* Section A — AI Draft */}
        <Card className="border-2 border-red-300">
          <CardHeader className="bg-red-600 text-white sticky top-[60px] z-[5]">
            <CardTitle className="text-base">
              AI DRAFT — NOT A DIAGNOSIS — PSYCHOLOGIST REVIEW REQUIRED
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="max-h-[40vh] overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {aiDraftOutput}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Section B — Action Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
                {error}
              </div>
            )}

            {mode === "menu" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white h-auto py-4"
                  onClick={approveAsDrafted}
                  disabled={working}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {working ? "Working…" : "APPROVE AS DRAFTED"}
                </Button>
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white h-auto py-4"
                  onClick={() => setMode("modify")}
                  disabled={working}
                >
                  <Edit3 className="h-5 w-5" /> APPROVE WITH MODIFICATIONS
                </Button>
                <Button
                  size="lg"
                  className="bg-amber-500 hover:bg-amber-600 text-white h-auto py-4"
                  onClick={() => setMode("request_data")}
                  disabled={working}
                >
                  <HelpCircle className="h-5 w-5" /> REQUEST MORE DATA
                </Button>
                <Button
                  size="lg"
                  className="bg-orange-600 hover:bg-orange-700 text-white h-auto py-4"
                  onClick={() => setMode("refer")}
                  disabled={working}
                >
                  <UserPlus2 className="h-5 w-5" /> REFER TO SPECIALIST
                </Button>
              </div>
            )}

            {mode === "modify" && (
              <div className="space-y-3">
                <Label>Edit AI Draft Output</Label>
                <Textarea
                  rows={14}
                  value={editedDraft}
                  onChange={(e) => setEditedDraft(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={approveModified}
                    disabled={working}
                  >
                    {working ? "Saving…" : "Save & Approve Modified Version"}
                  </Button>
                  <Button variant="outline" onClick={() => setMode("menu")} disabled={working}>
                    Back
                  </Button>
                </div>
              </div>
            )}

            {mode === "request_data" && (
              <div className="space-y-3">
                <Label htmlFor="req">What additional information is needed?</Label>
                <Textarea
                  id="req"
                  rows={6}
                  placeholder="Describe what the consultant needs to provide…"
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={requestMoreData}
                    disabled={working}
                  >
                    {working ? "Sending…" : "Send Request"}
                  </Button>
                  <Button variant="outline" onClick={() => setMode("menu")} disabled={working}>
                    Back
                  </Button>
                </div>
              </div>
            )}

            {mode === "refer" && (
              <div className="space-y-3">
                <Label htmlFor="ref">Specialist type and reason for referral</Label>
                <Textarea
                  id="ref"
                  rows={6}
                  placeholder="e.g. Pediatric neurologist — for evaluation of suspected seizure activity…"
                  value={referralText}
                  onChange={(e) => setReferralText(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={referToSpecialist}
                    disabled={working}
                  >
                    {working ? "Saving…" : "Record Referral"}
                  </Button>
                  <Button variant="outline" onClick={() => setMode("menu")} disabled={working}>
                    Back
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section C — Private Clinical Notes */}
        {canSeeNotes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Psychologist Notes — Confidential</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {notesSaving
                    ? "Saving…"
                    : notesSavedAt
                      ? `Saved ${notesSavedAt.toLocaleTimeString()}`
                      : "Auto-saves every 2 min"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={6}
                placeholder="Private clinical notes — visible only to psychologist and administrator."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button variant="outline" size="sm" onClick={saveNotesNow}>
                Save Notes Now
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Section D — Cancel */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </main>
    </div>
  );
}
