-- Create UPDATE policy for push_subscriptions to allow upserting subscriptions
CREATE POLICY "Push subscriptions UPDATE Policy"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
