import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Calendar, Trophy, RefreshCw, Dumbbell, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { AppHeader } from "@/components/AppHeader";
import { CoreLiftDashboard } from "@/components/CoreLiftDashboard";
import { WorkoutFrequencyDashboard } from "@/components/WorkoutFrequencyDashboard";

interface ProgressData {
  week: string;
  user_id: string;
  exercise: string;
  avg_reps: number;
  avg_weight: number;
}

interface CoreLiftProgression {
  core_lift_type: string;
  exercise_name: string;
  workout_date: string;
  best_estimated_1rm: number;
  total_volume: number;
  avg_weight: number;
  total_sets: number;
}

interface StatsData {
  totalWorkouts: number;
  totalSets: number;
  avgWeightProgress: number;
  completionRate: number;
}

const AnalyticsDashboard = () => {
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [coreLiftProgression, setCoreLiftProgression] = useState<CoreLiftProgression[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalWorkouts: 0,
    totalSets: 0,
    avgWeightProgress: 0,
    completionRate: 0
  });
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    fetchAIAnalysis();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch core lift progression data
      const { data: coreLifts, error: coreLiftsError } = await supabase
        .rpc('get_core_lift_progression');

      if (coreLiftsError) throw coreLiftsError;

      setCoreLiftProgression(coreLifts || []);

      // Fetch general progress data
      const { data: progress, error: progressError } = await supabase
        .rpc('get_user_progress');

      if (progressError) throw progressError;

      setProgressData(progress || []);

      // Calculate stats
      await calculateStats(user.id);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = async (userId: string) => {
    try {
      // Get total workouts
      const { count: workoutCount } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq('programs.user_id', userId)
        .not('workout_date', 'is', null);

      // Get total sets
      const { count: setsCount } = await supabase
        .from('sets')
        .select('*', { count: 'exact', head: true })
        .eq('workout_exercises.workouts.programs.user_id', userId);

      // Calculate average weight progress (simplified)
      const avgWeightProgress = progressData.length > 0 
        ? progressData.reduce((sum, item) => sum + (item.avg_weight || 0), 0) / progressData.length 
        : 0;

      setStats({
        totalWorkouts: workoutCount || 0,
        totalSets: setsCount || 0,
        avgWeightProgress: Math.round(avgWeightProgress * 10) / 10,
        completionRate: 85 // Placeholder
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const fetchAIAnalysis = async () => {
    setAnalysisLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze_progress');

      if (error) throw error;

      setAiAnalysis(data.analysis || "Analysis not available");
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
      setAiAnalysis("## Analysis Unavailable\n\nComplete some workouts to see your personalized progress analysis!");
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Group core lift progression data for chart
  const coreLiftsChartData = () => {
    const liftTypes = [...new Set(coreLiftProgression.map(item => item.core_lift_type))];
    const dataByDate = {};
    
    coreLiftProgression.forEach(item => {
      const dateKey = new Date(item.workout_date).toLocaleDateString();
      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = { date: dateKey };
      }
      dataByDate[dateKey][item.core_lift_type] = item.best_estimated_1rm;
    });
    
    return Object.values(dataByDate).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  // Get unique core lifts for chart colors
  const uniqueCoreLifts = [...new Set(coreLiftProgression.map(item => item.core_lift_type))];
  const liftColors = {
    squat: '#8884d8',
    bench: '#82ca9d', 
    deadlift: '#ffc658',
    overhead_press: '#ff7300'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Analytics Dashboard" showBack={true} />
        <div className="container mx-auto p-4 lg:p-6">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-96 bg-muted rounded"></div>
              <div className="h-96 bg-muted rounded"></div>
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Analytics Dashboard" showBack={true} />
      <div className="container mx-auto p-4 lg:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Workout & Core Lift Analytics</h2>
              <p className="text-muted-foreground">Track your workout consistency and strength progression</p>
            </div>
            <Button 
            onClick={() => {
              fetchData();
              fetchAIAnalysis();
            }}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
            </Button>
          </div>

        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Workouts</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalWorkouts}</div>
              <p className="text-xs text-muted-foreground">Completed sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sets</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSets}</div>
              <p className="text-xs text-muted-foreground">Sets performed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Weight</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgWeightProgress}kg</div>
              <p className="text-xs text-muted-foreground">Average across exercises</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progress Score</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completionRate}%</div>
              <p className="text-xs text-muted-foreground">Overall improvement</p>
            </CardContent>
          </Card>
        </div>

        {/* Core Lift and Workout Frequency Dashboard */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <CoreLiftDashboard />
          <WorkoutFrequencyDashboard />
        </div>

        {/* Core Lift Progression Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              Core Lift 1RM Progression
            </CardTitle>
          </CardHeader>
          <CardContent>
            {coreLiftProgression.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={coreLiftsChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      `${Math.round(value)}kg`, 
                      name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                    ]}
                  />
                  <Legend 
                    formatter={(value: string) => 
                      value.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                    }
                  />
                  {uniqueCoreLifts.map((liftType) => (
                    <Line
                      key={liftType}
                      type="monotone"
                      dataKey={liftType}
                      stroke={liftColors[liftType as keyof typeof liftColors]}
                      strokeWidth={3}
                      dot={{ r: 5 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No core lift data yet</p>
                <p className="text-sm">Perform squats, bench press, deadlifts, or overhead press to see progression</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Analysis Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>AI Progress Analysis</CardTitle>
              <Button
                onClick={fetchAIAnalysis}
                disabled={analysisLoading}
                variant="outline"
                size="sm"
              >
                {analysisLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  "Refresh Analysis"
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {analysisLoading ? (
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;