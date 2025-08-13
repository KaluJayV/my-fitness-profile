import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log('Processing audio for transcription...');

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    
    // Prepare form data for Whisper
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    // Send to OpenAI Whisper for transcription
    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      throw new Error(`Whisper API error: ${await transcriptionResponse.text()}`);
    }

    const transcriptionResult = await transcriptionResponse.json();
    const transcribedText = transcriptionResult.text;

    console.log('Transcribed text:', transcribedText);

    // Use GPT-4o-mini to parse the workout data
    const parseResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a workout data parser. Extract weight, reps, and RIR (reps in reserve) from user speech about their workout set. 

RIR is how many more reps they could have done (0 = to failure, 1 = could do 1 more, etc.).

Return ONLY valid JSON in this exact format:
{
  "weight": number_or_null,
  "reps": number_or_null,
  "rir": number_or_null
}

Examples:
"I did 225 pounds for 8 reps with 2 in reserve" -> {"weight": 225, "reps": 8, "rir": 2}
"185 for 10, could have done 1 more" -> {"weight": 185, "reps": 10, "rir": 1}
"Just did 12 reps bodyweight to failure" -> {"weight": null, "reps": 12, "rir": 0}
"135 pounds, 6 reps" -> {"weight": 135, "reps": 6, "rir": null}

If you can't extract a value, use null. Only return the JSON object.`
          },
          {
            role: 'user',
            content: transcribedText
          }
        ],
        temperature: 0.1,
        max_tokens: 100
      }),
    });

    if (!parseResponse.ok) {
      throw new Error(`GPT API error: ${await parseResponse.text()}`);
    }

    const parseResult = await parseResponse.json();
    const parsedContent = parseResult.choices[0].message.content.trim();

    console.log('Parsed content:', parsedContent);

    // Parse the JSON response
    let workoutData;
    try {
      workoutData = JSON.parse(parsedContent);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parsedContent);
      throw new Error('Failed to parse workout data from speech');
    }

    return new Response(
      JSON.stringify({ 
        transcription: transcribedText,
        workoutData: workoutData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in voice-to-workout-data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});