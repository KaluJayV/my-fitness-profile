-- Create function to get user workout history
CREATE OR REPLACE FUNCTION public.get_user_history(p_user uuid)
RETURNS TABLE (
    exercise_name text,
    total_sets bigint,
    avg_weight numeric,
    avg_reps numeric,
    last_performed timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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