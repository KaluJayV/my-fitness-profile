import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExerciseSubstitutionRequest {
  currentExercise: {
    id: number;
    name: string;
    primary_muscles: string[];
  };
  userRequest: string;
  availableEquipment?: string[];
  userGoals?: string[];
  injuries?: string[];
  exerciseLibrary: Array<{
    id: number;
    name: string;
    primary_muscles: string[];
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const requestData: ExerciseSubstitutionRequest = await req.json();
    
    // Create a detailed prompt for exercise substitution
    const systemPrompt = `You are an expert fitness trainer and exercise physiologist. Your role is to suggest intelligent exercise substitutions during live workout sessions.

CRITICAL GUIDELINES:
1. ALWAYS prioritize user safety - if they mention pain or injury, suggest easier/safer alternatives
2. Match muscle groups as closely as possible to maintain workout integrity
3. Consider equipment availability and user goals
4. Provide 2-3 exercise options with brief explanations
5. Include suggested weight adjustments based on the new exercise difficulty
6. Consider the context of mid-workout fatigue

RESPONSE FORMAT (JSON):
{
  "suggestions": [
    {
      "exercise_id": number,
      "exercise_name": "string",
      "reason": "Brief explanation why this is a good substitute",
      "muscle_match": "primary/secondary/partial",
      "difficulty_adjustment": "easier/similar/harder",
      "weight_recommendation": "Use 10-15% less weight" or similar guidance
    }
  ],
  "general_advice": "Brief guidance about the substitution context"
}

MUSCLE GROUP PRIORITY MATCHING:
- Primary: Exact same muscle groups
- Secondary: Overlapping muscle groups (80%+ match)
- Partial: Some overlapping muscles but different focus

COMMON SUBSTITUTION SCENARIOS:
- Joint pain/discomfort → suggest lower impact alternatives
- Equipment unavailable → suggest bodyweight or alternative equipment
- Fatigue → suggest easier variations or different exercise order
- Technique issues → suggest simpler movement patterns
- Time constraints → suggest compound movements or supersets`;

    const userPrompt = `
CURRENT EXERCISE: ${requestData.currentExercise.name}
MUSCLE GROUPS: ${requestData.currentExercise.primary_muscles.join(', ')}

USER REQUEST: "${requestData.userRequest}"

${requestData.injuries?.length ? `CURRENT INJURIES/CONCERNS: ${requestData.injuries.join(', ')}` : ''}
${requestData.availableEquipment?.length ? `AVAILABLE EQUIPMENT: ${requestData.availableEquipment.join(', ')}` : ''}
${requestData.userGoals?.length ? `USER GOALS: ${requestData.userGoals.join(', ')}` : ''}

AVAILABLE EXERCISE OPTIONS:
${requestData.exerciseLibrary.map(ex => 
  `- ${ex.name} (ID: ${ex.id}) [${ex.primary_muscles.join(', ')}]`
).join('\n')}

Please suggest the best exercise substitutions from the available options that match the user's request while maintaining workout quality.`;

    console.log('Sending request to OpenAI for exercise substitution...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from OpenAI');
    }

    let assistantResponse;
    try {
      assistantResponse = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', data.choices[0].message.content);
      throw new Error('Failed to parse AI response');
    }

    // Validate the suggestions against available exercises
    const validSuggestions = assistantResponse.suggestions.filter((suggestion: any) => 
      requestData.exerciseLibrary.some(ex => ex.id === suggestion.exercise_id)
    );

    const result = {
      ...assistantResponse,
      suggestions: validSuggestions,
      original_exercise: requestData.currentExercise
    };

    console.log('Exercise substitution completed successfully');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in workout-assistant function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      suggestions: [],
      general_advice: "Sorry, I couldn't process your request right now. Please try again or continue with your current exercise."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});