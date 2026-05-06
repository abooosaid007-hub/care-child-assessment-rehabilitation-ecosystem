ALTER TABLE public.intervention_plans
  ADD COLUMN IF NOT EXISTS ai_original_output text,
  ADD COLUMN IF NOT EXISTS psychologist_edits jsonb,
  ADD COLUMN IF NOT EXISTS modification_type text,
  ADD COLUMN IF NOT EXISTS refinement_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_version_source text,
  ADD COLUMN IF NOT EXISTS custom_modified boolean NOT NULL DEFAULT false;

ALTER TABLE public.intervention_plans
  DROP CONSTRAINT IF EXISTS intervention_plans_final_version_source_check;
ALTER TABLE public.intervention_plans
  ADD CONSTRAINT intervention_plans_final_version_source_check
  CHECK (final_version_source IS NULL OR final_version_source IN ('AI_Original','Psychologist_Edit','AI_Refined'));

ALTER TABLE public.intervention_plans
  DROP CONSTRAINT IF EXISTS intervention_plans_modification_type_check;
ALTER TABLE public.intervention_plans
  ADD CONSTRAINT intervention_plans_modification_type_check
  CHECK (modification_type IS NULL OR modification_type IN ('Minor','Major'));

ALTER TABLE public.intervention_plans
  DROP CONSTRAINT IF EXISTS intervention_plans_refinement_count_max;
ALTER TABLE public.intervention_plans
  ADD CONSTRAINT intervention_plans_refinement_count_max
  CHECK (refinement_count >= 0 AND refinement_count <= 2);