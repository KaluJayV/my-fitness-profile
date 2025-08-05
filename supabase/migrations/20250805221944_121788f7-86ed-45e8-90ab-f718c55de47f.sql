-- Enable RLS on all tables that need it
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own profile" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create RLS policies for programs table
CREATE POLICY "Users can view their own programs" 
ON public.programs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own programs" 
ON public.programs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own programs" 
ON public.programs 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create RLS policies for workouts table
CREATE POLICY "Users can view their own workouts" 
ON public.workouts 
FOR SELECT 
USING (auth.uid() = (SELECT user_id FROM programs WHERE id = program_id));

CREATE POLICY "Users can create their own workouts" 
ON public.workouts 
FOR INSERT 
WITH CHECK (auth.uid() = (SELECT user_id FROM programs WHERE id = program_id));

-- Create RLS policies for workout_exercises table
CREATE POLICY "Users can view their own workout exercises" 
ON public.workout_exercises 
FOR SELECT 
USING (auth.uid() = (SELECT p.user_id FROM programs p JOIN workouts w ON p.id = w.program_id WHERE w.id = workout_id));

CREATE POLICY "Users can create their own workout exercises" 
ON public.workout_exercises 
FOR INSERT 
WITH CHECK (auth.uid() = (SELECT p.user_id FROM programs p JOIN workouts w ON p.id = w.program_id WHERE w.id = workout_id));

-- Create RLS policies for sets table
CREATE POLICY "Users can view their own sets" 
ON public.sets 
FOR SELECT 
USING (auth.uid() = (SELECT p.user_id FROM programs p JOIN workouts w ON p.id = w.program_id JOIN workout_exercises we ON w.id = we.workout_id WHERE we.id = workout_exercise_id));

CREATE POLICY "Users can create their own sets" 
ON public.sets 
FOR INSERT 
WITH CHECK (auth.uid() = (SELECT p.user_id FROM programs p JOIN workouts w ON p.id = w.program_id JOIN workout_exercises we ON w.id = we.workout_id WHERE we.id = workout_exercise_id));

CREATE POLICY "Users can update their own sets" 
ON public.sets 
FOR UPDATE 
USING (auth.uid() = (SELECT p.user_id FROM programs p JOIN workouts w ON p.id = w.program_id JOIN workout_exercises we ON w.id = we.workout_id WHERE we.id = workout_exercise_id));

-- Create RLS policies for ratings table
CREATE POLICY "Users can view their own ratings" 
ON public.ratings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ratings" 
ON public.ratings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" 
ON public.ratings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Public read policies for exercise data
CREATE POLICY "Everyone can view exercise categories" 
ON public.exercise_categories 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Everyone can view exercises" 
ON public.exercises 
FOR SELECT 
TO authenticated
USING (true);

-- Fix the function security
DROP FUNCTION IF EXISTS public.get_user_history(uuid);

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
SET search_path = public, pg_temp
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