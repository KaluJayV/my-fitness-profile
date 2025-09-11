// Workout system types with modular structure

export interface Exercise {
  id: number;
  name: string;
  primary_muscles: string[];
  gif_url?: string;
}

export interface WorkoutExercise {
  exercise_id: number;
  exercise_name: string;
  sets: number;
  reps: string;
  rest: string;
  suggested_weight?: string;
  notes?: string;
  primary_muscles: string[];
}

// Different types of workout modules
export type WorkoutModuleType = 'warmup' | 'main' | 'core' | 'cooldown';

export interface WorkoutModule {
  type: WorkoutModuleType;
  name: string;
  description: string;
  duration_minutes: number;
  exercises: WorkoutExercise[];
  order: number; // For sorting modules within a workout
}

export interface WorkoutDay {
  day: string;
  name: string;
  description: string;
  total_duration_minutes: number;
  modules: WorkoutModule[]; // Changed from exercises to modules
}

export interface GeneratedWorkoutPlan {
  id?: string;
  name: string;
  description: string;
  duration_weeks: number;
  days_per_week: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  workouts: WorkoutDay[];
  enabled_modules: WorkoutModuleType[]; // Track which modules are enabled
}

// Configuration for workout generation
export interface WorkoutModuleConfig {
  warmup: {
    enabled: boolean;
    duration_minutes: number;
    type: 'dynamic' | 'static' | 'cardio';
  };
  main: {
    enabled: boolean; // Always true, but included for consistency
    duration_minutes: number;
  };
  core: {
    enabled: boolean;
    duration_minutes: number;
    intensity: 'light' | 'moderate' | 'intense';
    style: 'strength' | 'endurance' | 'mixed';
  };
  cooldown: {
    enabled: boolean;
    duration_minutes: number;
    type: 'stretching' | 'mobility' | 'relaxation';
  };
}

export interface WorkoutGenerationRequest {
  prompt: string;
  module_config: WorkoutModuleConfig;
  exercises: Exercise[];
  currentWorkout?: GeneratedWorkoutPlan;
  conversationHistory?: Array<{ type: string; content: string; timestamp: Date }>;
  userId?: string;
}