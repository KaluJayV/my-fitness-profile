import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Calendar, Trophy, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { AppHeader } from "@/components/AppHeader";

interface ProgressData {
  week: string;
  user_id: string;
  exercise: string;
  avg_reps: number;
  avg_weight: number;
}

interface MuscleGroupData {
  muscle: string;
  avgScore: number;
}

interface StatsData {
  totalWorkouts: number;
  totalSets: number;
  avgWeightProgress: number;
  completionRate: number;
}

const AnalyticsDashboard = () => {
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [muscleData, setMuscleData] = useState<MuscleGroupData[]>([]);
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

      // Fetch progress data using the secure function
      const { data: progress, error: progressError } = await supabase
        .rpc('get_user_progress');

      if (progressError) throw progressError;

      setProgressData(progress || []);

      // Fetch muscle group ratings
      const { data: ratings, error: ratingsError } = await supabase
        .from('ratings')
        .select(`
          pump_score,
          exercises!inner(primary_muscles)
        `)
        .eq('user_id', user.id)
        .not('pump_score', 'is', null);

      if (ratingsError) throw ratingsError;

      // Process muscle group data
      const muscleScores = {};
      ratings?.forEach((rating) => {
        const muscles = rating.exercises?.primary_muscles || [];
        muscles.forEach((muscle: string) => {
          if (!muscleScores[muscle]) {
            muscleScores[muscle] = [];
          }
          muscleScores[muscle].push(rating.pump_score);
        });
      });

      const muscleGroupData = Object.entries(muscleScores).map(([muscle, scores]: [string, number[]]) => ({
        muscle: muscle.charAt(0).toUpperCase() + muscle.slice(1),
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length
      }));

      setMuscleData(muscleGroupData);

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

  // Group progress data by exercise for line chart
  const chartData = () => {
    const exerciseWeeks = {};
    progressData.forEach(item => {
      const weekKey = new Date(item.week).toLocaleDateString();
      if (!exerciseWeeks[weekKey]) {
        exerciseWeeks[weekKey] = { week: weekKey };
      }
      exerciseWeeks[weekKey][item.exercise] = item.avg_weight;
    });
    return Object.values(exerciseWeeks);
  };

  // Get unique exercises for line chart colors
  const uniqueExercises = [...new Set(progressData.map(item => item.exercise))];
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

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
              <h2 className="text-2xl font-bold mb-2">Your Progress</h2>
              <p className="text-muted-foreground">Track your fitness progress and achievements</p>
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

        <div className="grid gap-6 lg:grid-cols-3 mb-8">
          {/* Progress Line Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Exercise Progress Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {progressData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {uniqueExercises.slice(0, 6).map((exercise, index) => (
                      <Line
                        key={exercise}
                        type="monotone"
                        dataKey={exercise}
                        stroke={colors[index]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No progress data yet</p>
                  <p className="text-sm">Complete workouts to see your progress</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Muscle Group Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Muscle Group Ratings</CardTitle>
            </CardHeader>
            <CardContent>
              {muscleData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={muscleData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="muscle" />
                    <PolarRadiusAxis domain={[0, 5]} />
                    <Radar
                      name="Avg Rating"
                      dataKey="avgScore"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No ratings yet</p>
                  <p className="text-sm">Rate exercises to see muscle analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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