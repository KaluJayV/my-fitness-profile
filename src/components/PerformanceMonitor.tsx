import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  Clock, 
  Target, 
  TrendingUp, 
  BarChart3,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface PerformanceMonitorProps {
  userId: string;
  sessionId: string;
  isVisible: boolean;
  onMetricTracked?: (metric: string, value: number) => void;
}

interface SessionAnalytics {
  sessionDuration: number;
  questionCount: number;
  averageResponseTime: number;
  engagementScore: number;
  completionStatus: string;
  metrics: any[];
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ 
  userId, 
  sessionId, 
  isVisible,
  onMetricTracked 
}) => {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(true);
  const [sessionStartTime] = useState(Date.now());

  // Track metrics automatically
  const trackMetric = useCallback(async (
    metricType: string, 
    value: number, 
    metadata?: any
  ) => {
    if (!isTracking || !userId || !sessionId) return;

    try {
      await supabase.functions.invoke('performance-analytics', {
        body: {
          userId,
          sessionId,
          action: 'track_metric',
          metric: {
            userId,
            sessionId,
            metricType,
            value,
            metadata,
            timestamp: new Date().toISOString()
          }
        }
      });

      if (onMetricTracked) {
        onMetricTracked(metricType, value);
      }
    } catch (error) {
      console.error('Error tracking metric:', error);
    }
  }, [userId, sessionId, isTracking, onMetricTracked]);

  // Fetch session analytics
  const fetchAnalytics = useCallback(async () => {
    if (!userId || !sessionId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('performance-analytics', {
        body: {
          userId,
          sessionId,
          action: 'get_session_analytics'
        }
      });

      if (error) throw error;

      setAnalytics(data.analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, sessionId]);

  // Track session duration periodically
  useEffect(() => {
    if (!isTracking) return;

    const interval = setInterval(() => {
      const duration = Math.round((Date.now() - sessionStartTime) / 1000);
      trackMetric('conversation_duration', duration);
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isTracking, sessionStartTime, trackMetric]);

  // Fetch analytics when component becomes visible
  useEffect(() => {
    if (isVisible && userId && sessionId) {
      fetchAnalytics();
    }
  }, [isVisible, userId, sessionId, fetchAnalytics]);

  // Track user engagement
  const trackEngagement = useCallback((score: number) => {
    trackMetric('user_engagement', score, { 
      timestamp: Date.now(),
      sessionDuration: Math.round((Date.now() - sessionStartTime) / 1000)
    });
  }, [trackMetric, sessionStartTime]);

  // Track response time
  const trackResponseTime = useCallback((responseTime: number) => {
    trackMetric('response_time', responseTime);
  }, [trackMetric]);

  // Track question count
  const trackQuestion = useCallback(() => {
    trackMetric('question_count', 1);
  }, [trackMetric]);

  // Track generation success
  const trackGenerationSuccess = useCallback((success: boolean) => {
    trackMetric('generation_success', success ? 1 : 0);
  }, [trackMetric]);

  // Expose tracking functions for parent component
  useEffect(() => {
    // Add tracking functions to window for easy access
    (window as any).performanceTracker = {
      trackEngagement,
      trackResponseTime,
      trackQuestion,
      trackGenerationSuccess
    };

    return () => {
      delete (window as any).performanceTracker;
    };
  }, [trackEngagement, trackResponseTime, trackQuestion, trackGenerationSuccess]);

  if (!isVisible) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'started': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in_progress': return Activity;
      case 'started': return Clock;
      default: return AlertTriangle;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="animate-fade-in border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm">Session Performance</CardTitle>
            {analytics?.completionStatus && (
              <Badge 
                variant="outline" 
                className={`${getStatusColor(analytics.completionStatus)} border-none`}
              >
                {React.createElement(getStatusIcon(analytics.completionStatus), { 
                  className: "h-3 w-3 mr-1" 
                })}
                {analytics.completionStatus.replace('_', ' ')}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAnalytics}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription className="text-xs">
          Real-time performance monitoring
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            <div className="animate-pulse">
              <div className="h-2 bg-muted rounded mb-2"></div>
              <div className="h-2 bg-muted rounded mb-2"></div>
              <div className="h-2 bg-muted rounded"></div>
            </div>
          </div>
        ) : analytics ? (
          <div className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-muted/50 rounded-md">
                <div className="text-lg font-semibold">{analytics.questionCount}</div>
                <div className="text-xs text-muted-foreground">Questions</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded-md">
                <div className="text-lg font-semibold">
                  {formatDuration(analytics.sessionDuration)}
                </div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
            </div>

            {/* Engagement Score */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Engagement Score</span>
                <span>{analytics.engagementScore}/10</span>
              </div>
              <Progress 
                value={analytics.engagementScore * 10} 
                className="h-2"
              />
            </div>

            {/* Response Time */}
            {analytics.averageResponseTime > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Avg Response Time</span>
                  <span>{analytics.averageResponseTime.toFixed(1)}s</span>
                </div>
                <Progress 
                  value={Math.min((analytics.averageResponseTime / 5) * 100, 100)} 
                  className="h-2"
                />
              </div>
            )}

            {/* Performance Indicators */}
            <div className="flex justify-between text-xs">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                <span>Quality: Good</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>Trend: Stable</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Performance data will appear as you interact</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};