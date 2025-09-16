import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdaptiveCoachRequest {
  userId: string;
  sessionId: string;
  userPreferences: any;
  conversationHistory: any[];
  userInsights?: any;
  action: 'adaptive_question' | 'quality_score' | 'conversation_summary' | 'smart_followup';
  context?: {
    questionCount: number;
    maxQuestions: number;
    phase: string;
    lastResponse?: string;
  };
}

interface ConversationQuality {
  score: number;
  factors: {
    depth: number;
    relevance: number;
    engagement: number;
    clarity: number;
  };
  suggestions: string[];
  shouldContinue: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const {
      userId,
      sessionId,
      userPreferences,
      conversationHistory,
      userInsights,
      action,
      context
    }: AdaptiveCoachRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Adaptive coach action:', action, 'for user:', userId);

    if (action === 'adaptive_question') {
      const question = await generateAdaptiveQuestion(
        OPENAI_API_KEY,
        userPreferences,
        conversationHistory,
        userInsights,
        context
      );
      
      return new Response(
        JSON.stringify({ question, sessionId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'quality_score') {
      const quality = await assessConversationQuality(
        OPENAI_API_KEY,
        conversationHistory,
        userPreferences,
        context
      );
      
      return new Response(
        JSON.stringify({ quality, sessionId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'conversation_summary') {
      const summary = await generateConversationSummary(
        OPENAI_API_KEY,
        conversationHistory,
        userPreferences,
        userInsights
      );
      
      return new Response(
        JSON.stringify({ summary, sessionId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'smart_followup') {
      const followup = await generateSmartFollowup(
        OPENAI_API_KEY,
        conversationHistory,
        userInsights,
        context
      );
      
      return new Response(
        JSON.stringify({ followup, sessionId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action specified');

  } catch (error) {
    console.error('Error in adaptive-coach-engine:', error);
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

async function generateAdaptiveQuestion(
  apiKey: string,
  preferences: any,
  conversation: any[],
  insights: any,
  context: any
): Promise<string> {
  
  const recentMessages = conversation.slice(-4);
  const userResponses = conversation.filter(msg => msg.type === 'user');
  
  const systemPrompt = `You are an adaptive AI fitness coach. Generate a personalized question based on the user's data and conversation flow.

USER PROFILE:
- Goal: ${preferences.goal}
- Experience: ${preferences.experience}
- Equipment: ${preferences.equipment}
- Days/week: ${preferences.daysPerWeek}
- Session length: ${preferences.sessionLength}min

CONVERSATION CONTEXT:
Question ${context?.questionCount || 0}/${context?.maxQuestions || 5}
Phase: ${context?.phase || 'questioning'}

RECENT CONVERSATION:
${recentMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n')}

AI INSIGHTS AVAILABLE:
${insights ? JSON.stringify(insights, null, 2) : 'No insights yet'}

ADAPTIVE RULES:
1. If user gives short answers, ask more engaging questions
2. If user gives detailed answers, dig deeper into specific areas
3. If insights show strength gaps, focus questions on those areas
4. If user seems confused, simplify and clarify
5. If user is experienced, ask more technical questions
6. If user mentions specific preferences, explore them further

Generate ONE personalized question that:
- Adapts to their response style and engagement level
- Leverages any available AI insights about their training
- Progresses the conversation toward better program design
- Matches their experience level and communication style
- Is engaging and specific to their situation

Question:`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate adaptive question.' }
      ],
      max_completion_tokens: 200,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion = await response.json();
  return completion.choices[0].message.content.trim();
}

async function assessConversationQuality(
  apiKey: string,
  conversation: any[],
  preferences: any,
  context: any
): Promise<ConversationQuality> {
  
  const userMessages = conversation.filter(msg => msg.type === 'user');
  const averageLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length;
  
  const systemPrompt = `Assess the quality of this fitness consultation conversation:

USER GOAL: ${preferences.goal}
CONVERSATION LENGTH: ${conversation.length} messages
USER RESPONSES: ${userMessages.length}
AVG RESPONSE LENGTH: ${averageLength.toFixed(0)} characters

FULL CONVERSATION:
${conversation.map(msg => `${msg.type}: ${msg.content}`).join('\n')}

Assess quality on these factors (1-10 scale):
1. DEPTH: How detailed and informative are the user's responses?
2. RELEVANCE: How relevant are responses to fitness program design?
3. ENGAGEMENT: How engaged and enthusiastic is the user?
4. CLARITY: How clear and specific are the user's preferences?

Also determine:
- Should we continue asking questions or move to program generation?
- What specific areas need more exploration?
- How can we improve the conversation?

Return JSON:
{
  "score": overall_score_1_to_10,
  "factors": {
    "depth": 1-10,
    "relevance": 1-10,
    "engagement": 1-10,
    "clarity": 1-10
  },
  "suggestions": ["specific improvement suggestions"],
  "shouldContinue": true/false,
  "reasoning": "why continue or stop"
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Assess conversation quality.' }
      ],
      max_completion_tokens: 400,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion = await response.json();
  try {
    return JSON.parse(completion.choices[0].message.content.trim());
  } catch (e) {
    // Fallback if JSON parsing fails
    return {
      score: 6,
      factors: { depth: 6, relevance: 6, engagement: 6, clarity: 6 },
      suggestions: ["Continue with more specific questions"],
      shouldContinue: true
    };
  }
}

async function generateConversationSummary(
  apiKey: string,
  conversation: any[],
  preferences: any,
  insights: any
): Promise<string> {
  
  const systemPrompt = `Create a concise summary of this fitness consultation:

USER PREFERENCES:
${JSON.stringify(preferences, null, 2)}

CONVERSATION:
${conversation.map(msg => `${msg.type}: ${msg.content}`).join('\n')}

AI INSIGHTS:
${insights ? JSON.stringify(insights, null, 2) : 'No insights available'}

Create a summary that captures:
1. Key user preferences and requirements discovered
2. Important constraints or limitations mentioned
3. Specific goals and motivations identified
4. Training preferences and style
5. Any unique factors that will influence program design

Keep it concise but comprehensive - this will be used to generate their workout program.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-mini-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate consultation summary.' }
      ],
      max_completion_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion = await response.json();
  return completion.choices[0].message.content.trim();
}

async function generateSmartFollowup(
  apiKey: string,
  conversation: any[],
  insights: any,
  context: any
): Promise<string> {
  
  const lastUserMessage = conversation.filter(msg => msg.type === 'user').pop();
  
  const systemPrompt = `Generate a smart follow-up response based on the user's latest input:

LATEST USER RESPONSE: "${lastUserMessage?.content || ''}"

CONTEXT:
Phase: ${context?.phase || 'questioning'}
Question count: ${context?.questionCount || 0}

AVAILABLE INSIGHTS:
${insights ? JSON.stringify(insights, null, 2) : 'No insights available'}

Generate a brief, intelligent follow-up that:
1. Acknowledges their response appropriately
2. Shows understanding of their specific situation
3. Bridges to the next logical question or program generation
4. Uses any relevant AI insights to personalize the response
5. Maintains conversational flow and engagement

Keep it concise (1-2 sentences) and natural.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-nano-2025-08-07',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate smart followup.' }
      ],
      max_completion_tokens: 150,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const completion = await response.json();
  return completion.choices[0].message.content.trim();
}