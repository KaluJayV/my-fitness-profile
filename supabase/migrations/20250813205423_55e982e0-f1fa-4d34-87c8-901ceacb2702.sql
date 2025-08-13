-- Create function to get exercise 1RM and recent performance for a user
CREATE OR REPLACE FUNCTION public.get_exercise_1rm_data(p_user_id uuid, p_exercise_id integer)
RETURNS TABLE(
  weight numeric,
  reps integer,
  rir integer,
  performed_at timestamp with time zone,
  estimated_1rm numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.weight,
    s.reps,
    s.rir,
    s.performed_at,
    -- Calculate estimated 1RM using Epley formula as baseline
    CASE 
      WHEN s.reps > 0 AND s.weight > 0 THEN
        s.weight * (1 + (s.reps + COALESCE(s.rir, 0)) / 30.0)
      ELSE NULL
    END as estimated_1rm
  FROM sets s
  JOIN workout_exercises we ON s.workout_exercise_id = we.id
  JOIN workouts w ON we.workout_id = w.id
  JOIN programs p ON w.program_id = p.id
  WHERE p.user_id = p_user_id 
    AND we.exercise_id = p_exercise_id
    AND s.weight IS NOT NULL
    AND s.weight > 0
    AND s.reps IS NOT NULL
    AND s.reps > 0
  ORDER BY s.performed_at DESC
  LIMIT 20; -- Get last 20 sets for analysis
END;
$$;