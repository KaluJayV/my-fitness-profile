-- Drop the existing SECURITY DEFINER view
DROP VIEW IF EXISTS public.v_progress;

-- Recreate the view without SECURITY DEFINER
CREATE VIEW public.v_progress AS 
SELECT 
    u.id AS user_id,
    e.name AS exercise,
    date_trunc('week', s.performed_at) AS week,
    avg(s.weight) AS avg_weight,
    avg(s.reps) AS avg_reps
FROM sets s
JOIN workout_exercises we ON we.id = s.workout_exercise_id
JOIN exercises e ON e.id = we.exercise_id
JOIN workouts w ON w.id = we.workout_id
JOIN programs p ON p.id = w.program_id
JOIN users u ON u.id = p.user_id
GROUP BY u.id, e.name, date_trunc('week', s.performed_at);

-- Enable RLS on the view
ALTER VIEW public.v_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policy so users can only see their own progress data
CREATE POLICY "Users can view their own progress data" 
ON public.v_progress 
FOR SELECT 
USING (auth.uid() = user_id);