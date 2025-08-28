-- Continue fixing remaining Security Definer Functions

-- Update get_user_history to use SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.get_user_history(p_user uuid)
 RETURNS TABLE(exercise_name text, total_sets bigint, avg_weight numeric, avg_reps numeric, last_performed timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY INVOKER -- Changed from DEFINER to INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    AND w.completed = true -- Only completed workouts
    GROUP BY e.id, e.name
    ORDER BY last_performed DESC
    LIMIT 50;
$function$;

-- Update get_exercise_stats to use SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.get_exercise_stats(p_user_id uuid, p_exercise_id integer)
 RETURNS TABLE(exercise_id integer, exercise_name text, manual_1rm numeric, manual_1rm_updated_at timestamp with time zone, calculated_1rm numeric, best_1rm numeric, total_sets bigint, avg_weight numeric, avg_reps numeric, last_performed timestamp with time zone, pump_score integer, notes text)
 LANGUAGE plpgsql
 SECURITY INVOKER -- Changed from DEFINER to INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    e.id as exercise_id,
    e.name as exercise_name,
    r.manual_1rm,
    r.manual_1rm_updated_at,
    -- Calculate best estimated 1RM from recent sets
    (
      SELECT MAX(s.weight * (1 + (s.reps + COALESCE(s.rir, 0)) / 30.0))
      FROM sets s
      JOIN workout_exercises we ON s.workout_exercise_id = we.id
      JOIN workouts w ON we.workout_id = w.id
      JOIN programs p ON w.program_id = p.id
      WHERE p.user_id = p_user_id 
        AND we.exercise_id = p_exercise_id
        AND s.weight IS NOT NULL AND s.weight > 0
        AND s.reps IS NOT NULL AND s.reps > 0
        AND w.completed = true -- Only completed workouts
        AND s.performed_at >= NOW() - INTERVAL '6 months' -- Recent sets only
    ) as calculated_1rm,
    -- Best 1RM (manual override takes precedence)
    COALESCE(
      r.manual_1rm,
      (
        SELECT MAX(s.weight * (1 + (s.reps + COALESCE(s.rir, 0)) / 30.0))
        FROM sets s
        JOIN workout_exercises we ON s.workout_exercise_id = we.id
        JOIN workouts w ON we.workout_id = w.id
        JOIN programs p ON w.program_id = p.id
        WHERE p.user_id = p_user_id 
          AND we.exercise_id = p_exercise_id
          AND s.weight IS NOT NULL AND s.weight > 0
          AND s.reps IS NOT NULL AND s.reps > 0
          AND w.completed = true -- Only completed workouts
          AND s.performed_at >= NOW() - INTERVAL '6 months'
      )
    ) as best_1rm,
    -- Total sets performed
    (
      SELECT COUNT(s.id)
      FROM sets s
      JOIN workout_exercises we ON s.workout_exercise_id = we.id
      JOIN workouts w ON we.workout_id = w.id
      JOIN programs p ON w.program_id = p.id
      WHERE p.user_id = p_user_id 
        AND we.exercise_id = p_exercise_id
        AND s.weight IS NOT NULL AND s.reps IS NOT NULL
        AND w.completed = true -- Only completed workouts
    ) as total_sets,
    -- Average weight and reps
    (
      SELECT AVG(s.weight)
      FROM sets s
      JOIN workout_exercises we ON s.workout_exercise_id = we.id
      JOIN workouts w ON we.workout_id = w.id
      JOIN programs p ON w.program_id = p.id
      WHERE p.user_id = p_user_id 
        AND we.exercise_id = p_exercise_id
        AND s.weight IS NOT NULL
        AND w.completed = true -- Only completed workouts
    ) as avg_weight,
    (
      SELECT AVG(s.reps)
      FROM sets s
      JOIN workout_exercises we ON s.workout_exercise_id = we.id
      JOIN workouts w ON we.workout_id = w.id
      JOIN programs p ON w.program_id = p.id
      WHERE p.user_id = p_user_id 
        AND we.exercise_id = p_exercise_id
        AND s.reps IS NOT NULL
        AND w.completed = true -- Only completed workouts
    ) as avg_reps,
    -- Last performed date
    (
      SELECT MAX(s.performed_at)
      FROM sets s
      JOIN workout_exercises we ON s.workout_exercise_id = we.id
      JOIN workouts w ON we.workout_id = w.id
      JOIN programs p ON w.program_id = p.id
      WHERE p.user_id = p_user_id AND we.exercise_id = p_exercise_id
      AND w.completed = true -- Only completed workouts
    ) as last_performed,
    r.pump_score,
    r.notes
  FROM exercises e
  LEFT JOIN ratings r ON e.id = r.exercise_id AND r.user_id = p_user_id
  WHERE e.id = p_exercise_id;
END;
$function$;