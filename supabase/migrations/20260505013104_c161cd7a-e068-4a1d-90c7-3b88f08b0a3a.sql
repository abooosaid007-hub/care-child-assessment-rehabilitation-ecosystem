
ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS last_modified_at timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS edited_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_edited_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS admin_edited_by uuid,
  ADD COLUMN IF NOT EXISTS edit_reason text;

-- Deduplicate any existing duplicates before adding unique constraint (keep most recent)
DELETE FROM public.daily_logs a
USING public.daily_logs b
WHERE a.student_id = b.student_id
  AND a.log_date = b.log_date
  AND a.created_at < b.created_at;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_logs_student_date_unique'
  ) THEN
    ALTER TABLE public.daily_logs
      ADD CONSTRAINT daily_logs_student_date_unique UNIQUE (student_id, log_date);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_daily_log_modified()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.last_modified_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_daily_log_modified ON public.daily_logs;
CREATE TRIGGER trg_touch_daily_log_modified
BEFORE UPDATE ON public.daily_logs
FOR EACH ROW EXECUTE FUNCTION public.touch_daily_log_modified();

-- Allow updates by psychologists/admins (admins already covered, add update policies for staff on own logs same-day)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_logs' AND policyname='Staff update own daily_logs') THEN
    CREATE POLICY "Staff update own daily_logs"
      ON public.daily_logs
      FOR UPDATE
      TO authenticated
      USING (created_by = auth.uid() AND log_date = CURRENT_DATE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='daily_logs' AND policyname='Psychologists update daily_logs') THEN
    CREATE POLICY "Psychologists update daily_logs"
      ON public.daily_logs
      FOR UPDATE
      TO authenticated
      USING (current_user_role() = 'psychologist');
  END IF;
END $$;
