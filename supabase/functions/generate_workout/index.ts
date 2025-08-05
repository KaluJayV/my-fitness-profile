import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1️⃣ pull user profile + history
    const { data: user, error: userError } = await supabaseClient
      .from("users")
      .select("*")
      .eq("id", user_id)
      .single();

    if (userError) {
      throw new Error(`Failed to fetch user: ${userError.message}`);
    }

    const { data: history, error: historyError } = await supabaseClient
      .rpc("get_user_history", { p_user: user_id });

    // 2️⃣ build prompt
    const prompt = `You are a professional strength coach. Generate a 4-day workout program for this user.

User Profile: ${JSON.stringify(user)}
Training History: ${JSON.stringify(history || [])}

Create a workout program with the following JSON structure:
{
  "days": 4,
  "split": [
    {
      "day": "Monday",
      "name": "Upper Body",
      "blocks": [
        {
          "exercise_id": 1,
          "sets": 3,
          "reps": "8-12",
          "rest": "90s"
        }
      ]
    }
  ]
}

Consider the user's:
- Experience level: ${user?.experience || 'beginner'}
- Goals: ${user?.goal || 'general fitness'}
- Available equipment: ${user?.equipment?.join(', ') || 'basic equipment'}
- Injuries/limitations: ${user?.injuries?.join(', ') || 'none'}

Return ONLY valid JSON matching the schema above.`;

    // 3️⃣ call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.statusText}`);
    }

    const completion = await openaiResponse.json();
    const plan = JSON.parse(completion.choices[0].message.content);

    // 4️⃣ persist program + workouts
    const { data: program, error: programError } = await supabaseClient
      .from("programs")
      .insert({
        user_id,
        name: `AI Program ${new Date().toISOString().slice(0, 10)}`,
        days_per_week: plan.days,
        generator_source: "AI"
      })
      .select()
      .single();

    if (programError) {
      throw new Error(`Failed to create program: ${programError.message}`);
    }

    for (const d of plan.split) {
      const { data: workout, error: workoutError } = await supabaseClient
        .from("workouts")
        .insert({
          program_id: program.id,
          workout_date: nextDate(d.day),
          json_plan: d
        })
        .select()
        .single();

      if (workoutError) {
        throw new Error(`Failed to create workout: ${workoutError.message}`);
      }

      // flatten exercises
      for (let idx = 0; idx < d.blocks.length; idx++) {
        const block = d.blocks[idx];
        const { error: weError } = await supabaseClient
          .from("workout_exercises")
          .insert({
            workout_id: workout.id,
            exercise_id: block.exercise_id,
            position: idx
          });

        if (weError) {
          console.error(`Failed to create workout exercise: ${weError.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, program_id: program.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function nextDate(dayName: string) {
  const map = { 
    "Monday": 1, 
    "Tuesday": 2, 
    "Wednesday": 3, 
    "Thursday": 4, 
    "Friday": 5, 
    "Saturday": 6, 
    "Sunday": 0 
  } as const;
  
  const today = new Date();
  const targetDay = map[dayName as keyof typeof map];
  const diff = (targetDay + 7 - today.getDay()) % 7;
  const nextDateObj = new Date();
  nextDateObj.setDate(today.getDate() + (diff === 0 ? 7 : diff));
  return nextDateObj.toISOString().slice(0, 10);
}