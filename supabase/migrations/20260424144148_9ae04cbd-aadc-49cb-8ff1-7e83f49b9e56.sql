
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS priority_domain text,
  ADD COLUMN IF NOT EXISTS priority_domain_start_date date,
  ADD COLUMN IF NOT EXISTS intervention_status text;

ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS rating integer,
  ADD COLUMN IF NOT EXISTS context_trigger text,
  ADD COLUMN IF NOT EXISTS incident_yes_no boolean,
  ADD COLUMN IF NOT EXISTS strategy_used text,
  ADD COLUMN IF NOT EXISTS non_compliance_reason text;

ALTER TABLE public.intervention_plans
  ADD COLUMN IF NOT EXISTS priority_domain text,
  ADD COLUMN IF NOT EXISTS selected_strategy text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS status text;

-- Make the title/content columns nullable for option-style plans (existing inserts still work)
ALTER TABLE public.intervention_plans
  ALTER COLUMN title DROP NOT NULL,
  ALTER COLUMN content DROP NOT NULL;

-- Allow administrators to insert daily_logs (the existing policy only covered teacher/speech_therapist)
DROP POLICY IF EXISTS "Teachers insert daily_logs" ON public.daily_logs;
CREATE POLICY "Staff insert daily_logs"
ON public.daily_logs
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND current_user_role() = ANY (ARRAY['teacher','speech_therapist','administrator','psychologist'])
);
