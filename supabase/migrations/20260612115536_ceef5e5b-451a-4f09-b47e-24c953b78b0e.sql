
-- 1. Fix profiles INSERT: prevent self-assignment of privileged roles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id AND role = 'teacher');

-- 2. Fix profiles UPDATE: prevent role escalation
DROP POLICY IF EXISTS "Users can update own profile basic" ON public.profiles;
CREATE POLICY "Users can update own profile basic"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- 3. Restrict SECURITY DEFINER function from being callable by clients
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO service_role;
