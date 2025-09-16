import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PerformanceMetric {
  userId: string;
  sessionId: string;
  metricType: 'conversation_duration' | 'question_count' | 'response_time' | 'user_engagement' | 'generation_success';
  value: number;
  metadata?: any;
  timestamp: string;
}

interface AnalyticsRequest {
  userId: string;
  sessionId?: string;
  action: 'track_metric' | 'get_session_analytics' | 'get_user_analytics' | 'performance_report';
  metrics?: PerformanceMetric[];
  metric?: PerformanceMetric;
  timeframe?: 'session' | 'day' | 'week' | 'month';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      userId,
      sessionId,
      action,
      metrics,
      metric,
      timeframe = 'session'
    }: AnalyticsRequest = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Performance analytics action:', action, 'for user:', userId);

    if (action === 'track_metric') {
      if (!metric) throw new Error('Metric data required');
      
      const result = await trackPerformanceMetric(supabase, metric);
      
      return new Response(
        JSON.stringify({ success: true, metricId: result.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_session_analytics') {
      if (!sessionId) throw new Error('Session ID required');
      
      const analytics = await getSessionAnalytics(supabase, userId, sessionId);
      
      return new Response(
        JSON.stringify({ analytics }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get_user_analytics') {
      const analytics = await getUserAnalytics(supabase, userId, timeframe);
      
      return new Response(
        JSON.stringify({ analytics, timeframe }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'performance_report') {
      const report = await generatePerformanceReport(supabase, userId, timeframe);
      
      return new Response(
        JSON.stringify({ report, timeframe }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action specified');

  } catch (error) {
    console.error('Error in performance-analytics:', error);
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

async function trackPerformanceMetric(supabase: any, metric: PerformanceMetric) {
  const { data, error } = await supabase
    .from('performance_metrics')
    .insert({
      user_id: metric.userId,
      session_id: metric.sessionId,
      metric_type: metric.metricType,
      value: metric.value,
      metadata: metric.metadata || {},
      timestamp: metric.timestamp,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Error tracking metric:', error);
    throw error;
  }

  return data;
}

async function getSessionAnalytics(supabase: any, userId: string, sessionId: string) {
  try {
    const { data: metrics, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    // Calculate session analytics
    const analytics = {
      sessionDuration: calculateSessionDuration(metrics),
      questionCount: metrics.filter(m => m.metric_type === 'question_count').length,
      averageResponseTime: calculateAverageResponseTime(metrics),
      engagementScore: calculateEngagementScore(metrics),
      completionStatus: determineCompletionStatus(metrics),
      metrics: metrics || []
    };

    return analytics;
  } catch (error) {
    console.error('Error getting session analytics:', error);
    return {
      sessionDuration: 0,
      questionCount: 0,
      averageResponseTime: 0,
      engagementScore: 0,
      completionStatus: 'unknown',
      metrics: []
    };
  }
}

async function getUserAnalytics(supabase: any, userId: string, timeframe: string) {
  const timeframeDays = {
    session: 1,
    day: 1,
    week: 7,
    month: 30
  };
  
  const days = timeframeDays[timeframe] || 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: metrics, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', since)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    const sessions = groupMetricsBySession(metrics || []);
    
    const analytics = {
      totalSessions: Object.keys(sessions).length,
      averageSessionDuration: calculateAverageSessionDuration(sessions),
      averageQuestionsPerSession: calculateAverageQuestions(sessions),
      successRate: calculateSuccessRate(sessions),
      engagementTrend: calculateEngagementTrend(sessions),
      performanceScore: calculateOverallPerformanceScore(sessions),
      timeframe,
      metrics: metrics || []
    };

    return analytics;
  } catch (error) {
    console.error('Error getting user analytics:', error);
    return {
      totalSessions: 0,
      averageSessionDuration: 0,
      averageQuestionsPerSession: 0,
      successRate: 0,
      engagementTrend: 'stable',
      performanceScore: 0,
      timeframe,
      metrics: []
    };
  }
}

async function generatePerformanceReport(supabase: any, userId: string, timeframe: string) {
  const userAnalytics = await getUserAnalytics(supabase, userId, timeframe);
  
  const report = {
    summary: {
      totalSessions: userAnalytics.totalSessions,
      performanceScore: userAnalytics.performanceScore,
      trend: userAnalytics.engagementTrend
    },
    insights: generatePerformanceInsights(userAnalytics),
    recommendations: generatePerformanceRecommendations(userAnalytics),
    benchmarks: generateBenchmarks(userAnalytics),
    timeframe
  };

  return report;
}

// Helper functions
function calculateSessionDuration(metrics: any[]): number {
  if (metrics.length < 2) return 0;
  
  const start = new Date(metrics[0].timestamp).getTime();
  const end = new Date(metrics[metrics.length - 1].timestamp).getTime();
  
  return Math.round((end - start) / 1000); // seconds
}

function calculateAverageResponseTime(metrics: any[]): number {
  const responseTimes = metrics
    .filter(m => m.metric_type === 'response_time')
    .map(m => m.value);
  
  if (responseTimes.length === 0) return 0;
  
  return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
}

function calculateEngagementScore(metrics: any[]): number {
  const engagementMetrics = metrics.filter(m => m.metric_type === 'user_engagement');
  
  if (engagementMetrics.length === 0) return 5; // Default neutral score
  
  const avgEngagement = engagementMetrics.reduce((sum, m) => sum + m.value, 0) / engagementMetrics.length;
  return Math.round(avgEngagement * 10) / 10;
}

function determineCompletionStatus(metrics: any[]): string {
  const hasSuccess = metrics.some(m => m.metric_type === 'generation_success' && m.value === 1);
  const hasQuestions = metrics.some(m => m.metric_type === 'question_count');
  
  if (hasSuccess) return 'completed';
  if (hasQuestions) return 'in_progress';
  return 'started';
}

function groupMetricsBySession(metrics: any[]): Record<string, any[]> {
  return metrics.reduce((acc, metric) => {
    const sessionId = metric.session_id;
    if (!acc[sessionId]) acc[sessionId] = [];
    acc[sessionId].push(metric);
    return acc;
  }, {});
}

function calculateAverageSessionDuration(sessions: Record<string, any[]>): number {
  const durations = Object.values(sessions).map(metrics => calculateSessionDuration(metrics));
  
  if (durations.length === 0) return 0;
  
  return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
}

function calculateAverageQuestions(sessions: Record<string, any[]>): number {
  const questionCounts = Object.values(sessions).map(metrics => 
    metrics.filter(m => m.metric_type === 'question_count').length
  );
  
  if (questionCounts.length === 0) return 0;
  
  return questionCounts.reduce((sum, count) => sum + count, 0) / questionCounts.length;
}

function calculateSuccessRate(sessions: Record<string, any[]>): number {
  const completedSessions = Object.values(sessions).filter(metrics =>
    metrics.some(m => m.metric_type === 'generation_success' && m.value === 1)
  ).length;
  
  const totalSessions = Object.keys(sessions).length;
  
  if (totalSessions === 0) return 0;
  
  return (completedSessions / totalSessions) * 100;
}

function calculateEngagementTrend(sessions: Record<string, any[]>): string {
  const sessionKeys = Object.keys(sessions).sort();
  
  if (sessionKeys.length < 2) return 'stable';
  
  const firstHalf = sessionKeys.slice(0, Math.floor(sessionKeys.length / 2));
  const secondHalf = sessionKeys.slice(Math.floor(sessionKeys.length / 2));
  
  const firstHalfEngagement = firstHalf.reduce((sum, key) => 
    sum + calculateEngagementScore(sessions[key]), 0) / firstHalf.length;
  
  const secondHalfEngagement = secondHalf.reduce((sum, key) => 
    sum + calculateEngagementScore(sessions[key]), 0) / secondHalf.length;
  
  const difference = secondHalfEngagement - firstHalfEngagement;
  
  if (difference > 0.5) return 'improving';
  if (difference < -0.5) return 'declining';
  return 'stable';
}

function calculateOverallPerformanceScore(sessions: Record<string, any[]>): number {
  const sessionCount = Object.keys(sessions).length;
  const avgDuration = calculateAverageSessionDuration(sessions);
  const avgQuestions = calculateAverageQuestions(sessions);
  const successRate = calculateSuccessRate(sessions);
  
  // Weighted performance score
  const durationScore = Math.min(avgDuration / 300, 1) * 25; // Max 5 minutes
  const questionScore = Math.min(avgQuestions / 5, 1) * 25; // Max 5 questions
  const successScore = successRate * 0.4; // 40% weight
  const volumeScore = Math.min(sessionCount / 10, 1) * 10; // Max 10 sessions
  
  return Math.round(durationScore + questionScore + successScore + volumeScore);
}

function generatePerformanceInsights(analytics: any): string[] {
  const insights = [];
  
  if (analytics.successRate > 80) {
    insights.push("Excellent completion rate - users are highly satisfied with the AI coach");
  } else if (analytics.successRate < 50) {
    insights.push("Low completion rate suggests users may need more guidance or support");
  }
  
  if (analytics.averageSessionDuration > 600) {
    insights.push("Long session duration indicates thorough consultation process");
  } else if (analytics.averageSessionDuration < 120) {
    insights.push("Short sessions suggest efficient question flow or potential user disengagement");
  }
  
  if (analytics.engagementTrend === 'improving') {
    insights.push("User engagement is improving over time - great user experience");
  } else if (analytics.engagementTrend === 'declining') {
    insights.push("Declining engagement trend needs attention - consider UX improvements");
  }
  
  return insights;
}

function generatePerformanceRecommendations(analytics: any): string[] {
  const recommendations = [];
  
  if (analytics.successRate < 70) {
    recommendations.push("Improve question clarity and add more user guidance");
    recommendations.push("Consider reducing question complexity for better completion rates");
  }
  
  if (analytics.averageQuestionsPerSession > 6) {
    recommendations.push("Optimize question flow to reduce session length");
  }
  
  if (analytics.performanceScore < 60) {
    recommendations.push("Focus on improving overall user experience and engagement");
  }
  
  return recommendations;
}

function generateBenchmarks(analytics: any): any {
  return {
    optimalSessionDuration: "3-5 minutes",
    targetQuestionCount: "3-5 questions",
    goodSuccessRate: ">75%",
    excellentEngagement: ">7/10",
    currentPerformance: {
      sessionDuration: `${Math.round(analytics.averageSessionDuration)}s`,
      questionCount: `${analytics.averageQuestionsPerSession.toFixed(1)}`,
      successRate: `${analytics.successRate.toFixed(1)}%`,
      performanceScore: `${analytics.performanceScore}/100`
    }
  };
}