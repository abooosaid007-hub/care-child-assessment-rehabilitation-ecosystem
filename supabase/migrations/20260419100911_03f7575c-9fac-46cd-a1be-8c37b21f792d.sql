-- SECURITY DEFINER helper to read current user's role without triggering RLS recursion.
-- (Role is still stored directly on profiles, per requirements.)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Replace recursive admin policy on profiles
DROP POLICY IF EXISTS "Admins full access profiles" ON public.profiles;
CREATE POLICY "Admins full access profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'administrator')
  WITH CHECK (public.current_user_role() = 'administrator');

-- Rewrite the other admin/role policies to use the helper (cleaner + faster)
DROP POLICY IF EXISTS "Admins full access students" ON public.students;
CREATE POLICY "Admins full access students"
  ON public.students FOR ALL TO authenticated
  USING (public.current_user_role() = 'administrator')
  WITH CHECK (public.current_user_role() = 'administrator');

DROP POLICY IF EXISTS "Psychologists read students" ON public.students;
CREATE POLICY "Psychologists read students"
  ON public.students FOR SELECT TO authenticated
  USING (public.current_user_role() = 'psychologist');

DROP POLICY IF EXISTS "Teachers read students" ON public.students;
CREATE POLICY "Teachers read students"
  ON public.students FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('teacher','speech_therapist'));

DROP POLICY IF EXISTS "Admins full access assessments" ON public.assessments;
CREATE POLICY "Admins full access assessments"
  ON public.assessments FOR ALL TO authenticated
  USING (public.current_user_role() = 'administrator')
  WITH CHECK (public.current_user_role() = 'administrator');

DROP POLICY IF EXISTS "Psychologists read assessments" ON public.assessments;
CREATE POLICY "Psychologists read assessments"
  ON public.assessments FOR SELECT TO authenticated
  USING (public.current_user_role() = 'psychologist');

DROP POLICY IF EXISTS "Psychologists update assessments" ON public.assessments;
CREATE POLICY "Psychologists update assessments"
  ON public.assessments FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'psychologist');

DROP POLICY IF EXISTS "Teachers read assessments" ON public.assessments;
CREATE POLICY "Teachers read assessments"
  ON public.assessments FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('teacher','speech_therapist'));

DROP POLICY IF EXISTS "Authors insert assessments" ON public.assessments;
CREATE POLICY "Authors insert assessments"
  ON public.assessments FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator','psychologist','teacher','speech_therapist'));

DROP POLICY IF EXISTS "Admins full access daily_logs" ON public.daily_logs;
CREATE POLICY "Admins full access daily_logs"
  ON public.daily_logs FOR ALL TO authenticated
  USING (public.current_user_role() = 'administrator')
  WITH CHECK (public.current_user_role() = 'administrator');

DROP POLICY IF EXISTS "Psychologists read daily_logs" ON public.daily_logs;
CREATE POLICY "Psychologists read daily_logs"
  ON public.daily_logs FOR SELECT TO authenticated
  USING (public.current_user_role() = 'psychologist');

DROP POLICY IF EXISTS "Teachers insert daily_logs" ON public.daily_logs;
CREATE POLICY "Teachers insert daily_logs"
  ON public.daily_logs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.current_user_role() IN ('teacher','speech_therapist')
  );
