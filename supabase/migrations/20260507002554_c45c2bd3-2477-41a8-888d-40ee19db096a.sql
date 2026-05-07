CREATE TABLE IF NOT EXISTS public.monthly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  intervention_plan_id UUID,
  cycle_start_date DATE NOT NULL,
  cycle_end_date DATE NOT NULL,
  priority_domain TEXT NOT NULL,
  days_in_cycle INTEGER,
  overall_trend TEXT CHECK (overall_trend IN ('Improving','Stable','Declining')),
  average_rating_month NUMERIC(3,2),
  baseline_rating NUMERIC(3,2),
  current_rating NUMERIC(3,2),
  change_from_baseline NUMERIC(3,2),
  incident_trend TEXT,
  strategy_compliance NUMERIC(5,2),
  red_flags TEXT,
  ai_review_output TEXT NOT NULL,
  confidence_level TEXT CHECK (confidence_level IN ('LOW','MEDIUM','HIGH')),
  recommended_option TEXT CHECK (recommended_option IN ('A','B','C','D')),
  decision_made TEXT CHECK (decision_made IN ('Continue','Modify','Switch','Reduce')),
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monthly_student ON public.monthly_reviews(student_id);
CREATE INDEX IF NOT EXISTS idx_monthly_date ON public.monthly_reviews(cycle_start_date);

ALTER TABLE public.monthly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access monthly_reviews"
ON public.monthly_reviews FOR ALL TO authenticated
USING (current_user_role() = 'administrator')
WITH CHECK (current_user_role() = 'administrator');

CREATE POLICY "Psychologists manage monthly_reviews"
ON public.monthly_reviews FOR ALL TO authenticated
USING (current_user_role() = 'psychologist')
WITH CHECK (current_user_role() = 'psychologist');

CREATE POLICY "Staff read monthly_reviews"
ON public.monthly_reviews FOR SELECT TO authenticated
USING (current_user_role() = ANY (ARRAY['teacher','speech_therapist']));

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS intervention_cycle_count INTEGER NOT NULL DEFAULT 0;
