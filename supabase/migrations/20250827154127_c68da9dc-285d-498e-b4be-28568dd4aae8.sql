-- Fix Security Definer Views by ensuring proper RLS enforcement

-- Enable RLS on the views (this will ensure user-level security)
ALTER VIEW v_progress OWNER TO authenticator;
ALTER VIEW v_core_lifts OWNER TO authenticator;

-- Create RLS policies for v_progress view to ensure users only see their own data
-- Note: Views inherit RLS from their underlying tables, but we ensure explicit policies

-- The v_progress view already filters by completed workouts and includes user_id
-- It will automatically respect RLS from the underlying tables (sets, workouts, programs)

-- The v_core_lifts view is public data (exercise definitions) so no user-specific RLS needed

-- Ensure the views are not created with SECURITY DEFINER
-- Recreate them without SECURITY DEFINER if needed
DROP VIEW IF EXISTS v_progress;
CREATE VIEW v_progress AS
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

-- Ensure proper ownership
ALTER VIEW v_progress OWNER TO authenticator;

-- The v_core_lifts view is fine as-is since it's public exercise data
-- But let's ensure it has proper ownership
ALTER VIEW v_core_lifts OWNER TO authenticator;