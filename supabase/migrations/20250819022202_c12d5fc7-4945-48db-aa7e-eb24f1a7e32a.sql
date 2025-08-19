-- Fix the 1RM calculation to be more realistic and add safeguards

-- Update the core lift progression function with better validation
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
  GROUP BY cl.core_lift_type, e.name, w.workout_date
  HAVING MAX(
    CASE 
      WHEN s.reps + COALESCE(s.rir, 0) > 30 THEN s.weight
      WHEN s.weight <= 0 OR s.reps <= 0 THEN NULL
      ELSE s.weight * (1 + LEAST(s.reps + COALESCE(s.rir, 0), 30) / 30.0)
    END
  ) IS NOT NULL
  ORDER BY w.workout_date DESC, cl.core_lift_type;
$$;

-- Update the current core lift maxes function with same validation
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
      MAX(
        CASE 
          WHEN s.reps + COALESCE(s.rir, 0) > 30 THEN s.weight
          WHEN s.weight <= 0 OR s.reps <= 0 THEN NULL
          ELSE s.weight * (1 + LEAST(s.reps + COALESCE(s.rir, 0), 30) / 30.0)
        END
      ) as estimated_1rm
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
      AND w.workout_date >= CURRENT_DATE - interval '6 months'
    GROUP BY cl.core_lift_type, e.name, w.workout_date
    HAVING MAX(
      CASE 
        WHEN s.reps + COALESCE(s.rir, 0) > 30 THEN s.weight
        WHEN s.weight <= 0 OR s.reps <= 0 THEN NULL
        ELSE s.weight * (1 + LEAST(s.reps + COALESCE(s.rir, 0), 30) / 30.0)
      END
    ) IS NOT NULL
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
  WHERE cb.current_1rm IS NOT NULL
    AND cb.current_1rm > 0
    AND cb.current_1rm <= 1000 -- Final sanity check
  ORDER BY cb.core_lift_type;
$$;