import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Edit3, Save, X, TrendingUp, Dumbbell, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Exercise {
  id: number;
  name: string;
  gif_url: string | null;
  primary_muscles: string[] | null;
  average_pump_score: number | null;
}

interface ExerciseStats {
  exercise_id: number;
  exercise_name: string;
  manual_1rm: number | null;
  manual_1rm_updated_at: string | null;
  calculated_1rm: number | null;
  best_1rm: number | null;
  total_sets: number;
  avg_weight: number | null;
  avg_reps: number | null;
  last_performed: string | null;
  pump_score: number | null;
  notes: string | null;
}

interface ExerciseDetailProps {
  exercise: Exercise;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'core', 'calves'
];

const StarRating = ({ rating, onRatingChange }: { rating: number; onRatingChange: (rating: number) => void }) => {
  const [hoveredRating, setHoveredRating] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Button
          key={star}
          variant="ghost"
          size="sm"
          className="p-1 h-auto"
          onMouseEnter={() => setHoveredRating(star)}
          onMouseLeave={() => setHoveredRating(0)}
          onClick={() => onRatingChange(star)}
        >
          <Star 
            className={`h-6 w-6 ${
              star <= (hoveredRating || rating) 
                ? 'fill-primary text-primary' 
                : 'text-muted-foreground'
            }`}
          />
        </Button>
      ))}
    </div>
  );
};

export const ExerciseDetail = ({ exercise, open, onOpenChange }: ExerciseDetailProps) => {
  const [userRating, setUserRating] = useState<number>(0);
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing1RM, setEditing1RM] = useState(false);
  const [manual1RM, setManual1RM] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (open && exercise) {
      fetchExerciseStats();
    }
  }, [open, exercise]);

  const fetchExerciseStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_exercise_stats', {
        p_user_id: user.id,
        p_exercise_id: exercise.id
      });

      if (error) throw error;
      
      if (data && data.length > 0) {
        const stats = data[0] as ExerciseStats;
        setExerciseStats(stats);
        setUserRating(stats.pump_score || 0);
        setManual1RM(stats.manual_1rm?.toString() || '');
      } else {
        // No data for this exercise yet
        setExerciseStats({
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          manual_1rm: null,
          manual_1rm_updated_at: null,
          calculated_1rm: null,
          best_1rm: null,
          total_sets: 0,
          avg_weight: null,
          avg_reps: null,
          last_performed: null,
          pump_score: null,
          notes: null
        });
      }
    } catch (error) {
      console.error('Error fetching exercise stats:', error);
    }
  };

  const handleRatingChange = async (newRating: number) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to rate exercises.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('ratings')
        .upsert({
          user_id: user.id,
          exercise_id: exercise.id,
          pump_score: newRating
        }, {
          onConflict: 'user_id,exercise_id'
        });

      if (error) throw error;

      setUserRating(newRating);
      if (exerciseStats) {
        setExerciseStats({ ...exerciseStats, pump_score: newRating });
      }
      
      toast({
        title: "Rating saved",
        description: `You rated ${exercise.name} ${newRating} stars.`
      });
    } catch (error) {
      console.error('Error saving rating:', error);
      toast({
        title: "Error",
        description: "Failed to save rating. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave1RM = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const weight = parseFloat(manual1RM);
      if (isNaN(weight) || weight <= 0) {
        toast({
          title: "Invalid weight",
          description: "Please enter a valid weight.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('ratings')
        .upsert({
          user_id: user.id,
          exercise_id: exercise.id,
          manual_1rm: weight,
          manual_1rm_updated_at: new Date().toISOString(),
          pump_score: userRating || null
        }, {
          onConflict: 'user_id,exercise_id'
        });

      if (error) throw error;

      setEditing1RM(false);
      await fetchExerciseStats(); // Refresh data
      
      toast({
        title: "1RM updated",
        description: `Manual 1RM set to ${weight}kg for ${exercise.name}.`
      });
    } catch (error) {
      console.error('Error saving 1RM:', error);
      toast({
        title: "Error",
        description: "Failed to save 1RM. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const format1RM = (weight: number | null) => {
    return weight ? `${weight.toFixed(1)}kg` : 'N/A';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{exercise.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Exercise GIF */}
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            {exercise.gif_url ? (
              <img
                src={exercise.gif_url}
                alt={exercise.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No exercise demonstration available
              </div>
            )}
          </div>

          {/* Exercise Stats Section */}
          {exerciseStats && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Your Performance Stats</h3>
              
              {/* 1RM Section */}
              <div className="bg-primary/5 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-primary" />
                    <h4 className="font-medium">One Rep Max (1RM)</h4>
                  </div>
                  {!editing1RM && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing1RM(true)}
                      className="text-primary"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                
                {editing1RM ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="manual-1rm">Manual 1RM (kg)</Label>
                      <Input
                        id="manual-1rm"
                        type="number"
                        step="0.5"
                        value={manual1RM}
                        onChange={(e) => setManual1RM(e.target.value)}
                        placeholder="Enter your 1RM in kg"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave1RM} disabled={loading}>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setEditing1RM(false);
                          setManual1RM(exerciseStats.manual_1rm?.toString() || '');
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Current 1RM</p>
                      <p className="text-2xl font-bold text-primary">
                        {format1RM(exerciseStats.best_1rm)}
                      </p>
                      {exerciseStats.manual_1rm && (
                        <p className="text-xs text-muted-foreground">
                          Manual override set {formatDate(exerciseStats.manual_1rm_updated_at)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Calculated 1RM</p>
                      <p className="text-lg font-semibold">
                        {format1RM(exerciseStats.calculated_1rm)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Based on recent sets
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Total Sets</p>
                  </div>
                  <p className="text-lg font-semibold">{exerciseStats.total_sets}</p>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Avg Weight</p>
                  </div>
                  <p className="text-lg font-semibold">
                    {exerciseStats.avg_weight ? `${exerciseStats.avg_weight.toFixed(1)}kg` : 'N/A'}
                  </p>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Avg Reps</p>
                  </div>
                  <p className="text-lg font-semibold">
                    {exerciseStats.avg_reps ? exerciseStats.avg_reps.toFixed(1) : 'N/A'}
                  </p>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground">Last Done</p>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatDate(exerciseStats.last_performed)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Primary Muscles */}
          {exercise.primary_muscles && exercise.primary_muscles.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Primary Muscles</h3>
              <div className="flex flex-wrap gap-2">
                {exercise.primary_muscles.map((muscle, index) => (
                  <Badge key={index} variant="secondary">
                    {muscle}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Muscle Chart - Simple visual representation */}
          <div>
            <h3 className="font-semibold mb-2">Muscle Groups</h3>
            <div className="grid grid-cols-3 gap-2">
              {MUSCLE_GROUPS.map((muscle) => {
                const isTargeted = exercise.primary_muscles?.some(pm => 
                  pm.toLowerCase().includes(muscle.toLowerCase())
                );
                return (
                  <div
                    key={muscle}
                    className={`p-2 rounded-lg text-center text-sm font-medium ${
                      isTargeted 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {muscle.charAt(0).toUpperCase() + muscle.slice(1)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Average Rating Display */}
          {exercise.average_pump_score !== null && (
            <div>
              <h3 className="font-semibold mb-2">Community Rating</h3>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(exercise.average_pump_score!) 
                          ? 'fill-primary text-primary' 
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {exercise.average_pump_score.toFixed(1)} average
                </span>
              </div>
            </div>
          )}

          {/* User Rating */}
          <div>
            <h3 className="font-semibold mb-2">Your Rating</h3>
            <div className="flex items-center gap-2">
              <StarRating 
                rating={userRating} 
                onRatingChange={handleRatingChange}
              />
              {userRating > 0 && (
                <span className="text-sm text-muted-foreground">
                  You rated this {userRating} star{userRating !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {loading && (
              <p className="text-sm text-muted-foreground mt-1">Saving...</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};