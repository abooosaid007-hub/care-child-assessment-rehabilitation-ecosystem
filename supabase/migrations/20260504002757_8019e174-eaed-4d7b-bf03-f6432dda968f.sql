
CREATE TABLE IF NOT EXISTS public.parent_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  progress_report_id UUID REFERENCES public.progress_reports(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  summary_urdu TEXT NOT NULL,
  summary_english TEXT NOT NULL,
  positive_highlight TEXT,
  challenge_observation TEXT,
  home_action TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Approved','Approved_Not_Sent','Sent','Failed')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES public.profiles(id),
  communication_method TEXT CHECK (communication_method IN ('WhatsApp','SMS','Email','In-Person','Not Sent')),
  parent_response TEXT,
  response_type TEXT CHECK (response_type IN ('Positive','Neutral','Concerned','No Response')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_comm_student ON public.parent_communications(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_comm_status ON public.parent_communications(status);
CREATE INDEX IF NOT EXISTS idx_parent_comm_week ON public.parent_communications(week_start);

ALTER TABLE public.parent_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access parent_communications"
  ON public.parent_communications FOR ALL TO authenticated
  USING (current_user_role() = 'administrator')
  WITH CHECK (current_user_role() = 'administrator');

CREATE POLICY "Psychologists manage parent_communications"
  ON public.parent_communications FOR ALL TO authenticated
  USING (current_user_role() = 'psychologist')
  WITH CHECK (current_user_role() = 'psychologist');

CREATE POLICY "Staff read parent_communications"
  ON public.parent_communications FOR SELECT TO authenticated
  USING (current_user_role() = ANY (ARRAY['teacher','speech_therapist']));

-- Lock message fields once Sent
CREATE OR REPLACE FUNCTION public.lock_sent_parent_communications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'Sent' THEN
    IF NEW.summary_urdu IS DISTINCT FROM OLD.summary_urdu
       OR NEW.summary_english IS DISTINCT FROM OLD.summary_english
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
       OR NEW.sent_by IS DISTINCT FROM OLD.sent_by
       OR NEW.communication_method IS DISTINCT FROM OLD.communication_method THEN
      RAISE EXCEPTION 'Sent parent communications are locked and cannot be modified except for feedback fields.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_sent_parent_comm ON public.parent_communications;
CREATE TRIGGER trg_lock_sent_parent_comm
  BEFORE UPDATE ON public.parent_communications
  FOR EACH ROW EXECUTE FUNCTION public.lock_sent_parent_communications();
