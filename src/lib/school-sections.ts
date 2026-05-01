export const SCHOOL_SECTIONS = [
  "ASD Section",
  "MCC",
  "HIC",
  "VIC",
  "PHC",
] as const;

export type SchoolSection = (typeof SCHOOL_SECTIONS)[number];

export const SECTION_LABELS: Record<SchoolSection, string> = {
  "ASD Section": "ASD Section",
  MCC: "MCC (Mentally Challenged Children)",
  HIC: "HIC (Hearing Impaired)",
  VIC: "VIC (Visually Impaired)",
  PHC: "PHC (Physically Handicapped)",
};

export const SECTION_SHORT: Record<SchoolSection, string> = {
  "ASD Section": "ASD",
  MCC: "MCC",
  HIC: "HIC",
  VIC: "VIC",
  PHC: "PHC",
};

export const ASD_SUBS = ["Level 1", "Level 2", "Level 3"] as const;
export const MCC_SUBS = [
  "Mild",
  "Moderate",
  "Severe",
  "Profound",
  "Vocational",
] as const;
export const CLASS_SUBS = [
  "KG1",
  "KG2",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
] as const;

export function subCategoriesFor(section: SchoolSection | "" | null | undefined): readonly string[] {
  switch (section) {
    case "ASD Section":
      return ASD_SUBS;
    case "MCC":
      return MCC_SUBS;
    case "HIC":
    case "VIC":
    case "PHC":
      return CLASS_SUBS;
    default:
      return [];
  }
}

/** Compact identity string used in lists, e.g. "ASD | Level 2 | ID: CARE-001" */
export function studentIdentity(opts: {
  school_section: string | null;
  sub_category: string | null;
  student_code: string;
}): string {
  const sec = opts.school_section
    ? (SECTION_SHORT[opts.school_section as SchoolSection] ?? opts.school_section)
    : "Uncategorized";
  const sub = opts.sub_category ?? "—";
  return `${sec} | ${sub} | ID: ${opts.student_code}`;
}
