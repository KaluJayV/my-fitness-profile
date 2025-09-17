import { GeneratedWorkoutPlan, WorkoutDay } from '@/types/workout';
import { ensureModularFormat, ensureLegacyFormat, isLegacyFormat } from './workoutSerializer';
import { supabase } from '@/integrations/supabase/client';

/**
 * Centralized data manager for workout operations
 * Handles data consistency, validation, and format conversion
 */
export class WorkoutDataManager {
  /**
   * Validates workout data integrity
   */
  static validateWorkoutData(workout: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!workout) {
      errors.push('Workout data is null or undefined');
      return { isValid: false, errors };
    }

    // Check basic required fields
    if (!workout.name || typeof workout.name !== 'string') {
      errors.push('Workout name is required and must be a string');
    }

    if (!workout.description || typeof workout.description !== 'string') {
      errors.push('Workout description is required and must be a string');
    }

    if (!workout.workouts || !Array.isArray(workout.workouts)) {
      errors.push('Workout must contain a workouts array');
      return { isValid: false, errors };
    }

    if (workout.workouts.length === 0) {
      errors.push('Workout must contain at least one workout day');
    }

    // Validate each workout day
    workout.workouts.forEach((day: any, dayIndex: number) => {
      if (!day.day || typeof day.day !== 'string') {
        errors.push(`Day ${dayIndex + 1}: day name is required`);
      }

      if (!day.name || typeof day.name !== 'string') {
        errors.push(`Day ${dayIndex + 1}: workout name is required`);
      }

      // Check if it's modular format
      if (day.modules) {
        if (!Array.isArray(day.modules)) {
          errors.push(`Day ${dayIndex + 1}: modules must be an array`);
        } else {
          day.modules.forEach((module: any, moduleIndex: number) => {
            if (!module.type || !['warmup', 'main', 'core', 'cooldown'].includes(module.type)) {
              errors.push(`Day ${dayIndex + 1}, Module ${moduleIndex + 1}: invalid module type`);
            }

            if (!module.exercises || !Array.isArray(module.exercises)) {
              errors.push(`Day ${dayIndex + 1}, Module ${moduleIndex + 1}: exercises must be an array`);
            }
          });
        }
      }
      // Check if it's legacy format
      else if (day.exercises) {
        if (!Array.isArray(day.exercises)) {
          errors.push(`Day ${dayIndex + 1}: exercises must be an array`);
        }
      } else {
        errors.push(`Day ${dayIndex + 1}: must contain either modules or exercises`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Safely converts workout to modular format with validation
   */
  static safeConvertToModular(workout: any): { workout: GeneratedWorkoutPlan | null; errors: string[] } {
    const validation = this.validateWorkoutData(workout);
    
    if (!validation.isValid) {
      return { workout: null, errors: validation.errors };
    }

    try {
      const modularWorkout = ensureModularFormat(workout);
      
      // Additional validation for modular format
      const modularValidation = this.validateModularFormat(modularWorkout);
      if (!modularValidation.isValid) {
        return { workout: null, errors: modularValidation.errors };
      }

      return { workout: modularWorkout, errors: [] };
    } catch (error) {
      return { 
        workout: null, 
        errors: [`Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Validates modular format specific requirements
   */
  static validateModularFormat(workout: GeneratedWorkoutPlan): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!workout.enabled_modules || !Array.isArray(workout.enabled_modules)) {
      errors.push('Modular workout must have enabled_modules array');
    }

    workout.workouts.forEach((day, dayIndex) => {
      if (!day.modules || !Array.isArray(day.modules)) {
        errors.push(`Day ${dayIndex + 1}: must contain modules array in modular format`);
        return;
      }

      // Validate module order
      const orders = day.modules.map(m => m.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i) {
          errors.push(`Day ${dayIndex + 1}: module orders must be sequential starting from 0`);
          break;
        }
      }

      // Validate required exercises in main module
      const mainModule = day.modules.find(m => m.type === 'main');
      if (!mainModule || mainModule.exercises.length === 0) {
        errors.push(`Day ${dayIndex + 1}: must contain a main module with exercises`);
      }
    });

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Saves workout with proper format conversion and validation
   */
  static async saveWorkoutProgram(
    workout: GeneratedWorkoutPlan, 
    userId: string
  ): Promise<{ success: boolean; programId?: string; errors: string[] }> {
    try {
      // Validate workout before saving
      const validation = this.validateWorkoutData(workout);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      // Create program
      const { data: program, error: programError } = await supabase
        .from('programs')
        .insert({
          name: workout.name,
          user_id: userId,
          days_per_week: workout.days_per_week,
          generator_source: 'ai_workout_generator'
        })
        .select()
        .single();

      if (programError) {
        return { success: false, errors: [`Failed to create program: ${programError.message}`] };
      }

      // Create workouts with proper metadata
      const workoutsToInsert = workout.workouts.map((workoutDay, index) => ({
        program_id: program.id,
        json_plan: {
          ...workoutDay,
          workout_type: 'modular',
          enabled_modules: workout.enabled_modules,
          difficulty: workout.difficulty,
          goals: workout.goals,
          format_version: '2.0'
        } as any,
        workout_date: null, // Will be set when scheduled
      }));

      const { error: workoutError } = await supabase
        .from('workouts')
        .insert(workoutsToInsert);

      if (workoutError) {
        return { success: false, errors: [`Failed to create workouts: ${workoutError.message}`] };
      }

      return { success: true, programId: program.id, errors: [] };

    } catch (error) {
      return { 
        success: false, 
        errors: [`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Loads and validates workout from database
   */
  static async loadWorkout(workoutId: string): Promise<{ 
    workout: any | null; 
    isModular: boolean; 
    errors: string[] 
  }> {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          programs (
            name,
            user_id
          )
        `)
        .eq('id', workoutId)
        .maybeSingle();

      if (error) {
        return { workout: null, isModular: false, errors: [`Database error: ${error.message}`] };
      }

      if (!data) {
        return { workout: null, isModular: false, errors: ['Workout not found'] };
      }

      // Determine format and validate
      const jsonPlan = data.json_plan as any;
      const isModular = jsonPlan?.workout_type === 'modular' || 
                       jsonPlan?.modules !== undefined;

      const validation = this.validateWorkoutData(jsonPlan);
      if (!validation.isValid) {
        console.warn('Workout validation failed:', validation.errors);
        // Don't fail completely, but log warnings
      }

      return { 
        workout: {
          ...data,
          program: data.programs,
          json_plan: jsonPlan
        },
        isModular, 
        errors: validation.isValid ? [] : validation.errors 
      };

    } catch (error) {
      return { 
        workout: null, 
        isModular: false, 
        errors: [`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Migrates legacy workouts to modular format
   */
  static async migrateLegacyWorkout(workoutId: string): Promise<{ success: boolean; errors: string[] }> {
    try {
      const { workout, isModular, errors } = await this.loadWorkout(workoutId);
      
      if (!workout) {
        return { success: false, errors };
      }

      if (isModular) {
        return { success: true, errors: ['Workout is already in modular format'] };
      }

      // Convert to modular format
      const { workout: modularWorkout, errors: conversionErrors } = this.safeConvertToModular({
        workouts: [workout.json_plan]
      });

      if (!modularWorkout) {
        return { success: false, errors: conversionErrors };
      }

      // Update database with modular format
      const { error: updateError } = await supabase
        .from('workouts')
        .update({
          json_plan: {
            ...modularWorkout.workouts[0],
            workout_type: 'modular',
            format_version: '2.0',
            migrated_at: new Date().toISOString()
          } as any
        })
        .eq('id', workoutId);

      if (updateError) {
        return { success: false, errors: [`Migration failed: ${updateError.message}`] };
      }

      return { success: true, errors: [] };

    } catch (error) {
      return { 
        success: false, 
        errors: [`Migration error: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Gets workout statistics with format handling
   */
  static getWorkoutStats(workout: any): {
    totalExercises: number;
    totalModules: number;
    averageDuration: number;
    uniqueMuscleGroups: number;
    format: 'modular' | 'legacy';
  } {
    const stats = {
      totalExercises: 0,
      totalModules: 0,
      averageDuration: 0,
      uniqueMuscleGroups: 0,
      format: isLegacyFormat(workout) ? 'legacy' as const : 'modular' as const
    };

    if (!workout.workouts || !Array.isArray(workout.workouts)) {
      return stats;
    }

    const muscleGroups = new Set<string>();
    let totalDuration = 0;

    workout.workouts.forEach((day: any) => {
      if (day.modules) {
        // Modular format
        stats.totalModules += day.modules.length;
        day.modules.forEach((module: any) => {
          stats.totalExercises += module.exercises.length;
          module.exercises.forEach((exercise: any) => {
            exercise.primary_muscles?.forEach((muscle: string) => muscleGroups.add(muscle));
          });
        });
      } else if (day.exercises) {
        // Legacy format
        stats.totalExercises += day.exercises.length;
        day.exercises.forEach((exercise: any) => {
          exercise.primary_muscles?.forEach((muscle: string) => muscleGroups.add(muscle));
        });
      }
      
      totalDuration += day.total_duration_minutes || 0;
    });

    stats.averageDuration = Math.round(totalDuration / workout.workouts.length);
    stats.uniqueMuscleGroups = muscleGroups.size;

    return stats;
  }
}