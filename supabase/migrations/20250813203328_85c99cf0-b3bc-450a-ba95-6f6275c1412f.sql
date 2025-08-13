-- Create function to get user's exercise history for progressive overload
CREATE OR REPLACE FUNCTION get_exercise_history(p_user_id uuid, p_exercise_id integer, p_limit integer DEFAULT 10)
RETURNS TABLE(
  weight numeric,
  reps integer,
  rir integer,
  performed_at timestamp with time zone,
  max_weight numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.weight,
    s.reps,
    s.rir,
    s.performed_at,
    MAX(s.weight) OVER () as max_weight
  FROM sets s
  JOIN workout_exercises we ON s.workout_exercise_id = we.id
  JOIN workouts w ON we.workout_id = w.id
  JOIN programs p ON w.program_id = p.id
  WHERE p.user_id = p_user_id 
    AND we.exercise_id = p_exercise_id
    AND s.weight IS NOT NULL
  ORDER BY s.performed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;