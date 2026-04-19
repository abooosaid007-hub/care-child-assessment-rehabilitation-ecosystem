-- ============================================================
-- CARE - Child Assessment and Rehabilitation Engine
-- Initial schema: profiles, students, assessments, daily_logs
-- ============================================================

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- TABLE 1: profiles  (role stored directly per user request)
-- ============================================================
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  email       text,
  role        text NOT NULL DEFAULT 'teacher'
              CHECK (role IN ('administrator','psychologist','teacher','speech_therapist','parent')),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can read their own profile row
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile basic"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Administrators can do everything on profiles
CREATE POLICY "Admins full access profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrator'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    'teacher'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLE 2: students
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.student_code_seq START 1;

CREATE TABLE public.students (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code        text UNIQUE NOT NULL DEFAULT ('CARE-' || lpad(nextval('public.student_code_seq')::text, 3, '0')),
  first_name          text NOT NULL,
  date_of_birth       date NOT NULL,
  gender              text CHECK (gender IN ('Male','Female','Other')),
  primary_condition   text NOT NULL,
  comorbid_conditions text[] NOT NULL DEFAULT '{}',
  under_observation   text[] NOT NULL DEFAULT '{}',
  observation_notes   text,
  complexity_flag     text CHECK (complexity_flag IN ('Simple','Moderate','Complex')),
  severity            text CHECK (severity IN ('Mild','Moderate','Severe')),
  class_section       text,
  enrollment_date     date DEFAULT CURRENT_DATE,
  status              text NOT NULL DEFAULT 'Active',
  assessment_status   text NOT NULL DEFAULT 'Not Yet Assessed',
  created_by          uuid REFERENCES public.profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access students"
  ON public.students FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrator'));

CREATE POLICY "Psychologists read students"
  ON public.students FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist'));

CREATE POLICY "Teachers read students"
  ON public.students FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('teacher','speech_therapist')));

-- ============================================================
-- TABLE 3: assessments
-- ============================================================
CREATE TABLE public.assessments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assessment_type      text,
  assessment_date      date DEFAULT CURRENT_DATE,
  consultant_name      text,
  form_data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_draft_output      text,
  ai_generated_at      timestamptz,
  psychologist_status  text NOT NULL DEFAULT 'Pending'
                       CHECK (psychologist_status IN ('Pending','Approved','Revised','Referred','Draft')),
  psychologist_notes   text,
  approved_at          timestamptz,
  created_by           uuid REFERENCES public.profiles(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access assessments"
  ON public.assessments FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrator'));

CREATE POLICY "Psychologists read assessments"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist'));

CREATE POLICY "Psychologists update assessments"
  ON public.assessments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist'));

CREATE POLICY "Teachers read assessments"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('teacher','speech_therapist')));

CREATE POLICY "Authors insert assessments"
  ON public.assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('administrator','psychologist','teacher','speech_therapist'))
  );

CREATE POLICY "Authors update own assessments"
  ON public.assessments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Parents: read only approved assessments for their linked student.
-- Linking parents to students is not yet defined in schema; deny by default for now.
-- (No additional policy needed — RLS denies by default.)

-- ============================================================
-- TABLE 4: daily_logs
-- ============================================================
CREATE TABLE public.daily_logs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id               uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  log_date                 date NOT NULL DEFAULT CURRENT_DATE,
  session_time             text CHECK (session_time IN ('Morning','Afternoon')),
  attention_level          integer CHECK (attention_level BETWEEN 1 AND 5),
  attention_minutes        integer,
  prompt_dependency        text CHECK (prompt_dependency IN ('Independent','Verbal','Physical','Full Assist')),
  behavioral_incidents     integer NOT NULL DEFAULT 0,
  incident_description     text,
  emotional_regulation     integer CHECK (emotional_regulation BETWEEN 1 AND 5),
  emotional_trigger        text,
  skill_practiced          text,
  skill_performance        text CHECK (skill_performance IN ('Emerging','Developing','Consistent')),
  intervention_used        text,
  intervention_effectiveness integer CHECK (intervention_effectiveness BETWEEN 1 AND 3),
  teacher_notes            text,
  created_by               uuid REFERENCES public.profiles(id),
  created_at               timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access daily_logs"
  ON public.daily_logs FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrator'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'administrator'));

CREATE POLICY "Psychologists read daily_logs"
  ON public.daily_logs FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'psychologist'));

CREATE POLICY "Teachers insert daily_logs"
  ON public.daily_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('teacher','speech_therapist'))
  );

CREATE POLICY "Teachers read own daily_logs"
  ON public.daily_logs FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());
