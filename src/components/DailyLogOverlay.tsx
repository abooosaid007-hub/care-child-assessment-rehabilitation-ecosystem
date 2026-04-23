import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Star, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  studentId: string;
  studentName: string;
  onClose: () => void;
  onSaved?: () => void;
}

const ATTN_LEVELS = [
  { v: 1, label: "No attention" },
  { v: 2, label: "Minimal" },
  { v: 3, label: "Moderate" },
  { v: 4, label: "Good" },
  { v: 5, label: "Excellent" },
];
const REG_LEVELS = [
  { v: 1, label: "Very Poor" },
  { v: 2, label: "Poor" },
  { v: 3, label: "Fair" },
  { v: 4, label: "Good" },
  { v: 5, label: "Excellent" },
];
const PROMPT_DEPS = ["Independent", "Verbal", "Physical", "Full Assist"];
const SKILL_PERF = ["Emerging", "Developing", "Consistent"];

function PillButton({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm border transition-colors ${
        active
          ? "bg-teal-600 text-white border-teal-600"
          : "bg-background border-border hover:bg-muted"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function DailyLogOverlay({ studentId, studentName, onClose, onSaved }: Props) {
  const { user } = useAuth();

  const today = new Date().toISOString().slice(0, 10);
  const [logDate, setLogDate] = useState(today);
  const [sessionTime, setSessionTime] = useState<"Morning" | "Afternoon" | "">("");
  const [attentionLevel, setAttentionLevel] = useState<number | null>(null);
  const [attentionMinutes, setAttentionMinutes] = useState("");
  const [promptDep, setPromptDep] = useState("");
  const [incidentCount, setIncidentCount] = useState(0);
  const [incidentDesc, setIncidentDesc] = useState("");
  const [emoReg, setEmoReg] = useState<number | null>(null);
  const [emoTrigger, setEmoTrigger] = useState("");
  const [skill, setSkill] = useState("");
  const [skillPerf, setSkillPerf] = useState("");
  const [intervention, setIntervention] = useState("");
  const [interventionEff, setInterventionEff] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const submit = async () => {
    setError(null);
    if (!user) {
      setError("Not authenticated.");
      return;
    }
    if (!logDate) return setError("Date is required.");
    if (!sessionTime) return setError("Please select a session time.");

    setSaving(true);
    const { error: insErr } = await supabase.from("daily_logs").insert({
      student_id: studentId,
      created_by: user.id,
      log_date: logDate,
      session_time: sessionTime,
      attention_level: attentionLevel,
      attention_minutes: attentionMinutes ? Number(attentionMinutes) : null,
      prompt_dependency: promptDep || null,
      behavioral_incidents: incidentCount,
      incident_description: incidentCount > 0 ? incidentDesc || null : null,
      emotional_regulation: emoReg,
      emotional_trigger: emoTrigger || null,
      skill_practiced: skill || null,
      skill_performance: skillPerf || null,
      intervention_used: intervention || null,
      intervention_effectiveness: interventionEff,
      teacher_notes: notes || null,
    });
    setSaving(false);
    if (insErr) {
      setError(`Save failed: ${insErr.message}`);
      return;
    }
    toast.success(`Daily log recorded for ${studentName} on ${logDate}`);
    onSaved?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Daily Observation Log"
    >
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Daily Observation Log — {studentName}</p>
            <p className="text-xs text-muted-foreground">Factual observations only</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close log">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-28">
        <Card>
          <CardHeader>
            <CardTitle>New Daily Log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="logdate">Date</Label>
              <Input
                id="logdate"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Session Time</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <PillButton
                  active={sessionTime === "Morning"}
                  onClick={() => setSessionTime("Morning")}
                  className="py-4 text-base"
                >
                  Morning
                </PillButton>
                <PillButton
                  active={sessionTime === "Afternoon"}
                  onClick={() => setSessionTime("Afternoon")}
                  className="py-4 text-base"
                >
                  Afternoon
                </PillButton>
              </div>
            </div>

            <div>
              <Label>Attention Level</Label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {ATTN_LEVELS.map((a) => (
                  <PillButton
                    key={a.v}
                    active={attentionLevel === a.v}
                    onClick={() => setAttentionLevel(a.v)}
                  >
                    <span className="font-semibold">{a.v}</span> {a.label}
                  </PillButton>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="amin">Attention Minutes Sustained</Label>
              <Input
                id="amin"
                type="number"
                min={0}
                value={attentionMinutes}
                onChange={(e) => setAttentionMinutes(e.target.value)}
              />
            </div>

            <div>
              <Label>Prompt Dependency</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PROMPT_DEPS.map((p) => (
                  <PillButton key={p} active={promptDep === p} onClick={() => setPromptDep(p)}>
                    {p}
                  </PillButton>
                ))}
              </div>
            </div>

            <div>
              <Label>Behavioral Incidents Count</Label>
              <div className="mt-2 flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIncidentCount((c) => Math.max(0, c - 1))}
                  aria-label="Decrease"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-xl font-semibold w-8 text-center">{incidentCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIncidentCount((c) => c + 1)}
                  aria-label="Increase"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {incidentCount > 0 && (
                <div className="mt-3">
                  <Label htmlFor="idesc">Describe incidents</Label>
                  <Textarea
                    id="idesc"
                    rows={3}
                    value={incidentDesc}
                    onChange={(e) => setIncidentDesc(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Emotional Regulation Level</Label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {REG_LEVELS.map((r) => (
                  <PillButton key={r.v} active={emoReg === r.v} onClick={() => setEmoReg(r.v)}>
                    <span className="font-semibold">{r.v}</span> {r.label}
                  </PillButton>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="trig">Emotional Trigger (optional)</Label>
              <Input id="trig" value={emoTrigger} onChange={(e) => setEmoTrigger(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="skill">Skill Practiced Today</Label>
              <Input id="skill" value={skill} onChange={(e) => setSkill(e.target.value)} />
            </div>

            <div>
              <Label>Skill Performance</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SKILL_PERF.map((p) => (
                  <PillButton key={p} active={skillPerf === p} onClick={() => setSkillPerf(p)}>
                    {p}
                  </PillButton>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="iv">Intervention Used</Label>
              <Input id="iv" value={intervention} onChange={(e) => setIntervention(e.target.value)} />
            </div>

            <div>
              <Label>Intervention Effectiveness</Label>
              <div className="mt-2 flex items-center gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setInterventionEff(n)}
                    aria-label={`${n} star`}
                    className="p-1"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        interventionEff !== null && n <= interventionEff
                          ? "fill-amber-400 text-amber-500"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Teacher Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                placeholder="Factual observations only — no assumptions or judgments"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              <Button
                size="lg"
                className="bg-teal-600 hover:bg-teal-700 text-white flex-1"
                onClick={submit}
                disabled={saving}
              >
                {saving ? "Saving…" : "SUBMIT LOG"}
              </Button>
              <Button size="lg" variant="outline" onClick={onClose} disabled={saving}>
                CANCEL
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
