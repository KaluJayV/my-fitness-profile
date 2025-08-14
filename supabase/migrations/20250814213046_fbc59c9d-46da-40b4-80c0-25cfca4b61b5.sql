-- Drop the problematic SECURITY DEFINER view
DROP VIEW IF EXISTS public.v_progress;

-- Create a function that returns progress data with proper RLS enforcement
CREATE OR REPLACE FUNCTION public.get_user_progress(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
    user_id uuid,
    exercise text,
    week timestamp with time zone,
    avg_weight numeric,
    avg_reps numeric
) 
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT 
        p.user_id,
        e.name AS exercise,
        date_trunc('week', s.performed_at) AS week,
        avg(s.weight) AS avg_weight,
        avg(s.reps) AS avg_reps
    FROM sets s
    JOIN workout_exercises we ON we.id = s.workout_exercise_id
    JOIN exercises e ON e.id = we.exercise_id
    JOIN workouts w ON w.id = we.workout_id
    JOIN programs p ON p.id = w.program_id
    WHERE p.user_id = COALESCE(p_user_id, auth.uid())
    GROUP BY p.user_id, e.name, date_trunc('week', s.performed_at)
    ORDER BY week DESC;
$$;