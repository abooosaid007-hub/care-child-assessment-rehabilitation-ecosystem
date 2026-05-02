-- Add new fields
ALTER TABLE public.intervention_plans
  ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cycle_length_days INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Migrate existing Archived → Replaced
UPDATE public.intervention_plans SET status = 'Replaced' WHERE status = 'Archived';

-- Update trigger to set status='Replaced' and replaced_at when superseding
CREATE OR REPLACE FUNCTION public.supersede_active_interventions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'Active' THEN
    UPDATE public.intervention_plans
       SET status = 'Replaced',
           replaced_at = now()
     WHERE student_id = NEW.student_id
       AND status = 'Active'
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trg_supersede_active_interventions ON public.intervention_plans;
CREATE TRIGGER trg_supersede_active_interventions
  BEFORE INSERT OR UPDATE ON public.intervention_plans
  FOR EACH ROW EXECUTE FUNCTION public.supersede_active_interventions();

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_intervention_student ON public.intervention_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_intervention_status ON public.intervention_plans(status);