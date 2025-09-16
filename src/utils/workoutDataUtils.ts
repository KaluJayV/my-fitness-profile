// Utility functions for workout data conversion and validation
import { GeneratedWorkoutPlan, WorkoutDay, WorkoutModule, WorkoutExercise, Exercise } from '@/types/workout';

// Legacy workout interface for backward compatibility
interface LegacyWorkoutDay {
  day: string;
  name: string;
  description: string;
  total_duration_minutes?: number;
  exercises: WorkoutExercise[];
}

interface LegacyWorkoutPlan {
  name: string;
  description: string;
  duration_weeks: number;
  days_per_week: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  workouts: LegacyWorkoutDay[];
}

/**
 * Converts legacy workout format (exercises array) to modular format (modules array)
 */
export const convertLegacyToModular = (legacyWorkout: LegacyWorkoutPlan): GeneratedWorkoutPlan => {
  const convertedWorkouts: WorkoutDay[] = legacyWorkout.workouts.map(day => {
    // Convert exercises to a single "main" module
    const mainModule: WorkoutModule = {
      type: 'main',
      name: 'Main Workout',
      description: 'Primary training session',
      duration_minutes: day.total_duration_minutes || estimateDuration(day.exercises),
      exercises: day.exercises,
      order: 1
    };

    return {
      day: day.day,
      name: day.name,
      description: day.description,
      total_duration_minutes: day.total_duration_minutes || estimateDuration(day.exercises),
      modules: [mainModule]
    };
  });

  return {
    ...legacyWorkout,
    workouts: convertedWorkouts,
    enabled_modules: ['main']
  };
};

/**
 * Validates workout data and ensures it has the correct structure
 */
export const validateWorkoutData = (workout: any): GeneratedWorkoutPlan | null => {
  if (!workout || !workout.workouts || !Array.isArray(workout.workouts)) {
    return null;
  }

  // Check if it's legacy format (has exercises instead of modules)
  const isLegacyFormat = workout.workouts.some((day: any) => 
    day.exercises && !day.modules
  );

  if (isLegacyFormat) {
    console.log('Converting legacy workout format to modular format');
    return convertLegacyToModular(workout as LegacyWorkoutPlan);
  }

  // Validate modular format
  const isValidModular = workout.workouts.every((day: any) => 
    day.modules && Array.isArray(day.modules)
  );

  if (!isValidModular) {
    console.error('Invalid workout format: neither legacy nor valid modular');
    return null;
  }

  return workout as GeneratedWorkoutPlan;
};

/**
 * Estimates workout duration based on exercises
 */
const estimateDuration = (exercises: WorkoutExercise[]): number => {
  if (!exercises || exercises.length === 0) return 0;
  
  // Rough estimation: 3-4 minutes per exercise (including rest)
  return exercises.length * 3.5;
};

/**
 * Calculates workout statistics for preview
 */
export const calculateWorkoutStats = (workout: GeneratedWorkoutPlan) => {
  const totalExercises = workout.workouts.reduce((total, day) => 
    total + day.modules.reduce((dayTotal, module) => 
      dayTotal + module.exercises.length, 0), 0
  );

  const totalModules = workout.workouts.reduce((total, day) => 
    total + day.modules.length, 0
  );

  const averageDuration = workout.workouts.reduce((total, day) => 
    total + day.total_duration_minutes, 0) / workout.workouts.length;

  const muscleGroups = new Set<string>();
  workout.workouts.forEach(day => 
    day.modules.forEach(module => 
      module.exercises.forEach(exercise => 
        exercise.primary_muscles?.forEach(muscle => muscleGroups.add(muscle))
      )
    )
  );

  return {
    totalExercises,
    totalModules,
    averageDuration: Math.round(averageDuration),
    uniqueMuscleGroups: muscleGroups.size,
    muscleGroups: Array.from(muscleGroups)
  };
};

/**
 * Validates exercise data against the exercise library
 */
export const validateExercises = (workout: GeneratedWorkoutPlan, exerciseLibrary: Exercise[]): GeneratedWorkoutPlan => {
  const validatedWorkout = { ...workout };
  
  validatedWorkout.workouts = workout.workouts.map(day => ({
    ...day,
    modules: day.modules.map(module => ({
      ...module,
      exercises: module.exercises.map(exercise => {
        const foundExercise = exerciseLibrary.find(ex => ex.id === exercise.exercise_id);
        
        if (!foundExercise) {
          console.warn(`Exercise ID ${exercise.exercise_id} not found in library`);
          // Try to find by name
          const nameMatch = exerciseLibrary.find(ex => 
            ex.name.toLowerCase().includes(exercise.exercise_name.toLowerCase())
          );
          
          if (nameMatch) {
            return {
              ...exercise,
              exercise_id: nameMatch.id,
              exercise_name: nameMatch.name,
              primary_muscles: nameMatch.primary_muscles || exercise.primary_muscles || []
            };
          }
        } else {
          // Ensure primary_muscles is populated
          return {
            ...exercise,
            primary_muscles: exercise.primary_muscles || foundExercise.primary_muscles || []
          };
        }
        
        return exercise;
      })
    }))
  }));
  
  return validatedWorkout;
};

/**
 * Creates a fallback workout when data is missing or invalid
 */
export const createFallbackWorkout = (exerciseLibrary: Exercise[]): GeneratedWorkoutPlan => {
  if (!exerciseLibrary || exerciseLibrary.length === 0) {
    throw new Error('Cannot create fallback workout without exercise library');
  }

  const basicExercises = exerciseLibrary.slice(0, 6).map(ex => ({
    exercise_id: ex.id,
    exercise_name: ex.name,
    sets: 3,
    reps: '8-12',
    rest: '60-90s',
    suggested_weight: 'Start light',
    notes: 'Focus on proper form',
    primary_muscles: ex.primary_muscles || []
  }));

  const mainModule: WorkoutModule = {
    type: 'main',
    name: 'Full Body Workout',
    description: 'Basic full body training session',
    duration_minutes: 45,
    exercises: basicExercises,
    order: 1
  };

  const workoutDay: WorkoutDay = {
    day: 'Monday',
    name: 'Full Body Training',
    description: 'Complete body workout for all major muscle groups',
    total_duration_minutes: 45,
    modules: [mainModule]
  };

  return {
    name: 'Basic Training Program',
    description: 'A simple, effective training program for beginners',
    duration_weeks: 4,
    days_per_week: 3,
    difficulty: 'beginner',
    goals: ['Build Strength', 'Learn Form'],
    workouts: [workoutDay],
    enabled_modules: ['main']
  };
};