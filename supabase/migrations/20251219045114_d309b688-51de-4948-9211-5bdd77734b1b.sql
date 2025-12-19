-- Update the existing categories policy to require authentication
DROP POLICY IF EXISTS "Authenticated users can view categories" ON public.categories;

CREATE POLICY "Authenticated users can view categories"
ON public.categories
FOR SELECT
USING (is_authenticated_user(auth.uid()));