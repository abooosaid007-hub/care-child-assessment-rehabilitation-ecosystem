export type LogFormType = "ASD" | "ADHD" | "ID" | "Motor" | "Communication" | "Generic";

export interface LogFieldConfig {
  label: string;
  options: string[];
  /** number of columns for option buttons (default 2) */
  cols?: number;
}

export interface LogFormConfig {
  type: LogFormType;
  title: string; // e.g. "ASD Focus"
  fields: [LogFieldConfig, LogFieldConfig, LogFieldConfig, LogFieldConfig]; // exactly 4 categorical fields
}

const ASD: LogFormConfig = {
  type: "ASD",
  title: "ASD Focus",
  fields: [
    {
      label: "Social Interaction Today",
      options: [
        "😔 Avoided peers",
        "🤝 Parallel play (near but not with)",
        "👋 Sought peers briefly",
        "😊 Engaged appropriately",
      ],
    },
    {
      label: "Communication Attempts",
      options: ["0-2 times", "3-5 times", "6-10 times", "10+ times"],
    },
    {
      label: "Sensory Regulation",
      options: [
        "🔴 Dysregulated (meltdown/shutdown)",
        "🟡 Needed support to regulate",
        "🟢 Self-regulated well",
        "⚪ No sensory issues observed",
      ],
    },
    {
      label: "Repetitive Behaviors",
      options: [
        "Frequent (interfered with tasks)",
        "Moderate (noticeable but managed)",
        "Minimal",
        "None observed",
      ],
    },
  ],
};

const ADHD: LogFormConfig = {
  type: "ADHD",
  title: "ADHD Focus",
  fields: [
    {
      label: "Sustained Attention",
      options: [
        "😔 Under 2 minutes",
        "🟡 2-5 minutes",
        "🟢 5-10 minutes",
        "😊 10+ minutes",
      ],
    },
    {
      label: "Hyperactivity Level",
      options: [
        "High (constant movement)",
        "Moderate (frequent breaks needed)",
        "Mild (manageable)",
        "Low (calm today)",
      ],
    },
    {
      label: "Impulsivity",
      options: [
        "High (frequent interruptions/actions)",
        "Moderate (some control)",
        "Mild (mostly controlled)",
        "None (good self-control)",
      ],
    },
    {
      label: "Task Completion",
      options: ["0-25%", "25-50%", "50-75%", "75-100%"],
    },
  ],
};

const ID: LogFormConfig = {
  type: "ID",
  title: "ID Focus",
  fields: [
    {
      label: "Task Comprehension",
      options: [
        "Full demonstration needed",
        "Multiple verbal prompts",
        "Minimal prompting",
        "Independent understanding",
      ],
    },
    {
      label: "Task Completion Level",
      options: ["0-25%", "25-50%", "50-75%", "75-100%"],
    },
    {
      label: "Memory/Retention",
      options: [
        "Poor (forgot immediately)",
        "Fair (remembered with prompts)",
        "Good (retained most)",
        "Excellent (full retention)",
      ],
    },
    {
      label: "Assistance Required",
      options: [
        "Full physical assistance",
        "Moderate help",
        "Minimal prompts",
        "Independent",
      ],
    },
  ],
};

const Motor: LogFormConfig = {
  type: "Motor",
  title: "Motor Focus",
  fields: [
    {
      label: "Motor Task Completion",
      options: [
        "Unable to attempt",
        "Partial with full support",
        "Completed with moderate help",
        "Completed independently",
      ],
    },
    {
      label: "Fatigue Level",
      options: ["High (very tired)", "Moderate", "Mild", "Energetic"],
    },
    {
      label: "Pain Indicators",
      options: ["Yes (showed discomfort)", "Mild (minor complaints)", "No pain observed"],
      cols: 3,
    },
    {
      label: "Physical Assistance Level",
      options: ["Full support needed", "Moderate support", "Minimal support", "Independent"],
    },
  ],
};

const Communication: LogFormConfig = {
  type: "Communication",
  title: "Communication Focus",
  fields: [
    {
      label: "Communication Attempts",
      options: ["0-2 times", "3-5 times", "6-10 times", "10+ times"],
    },
    {
      label: "Communication Clarity",
      options: ["Unintelligible", "Partially understood", "Mostly clear", "Fully clear"],
    },
    {
      label: "Response to Questions",
      options: ["No response", "Gestures only", "Single words", "Full sentences"],
    },
    {
      label: "Frustration with Communication",
      options: ["High (gave up/tantrum)", "Moderate (visible frustration)", "Mild", "None"],
    },
  ],
};

const Generic: LogFormConfig = {
  type: "Generic",
  title: "General Focus",
  fields: [
    {
      label: "Domain Performance",
      options: ["😐 Low", "🙂 Medium", "😊 High"],
      cols: 3,
    },
    {
      label: "Context Trigger",
      options: ["Transition", "Noise", "Task", "Tired", "Home issue", "Unknown"],
      cols: 3,
    },
    {
      label: "Strategy Used",
      options: ["Yes", "No", "Partially"],
      cols: 3,
    },
    {
      label: "Engagement Level",
      options: ["Low", "Medium", "High"],
      cols: 3,
    },
  ],
};

export function getLogFormForCondition(primaryCondition: string | null | undefined): LogFormConfig {
  const c = (primaryCondition ?? "").toLowerCase();
  if (!c) return Generic;

  // Autism
  if (c.includes("asd") || c.includes("autism")) return ASD;
  // ADHD
  if (c.includes("adhd")) return ADHD;
  // Down Syndrome → ID
  if (c.includes("down")) return ID;
  // Intellectual Disability / GDD
  if (
    c.includes("intellectual disability") ||
    c.includes("global developmental delay") ||
    c.includes("gdd")
  )
    return ID;
  // Motor
  if (c.includes("cerebral palsy") || c.includes("muscular dystrophy")) return Motor;
  // Communication
  if (
    c.includes("speech") ||
    c.includes("language disorder") ||
    c.includes("selective mutism")
  )
    return Communication;
  // Sensory / behavioral / multiple → Generic
  return Generic;
}

export const CONFIDENCE_OPTIONS = [
  { value: "Low", label: "🟡 Low (rushed/uncertain)" },
  { value: "Medium", label: "🟢 Medium (normal observation)" },
  { value: "High", label: "🔵 High (detailed observation)" },
];
