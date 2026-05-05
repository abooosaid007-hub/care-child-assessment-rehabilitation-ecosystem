import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Lock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  studentId: string;
  studentName: string;
  priorityDomain: string | null;
  /** If provided, open this specific log (view/edit a past or today's log). Otherwise creates/edits today's log. */
  logId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

const RATINGS: { v: 1 | 2 | 3; emoji: string; label: string }[] = [
  { v: 1, emoji: "😐", label: "Low" },
  { v: 2, emoji: "🙂", label: "Medium" },
  { v: 3, emoji: "😊", label: "High" },
];
const TRIGGERS = ["Transition", "Noise", "Task", "Tired", "Home issue", "Unknown"];
const STRATEGY = ["Yes", "No", "Partially"];
const NON_COMPLIANCE_REASONS = [
  "Time constraint",
  "Child resistance",
  "Forgot",
  "Not suitable",
  "Other",
];

function PillButton({
  active,
  onClick,
  children,
  className = "",
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-2 rounded-md text-sm border transition-colors ${
        active
          ? "bg-teal-600 text-white border-teal-600"
          : "bg-background border-border hover:bg-muted"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function DailyLogOverlay({
  studentId,
  studentName,
  priorityDomain,
  logId,
  onClose,
  onSaved,
}: Props) {
  const { user, profile } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const isPrivileged = profile?.role === "administrator" || profile?.role === "psychologist";

  const [existingId, setExistingId] = useState<string | null>(null);
  const [logDate, setLogDate] = useState<string>(today);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [editedByAdmin, setEditedByAdmin] = useState(false);
  const [previousReason, setPreviousReason] = useState<string | null>(null);

  const [rating, setRating] = useState<1 | 2 | 3 | null>(null);
  const [trigger, setTrigger] = useState<string>("");
  const [incident, setIncident] = useState<"Yes" | "No" | null>(null);
  const [incidentDesc, setIncidentDesc] = useState("");
  const [strategy, setStrategy] = useState<string>("");
  const [nonComplianceReason, setNonComplianceReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [editReason, setEditReason] = useState("");

  const [loadingExisting, setLoadingExisting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unknownWarning, setUnknownWarning] = useState<{ pct: number; total: number } | null>(null);

  const isPastDate = logDate < today;
  const readOnly = isPastDate && !isPrivileged;
  const adminOverride = isPastDate && isPrivileged;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Load existing log: by id, or today's log for student
  useEffect(() => {
    (async () => {
      setLoadingExisting(true);
      let query = supabase.from("daily_logs").select("*").eq("student_id", studentId);
      if (logId) {
        query = query.eq("id", logId);
      } else {
        query = query.eq("log_date", today);
      }
      const { data } = await query.maybeSingle();
      if (data) {
        setExistingId(data.id);
        setLogDate(data.log_date);
        setRating((data.rating as 1 | 2 | 3) ?? null);
        setTrigger(data.context_trigger ?? "");
        setIncident(data.incident_yes_no === true ? "Yes" : data.incident_yes_no === false ? "No" : null);
        setIncidentDesc(data.incident_description ?? "");
        setStrategy(data.strategy_used ?? "");
        setNonComplianceReason(data.non_compliance_reason ?? "");
        setNote(data.teacher_notes ?? "");
        setCreatedAt(data.created_at);
        setEditedByAdmin(!!data.edited_by_admin);
        setPreviousReason(data.edit_reason ?? null);
        if (data.created_by) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", data.created_by)
            .maybeSingle();
          setCreatorName(prof?.full_name ?? prof?.email ?? null);
        }
      }
      setLoadingExisting(false);
    })();
  }, [studentId, today, logId]);

  // Data quality flag
  useEffect(() => {
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data } = await supabase
        .from("daily_logs")
        .select("context_trigger")
        .eq("student_id", studentId)
        .gte("log_date", since.toISOString().slice(0, 10));
      if (!data || data.length === 0) return;
      const unknown = data.filter((r) => r.context_trigger === "Unknown").length;
      const pct = (unknown / data.length) * 100;
      if (pct > 40) setUnknownWarning({ pct: Math.round(pct), total: data.length });
    })();
  }, [studentId]);

  const submit = async () => {
    setError(null);
    if (readOnly) return;
    if (!user) return setError("Not authenticated.");
    if (rating === null) return setError("Please select Domain Performance.");
    if (!trigger) return setError("Please select a Context Trigger.");
    if (!incident) return setError("Please indicate if there was a behavioral incident.");
    if (!strategy) return setError("Please indicate if the intervention strategy was used.");
    if ((strategy === "No" || strategy === "Partially") && !nonComplianceReason) {
      return setError("Please select a reason the strategy was not fully used.");
    }
    if (adminOverride && !editReason.trim()) {
      return setError("Reason for editing locked log is required.");
    }

    setSaving(true);
    const basePayload = {
      domain: priorityDomain,
      rating,
      context_trigger: trigger,
      incident_yes_no: incident === "Yes",
      incident_description: incident === "Yes" ? incidentDesc || null : null,
      behavioral_incidents: incident === "Yes" ? 1 : 0,
      strategy_used: strategy,
      non_compliance_reason:
        strategy === "No" || strategy === "Partially" ? nonComplianceReason : null,
      teacher_notes: note || null,
    };

    if (existingId) {
      const updatePayload = adminOverride
        ? {
            ...basePayload,
            edit_reason: editReason.trim(),
            edited_by_admin: true,
            admin_edited_at: new Date().toISOString(),
            admin_edited_by: user.id,
          }
        : basePayload;
      const { error: upErr } = await supabase
        .from("daily_logs")
        .update(updatePayload)
        .eq("id", existingId);
      setSaving(false);
      if (upErr) return setError(`Save failed: ${upErr.message}`);
      toast.success(`Log updated for ${studentName} — ${logDate}`);
    } else {
      const { error: insErr } = await supabase.from("daily_logs").insert({
        student_id: studentId,
        created_by: user.id,
        log_date: today,
        ...basePayload,
      });
      setSaving(false);
      if (insErr) {
        if (insErr.message.toLowerCase().includes("duplicate") || insErr.code === "23505") {
          setError("Today's log already exists. Refreshing to load it...");
          // Trigger re-fetch
          const { data } = await supabase
            .from("daily_logs")
            .select("id")
            .eq("student_id", studentId)
            .eq("log_date", today)
            .maybeSingle();
          if (data) setExistingId(data.id);
          return;
        }
        return setError(`Save failed: ${insErr.message}`);
      }
      toast.success(`Log recorded for ${studentName} on ${today}`);
    }
    onSaved?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Daily Log"
    >
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Daily Log — {studentName}</p>
            <p className="text-xs text-muted-foreground">
              Priority Domain: {priorityDomain ?? "Not set"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-28">
        <Card>
          <CardHeader>
            <CardTitle>{logDate}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingExisting ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {/* Status banner */}
                {readOnly ? (
                  <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
                    <p className="font-semibold flex items-center gap-1">
                      <Lock className="h-4 w-4" /> Log Locked
                    </p>
                    <p>This log is from a past date and cannot be edited.</p>
                    <p className="text-xs mt-1">Contact administrator if changes needed.</p>
                  </div>
                ) : adminOverride ? (
                  <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-semibold">⚠️ Admin Override — Editing locked log</p>
                    <p className="text-xs mt-1">Past-date edits require a documented reason.</p>
                  </div>
                ) : existingId ? (
                  <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                    <p className="font-semibold">⚠️ Editing Today's Log — Changes will update existing entry</p>
                    {creatorName && createdAt && (
                      <p className="text-xs mt-1">
                        Created by {creatorName} at {new Date(createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                    Creating New Log for {studentName} — {today}
                  </div>
                )}

                {editedByAdmin && previousReason && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    Previously admin-edited. Reason: {previousReason}
                  </div>
                )}

                {!priorityDomain && !existingId && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    No priority domain selected for this student.
                  </div>
                )}

                {unknownWarning && (
                  <div className="rounded-md border-2 border-orange-400 bg-orange-50 p-3 text-sm text-orange-900">
                    <p className="font-semibold">⚠ Data quality flag</p>
                    <p>
                      {unknownWarning.pct}% of the last {unknownWarning.total} logs used "Unknown" as the trigger.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
                    {error}
                  </div>
                )}

                <div>
                  <Label>How was {priorityDomain ?? "the priority domain"} today?</Label>
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    {RATINGS.map((r) => (
                      <PillButton
                        key={r.v}
                        active={rating === r.v}
                        onClick={() => setRating(r.v)}
                        disabled={readOnly}
                        className="py-5 text-base flex flex-col items-center gap-1"
                      >
                        <span className="text-2xl">{r.emoji}</span>
                        <span>{r.label}</span>
                      </PillButton>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>What was happening during low/medium performance?</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TRIGGERS.map((t) => (
                      <PillButton
                        key={t}
                        active={trigger === t}
                        onClick={() => setTrigger(t)}
                        disabled={readOnly}
                      >
                        {t}
                      </PillButton>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Behavioral incident today?</Label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <PillButton
                      active={incident === "Yes"}
                      onClick={() => setIncident("Yes")}
                      disabled={readOnly}
                      className="py-4"
                    >
                      Yes
                    </PillButton>
                    <PillButton
                      active={incident === "No"}
                      onClick={() => setIncident("No")}
                      disabled={readOnly}
                      className="py-4"
                    >
                      No
                    </PillButton>
                  </div>
                  {incident === "Yes" && (
                    <div className="mt-3">
                      <Label htmlFor="idesc">Quick description (optional)</Label>
                      <Input
                        id="idesc"
                        value={incidentDesc}
                        onChange={(e) => setIncidentDesc(e.target.value)}
                        placeholder="What happened?"
                        disabled={readOnly}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label>Was today's intervention strategy used?</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {STRATEGY.map((s) => (
                      <PillButton
                        key={s}
                        active={strategy === s}
                        onClick={() => {
                          setStrategy(s);
                          if (s === "Yes") setNonComplianceReason("");
                        }}
                        disabled={readOnly}
                      >
                        {s}
                      </PillButton>
                    ))}
                  </div>
                  {(strategy === "No" || strategy === "Partially") && (
                    <div className="mt-3">
                      <Label htmlFor="ncr">Why not used?</Label>
                      <select
                        id="ncr"
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
                        value={nonComplianceReason}
                        onChange={(e) => setNonComplianceReason(e.target.value)}
                        disabled={readOnly}
                      >
                        <option value="">Select reason…</option>
                        {NON_COMPLIANCE_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="note">Teacher Note (optional)</Label>
                  <Textarea
                    id="note"
                    rows={3}
                    placeholder="One sentence observation (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={readOnly}
                  />
                </div>

                {adminOverride && (
                  <div>
                    <Label htmlFor="editReason">Reason for editing locked log <span className="text-destructive">*</span></Label>
                    <Textarea
                      id="editReason"
                      rows={2}
                      placeholder="Required: explain why this past-date log is being edited"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
                  {!readOnly && (
                    <Button
                      size="lg"
                      className="bg-teal-600 hover:bg-teal-700 text-white flex-1"
                      onClick={submit}
                      disabled={saving || (!priorityDomain && !existingId)}
                    >
                      {saving ? "Saving…" : existingId ? "UPDATE LOG" : "SUBMIT LOG"}
                    </Button>
                  )}
                  <Button size="lg" variant="outline" onClick={onClose} disabled={saving}>
                    {readOnly ? "CLOSE" : "CANCEL"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
