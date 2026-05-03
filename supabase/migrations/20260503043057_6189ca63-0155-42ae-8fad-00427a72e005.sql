
CREATE TABLE IF NOT EXISTS public.progress_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  intervention_plan_id UUID,
  report_week_start DATE NOT NULL,
  report_week_end DATE NOT NULL,
  priority_domain TEXT NOT NULL,
  avg_rating NUMERIC(3,2),
  incident_rate NUMERIC(5,2),
  strategy_compliance NUMERIC(5,2),
  dominant_trigger TEXT,
  rating_trend TEXT CHECK (rating_trend IN ('Improving', 'Stable', 'Declining')),
  baseline_comparison NUMERIC(4,2),
  ai_analysis_output TEXT NOT NULL,
  teacher_reported_issue TEXT,
  confidence_level TEXT CHECK (confidence_level IN ('LOW', 'MEDIUM', 'HIGH')),
  recommended_action TEXT,
  psychologist_status TEXT CHECK (psychologist_status IN ('Pending','Approved','Modified','Change Implemented','Deferred')) DEFAULT 'Pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_student ON public.progress_reports(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_status ON public.progress_reports(psychologist_status);

ALTER TABLE public.progress_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access progress_reports"
  ON public.progress_reports FOR ALL TO authenticated
  USING (current_user_role() = 'administrator')
  WITH CHECK (current_user_role() = 'administrator');

CREATE POLICY "Psychologists manage progress_reports"
  ON public.progress_reports FOR ALL TO authenticated
  USING (current_user_role() = 'psychologist')
  WITH CHECK (current_user_role() = 'psychologist');

CREATE POLICY "Staff read progress_reports"
  ON public.progress_reports FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['teacher','speech_therapist']));

ALTER TABLE public.intervention_plans
  ADD COLUMN IF NOT EXISTS change_count INTEGER NOT NULL DEFAULT 0;
