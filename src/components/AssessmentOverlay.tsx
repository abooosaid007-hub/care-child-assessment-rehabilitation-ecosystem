import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Save, Sparkles, Send, X, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { PsychologistReviewOverlay } from "@/components/PsychologistReviewOverlay";

interface StudentLite {
  id: string;
  student_code: string;
  first_name: string;
  date_of_birth: string;
  gender: string | null;
  primary_condition: string;
  comorbid_conditions: string[];
  under_observation: string[];
  severity: string | null;
  complexity_flag: string | null;
}

const ASSESSMENT_TYPES = ["Initial Assessment", "Re-Assessment", "Progress Review"];
const MED_CONDITIONS = ["None", "Epilepsy", "Cardiac", "GI Issues", "Hearing Issues", "Vision Issues", "Other"];
const BIRTH_COMPLICATIONS = ["None", "Premature", "Oxygen deprivation", "Other", "Unknown"];
const HOME_LANGS = ["Urdu", "English", "Punjabi", "Pashto", "Mixed", "Other"];
const FAMILY_AWARENESS = ["Fully aware", "Partially aware", "In denial", "Unaware"];
const PARENT_ENGAGEMENT = ["High", "Moderate", "Low", "Absent"];
const ATTENTION_SPAN = ["Under 2 min", "2 to 5 min", "5 to 10 min", "10 to 15 min", "Over 15 min"];
const HYPER_LEVELS = ["None", "Mild", "Moderate", "Severe"];
const MELTDOWN_FREQ = ["Rare", "Occasional", "Frequent daily", "Multiple daily"];
const MELTDOWN_SEV = ["Mild self-calms", "Moderate needs support", "Severe physical risk"];
const SIB_LEVELS = ["None", "Mild", "Moderate", "Severe"];
const AGGRESSION_LEVELS = ["None", "Rare", "Occasional", "Frequent"];
const COMM_MODE = ["Non-verbal", "Single words", "2 to 3 word phrases", "Sentences", "Fluent speech"];
const SPEECH_CLARITY = ["Unintelligible", "Partially clear", "Mostly clear", "Clear"];
const INITIATES_COMM = ["Never", "Rarely", "Sometimes", "Often", "Frequently"];
const FOLLOW_1_STEP = ["Never", "With physical prompt", "With verbal prompt", "Independently"];
const FOLLOW_2_STEP = ["Never", "With prompt", "Sometimes", "Independently"];
const EYE_CONTACT = ["None", "Fleeting", "Inconsistent", "Appropriate"];
const JOINT_ATTN = ["Absent", "Emerging", "Inconsistent", "Present"];
const PEER_INTERACTION = ["Avoids", "Parallel play only", "Seeks peers", "Engages appropriately"];
const RATING_COLS = ["Not Present", "Emerging", "Developing", "Consistent"];
const ACADEMIC_SKILLS = [
  "Pre-literacy letter recognition",
  "Reading word level",
  "Reading comprehension",
  "Writing and copying",
  "Number recognition 1 to 10",
  "Basic counting",
  "Simple addition and subtraction",
  "Color and shape recognition",
  "Sorting and categorization",
  "Concept of time",
];
const FUNCTIONAL_SKILLS = [
  "Toileting independent",
  "Hand washing",
  "Dressing",
  "Feeding self",
  "Following classroom routines",
  "Transitioning between activities",
  "Waiting turn",
  "Packing bag",
  "Basic safety awareness",
  "Asking for help",
];
const DIET_VARIETY = ["Extremely restricted", "Limited", "Moderate", "Varied"];
const SENSORY_REFUSAL = ["Severe", "Moderate", "Mild", "None"];
const NEXT_STEP = [
  "Confirm existing diagnosis",
  "Request further assessment",
  "Refer to specialist",
  "Begin intervention planning",
];

interface FormData {
  assessment_type: string;
  consultant_name: string;
  psychologist_on_record: string;
  assessment_date: string;
  previous_diagnosis: string;
  diagnosed_by: string;
  year_of_diagnosis: string;
  medical_conditions: string[];
  current_medications: boolean;
  medications_detail: string;
  age_first_walked_months: string;
  age_first_words_months: string;
  birth_complications: string[];
  primary_caregiver: string;
  number_of_siblings: string;
  home_language: string[];
  family_awareness: string;
  parental_engagement: string;
  parent_concerns: string;
  attention_span: string;
  hyperactivity: string;
  impulsivity: string;
  attention_description: string;
  meltdown_frequency: string;
  meltdown_severity: string;
  self_injurious: string;
  aggression: string;
  triggers: string;
  what_calms: string;
  communication_mode: string;
  speech_clarity: string;
  initiates_communication: string;
  follows_1_step: string;
  follows_2_step: string;
  eye_contact: string;
  joint_attention: string;
  peer_interaction: string;
  speech_therapist_notes: string;
  academic_ratings: Record<string, string>;
  functional_ratings: Record<string, string>;
  dietary_variety: string;
  sensory_food_refusal: string;
  parent_diet_notes: string;
  key_strengths: string;
  special_interests: string;
  clinical_impression: string;
  primary_concerns: string;
  recommended_next_step: string;
  clinical_questions: string;
}

function emptyForm(): FormData {
  return {
    assessment_type: "Initial Assessment",
    consultant_name: "",
    psychologist_on_record: "",
    assessment_date: new Date().toISOString().slice(0, 10),
    previous_diagnosis: "",
    diagnosed_by: "",
    year_of_diagnosis: "",
    medical_conditions: [],
    current_medications: false,
    medications_detail: "",
    age_first_walked_months: "",
    age_first_words_months: "",
    birth_complications: [],
    primary_caregiver: "",
    number_of_siblings: "",
    home_language: [],
    family_awareness: "",
    parental_engagement: "",
    parent_concerns: "",
    attention_span: "",
    hyperactivity: "",
    impulsivity: "",
    attention_description: "",
    meltdown_frequency: "",
    meltdown_severity: "",
    self_injurious: "",
    aggression: "",
    triggers: "",
    what_calms: "",
    communication_mode: "",
    speech_clarity: "",
    initiates_communication: "",
    follows_1_step: "",
    follows_2_step: "",
    eye_contact: "",
    joint_attention: "",
    peer_interaction: "",
    speech_therapist_notes: "",
    academic_ratings: {},
    functional_ratings: {},
    dietary_variety: "",
    sensory_food_refusal: "",
    parent_diet_notes: "",
    key_strengths: "",
    special_interests: "",
    clinical_impression: "",
    primary_concerns: "",
    recommended_next_step: "",
    clinical_questions: "",
  };
}

function ButtonSelector({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-2 rounded-md text-sm border transition-colors ${
            value === opt ? "bg-teal-600 text-white border-teal-600" : "bg-background border-border hover:bg-muted"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function CheckboxGroup({ options, values, onChange }: { options: string[]; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((opt) => {
        const checked = values.includes(opt);
        return (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={checked}
              onCheckedChange={(c) => {
                if (c) onChange([...values, opt]);
                else onChange(values.filter((v) => v !== opt));
              }}
            />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function RatingTable({ skills, ratings, onChange }: { skills: string[]; ratings: Record<string, string>; onChange: (skill: string, rating: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-2 font-semibold">Skill</th>
            {RATING_COLS.map((c) => (
              <th key={c} className="text-center py-2 px-2 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skills.map((skill) => (
            <tr key={skill} className="border-b border-border/50">
              <td className="py-2 pr-2">{skill}</td>
              {RATING_COLS.map((c) => (
                <td key={c} className="text-center py-2 px-2">
                  <input
                    type="radio"
                    name={`rating-${skill}`}
                    checked={ratings[skill] === c}
                    onChange={() => onChange(skill, c)}
                    className="w-4 h-4 accent-teal-600"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  student: StudentLite;
  onClose: () => void;
}

export function AssessmentOverlay({ student, onClose }: Props) {
  const studentId = student.id;
  const { profile, user } = useAuth();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [section, setSection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [psychNotes, setPsychNotes] = useState<string | null>(null);

  const formRef = useRef(form);
  formRef.current = form;
  const assessmentIdRef = useRef<string | null>(null);
  assessmentIdRef.current = assessmentId;

  // Lock body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Initial load: fetch or create draft assessment
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);

      const { data: existing, error: aErr } = await supabase
        .from("assessments")
        .select("id, form_data, ai_draft_output")
        .eq("student_id", studentId)
        .eq("psychologist_status", "Pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (aErr) {
        setLoadError(`Failed to check existing draft: ${aErr.message}`);
        setLoading(false);
        return;
      }

      if (existing) {
        setAssessmentId(existing.id);
        if (existing.form_data && typeof existing.form_data === "object") {
          setForm({ ...emptyForm(), ...(existing.form_data as Partial<FormData>) });
        }
        if (existing.ai_draft_output) setAiOutput(existing.ai_draft_output);
      } else {
        const initial = emptyForm();
        if (profile?.full_name) initial.consultant_name = profile.full_name;
        const { data: created, error: cErr } = await supabase
          .from("assessments")
          .insert({
            student_id: studentId,
            created_by: user.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            form_data: initial as any,
            assessment_date: initial.assessment_date,
            assessment_type: initial.assessment_type,
            consultant_name: initial.consultant_name,
          })
          .select("id")
          .single();
        if (cancelled) return;
        if (cErr) {
          setLoadError(`Failed to create assessment draft: ${cErr.message}`);
          setLoading(false);
          return;
        }
        setAssessmentId(created.id);
        setForm(initial);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, user, profile]);

  useEffect(() => {
    if (profile?.full_name && !form.consultant_name) {
      setForm((f) => ({ ...f, consultant_name: profile.full_name ?? "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const save = async (silent = false): Promise<boolean> => {
    const id = assessmentIdRef.current;
    if (!id) return false;
    setSaving(true);
    const f = formRef.current;
    const { error } = await supabase
      .from("assessments")
      .update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form_data: f as any,
        assessment_date: f.assessment_date,
        assessment_type: f.assessment_type,
        consultant_name: f.consultant_name,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      if (!silent) toast.error(`Save failed: ${error.message}`);
      return false;
    }
    setLastSaved(new Date());
    if (!silent) toast.success("Saved");
    return true;
  };

  useEffect(() => {
    if (!assessmentId) return;
    const interval = setInterval(() => void save(true), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [assessmentId]);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submitAssessment = async () => {
    setSubmitError(null);
    const missing: string[] = [];
    if (!form.assessment_type) missing.push("assessment type (Section 1)");
    if (!form.consultant_name.trim()) missing.push("consultant name (Section 1)");
    if (!form.assessment_date) missing.push("assessment date (Section 1)");
    if (!form.clinical_impression.trim()) missing.push("clinical impression (Section 9)");
    if (!form.recommended_next_step) missing.push("recommended next step (Section 9)");
    if (missing.length) {
      setSubmitError(`Please complete: ${missing.join(", ")}.`);
      return;
    }

    const id = assessmentIdRef.current;
    if (!id) {
      setSubmitError("No assessment draft found. Please reload the page.");
      return;
    }

    setSubmitting(true);
    const f = formRef.current;
    const { error } = await supabase
      .from("assessments")
      .update({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form_data: f as any,
        assessment_date: f.assessment_date,
        assessment_type: f.assessment_type,
        consultant_name: f.consultant_name,
        psychologist_status: "Submitted",
      })
      .eq("id", id);

    if (error) {
      setSubmitting(false);
      setSubmitError(`Submit failed: ${error.message}`);
      return;
    }

    const { error: stuErr } = await supabase
      .from("students")
      .update({ assessment_status: "Intake Submitted" })
      .eq("id", studentId);

    setSubmitting(false);
    if (stuErr) {
      setSubmitError(`Saved assessment but failed to update student status: ${stuErr.message}`);
      return;
    }
    setLastSaved(new Date());
    setSubmitted(true);
    toast.success("Assessment submitted successfully");
  };

  const generateAI = async () => {
    if (!form.assessment_type || !form.consultant_name || !form.assessment_date) {
      toast.error("Section 1 incomplete: assessment type, consultant name, and date are required.");
      setSection(1);
      return;
    }
    if (!form.recommended_next_step || !form.clinical_impression.trim()) {
      toast.error("Section 9 incomplete: clinical impression and recommended next step are required.");
      setSection(9);
      return;
    }
    setAiError(null);
    setAiLoading(true);
    setAiOutput(null);

    const ok = await save(true);
    if (!ok) {
      setAiLoading(false);
      setAiError("Could not save form before generating. Please try again.");
      return;
    }

    const timeoutMs = 60000;
    const timer = new Promise<{ error: string }>((resolve) =>
      setTimeout(() => resolve({ error: "AI request timed out after 60 seconds." }), timeoutMs),
    );

    try {
      const callPromise = supabase.functions
        .invoke("generate-assessment", {
          body: { formData: form, studentSummary: student },
        })
        .then((r) => r);

      const result = (await Promise.race([callPromise, timer])) as
        | { data: { output?: string; error?: string } | null; error: { message: string } | null }
        | { error: string };

      if ("error" in result && typeof result.error === "string") {
        setAiError(result.error);
        setAiLoading(false);
        return;
      }
      const r = result as { data: { output?: string; error?: string } | null; error: { message: string } | null };
      if (r.error) {
        setAiError(r.error.message);
        setAiLoading(false);
        return;
      }
      if (r.data?.error) {
        setAiError(r.data.error);
        setAiLoading(false);
        return;
      }
      const output = r.data?.output ?? "";
      if (!output) {
        setAiError("AI returned an empty response.");
        setAiLoading(false);
        return;
      }
      setAiOutput(output);

      const id = assessmentIdRef.current;
      if (id) {
        const { error: upErr } = await supabase
          .from("assessments")
          .update({ ai_draft_output: output, ai_generated_at: new Date().toISOString() })
          .eq("id", id);
        if (upErr) toast.error(`Saved AI output failed: ${upErr.message}`);
      }
      await supabase
        .from("students")
        .update({ assessment_status: "AI Analysis Generated" })
        .eq("id", studentId);
      toast.success("AI assessment generated.");
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Unknown error generating AI assessment.");
    } finally {
      setAiLoading(false);
    }
  };

  const sendToPsychologist = async () => {
    const id = assessmentIdRef.current;
    if (!id) return;
    const { error } = await supabase
      .from("assessments")
      .update({ psychologist_status: "Awaiting Review" })
      .eq("id", id);
    if (error) {
      toast.error(`Send failed: ${error.message}`);
      return;
    }
    await supabase
      .from("students")
      .update({ assessment_status: "Awaiting Psychologist Review" })
      .eq("id", studentId);
    toast.success("Sent to psychologist for review.");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto" role="dialog" aria-modal="true" aria-label="Assessment Intake">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-xs font-mono text-muted-foreground truncate">{student.student_code}</p>
              <p className="text-sm font-semibold truncate">Assessment — {student.first_name}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {saving ? (
                <span>Saving…</span>
              ) : lastSaved ? (
                <span className="text-green-700">Saved {lastSaved.toLocaleTimeString()}</span>
              ) : (
                <span>Not saved yet</span>
              )}
              <Button variant="outline" size="sm" onClick={() => save()}>
                <Save className="h-3 w-3" /> Save
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close assessment">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={(section / 9) * 100} className="flex-1" />
            <span className="text-xs font-semibold whitespace-nowrap">Section {section} of 9</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center text-muted-foreground">Loading assessment…</div>
      ) : loadError ? (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Could not load assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-destructive break-words">{loadError}</p>
              <Button variant="outline" onClick={onClose}>
                <ArrowLeft className="h-4 w-4" /> Close
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
          {section === 1 && (
            <Card>
              <CardHeader><CardTitle>1. Administrative Information</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label>Assessment Type</Label>
                  <div className="mt-2">
                    <ButtonSelector options={ASSESSMENT_TYPES} value={form.assessment_type} onChange={(v) => update("assessment_type", v)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="consultant">Consultant Name</Label>
                  <Input id="consultant" value={form.consultant_name} onChange={(e) => update("consultant_name", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="psych">Psychologist on Record</Label>
                  <Input id="psych" value={form.psychologist_on_record} onChange={(e) => update("psychologist_on_record", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="adate">Assessment Date</Label>
                  <Input id="adate" type="date" value={form.assessment_date} onChange={(e) => update("assessment_date", e.target.value)} />
                </div>
              </CardContent>
            </Card>
          )}

          {section === 2 && (
            <Card>
              <CardHeader><CardTitle>2. Background and History</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div><Label>Previous Diagnosis</Label><Input value={form.previous_diagnosis} onChange={(e) => update("previous_diagnosis", e.target.value)} /></div>
                <div><Label>Diagnosed By</Label><Input value={form.diagnosed_by} onChange={(e) => update("diagnosed_by", e.target.value)} /></div>
                <div><Label>Year of Diagnosis</Label><Input type="number" value={form.year_of_diagnosis} onChange={(e) => update("year_of_diagnosis", e.target.value)} /></div>
                <div><Label>Known Medical Conditions</Label><div className="mt-2"><CheckboxGroup options={MED_CONDITIONS} values={form.medical_conditions} onChange={(v) => update("medical_conditions", v)} /></div></div>
                <div className="flex items-center justify-between">
                  <Label>Current Medications</Label>
                  <Switch checked={form.current_medications} onCheckedChange={(v) => update("current_medications", v)} />
                </div>
                {form.current_medications && (
                  <div><Label>Medication Details</Label><Input value={form.medications_detail} onChange={(e) => update("medications_detail", e.target.value)} /></div>
                )}
                <div><Label>Age First Walked (months)</Label><Input type="number" value={form.age_first_walked_months} onChange={(e) => update("age_first_walked_months", e.target.value)} /></div>
                <div><Label>Age of First Words (months)</Label><Input type="number" value={form.age_first_words_months} onChange={(e) => update("age_first_words_months", e.target.value)} /></div>
                <div><Label>Birth Complications</Label><div className="mt-2"><CheckboxGroup options={BIRTH_COMPLICATIONS} values={form.birth_complications} onChange={(v) => update("birth_complications", v)} /></div></div>
              </CardContent>
            </Card>
          )}

          {section === 3 && (
            <Card>
              <CardHeader><CardTitle>3. Family and Home Environment</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div><Label>Primary Caregiver</Label><Input value={form.primary_caregiver} onChange={(e) => update("primary_caregiver", e.target.value)} /></div>
                <div><Label>Number of Siblings</Label><Input type="number" value={form.number_of_siblings} onChange={(e) => update("number_of_siblings", e.target.value)} /></div>
                <div><Label>Home Language</Label><div className="mt-2"><CheckboxGroup options={HOME_LANGS} values={form.home_language} onChange={(v) => update("home_language", v)} /></div></div>
                <div><Label>Family Awareness</Label><div className="mt-2"><ButtonSelector options={FAMILY_AWARENESS} value={form.family_awareness} onChange={(v) => update("family_awareness", v)} /></div></div>
                <div><Label>Parental Engagement</Label><div className="mt-2"><ButtonSelector options={PARENT_ENGAGEMENT} value={form.parental_engagement} onChange={(v) => update("parental_engagement", v)} /></div></div>
                <div><Label>Parent Reported Concerns</Label><Textarea rows={4} value={form.parent_concerns} onChange={(e) => update("parent_concerns", e.target.value)} /></div>
              </CardContent>
            </Card>
          )}

          {section === 4 && (
            <Card>
              <CardHeader><CardTitle>4. Attention Profile</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div><Label>Attention Span</Label><div className="mt-2"><ButtonSelector options={ATTENTION_SPAN} value={form.attention_span} onChange={(v) => update("attention_span", v)} /></div></div>
                <div><Label>Hyperactivity</Label><div className="mt-2"><ButtonSelector options={HYPER_LEVELS} value={form.hyperactivity} onChange={(v) => update("hyperactivity", v)} /></div></div>
                <div><Label>Impulsivity</Label><div className="mt-2"><ButtonSelector options={HYPER_LEVELS} value={form.impulsivity} onChange={(v) => update("impulsivity", v)} /></div></div>
                <div><Label>Description</Label><Textarea rows={4} value={form.attention_description} onChange={(e) => update("attention_description", e.target.value)} /></div>
              </CardContent>
            </Card>
          )}

          {section === 5 && (
            <Card>
              <CardHeader><CardTitle>5. Emotional and Behavioral Regulation</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div><Label>Meltdown Frequency</Label><div className="mt-2"><ButtonSelector options={MELTDOWN_FREQ} value={form.meltdown_frequency} onChange={(v) => update("meltdown_frequency", v)} /></div></div>
                <div><Label>Meltdown Severity</Label><div className="mt-2"><ButtonSelector options={MELTDOWN_SEV} value={form.meltdown_severity} onChange={(v) => update("meltdown_severity", v)} /></div></div>
                <div><Label>Self-Injurious Behavior</Label><div className="mt-2"><ButtonSelector options={SIB_LEVELS} value={form.self_injurious} onChange={(v) => update("self_injurious", v)} /></div></div>
                <div><Label>Aggression</Label><div className="mt-2"><ButtonSelector options={AGGRESSION_LEVELS} value={form.aggression} onChange={(v) => update("aggression", v)} /></div></div>
                <div><Label>Known Triggers</Label><Textarea rows={3} value={form.triggers} onChange={(e) => update("triggers", e.target.value)} /></div>
                <div><Label>What Calms the Child</Label><Textarea rows={3} value={form.what_calms} onChange={(e) => update("what_calms", e.target.value)} /></div>
              </CardContent>
            </Card>
          )}

          {section === 6 && (
            <Card>
              <CardHeader><CardTitle>6. Communication Profile</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div><Label>Communication Mode</Label><div className="mt-2"><ButtonSelector options={COMM_MODE} value={form.communication_mode} onChange={(v) => update("communication_mode", v)} /></div></div>
                <div><Label>Speech Clarity</Label><div className="mt-2"><ButtonSelector options={SPEECH_CLARITY} value={form.speech_clarity} onChange={(v) => update("speech_clarity", v)} /></div></div>
                <div><Label>Initiates Communication</Label><div className="mt-2"><ButtonSelector options={INITIATES_COMM} value={form.initiates_communication} onChange={(v) => update("initiates_communication", v)} /></div></div>
                <div><Label>Follows 1-step Instructions</Label><div className="mt-2"><ButtonSelector options={FOLLOW_1_STEP} value={form.follows_1_step} onChange={(v) => update("follows_1_step", v)} /></div></div>
                <div><Label>Follows 2-step Instructions</Label><div className="mt-2"><ButtonSelector options={FOLLOW_2_STEP} value={form.follows_2_step} onChange={(v) => update("follows_2_step", v)} /></div></div>
                <div><Label>Eye Contact</Label><div className="mt-2"><ButtonSelector options={EYE_CONTACT} value={form.eye_contact} onChange={(v) => update("eye_contact", v)} /></div></div>
                <div><Label>Joint Attention</Label><div className="mt-2"><ButtonSelector options={JOINT_ATTN} value={form.joint_attention} onChange={(v) => update("joint_attention", v)} /></div></div>
                <div><Label>Peer Interaction</Label><div className="mt-2"><ButtonSelector options={PEER_INTERACTION} value={form.peer_interaction} onChange={(v) => update("peer_interaction", v)} /></div></div>
                <div><Label>Speech Therapist Notes</Label><Textarea rows={4} value={form.speech_therapist_notes} onChange={(e) => update("speech_therapist_notes", e.target.value)} /></div>
              </CardContent>
            </Card>
          )}

          {section === 7 && (
            <Card>
              <CardHeader><CardTitle>7. Academic Skills</CardTitle></CardHeader>
              <CardContent>
                <RatingTable
                  skills={ACADEMIC_SKILLS}
                  ratings={form.academic_ratings}
                  onChange={(s, r) => update("academic_ratings", { ...form.academic_ratings, [s]: r })}
                />
              </CardContent>
            </Card>
          )}

          {section === 8 && (
            <Card>
              <CardHeader><CardTitle>8. Functional Skills and Nutrition</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <RatingTable
                  skills={FUNCTIONAL_SKILLS}
                  ratings={form.functional_ratings}
                  onChange={(s, r) => update("functional_ratings", { ...form.functional_ratings, [s]: r })}
                />
                <div><Label>Dietary Variety</Label><div className="mt-2"><ButtonSelector options={DIET_VARIETY} value={form.dietary_variety} onChange={(v) => update("dietary_variety", v)} /></div></div>
                <div><Label>Sensory Food Refusal</Label><div className="mt-2"><ButtonSelector options={SENSORY_REFUSAL} value={form.sensory_food_refusal} onChange={(v) => update("sensory_food_refusal", v)} /></div></div>
                <div><Label>Parent Reported Diet</Label><Textarea rows={3} value={form.parent_diet_notes} onChange={(e) => update("parent_diet_notes", e.target.value)} /></div>
              </CardContent>
            </Card>
          )}

          {section === 9 && (
            <Card>
              <CardHeader><CardTitle>9. Consultant Summary</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div><Label>Key Strengths Observed</Label><Textarea rows={3} value={form.key_strengths} onChange={(e) => update("key_strengths", e.target.value)} /></div>
                <div><Label>Special Interests and Motivators</Label><Textarea rows={3} value={form.special_interests} onChange={(e) => update("special_interests", e.target.value)} /></div>
                <div>
                  <Label>Overall Clinical Impression</Label>
                  <Textarea rows={4} placeholder="Factual observations only" value={form.clinical_impression} onChange={(e) => update("clinical_impression", e.target.value)} />
                </div>
                <div><Label>Areas of Primary Concern</Label><Textarea rows={3} value={form.primary_concerns} onChange={(e) => update("primary_concerns", e.target.value)} /></div>
                <div><Label>Recommended Next Step</Label><div className="mt-2"><ButtonSelector options={NEXT_STEP} value={form.recommended_next_step} onChange={(v) => update("recommended_next_step", v)} /></div></div>
                <div><Label>Clinical Questions for Psychologist</Label><Textarea rows={3} value={form.clinical_questions} onChange={(e) => update("clinical_questions", e.target.value)} /></div>

                <div className="pt-4 border-t border-border space-y-3">
                  <Button size="lg" variant="outline" className="w-full" onClick={submitAssessment} disabled={submitting}>
                    <Save className="h-5 w-5" />
                    {submitting ? "Submitting…" : "Submit Assessment (Sections 1–9)"}
                  </Button>
                  {submitError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
                      {submitError}
                    </div>
                  )}
                  {submitted && (
                    <div className="rounded-md border-2 border-green-500 bg-green-50 p-4 space-y-3">
                      <p className="font-semibold text-green-800">
                        ✓ Assessment submitted successfully — all 9 sections saved.
                      </p>
                      <p className="text-sm text-green-700">
                        You can now generate the AI assessment report below, or return to the student profile.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={onClose}>
                          <ArrowLeft className="h-4 w-4" /> Back to Student Profile
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link to="/admin">Go to Dashboard</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                  <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white w-full" onClick={generateAI} disabled={aiLoading}>
                    <Sparkles className="h-5 w-5" />
                    {aiLoading ? "AI is analyzing assessment data, please wait…" : "Generate AI Assessment Report"}
                  </Button>
                  {aiError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive break-words">
                      {aiError}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {aiOutput && (
            <Card className="border-2 border-red-300">
              <CardHeader className="bg-red-600 text-white">
                <CardTitle>AI DRAFT — NOT A DIAGNOSIS — PSYCHOLOGIST REVIEW REQUIRED</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{aiOutput}</pre>
                <Button onClick={sendToPsychologist} className="bg-teal-600 hover:bg-teal-700 text-white">
                  <Send className="h-4 w-4" /> Send to Psychologist for Review
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={section === 1} onClick={() => { void save(true); setSection((s) => Math.max(1, s - 1)); }}>
              Back
            </Button>
            <Button variant="outline" disabled={section === 9} onClick={() => { void save(true); setSection((s) => Math.min(9, s + 1)); }}>
              Next
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}
