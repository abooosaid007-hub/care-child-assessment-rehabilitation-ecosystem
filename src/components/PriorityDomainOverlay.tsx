import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Brain, Activity, MessageCircle, Sparkles, Footprints, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  studentId: string;
  studentName: string;
  onClose: () => void;
  onSelected?: (domain: string) => void;
}

const DOMAINS = [
  {
    key: "Attention Regulation",
    icon: Brain,
    desc: "Sustaining focus, reducing distractibility, building task-completion stamina.",
  },
  {
    key: "Behavioral Control",
    icon: Activity,
    desc: "Reducing meltdowns, aggression, and impulsivity; building self-regulation.",
  },
  {
    key: "Communication Skill",
    icon: MessageCircle,
    desc: "Initiating speech, expanding utterances, following instructions, social use of language.",
  },
  {
    key: "Sensory Regulation",
    icon: Sparkles,
    desc: "Managing sensory seeking/avoiding behaviors and food/textile/auditory tolerance.",
  },
  {
    key: "Motor/Physical Development",
    icon: Footprints,
    desc: "Gross/fine motor skills, coordination, postural control, daily-living tasks.",
  },
];

export function PriorityDomainOverlay({ studentId, studentName, onClose, onSelected }: Props) {
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const choose = async (domain: string) => {
    setSaving(domain);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("students")
      .update({
        priority_domain: domain,
        priority_domain_start_date: today,
        assessment_status: "Priority Selected - Awaiting Intervention",
      })
      .eq("id", studentId);
    setSaving(null);
    if (error) {
      toast.error(`Could not save priority domain: ${error.message}`);
      return;
    }
    toast.success(`Priority domain set: ${domain}`);
    onSelected?.(domain);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-background overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Select Priority Domain"
    >
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold truncate">
            {studentName} — Select Priority Domain for Next 30 Days
          </p>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-24">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900">
            <span className="font-semibold">Select ONLY ONE domain.</span> Other domains remain on
            observation only for the next 30 days.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DOMAINS.map((d) => {
            const Icon = d.icon;
            const isSaving = saving === d.key;
            return (
              <Card
                key={d.key}
                className="hover:border-purple-500 transition-colors cursor-pointer"
                onClick={() => !saving && choose(d.key)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-purple-100 p-2 text-purple-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{d.key}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{d.desc}</p>
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={!!saving}
                    onClick={(e) => {
                      e.stopPropagation();
                      choose(d.key);
                    }}
                  >
                    {isSaving ? "Saving…" : `Select ${d.key}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
