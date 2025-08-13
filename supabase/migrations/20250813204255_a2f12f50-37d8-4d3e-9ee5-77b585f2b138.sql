-- Add DELETE policy for workouts table
CREATE POLICY "Users can delete their own workouts" 
ON public.workouts 
FOR DELETE 
USING (auth.uid() = ( SELECT programs.user_id
   FROM programs
  WHERE (programs.id = workouts.program_id)));