-- Fix remaining Security Definer Functions

-- Update get_workout_frequency_stats to use SECURITY INVOKER  
CREATE OR REPLACE FUNCTION public.get_workout_frequency_stats(p_user_id uuid DEFAULT auth.uid())
 RETURNS TABLE(total_workouts bigint, avg_workouts_per_week numeric, current_streak integer, longest_streak integer, last_workout_date date)
 LANGUAGE plpgsql
 STABLE SECURITY INVOKER -- Changed from DEFINER to INVOKER
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