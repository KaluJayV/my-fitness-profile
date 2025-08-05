import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WeekCalendar } from "@/components/WeekCalendar";
import { WorkoutList } from "@/components/WorkoutList";

interface Program {
  id: string;
  name: string;
  color?: string;
}

interface Workout {
  id: string;
  program_id: string;
  workout_date: string | null;
  json_plan: any;
  program: Program;
}

const ScheduleBuilder = () => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<Workout[]>([]);
  const [unscheduledWorkouts, setUnscheduledWorkouts] = useState<Workout[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkouts();
  }, []);

  useEffect(() => {
    // Separate scheduled and unscheduled workouts
    const scheduled = workouts.filter(w => w.workout_date);
    const unscheduled = workouts.filter(w => !w.workout_date);
    setScheduledWorkouts(scheduled);
    setUnscheduledWorkouts(unscheduled);
  }, [workouts]);

  const fetchWorkouts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          programs (
            id,
            name
          )
        `)
        .eq('programs.user_id', user.id);

      if (error) throw error;

      // Add colors to programs
      const workoutsWithColors = data?.map((workout, index) => ({
        ...workout,
        program: {
          ...workout.programs,
          color: generateProgramColor(workout.programs?.id || '', index)
        }
      })) || [];

      setWorkouts(workoutsWithColors);
    } catch (error) {
      console.error('Error fetching workouts:', error);
      toast({
        title: "Error",
        description: "Failed to load workouts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateProgramColor = (programId: string, index: number) => {
    const colors = [
      'hsl(var(--primary))',
      'hsl(220, 70%, 50%)',
      'hsl(160, 70%, 45%)',
      'hsl(30, 80%, 55%)',
      'hsl(280, 70%, 55%)',
      'hsl(10, 75%, 55%)'
    ];
    return colors[index % colors.length];
  };

  const handleWorkoutSchedule = async (workoutId: string, date: Date | null) => {
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ workout_date: date?.toISOString().split('T')[0] || null })
        .eq('id', workoutId);

      if (error) throw error;

      // Update local state
      setWorkouts(prev => prev.map(w => 
        w.id === workoutId 
          ? { ...w, workout_date: date?.toISOString().split('T')[0] || null }
          : w
      ));

      toast({
        title: date ? "Workout scheduled" : "Workout unscheduled",
        description: date 
          ? `Workout scheduled for ${date.toLocaleDateString()}`
          : "Workout moved to unscheduled list"
      });
    } catch (error) {
      console.error('Error updating workout:', error);
      toast({
        title: "Error",
        description: "Failed to update workout schedule",
        variant: "destructive"
      });
    }
  };

  const generateWeek = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to generate workouts",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate_workout', {
        body: { 
          generateWeek: true,
          weekStart: getWeekStart(currentWeek).toISOString()
        }
      });

      if (error) throw error;

      toast({
        title: "Week generated",
        description: "New workout week has been generated successfully"
      });

      // Refresh workouts
      await fetchWorkouts();
    } catch (error) {
      console.error('Error generating week:', error);
      toast({
        title: "Error",
        description: "Failed to generate workout week",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const getWeekStart = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day;
    return new Date(start.setDate(diff));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-96 bg-muted rounded"></div>
              <div className="h-96 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Schedule Builder</h1>
          </div>
          <Button 
            onClick={generateWeek} 
            disabled={generating}
            className="flex items-center gap-2"
          >
            {generating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Generate Week
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Week View */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Week Schedule</span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateWeek('prev')}
                    >
                      ←
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigateWeek('next')}
                    >
                      →
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WeekCalendar
                  currentWeek={currentWeek}
                  workouts={scheduledWorkouts}
                  onWorkoutSchedule={handleWorkoutSchedule}
                />
              </CardContent>
            </Card>
          </div>

          {/* Workout List */}
          <div>
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Available Workouts</CardTitle>
              </CardHeader>
              <CardContent>
                <WorkoutList
                  workouts={unscheduledWorkouts}
                  onWorkoutSchedule={handleWorkoutSchedule}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleBuilder;