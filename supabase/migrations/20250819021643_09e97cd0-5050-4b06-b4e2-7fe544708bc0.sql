-- Create core lift identification and tracking enhancements

-- Add a view to identify core lifts based on exercise names
CREATE OR REPLACE VIEW v_core_lifts AS
SELECT 
  e.id,
  e.name,
  CASE 
    WHEN LOWER(e.name) LIKE '%squat%' AND LOWER(e.name) NOT LIKE '%front%' THEN 'squat'
    WHEN LOWER(e.name) LIKE '%bench%' AND LOWER(e.name) NOT LIKE '%incline%' THEN 'bench'
    WHEN LOWER(e.name) LIKE '%deadlift%' THEN 'deadlift'
    WHEN LOWER(e.name) LIKE '%overhead press%' OR LOWER(e.name) LIKE '%military press%' OR (LOWER(e.name) LIKE '%press%' AND LOWER(e.name) LIKE '%standing%') THEN 'overhead_press'
    ELSE NULL
  END as core_lift_type
FROM exercises e
WHERE LOWER(e.name) LIKE '%squat%' 
   OR LOWER(e.name) LIKE '%bench%'
   OR LOWER(e.name) LIKE '%deadlift%'
   OR LOWER(e.name) LIKE '%overhead press%'
   OR LOWER(e.name) LIKE '%military press%'
   OR (LOWER(e.name) LIKE '%press%' AND LOWER(e.name) LIKE '%standing%');

-- Function to get core lift progression data
CREATE OR REPLACE FUNCTION get_core_lift_progression(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  core_lift_type text,
  exercise_name text,
  workout_date date,
  best_estimated_1rm numeric,
  total_volume numeric,
  avg_weight numeric,
  total_sets bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 
    cl.core_lift_type,
    e.name as exercise_name,
    w.workout_date,
    -- Calculate best estimated 1RM for the day
    MAX(s.weight * (1 + (s.reps + COALESCE(s.rir, 0)) / 30.0)) as best_estimated_1rm,
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
    AND w.workout_date IS NOT NULL
  GROUP BY cl.core_lift_type, e.name, w.workout_date
  ORDER BY w.workout_date DESC, cl.core_lift_type;
$$;

-- Function to get workout frequency analytics
CREATE OR REPLACE FUNCTION get_workout_frequency_stats(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  total_workouts bigint,
  avg_workouts_per_week numeric,
  current_streak integer,
  longest_streak integer,
  last_workout_date date
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  streak_count integer := 0;
  max_streak integer := 0;
  current_date date;
  prev_date date;
  streak_broken boolean := false;
BEGIN
  -- Get basic workout stats
  SELECT 
    COUNT(*),
    ROUND(COUNT(*)::numeric / GREATEST(1, EXTRACT(weeks FROM (MAX(workout_date) - MIN(workout_date) + interval '1 week'))), 2),
    MAX(workout_date)
  INTO total_workouts, avg_workouts_per_week, last_workout_date
  FROM workouts w
  JOIN programs p ON w.program_id = p.id
  WHERE p.user_id = COALESCE(p_user_id, auth.uid())
    AND w.workout_date IS NOT NULL;

  -- Calculate streaks by iterating through workout dates
  current_streak := 0;
  max_streak := 0;
  prev_date := NULL;
  
  FOR current_date IN (
    SELECT DISTINCT w.workout_date
    FROM workouts w
    JOIN programs p ON w.program_id = p.id
    WHERE p.user_id = COALESCE(p_user_id, auth.uid())
      AND w.workout_date IS NOT NULL
    ORDER BY w.workout_date DESC
  ) LOOP
    IF prev_date IS NULL THEN
      -- First workout in sequence
      current_streak := 1;
    ELSIF current_date = prev_date - interval '1 day' OR current_date = prev_date - interval '2 days' THEN
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
$$;

-- Function to get current core lift 1RM estimates
CREATE OR REPLACE FUNCTION get_current_core_lift_maxes(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(
  core_lift_type text,
  exercise_name text,
  current_1rm numeric,
  last_performed date,
  improvement_30d numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  WITH recent_maxes AS (
    SELECT 
      cl.core_lift_type,
      e.name as exercise_name,
      w.workout_date,
      MAX(s.weight * (1 + (s.reps + COALESCE(s.rir, 0)) / 30.0)) as estimated_1rm
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
      AND w.workout_date >= CURRENT_DATE - interval '6 months'
    GROUP BY cl.core_lift_type, e.name, w.workout_date
  ),
  current_best AS (
    SELECT 
      core_lift_type,
      exercise_name,
      MAX(estimated_1rm) as current_1rm,
      MAX(workout_date) as last_performed
    FROM recent_maxes
    GROUP BY core_lift_type, exercise_name
  ),
  old_maxes AS (
    SELECT 
      core_lift_type,
      exercise_name,
      MAX(estimated_1rm) as old_1rm
    FROM recent_maxes
    WHERE workout_date < CURRENT_DATE - interval '30 days'
    GROUP BY core_lift_type, exercise_name
  )
  SELECT 
    cb.core_lift_type,
    cb.exercise_name,
    cb.current_1rm,
    cb.last_performed,
    COALESCE(cb.current_1rm - om.old_1rm, 0) as improvement_30d
  FROM current_best cb
  LEFT JOIN old_maxes om ON cb.core_lift_type = om.core_lift_type 
    AND cb.exercise_name = om.exercise_name
  ORDER BY cb.core_lift_type;
$$;