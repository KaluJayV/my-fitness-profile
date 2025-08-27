-- Add completed status to workouts table
ALTER TABLE workouts ADD COLUMN completed BOOLEAN DEFAULT false;

-- Update the get_workout_frequency_stats function to only count completed workouts
CREATE OR REPLACE FUNCTION public.get_workout_frequency_stats(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(total_workouts bigint, avg_workouts_per_week numeric, current_streak integer, longest_streak integer, last_workout_date date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  streak_count integer := 0;
  max_streak integer := 0;
  current_date date;
  prev_date date;
  streak_broken boolean := false;
  weeks_between numeric;
BEGIN
  -- Get basic workout stats with proper date interval calculation - ONLY COMPLETED WORKOUTS
  SELECT 
    COUNT(*),
    CASE 
      WHEN MAX(workout_date) = MIN(workout_date) THEN COUNT(*)::numeric
      ELSE ROUND(COUNT(*)::numeric / GREATEST(1, (MAX(workout_date) - MIN(workout_date))::numeric / 7.0), 2)
    END,
    MAX(workout_date)
  INTO total_workouts, avg_workouts_per_week, last_workout_date
  FROM workouts w
  JOIN programs p ON w.program_id = p.id
  WHERE p.user_id = COALESCE(p_user_id, auth.uid())
    AND w.workout_date IS NOT NULL
    AND w.completed = true; -- Only count completed workouts

  -- Calculate streaks by iterating through workout dates - ONLY COMPLETED WORKOUTS
  current_streak := 0;
  max_streak := 0;
  prev_date := NULL;
  
  FOR current_date IN (
    SELECT DISTINCT w.workout_date
    FROM workouts w
    JOIN programs p ON w.program_id = p.id
    WHERE p.user_id = COALESCE(p_user_id, auth.uid())
      AND w.workout_date IS NOT NULL
      AND w.completed = true -- Only count completed workouts
    ORDER BY w.workout_date DESC
  ) LOOP
    IF prev_date IS NULL THEN
      -- First workout in sequence
      current_streak := 1;
    ELSIF current_date >= prev_date - interval '2 days' THEN
      -- Within acceptable streak gap (1-2 days)
      current_streak := current_streak + 1;
    ELSE
      -- Streak broken
      IF current_streak > max_streak THEN
        max_streak := current_streak;
      END IF;
      current_streak := 1;
    END IF;
    
    prev_date := current_date;
  END LOOP;
  
  -- Check final streak
  IF current_streak > max_streak THEN
    max_streak := current_streak;
  END IF;
  
  -- If last workout was more than 3 days ago, current streak is 0
  IF last_workout_date < CURRENT_DATE - interval '3 days' THEN
    current_streak := 0;
  END IF;
  
  longest_streak := max_streak;
  
  RETURN QUERY SELECT 
    COALESCE(total_workouts, 0),
    COALESCE(avg_workouts_per_week, 0),
    COALESCE(current_streak, 0),
    COALESCE(longest_streak, 0),
    last_workout_date;
END;
$function$;

-- Update the v_progress view to only include data from completed workouts
CREATE OR REPLACE VIEW v_progress AS
SELECT 
    s.id,
    s.workout_exercise_id,
    s.weight,
    s.reps,
    s.rir,
    s.performed_at,
    w.workout_date,
    we.exercise_id,
    e.name as exercise_name,
    p.user_id,
    s.weight * s.reps as volume,
    CASE 
        WHEN s.reps > 0 AND s.weight > 0 THEN
            s.weight * (1 + (s.reps + COALESCE(s.rir, 0)) / 30.0)
        ELSE NULL
    END as estimated_1rm
FROM sets s
JOIN workout_exercises we ON s.workout_exercise_id = we.id
JOIN workouts w ON we.workout_id = w.id
JOIN programs p ON w.program_id = p.id
JOIN exercises e ON we.exercise_id = e.id
WHERE w.completed = true; -- Only include data from completed workouts

-- Update core lift progression function to only consider completed workouts
CREATE OR REPLACE FUNCTION public.get_core_lift_progression(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(core_lift_type text, exercise_name text, workout_date date, best_estimated_1rm numeric, total_volume numeric, avg_weight numeric, total_sets bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT 
    cl.core_lift_type,
    e.name as exercise_name,
    w.workout_date,
    -- Calculate best estimated 1RM for the day with validation
    MAX(
      CASE 
        WHEN s.reps + COALESCE(s.rir, 0) > 30 THEN s.weight -- Cap unrealistic rep ranges
        WHEN s.weight <= 0 OR s.reps <= 0 THEN NULL
        ELSE s.weight * (1 + LEAST(s.reps + COALESCE(s.rir, 0), 30) / 30.0) -- Use Epley with cap
      END
    ) as best_estimated_1rm,
    -- Calculate total volume (sets * reps * weight)
    SUM(s.weight * s.reps) as total_volume,
    -- Average weight used
    AVG(s.weight) as avg_weight,
    -- Total sets
    COUNT(s.id) as total_sets
  FROM v_core_lifts cl
  JOIN exercises e ON cl.id = e.id
  JOIN workout_exercises we ON e.id = we.exercise_id
  JOIN workouts w ON we.workout_id = w.id
  JOIN programs p ON w.program_id = p.id
  JOIN sets s ON we.id = s.workout_exercise_id
  WHERE p.user_id = COALESCE(p_user_id, auth.uid())
    AND cl.core_lift_type IS NOT NULL
    AND s.weight IS NOT NULL 
    AND s.reps IS NOT NULL
    AND s.weight > 0
    AND s.reps > 0
    AND s.weight <= 1000 -- Reasonable max weight limit
    AND s.reps <= 50 -- Reasonable max reps limit
    AND w.workout_date IS NOT NULL
    AND w.completed = true -- Only consider completed workouts
  GROUP BY cl.core_lift_type, e.name, w.workout_date
  HAVING MAX(
    CASE 
      WHEN s.reps + COALESCE(s.rir, 0) > 30 THEN s.weight
      WHEN s.weight <= 0 OR s.reps <= 0 THEN NULL
      ELSE s.weight * (1 + LEAST(s.reps + COALESCE(s.rir, 0), 30) / 30.0)
    END
  ) IS NOT NULL
  ORDER BY w.workout_date DESC, cl.core_lift_type;
$function$;