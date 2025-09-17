import { GeneratedWorkoutPlan, WorkoutDay, WorkoutModule, WorkoutExercise } from '@/types/workout';

// Legacy format for database compatibility
export interface LegacyWorkoutExercise {
  exercise_id: number;
  exercise_name: string;
  sets: number;
  reps: string;
  rest: string;
  suggested_weight?: string;
  notes?: string;
  primary_muscles: string[];
}

export interface LegacyWorkoutDay {
  day: string;
  name: string;
  description: string;
  total_duration_minutes: number;
  exercises: LegacyWorkoutExercise[];
}

export interface LegacyWorkoutPlan {
  id?: string;
  name: string;
  description: string;
  duration_weeks: number;
  days_per_week: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  workouts: LegacyWorkoutDay[];
}

/**
 * Converts modular workout format to legacy format for database storage and calendar compatibility
 */
export function convertModularToLegacy(modularWorkout: GeneratedWorkoutPlan): LegacyWorkoutPlan {
  const legacyWorkouts: LegacyWorkoutDay[] = modularWorkout.workouts.map(day => {
    // Flatten all exercises from all modules into a single array
    const allExercises: LegacyWorkoutExercise[] = [];
    
    day.modules
      .sort((a, b) => a.order - b.order)
      .forEach(module => {
        module.exercises.forEach(exercise => {
          allExercises.push({
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.exercise_name,
            sets: exercise.sets,
            reps: exercise.reps,
            rest: exercise.rest,
            suggested_weight: exercise.suggested_weight,
            notes: exercise.notes || `${module.name} - ${module.description}`,
            primary_muscles: exercise.primary_muscles
          });
        });
      });

    return {
      day: day.day,
      name: day.name,
      description: day.description,
      total_duration_minutes: day.total_duration_minutes,
      exercises: allExercises
    };
  });

  return {
    id: modularWorkout.id,
    name: modularWorkout.name,
    description: modularWorkout.description,
    duration_weeks: modularWorkout.duration_weeks,
    days_per_week: modularWorkout.days_per_week,
    difficulty: modularWorkout.difficulty,
    goals: modularWorkout.goals,
    workouts: legacyWorkouts
  };
}

/**
 * Converts legacy workout format to modular format for enhanced preview display
 */
export function convertLegacyToModular(legacyWorkout: LegacyWorkoutPlan): GeneratedWorkoutPlan {
  const modularWorkouts: WorkoutDay[] = legacyWorkout.workouts.map(day => {
    // Create a main module containing all exercises from legacy format
    const mainModule: WorkoutModule = {
      type: 'main',
      name: 'Main Workout',
      description: 'Primary training exercises',
      duration_minutes: Math.max(day.total_duration_minutes - 20, 30), // Reserve time for warm-up/cool-down
      exercises: day.exercises.map(exercise => ({
        exercise_id: exercise.exercise_id,
        exercise_name: exercise.exercise_name,
        sets: exercise.sets,
        reps: exercise.reps,
        rest: exercise.rest,
        suggested_weight: exercise.suggested_weight,
        notes: exercise.notes,
        primary_muscles: exercise.primary_muscles
      })),
      order: 1
    };

    // Add default warm-up and cool-down modules
    const warmupModule: WorkoutModule = {
      type: 'warmup',
      name: 'Warm-up',
      description: 'Prepare your body for the workout',
      duration_minutes: 10,
      exercises: [],
      order: 0
    };

    const cooldownModule: WorkoutModule = {
      type: 'cooldown',
      name: 'Cool-down',
      description: 'Stretching and recovery',
      duration_minutes: 10,
      exercises: [],
      order: 2
    };

    return {
      day: day.day,
      name: day.name,
      description: day.description,
      total_duration_minutes: day.total_duration_minutes,
      modules: [warmupModule, mainModule, cooldownModule]
    };
  });

  return {
    id: legacyWorkout.id,
    name: legacyWorkout.name,
    description: legacyWorkout.description,
    duration_weeks: legacyWorkout.duration_weeks,
    days_per_week: legacyWorkout.days_per_week,
    difficulty: legacyWorkout.difficulty,
    goals: legacyWorkout.goals,
    workouts: modularWorkouts,
    enabled_modules: ['warmup', 'main', 'cooldown']
  };
}

/**
 * Detects if a workout object is in legacy or modular format
 */
export function isLegacyFormat(workout: any): workout is LegacyWorkoutPlan {
  return workout.workouts && workout.workouts[0] && 'exercises' in workout.workouts[0] && !('modules' in workout.workouts[0]);
}

/**
 * Ensures a workout is in modular format, converting if necessary
 */
export function ensureModularFormat(workout: any): GeneratedWorkoutPlan {
  if (isLegacyFormat(workout)) {
    return convertLegacyToModular(workout);
  }
  return workout as GeneratedWorkoutPlan;
}

/**
 * Ensures a workout is in legacy format for database storage
 */
export function ensureLegacyFormat(workout: GeneratedWorkoutPlan): LegacyWorkoutPlan {
  return convertModularToLegacy(workout);
}