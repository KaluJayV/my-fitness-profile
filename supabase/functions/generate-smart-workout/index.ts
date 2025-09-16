import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Exercise {
  id: number;
  name: string;
  muscles: string[];
}

interface WorkoutRequest {
  prompt: string;
  exercises: Exercise[];
  currentWorkout?: any;
  conversationHistory?: Array<{ type: string; content: string; timestamp: Date }>;
  userId?: string;
  isQuestion?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, exercises, currentWorkout, conversationHistory, userId, isQuestion }: WorkoutRequest = await req.json();
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    // Handle clarifying question requests
    if (isQuestion) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-2025-08-07',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_completion_tokens: 200,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error:', errorData);
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const completion = await response.json();
      const question = completion.choices[0].message.content.trim();

      return new Response(
        JSON.stringify({ question }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }


    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

// Ensure exercise library is available (fallback to DB if none provided)
let exerciseList: Exercise[] = Array.isArray(exercises) ? exercises : [];
try {
  if (!exerciseList || exerciseList.length === 0) {
    console.log('Input exercise library empty; fetching from database...');
    const { data: exData, error: exError } = await supabase
      .from('exercises')
      .select('id, name, primary_muscles');
    if (exError) {
      console.error('Error fetching exercises fallback:', exError);
    } else {
      exerciseList = (exData || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        muscles: e.primary_muscles || []
      }));
    }
  }
} catch (err) {
  console.error('Unexpected error fetching exercises fallback:', err);
}

// Fetch user's training history for weight suggestions
    let userHistoryData: any = {};
    if (userId) {
      try {
        console.log('Fetching 1RM data for user:', userId);
        
        // Get 1RM data for each exercise in the library
        const exercisePromises = exerciseList.map(async (exercise) => {
          const { data, error } = await supabase.rpc('get_exercise_1rm_data', {
            p_user_id: userId,
            p_exercise_id: exercise.id
          });
          
          if (error) {
            console.error(`Error fetching data for exercise ${exercise.id}:`, error);
            return null;
          }
          
          if (data && data.length > 0) {
            // Calculate best 1RM from recent sets
            const sets = data.map((set: any) => ({
              weight: parseFloat(set.weight),
              reps: set.reps,
              rir: set.rir || 0
            }));
            
            // Use Epley formula for best estimate
            const best1RM = Math.max(...data.map((set: any) => parseFloat(set.estimated_1rm)));
            
            return {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              estimated1RM: best1RM,
              recentSets: sets.slice(0, 5) // Last 5 sets
            };
          }
          
          return null;
        });
        
        const exerciseHistory = await Promise.all(exercisePromises);
        userHistoryData = exerciseHistory
          .filter(data => data !== null)
          .reduce((acc, data) => {
            acc[data.exerciseId] = data;
            return acc;
          }, {});
          
        console.log('User history data collected:', Object.keys(userHistoryData).length, 'exercises');
      } catch (error) {
        console.error('Error fetching user history:', error);
        // Continue without history data
      }
    }

    // Build context for the LLM including user history
    const exerciseLibrary = exerciseList.map(ex => {
      const history = userHistoryData[ex.id];
      let historyInfo = '';
      if (history) {
        historyInfo = ` | User's Est. 1RM: ${history.estimated1RM.toFixed(1)}kg`;
      }
      return `ID: ${ex.id}, Name: "${ex.name}", Muscles: [${ex.muscles ? ex.muscles.join(', ') : 'not specified'}]${historyInfo}`;
    }).join('\n');

    const conversationContext = conversationHistory && conversationHistory.length > 0
      ? '\n\nPrevious conversation:\n' + conversationHistory.map(msg => 
          `${msg.type}: ${msg.content}`
        ).join('\n')
      : '';

    const isRevision = currentWorkout !== null && currentWorkout !== undefined;
    
    const systemPrompt = `You are an expert fitness coach and workout programmer. Your job is to create comprehensive, personalized workout plans using ONLY exercises from the provided exercise library.

CRITICAL REQUIREMENTS:
1. ONLY use exercises from the provided library - NEVER make up exercise names
2. Always use the exact exercise ID and name from the library
3. Match exercise IDs correctly with exercise names
4. Include realistic sets, reps, and rest periods
5. Consider muscle balance and recovery
6. Provide clear, actionable workout structure
7. IMPORTANT: When a user has historical data (Est. 1RM shown), provide specific weight suggestions based on their strength levels
8. Use percentage-based recommendations: 75-80% of 1RM for 6-12 reps, 85-90% for 3-5 reps, 65-75% for 12+ reps
9. For exercises without user history, suggest "Start with bodyweight" or "Begin with light weight"

Available Exercise Library:
${exerciseLibrary}

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "name": "Program Name",
  "description": "Brief description of the program",
  "duration_weeks": 4-12,
  "days_per_week": 3-6,
  "difficulty": "beginner|intermediate|advanced",
  "goals": ["goal1", "goal2"],
  "workouts": [
    {
      "day": "Monday",
      "name": "Workout Name",
      "description": "Brief workout description",
      "exercises": [
        {
          "exercise_id": 123,
          "exercise_name": "Exact name from library",
          "sets": 3,
          "reps": "8-12",
          "rest": "90s",
          "suggested_weight": "75kg" or "Bodyweight" or "Start light",
          "notes": "Form cues and weight rationale based on user's 1RM if available",
          "primary_muscles": ["muscle1", "muscle2"]
        }
      ]
    }
  ]
}

${isRevision ? `CURRENT WORKOUT TO MODIFY:\n${JSON.stringify(currentWorkout, null, 2)}` : ''}
${conversationContext}`;

    const userMessage = isRevision 
      ? `Modify the current workout based on this request: ${prompt}`
      : `Create a new workout plan based on this request: ${prompt}`;

    console.log('Sending request to OpenAI with prompt:', userMessage);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_completion_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const completion = await response.json();
    console.log('OpenAI response:', completion);

    if (!completion.choices || !completion.choices[0] || !completion.choices[0].message) {
      throw new Error('Invalid response from OpenAI');
    }

    let workoutPlan;
    try {
      const content = completion.choices[0].message.content.trim();
      console.log('Raw content from OpenAI:', content);
      
      // Extract JSON from the response (in case there's extra text)
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}') + 1;
      const jsonStr = content.slice(jsonStart, jsonEnd);
      
      workoutPlan = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse workout plan:', parseError);
      console.error('Raw content:', completion.choices[0].message.content);
      throw new Error('Failed to parse generated workout plan');
    }
    // If no workouts or exercises were returned, build a sensible fallback plan
    if (!workoutPlan || !workoutPlan.workouts || workoutPlan.workouts.length === 0 || workoutPlan.workouts.every((w: any) => !w.exercises || w.exercises.length === 0)) {
      console.warn('AI returned no workouts/exercises. Building fallback plan.');
      const days = ['Monday', 'Wednesday', 'Friday'];
      const pick = (start: number) => (
        exerciseList.slice(start, start + 5).map(ex => ({
          exercise_id: ex.id,
          exercise_name: ex.name,
          sets: 3,
          reps: '8-12',
          rest: '60-90s',
          suggested_weight: 'Start moderate',
          notes: 'Adjust weight to stay in target reps with good form.',
          primary_muscles: ex.muscles || []
        }))
      );
      const fallbackWorkouts = days.map((day, idx) => ({
        day,
        name: `Full Body ${idx + 1}`,
        description: 'Auto-generated fallback when AI output was empty.',
        exercises: pick(idx * 5)
      }));
      workoutPlan = {
        name: 'Auto Plan',
        description: 'Fallback plan generated automatically due to empty AI output.',
        duration_weeks: 4,
        days_per_week: fallbackWorkouts.length,
        difficulty: 'beginner',
        goals: ['Build Muscle', 'Lose Fat'],
        workouts: fallbackWorkouts
      };
    }

    // Validate that all exercises exist in the library and fix missing primary_muscles
    for (const workout of workoutPlan.workouts) {
      for (const exercise of workout.exercises) {
        const foundExercise = exerciseList.find(ex => ex.id === exercise.exercise_id);
        if (!foundExercise) {
          console.error(`Exercise ID ${exercise.exercise_id} not found in library`);
          // Find a similar exercise by name if possible
          const similarExercise = exerciseList.find(ex => 
            ex.name && exercise.exercise_name && 
            ex.name.toLowerCase().includes(exercise.exercise_name.toLowerCase().split(' ')[0])
          );
          if (similarExercise) {
            exercise.exercise_id = similarExercise.id;
            exercise.exercise_name = similarExercise.name;
            exercise.primary_muscles = similarExercise.muscles || [];
          } else if (exerciseList.length > 0) {
            // Use first exercise as fallback
            exercise.exercise_id = exerciseList[0].id;
            exercise.exercise_name = exerciseList[0].name;
            exercise.primary_muscles = exerciseList[0].muscles || [];
          }
        } else {
          // Exercise exists, ensure primary_muscles is set
          if (!exercise.primary_muscles) {
            exercise.primary_muscles = foundExercise.muscles || [];
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        workout: workoutPlan,
        message: isRevision ? 'Workout plan updated successfully' : 'Workout plan generated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in generate-smart-workout:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check the function logs for more information'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});