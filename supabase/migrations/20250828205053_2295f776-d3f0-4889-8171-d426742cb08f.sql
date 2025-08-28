-- Fix Security Definer Views by recreating them without SECURITY DEFINER
-- This ensures they respect Row Level Security from underlying tables

-- Recreate v_progress view without SECURITY DEFINER
DROP VIEW IF EXISTS v_progress CASCADE;
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
WHERE w.completed = true;

-- Recreate v_core_lifts view without SECURITY DEFINER  
DROP VIEW IF EXISTS v_core_lifts CASCADE;
CREATE VIEW v_core_lifts AS
SELECT 
    id,
    name,
    CASE
        WHEN (lower(name) LIKE '%squat%' AND lower(name) NOT LIKE '%front%') THEN 'squat'
        WHEN (lower(name) LIKE '%bench%' AND lower(name) NOT LIKE '%incline%') THEN 'bench'
        WHEN lower(name) LIKE '%deadlift%' THEN 'deadlift'
        WHEN (lower(name) LIKE '%overhead press%' OR lower(name) LIKE '%military press%' OR (lower(name) LIKE '%press%' AND lower(name) LIKE '%standing%')) THEN 'overhead_press'
        ELSE NULL
    END as core_lift_type
FROM exercises e
WHERE (lower(name) LIKE '%squat%' OR lower(name) LIKE '%bench%' OR lower(name) LIKE '%deadlift%' OR lower(name) LIKE '%overhead press%' OR lower(name) LIKE '%military press%' OR (lower(name) LIKE '%press%' AND lower(name) LIKE '%standing%'));