import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WeeklyProgress {
  thisWeek: number;
  lastWeek: number;
  improvement: number;
  improvementPercentage: number;
}

export const WeeklyProgressTracker = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState<WeeklyProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWeeklyProgress();
    }
  }, [user]);

  const fetchWeeklyProgress = async () => {
    try {
      if (!user) return;

      // Get progress data for the last 2 weeks
      const { data, error } = await supabase
        .rpc('get_user_progress')
        .order('week', { ascending: false })
        .limit(2);

      if (error) throw error;

      if (data && data.length >= 2) {
        const thisWeek = data[0];
        const lastWeek = data[1];
        
        const thisWeekAvg = Number(thisWeek.avg_weight) || 0;
        const lastWeekAvg = Number(lastWeek.avg_weight) || 0;
        
        const improvement = thisWeekAvg - lastWeekAvg;
        const improvementPercentage = lastWeekAvg > 0 
          ? ((improvement / lastWeekAvg) * 100) 
          : 0;

        setProgress({
          thisWeek: thisWeekAvg,
          lastWeek: lastWeekAvg,
          improvement,
          improvementPercentage
        });
      } else {
        setProgress(null);
      }
    } catch (error) {
      console.error('Error fetching weekly progress:', error);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const renderTrendIcon = () => {
    if (!progress) return <Minus className="h-4 w-4 text-muted-foreground" />;
    
    if (progress.improvement > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (progress.improvement < 0) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (!progress) return "text-muted-foreground";
    if (progress.improvement > 0) return "text-green-600";
    if (progress.improvement < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weekly Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!progress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weekly Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Complete 2+ weeks of workouts to see progress</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Weekly Progress
          {renderTrendIcon()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Average Weight</span>
            <span className="font-semibold">{Math.round(progress.thisWeek * 10) / 10}kg</span>
          </div>
          
          <div className={`text-sm ${getTrendColor()}`}>
            {progress.improvement > 0 ? '+' : ''}{Math.round(progress.improvement * 10) / 10}kg 
            ({progress.improvementPercentage > 0 ? '+' : ''}{Math.round(progress.improvementPercentage * 10) / 10}%) 
            vs last week
          </div>
        </div>
      </CardContent>
    </Card>
  );
};