import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Target, Flame, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WorkoutFrequencyStats {
  total_workouts: number;
  avg_workouts_per_week: number;
  current_streak: number;
  longest_streak: number;
  last_workout_date: string;
}

export const WorkoutFrequencyDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<WorkoutFrequencyStats>({
    total_workouts: 0,
    avg_workouts_per_week: 0,
    current_streak: 0,
    longest_streak: 0,
    last_workout_date: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWorkoutFrequencyStats();
    }
  }, [user]);

  const fetchWorkoutFrequencyStats = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .rpc('get_workout_frequency_stats');

      if (error) throw error;

      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('Error fetching workout frequency stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStreakStatus = (streak: number) => {
    if (streak >= 7) return { color: "text-green-600", status: "🔥 Hot Streak!" };
    if (streak >= 3) return { color: "text-orange-600", status: "💪 Building Momentum" };
    if (streak >= 1) return { color: "text-blue-600", status: "🌟 Getting Started" };
    return { color: "text-muted-foreground", status: "💤 Time to Return" };
  };

  const getFrequencyRating = (avgPerWeek: number) => {
    if (avgPerWeek >= 4) return { rating: "Excellent", color: "text-green-600" };
    if (avgPerWeek >= 3) return { rating: "Great", color: "text-blue-600" };
    if (avgPerWeek >= 2) return { rating: "Good", color: "text-orange-600" };
    return { rating: "Needs Work", color: "text-red-600" };
  };

  const streakInfo = getStreakStatus(stats.current_streak);
  const frequencyInfo = getFrequencyRating(stats.avg_workouts_per_week);

  if (!user || loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Workout Frequency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Workout Frequency
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Total Workouts */}
          <div className="text-center p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mx-auto mb-2">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.total_workouts}</div>
            <p className="text-xs text-muted-foreground">Total Workouts</p>
          </div>

          {/* Weekly Average */}
          <div className="text-center p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mx-auto mb-2">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.avg_workouts_per_week}</div>
            <p className="text-xs text-muted-foreground">Per Week</p>
            <p className={`text-[10px] font-medium ${frequencyInfo.color}`}>
              {frequencyInfo.rating}
            </p>
          </div>

          {/* Current Streak */}
          <div className="text-center p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mx-auto mb-2">
              <Flame className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.current_streak}</div>
            <p className="text-xs text-muted-foreground">Day Streak</p>
            <p className={`text-[10px] font-medium ${streakInfo.color}`}>
              {streakInfo.status}
            </p>
          </div>

          {/* Best Streak */}
          <div className="text-center p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mx-auto mb-2">
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.longest_streak}</div>
            <p className="text-xs text-muted-foreground">Best Streak</p>
          </div>
        </div>

        {/* Last Workout Date */}
        {stats.last_workout_date && (
          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Last workout: {new Date(stats.last_workout_date).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};