-- Add completed status to workouts table
ALTER TABLE workouts ADD COLUMN completed BOOLEAN DEFAULT false;

-- Drop and recreate the v_progress view to only include data from completed workouts
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