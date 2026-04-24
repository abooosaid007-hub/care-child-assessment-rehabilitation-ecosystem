-- 1. Enforce ONE active intervention per student via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_intervention_per_student
ON public.intervention_plans (student_id)
WHERE status = 'Active';

-- 2. Trigger: when a new Active plan is inserted, supersede previous Active plans for that student
CREATE OR REPLACE FUNCTION public.supersede_active_interventions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Active' THEN
    UPDATE public.intervention_plans
       SET status = 'Superseded'
     WHERE student_id = NEW.student_id
       AND status = 'Active'
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supersede_active_interventions ON public.intervention_plans;
CREATE TRIGGER trg_supersede_active_interventions
BEFORE INSERT ON public.intervention_plans
FOR EACH ROW
EXECUTE FUNCTION public.supersede_active_interventions();

-- 3. Monthly domain progress score table (-2 to +2)
CREATE TABLE IF NOT EXISTS public.domain_progress_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  priority_domain text NOT NULL,
  period_month date NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN -2 AND 2),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, priority_domain, period_month)
);

ALTER TABLE public.domain_progress_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access domain_progress_scores"
ON public.domain_progress_scores FOR ALL TO authenticated
USING (current_user_role() = 'administrator')
WITH CHECK (current_user_role() = 'administrator');

CREATE POLICY "Psychologists manage domain_progress_scores"
ON public.domain_progress_scores FOR ALL TO authenticated
USING (current_user_role() = 'psychologist')
WITH CHECK (current_user_role() = 'psychologist');

CREATE POLICY "Staff read domain_progress_scores"
ON public.domain_progress_scores FOR SELECT TO authenticated
USING (current_user_role() = ANY (ARRAY['teacher','speech_therapist']));

CREATE INDEX IF NOT EXISTS idx_dps_student ON public.domain_progress_scores(student_id);

-- 4. Index to support 7-day rolling Unknown-trigger quality check
CREATE INDEX IF NOT EXISTS idx_daily_logs_student_date
ON public.daily_logs(student_id, log_date DESC);