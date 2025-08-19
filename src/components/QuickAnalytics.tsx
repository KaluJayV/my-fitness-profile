import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Calendar, Trophy, ArrowRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { CoreLiftDashboard } from "./CoreLiftDashboard";
import { WorkoutFrequencyDashboard } from "./WorkoutFrequencyDashboard";

interface StatsData {
  totalWorkouts: number;
  totalSets: number;
  avgWeightProgress: number;
  recentProgress: Array<{ week: string; avgWeight: number }>;
}

export const QuickAnalytics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsData>({
    totalWorkouts: 0,
    totalSets: 0,
    avgWeightProgress: 0,
    recentProgress: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchQuickStats();
    }
  }, [user]);

  const fetchQuickStats = async () => {
    try {
      if (!user) return;

      // Get basic stats in parallel
      const [progressData, workoutCount, setsCount] = await Promise.all([
        supabase.rpc('get_user_progress'),
        supabase
          .from('workouts')
          .select('id', { count: 'exact', head: true })
          .eq('programs.user_id', user.id)
          .not('workout_date', 'is', null),
        supabase
          .from('sets')
          .select('id', { count: 'exact', head: true })
          .eq('workout_exercises.workouts.programs.user_id', user.id)
      ]);

      // Process progress data for recent weeks (last 4 weeks)
      const recentWeeks = progressData.data?.slice(0, 4).reverse() || [];
      const weeklyProgress = recentWeeks.map(item => ({
        week: new Date(item.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        avgWeight: item.avg_weight || 0
      }));

      // Calculate average weight progress
      const avgWeight = progressData.data?.length > 0 
        ? progressData.data.reduce((sum: number, item: any) => sum + (item.avg_weight || 0), 0) / progressData.data.length 
        : 0;

      setStats({
        totalWorkouts: workoutCount.count || 0,
        totalSets: setsCount.count || 0,
        avgWeightProgress: Math.round(avgWeight * 10) / 10,
        recentProgress: weeklyProgress
      });
    } catch (error) {
      console.error('Error fetching quick stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user || loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Quick Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card with Quick Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Quick Analytics
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/analytics">
                View Full Analytics
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mx-auto mb-2">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">{stats.totalWorkouts}</div>
              <p className="text-xs text-muted-foreground">Workouts</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mx-auto mb-2">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">{stats.totalSets}</div>
              <p className="text-xs text-muted-foreground">Sets</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mx-auto mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">{stats.avgWeightProgress}kg</div>
              <p className="text-xs text-muted-foreground">Avg Weight</p>
            </div>
          </div>

          {/* Mini Progress Chart */}
          {stats.recentProgress.length > 0 ? (
            <div className="pt-2">
              <h4 className="text-sm font-medium mb-2">Recent Progress</h4>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={stats.recentProgress}>
                  <XAxis dataKey="week" hide />
                  <YAxis hide />
                  <Line
                    type="monotone"
                    dataKey="avgWeight"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Complete workouts to see progress</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Core Lift Dashboard */}
      <CoreLiftDashboard />

      {/* Workout Frequency Dashboard */}
      <WorkoutFrequencyDashboard />
    </div>
  );
};