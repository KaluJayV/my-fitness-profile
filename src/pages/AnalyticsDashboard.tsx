import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Calendar, Trophy, RefreshCw, Dumbbell, Target, Activity, Zap, Award } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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
  totalVolume: number;
  avgWeightProgress: number;
  personalRecords: number;
  consistencyScore: number;
  strengthGain: number;
}

interface VolumeData {
  date: string;
  volume: number;
  workouts: number;
}

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [coreLiftProgression, setCoreLiftProgression] = useState<CoreLiftProgression[]>([]);
  const [volumeData, setVolumeData] = useState<VolumeData[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalWorkouts: 0,
    totalSets: 0,
    totalVolume: 0,
    avgWeightProgress: 0,
    personalRecords: 0,
    consistencyScore: 0,
    strengthGain: 0
  });
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
      fetchAIAnalysis();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      if (!user) {
        console.log('No user found');
        return;
      }

      console.log('Fetching analytics data for user:', user.id);

      // Fetch core lift progression data with explicit user ID
      const { data: coreLifts, error: coreLiftsError } = await supabase
        .rpc('get_core_lift_progression', { p_user_id: user.id });

      if (coreLiftsError) {
        console.error('Core lifts error:', coreLiftsError);
      } else {
        console.log('Core lifts data:', coreLifts?.length);
        setCoreLiftProgression(coreLifts || []);
      }

      // Fetch general progress data with explicit user ID
      const { data: progress, error: progressError } = await supabase
        .rpc('get_user_progress', { p_user_id: user.id });

      if (progressError) {
        console.error('Progress error:', progressError);
      } else {
        console.log('Progress data:', progress?.length);
        setProgressData(progress || []);
      }

      // Fetch volume data for charts
      await fetchVolumeData(user.id);

      // Calculate comprehensive stats
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

  const fetchVolumeData = async (userId: string) => {
    try {
      const { data: volumeRaw, error } = await supabase
        .from('v_progress')
        .select('workout_date, volume')
        .eq('user_id', userId)
        .not('volume', 'is', null)
        .order('workout_date', { ascending: true });

      if (error) {
        console.error('Volume data error:', error);
        return;
      }

      // Group by week and calculate totals
      const weeklyVolume = {};
      volumeRaw?.forEach(item => {
        const week = new Date(item.workout_date).toISOString().split('T')[0];
        if (!weeklyVolume[week]) {
          weeklyVolume[week] = { volume: 0, workouts: 0 };
        }
        weeklyVolume[week].volume += item.volume || 0;
        weeklyVolume[week].workouts += 1;
      });

      const chartData = Object.entries(weeklyVolume)
        .map(([date, data]: [string, any]) => ({
          date: new Date(date).toLocaleDateString(),
          volume: Math.round(data.volume),
          workouts: data.workouts
        }))
        .slice(-12); // Last 12 weeks

      setVolumeData(chartData);
    } catch (error) {
      console.error('Error fetching volume data:', error);
    }
  };

  const calculateStats = async (userId: string) => {
    try {
      // Get comprehensive workout data
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('workouts')
        .select('id, workout_date, programs!inner(user_id)')
        .eq('programs.user_id', userId)
        .not('workout_date', 'is', null);

      // Get sets with volume calculation
      const { data: setsData, error: setsError } = await supabase
        .from('sets')
        .select(`
          id, weight, reps,
          workout_exercises!inner(
            workout_id,
            workouts!inner(
              workout_date,
              program_id,
              programs!inner(user_id)
            )
          )
        `)
        .eq('workout_exercises.workouts.programs.user_id', userId);

      if (workoutsError) console.error('Workouts error:', workoutsError);
      if (setsError) console.error('Sets error:', setsError);

      // Calculate comprehensive stats
      const totalWorkouts = workoutsData?.length || 0;
      const totalSets = setsData?.length || 0;
      
      // Calculate total volume (weight × reps)
      const totalVolume = setsData?.reduce((sum, set) => {
        const volume = (set.weight || 0) * (set.reps || 0);
        return sum + volume;
      }, 0) || 0;

      // Calculate average weight
      const weights = setsData?.map(s => s.weight).filter(w => w != null) || [];
      const avgWeightProgress = weights.length > 0 
        ? weights.reduce((sum, weight) => sum + weight, 0) / weights.length 
        : 0;

      // Calculate consistency score (workouts per week)
      const weeklyConsistency = totalWorkouts > 0 && workoutsData ? 
        calculateConsistencyScore(workoutsData) : 0;

      // Calculate strength gain (comparing first vs last month)
      const strengthGain = calculateStrengthGain(setsData || []);

      // Count personal records (simplified - count of max weights per exercise)
      const personalRecords = countPersonalRecords(setsData || []);

      setStats({
        totalWorkouts,
        totalSets,
        totalVolume: Math.round(totalVolume),
        avgWeightProgress: Math.round(avgWeightProgress * 10) / 10,
        personalRecords,
        consistencyScore: Math.round(weeklyConsistency * 10) / 10,
        strengthGain: Math.round(strengthGain * 10) / 10
      });

    } catch (error) {
      console.error('Error calculating stats:', error);
      setStats({
        totalWorkouts: 0,
        totalSets: 0,
        totalVolume: 0,
        avgWeightProgress: 0,
        personalRecords: 0,
        consistencyScore: 0,
        strengthGain: 0
      });
    }
  };

  const calculateConsistencyScore = (workouts: any[]) => {
    if (workouts.length === 0) return 0;
    const dates = workouts.map(w => new Date(w.workout_date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const weeks = Math.max(1, (maxDate.getTime() - minDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return workouts.length / weeks;
  };

  const calculateStrengthGain = (sets: any[]) => {
    if (sets.length < 2) return 0;
    const sortedSets = sets.sort((a, b) => 
      new Date(a.workout_exercises.workouts.workout_date).getTime() - 
      new Date(b.workout_exercises.workouts.workout_date).getTime()
    );
    const firstMonth = sortedSets.slice(0, Math.min(10, sortedSets.length / 2));
    const lastMonth = sortedSets.slice(-Math.min(10, sortedSets.length / 2));
    
    const firstAvg = firstMonth.reduce((sum, s) => sum + (s.weight || 0), 0) / firstMonth.length;
    const lastAvg = lastMonth.reduce((sum, s) => sum + (s.weight || 0), 0) / lastMonth.length;
    
    return ((lastAvg - firstAvg) / Math.max(firstAvg, 1)) * 100; // Percentage gain
  };

  const countPersonalRecords = (sets: any[]) => {
    const exerciseMaxes = {};
    sets.forEach(set => {
      const key = set.workout_exercises?.exercise_id || 'unknown';
      const weight = set.weight || 0;
      if (!exerciseMaxes[key] || weight > exerciseMaxes[key]) {
        exerciseMaxes[key] = weight;
      }
    });
    return Object.keys(exerciseMaxes).length;
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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Analytics Dashboard" showBack={true} />
        <div className="container mx-auto p-4 lg:p-6">
          <div className="max-w-6xl mx-auto">
            {!user ? (
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold mb-4">Please Sign In</h2>
                <p className="text-muted-foreground">You need to be signed in to view your analytics.</p>
              </div>
            ) : (
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
            )}
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

        {/* Enhanced Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <Dumbbell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {(stats.totalVolume / 1000).toFixed(1)}k kg
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400">Total weight moved</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Workouts</CardTitle>
              <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.totalWorkouts}</div>
              <p className="text-xs text-green-600 dark:text-green-400">{stats.totalSets} total sets</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Strength Gain</CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {stats.strengthGain > 0 ? '+' : ''}{stats.strengthGain}%
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400">Average weight progress</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Consistency</CardTitle>
              <Activity className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {stats.consistencyScore}/week
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400">Workout frequency</p>
            </CardContent>
          </Card>
        </div>

        {/* Primary Volume Chart - Made Prominent */}
        <Card className="mb-8 border-2 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-6 w-6 text-primary" />
              Training Volume & Frequency
            </CardTitle>
            <p className="text-muted-foreground">Track your weekly training load and workout consistency</p>
          </CardHeader>
          <CardContent>
            {volumeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={volumeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="date" 
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    yAxisId="volume"
                    orientation="left"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    yAxisId="workouts"
                    orientation="right"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any, name: string) => [
                      name === 'volume' ? `${value} kg` : `${value} workouts`,
                      name === 'volume' ? 'Total Volume' : 'Workouts'
                    ]}
                  />
                  <Legend />
                  <Bar 
                    yAxisId="volume"
                    dataKey="volume" 
                    name="Volume (kg)"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No volume data yet</p>
                <p className="text-sm">Complete more workouts to see your training volume trends</p>
              </div>
            )}
          </CardContent>
        </Card>

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