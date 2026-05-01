ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS school_section text,
  ADD COLUMN IF NOT EXISTS sub_category text;

CREATE INDEX IF NOT EXISTS idx_students_school_section ON public.students(school_section);

-- Backfill Hamza based on primary condition / name
UPDATE public.students
   SET school_section = 'ASD Section',
       sub_category   = 'Level 2'
 WHERE first_name ILIKE 'Hamza%'
   AND school_section IS NULL;