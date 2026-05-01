-- Align the supersede trigger to use "Archived" status (single source of truth: Active vs Archived)
CREATE OR REPLACE FUNCTION public.supersede_active_interventions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'Active' THEN
    UPDATE public.intervention_plans
       SET status = 'Archived'
     WHERE student_id = NEW.student_id
       AND status = 'Active'
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Normalize any historical "Superseded" rows into "Archived"
UPDATE public.intervention_plans SET status = 'Archived' WHERE status = 'Superseded';