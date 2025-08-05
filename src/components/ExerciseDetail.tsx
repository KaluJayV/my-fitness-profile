import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Exercise {
  id: number;
  name: string;
  gif_url: string | null;
  primary_muscles: string[] | null;
  average_pump_score: number | null;
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
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && exercise) {
      fetchUserRating();
    }
  }, [open, exercise]);

  const fetchUserRating = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ratings')
        .select('pump_score')
        .eq('user_id', user.id)
        .eq('exercise_id', exercise.id)
        .maybeSingle();

      if (error) throw error;
      
      setUserRating(data?.pump_score || 0);
    } catch (error) {
      console.error('Error fetching user rating:', error);
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