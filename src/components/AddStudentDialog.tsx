import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SCHOOL_SECTIONS,
  SECTION_LABELS,
  subCategoriesFor,
  type SchoolSection,
} from "@/lib/school-sections";

const PRIMARY_CONDITIONS = [
  "Autism Spectrum Disorder",
  "ADHD",
  "Intellectual Disability",
  "Down Syndrome",
  "Cerebral Palsy",
  "Speech and Language Disorder",
  "Learning Disability",
  "Hearing Impairment",
  "Visual Impairment",
  "Other",
];

const COMORBID_OPTIONS = [
  "ADHD",
  "Anxiety",
  "Epilepsy",
  "Sensory Processing Disorder",
  "Speech Delay",
  "Sleep Disorder",
  "OCD",
  "Depression",
];

const GENDERS = ["Male", "Female", "Other"];
const SEVERITIES = ["Mild", "Moderate", "Severe"];
const COMPLEXITY = ["Simple", "Moderate", "Complex"];

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender: z.string().optional(),
  primary_condition: z.string().min(1, "Primary condition is required"),
  comorbid_conditions: z.array(z.string()),
  class_section: z.string().trim().max(50).optional(),
  school_section: z.string().min(1, "School section is required"),
  sub_category: z.string().min(1, "Sub-category is required"),
  severity: z.string().optional(),
  complexity_flag: z.string().optional(),
  observation_notes: z.string().trim().max(2000).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function AddStudentDialog({ open, onOpenChange, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<string>("");
  const [primaryCondition, setPrimaryCondition] = useState<string>("");
  const [comorbid, setComorbid] = useState<string[]>([]);
  const [classSection, setClassSection] = useState("");
  const [severity, setSeverity] = useState<string>("");
  const [complexity, setComplexity] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [schoolSection, setSchoolSection] = useState<SchoolSection | "">("");
  const [subCategory, setSubCategory] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function reset() {
    setFirstName("");
    setDob("");
    setGender("");
    setPrimaryCondition("");
    setComorbid([]);
    setClassSection("");
    setSchoolSection("");
    setSubCategory("");
    setSeverity("");
    setComplexity("");
    setNotes("");
    setErrorMsg(null);
  }

  function toggleComorbid(value: string) {
    setComorbid((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = schema.safeParse({
      first_name: firstName,
      date_of_birth: dob,
      gender: gender || undefined,
      primary_condition: primaryCondition,
      comorbid_conditions: comorbid,
      class_section: classSection || undefined,
      school_section: schoolSection,
      sub_category: subCategory,
      severity: severity || undefined,
      complexity_flag: complexity || undefined,
      observation_notes: notes || undefined,
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setErrorMsg(first?.message ?? "Please check your inputs");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id ?? null;

      const { error } = await supabase.from("students").insert({
        first_name: parsed.data.first_name,
        date_of_birth: parsed.data.date_of_birth,
        gender: parsed.data.gender ?? null,
        primary_condition: parsed.data.primary_condition,
        comorbid_conditions: parsed.data.comorbid_conditions,
        class_section: parsed.data.class_section ?? null,
        school_section: parsed.data.school_section,
        sub_category: parsed.data.sub_category,
        severity: parsed.data.severity ?? null,
        complexity_flag: parsed.data.complexity_flag ?? null,
        observation_notes: parsed.data.observation_notes ?? null,
        created_by: userId,
      });

      if (error) {
        setErrorMsg(error.message);
        toast.error("Failed to add student", { description: error.message });
        return;
      }

      toast.success("Student added successfully");
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setErrorMsg(msg);
      toast.error("Failed to add student", { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Enroll a new child. A unique student code will be generated automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Ahmed"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input
                id="dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="class_section">Class / Section</Label>
              <Input
                id="class_section"
                value={classSection}
                onChange={(e) => setClassSection(e.target.value)}
                placeholder="e.g. Class A"
              />
            </div>

            <div className="space-y-2">
              <Label>School Section *</Label>
              <Select
                value={schoolSection}
                onValueChange={(v) => {
                  setSchoolSection(v as SchoolSection);
                  setSubCategory("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school section" />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SECTION_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sub-Category *</Label>
              <Select
                value={subCategory}
                onValueChange={setSubCategory}
                disabled={!schoolSection}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      schoolSection ? "Select sub-category" : "Select section first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {subCategoriesFor(schoolSection).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Primary Condition *</Label>
              <Select value={primaryCondition} onValueChange={setPrimaryCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select primary condition" />
                </SelectTrigger>
                <SelectContent>
                  {PRIMARY_CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Complexity Flag</Label>
              <Select value={complexity} onValueChange={setComplexity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select complexity" />
                </SelectTrigger>
                <SelectContent>
                  {COMPLEXITY.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Comorbid Conditions</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 sm:grid-cols-3">
              {COMORBID_OPTIONS.map((opt) => {
                const checked = comorbid.includes(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleComorbid(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observation Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Initial observations, behaviors, family context…"
              rows={4}
              maxLength={2000}
            />
          </div>

          {errorMsg && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Add Student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
