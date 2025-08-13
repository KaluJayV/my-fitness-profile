-- Fix security issues from the linter
-- 1. Fix function search path mutable by setting search_path
DROP FUNCTION IF EXISTS public.get_exercise_1rm_data(uuid, integer);

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
SET search_path = 'public', 'pg_temp'
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

-- Fix the existing function with search_path
DROP FUNCTION IF EXISTS public.get_user_history(uuid);

CREATE OR REPLACE FUNCTION public.get_user_history(p_user uuid)
RETURNS TABLE(exercise_name text, total_sets bigint, avg_weight numeric, avg_reps numeric, last_performed timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
    SELECT 
        e.name as exercise_name,
        COUNT(s.id) as total_sets,
        AVG(s.weight) as avg_weight,
        AVG(s.reps) as avg_reps,
        MAX(s.performed_at) as last_performed
    FROM exercises e
    JOIN workout_exercises we ON e.id = we.exercise_id
    JOIN sets s ON we.id = s.workout_exercise_id
    JOIN workouts w ON we.workout_id = w.id
    JOIN programs p ON w.program_id = p.id
    WHERE p.user_id = p_user
    GROUP BY e.id, e.name
    ORDER BY last_performed DESC
    LIMIT 50;
$$;