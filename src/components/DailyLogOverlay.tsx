import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  CONFIDENCE_OPTIONS,
  getLogFormForCondition,
  type LogFormConfig,
} from "@/lib/log-forms";

interface Props {
  studentId: string;
  studentName: string;
  priorityDomain: string | null;
  /** Optional: pass to skip a fetch */
  primaryCondition?: string | null;
  /** Open a specific log (history view/edit). Otherwise creates/edits today's log. */
  logId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

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
      className={`px-3 py-2 rounded-md text-sm border transition-colors text-left ${
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
  primaryCondition: primaryConditionProp,
  logId,
  onClose,
  onSaved,
}: Props) {
  const { user, profile } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const isPrivileged = profile?.role === "administrator" || profile?.role === "psychologist";

  const [primaryCondition, setPrimaryCondition] = useState<string | null>(
    primaryConditionProp ?? null,
  );
  const [existingId, setExistingId] = useState<string | null>(null);
  const [logDate, setLogDate] = useState<string>(today);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [editedByAdmin, setEditedByAdmin] = useState(false);
  const [previousReason, setPreviousReason] = useState<string | null>(null);

  // Disability-specific form values
  const [field1, setField1] = useState<string>("");
  const [field2, setField2] = useState<string>("");
  const [field3, setField3] = useState<string>("");
  const [field4, setField4] = useState<string>("");
  // Shared
  const [incident, setIncident] = useState<"Yes" | "No" | null>(null);
  const [incidentDesc, setIncidentDesc] = useState("");
  const [confidence, setConfidence] = useState<string>("");
  const [note, setNote] = useState("");
  const [editReason, setEditReason] = useState("");

  const [loadingExisting, setLoadingExisting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPastDate = logDate < today;
  const readOnly = isPastDate && !isPrivileged;
  const adminOverride = isPastDate && isPrivileged;

  const formCfg: LogFormConfig = useMemo(
    () => getLogFormForCondition(primaryCondition),
    [primaryCondition],
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Fetch student primary_condition if not provided
  useEffect(() => {
    if (primaryConditionProp !== undefined && primaryConditionProp !== null) return;
    (async () => {
      const { data } = await supabase
        .from("students")
        .select("primary_condition")
        .eq("id", studentId)
        .maybeSingle();
      setPrimaryCondition(data?.primary_condition ?? null);
    })();
  }, [studentId, primaryConditionProp]);

  // Load existing log
  useEffect(() => {
    (async () => {
      setLoadingExisting(true);
      let query = supabase.from("daily_logs").select("*").eq("student_id", studentId);
      if (logId) query = query.eq("id", logId);
      else query = query.eq("log_date", today);
      const { data } = await query.maybeSingle();
      if (data) {
        setExistingId(data.id);
        setLogDate(data.log_date);
        setField1(data.field1_value ?? "");
        setField2(data.field2_value ?? "");
        setField3(data.field3_value ?? "");
        setField4(data.field4_value ?? "");
        setIncident(
          data.incident_yes_no === true ? "Yes" : data.incident_yes_no === false ? "No" : null,
        );
        setIncidentDesc(data.incident_description ?? "");
        setConfidence(data.teacher_confidence ?? "");
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

  const fieldStates = [
    { val: field1, set: setField1 },
    { val: field2, set: setField2 },
    { val: field3, set: setField3 },
    { val: field4, set: setField4 },
  ];

  const submit = async () => {
    setError(null);
    if (readOnly) return;
    if (!user) return setError("Not authenticated.");
    for (let i = 0; i < formCfg.fields.length; i++) {
      if (!fieldStates[i].val) {
        return setError(`Please select: ${formCfg.fields[i].label}.`);
      }
    }
    if (!incident) return setError("Please indicate if there was a behavioral incident.");
    if (!confidence) return setError("Please rate your observation confidence.");
    if (adminOverride && !editReason.trim()) {
      return setError("Reason for editing locked log is required.");
    }

    setSaving(true);
    const basePayload = {
      domain: priorityDomain,
      log_form_type: formCfg.type,
      field1_value: field1 || null,
      field2_value: field2 || null,
      field3_value: field3 || null,
      field4_value: field4 || null,
      field5_value: incident,
      field6_value: note || null,
      incident_yes_no: incident === "Yes",
      incident_description: incident === "Yes" ? incidentDesc || null : null,
      behavioral_incidents: incident === "Yes" ? 1 : 0,
      teacher_confidence: confidence,
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
            <p className="text-sm font-semibold truncate">
              Daily Log — {studentName} — {formCfg.title}
            </p>
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
                  </div>
                ) : existingId ? (
                  <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                    <p className="font-semibold">
                      ⚠️ Editing Today's Log — Changes will update existing entry
                    </p>
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

                {error && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
                    {error}
                  </div>
                )}

                {formCfg.fields.map((f, idx) => {
                  const cols = f.cols ?? 2;
                  const colClass =
                    cols === 3 ? "grid-cols-3" : cols === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2";
                  const state = fieldStates[idx];
                  return (
                    <div key={f.label}>
                      <Label>{f.label}</Label>
                      <div className={`mt-2 grid ${colClass} gap-2`}>
                        {f.options.map((opt) => (
                          <PillButton
                            key={opt}
                            active={state.val === opt}
                            onClick={() => state.set(opt)}
                            disabled={readOnly}
                          >
                            {opt}
                          </PillButton>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div>
                  <Label>Behavioral incident today?</Label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <PillButton
                      active={incident === "Yes"}
                      onClick={() => setIncident("Yes")}
                      disabled={readOnly}
                      className="py-4 justify-center text-center"
                    >
                      Yes
                    </PillButton>
                    <PillButton
                      active={incident === "No"}
                      onClick={() => setIncident("No")}
                      disabled={readOnly}
                      className="py-4 justify-center text-center"
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
                  <Label htmlFor="note">Teacher Note (optional, 1 sentence)</Label>
                  <Textarea
                    id="note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={readOnly}
                  />
                </div>

                <div>
                  <Label>How confident are you about today's observations?</Label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {CONFIDENCE_OPTIONS.map((c) => (
                      <PillButton
                        key={c.value}
                        active={confidence === c.value}
                        onClick={() => setConfidence(c.value)}
                        disabled={readOnly}
                      >
                        {c.label}
                      </PillButton>
                    ))}
                  </div>
                </div>

                {adminOverride && (
                  <div>
                    <Label htmlFor="editReason">
                      Reason for editing locked log <span className="text-destructive">*</span>
                    </Label>
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
