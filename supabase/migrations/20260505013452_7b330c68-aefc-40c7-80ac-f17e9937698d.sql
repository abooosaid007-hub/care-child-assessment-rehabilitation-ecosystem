
ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS log_form_type text,
  ADD COLUMN IF NOT EXISTS field1_value text,
  ADD COLUMN IF NOT EXISTS field2_value text,
  ADD COLUMN IF NOT EXISTS field3_value text,
  ADD COLUMN IF NOT EXISTS field4_value text,
  ADD COLUMN IF NOT EXISTS field5_value text,
  ADD COLUMN IF NOT EXISTS field6_value text,
  ADD COLUMN IF NOT EXISTS teacher_confidence text;
