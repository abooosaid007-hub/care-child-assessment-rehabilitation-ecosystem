CREATE TABLE public.intervention_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_intervention_plans_student ON public.intervention_plans(student_id);
CREATE INDEX idx_intervention_plans_assessment ON public.intervention_plans(assessment_id);

ALTER TABLE public.intervention_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access intervention_plans"
ON public.intervention_plans FOR ALL TO authenticated
USING (current_user_role() = 'administrator')
WITH CHECK (current_user_role() = 'administrator');

CREATE POLICY "Psychologists read intervention_plans"
ON public.intervention_plans FOR SELECT TO authenticated
USING (current_user_role() = 'psychologist');

CREATE POLICY "Psychologists insert intervention_plans"
ON public.intervention_plans FOR INSERT TO authenticated
WITH CHECK (current_user_role() = 'psychologist');

CREATE POLICY "Teachers read intervention_plans"
ON public.intervention_plans FOR SELECT TO authenticated
USING (current_user_role() = ANY (ARRAY['teacher','speech_therapist']));