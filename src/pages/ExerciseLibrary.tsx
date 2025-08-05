import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ExerciseDetail } from "@/components/ExerciseDetail";
import { NavigationHeader } from "@/components/NavigationHeader";

interface Exercise {
  id: number;
  name: string;
  gif_url: string | null;
  primary_muscles: string[] | null;
  average_pump_score: number | null;
}

const ExerciseLibrary = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    const filtered = exercises.filter(exercise =>
      exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.primary_muscles?.some(muscle =>
        muscle.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    setFilteredExercises(filtered);
  }, [searchTerm, exercises]);

  const fetchExercises = async () => {
    try {
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*');

      if (exercisesError) throw exercisesError;

      // Fetch average pump scores for each exercise
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('exercise_id, pump_score');

      if (ratingsError) throw ratingsError;

      // Calculate average pump scores
      const pumpScoreMap = new Map();
      ratingsData?.forEach((rating) => {
        if (!pumpScoreMap.has(rating.exercise_id)) {
          pumpScoreMap.set(rating.exercise_id, []);
        }
        if (rating.pump_score !== null) {
          pumpScoreMap.get(rating.exercise_id).push(rating.pump_score);
        }
      });

      const exercisesWithScores = exercisesData?.map((exercise) => {
        const scores = pumpScoreMap.get(exercise.id) || [];
        const averageScore = scores.length > 0 
          ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length 
          : null;
        
        return {
          ...exercise,
          average_pump_score: averageScore
        };
      }) || [];

      setExercises(exercisesWithScores);
      setFilteredExercises(exercisesWithScores);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationHeader title="Exercise Library" />
        <div className="p-4">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
            <div className="h-10 bg-muted rounded mb-6"></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted rounded"></div>
              ))}
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationHeader title="Exercise Library" />
      <div className="p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">Browse Exercises</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search exercises or muscle groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
            </div>
          </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredExercises.map((exercise) => (
            <Card 
              key={exercise.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedExercise(exercise)}
            >
              <CardContent className="p-4">
                <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
                  {exercise.gif_url ? (
                    <img
                      src={exercise.gif_url}
                      alt={exercise.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                
                <h3 className="font-semibold mb-2 line-clamp-2">{exercise.name}</h3>
                
                {exercise.primary_muscles && exercise.primary_muscles.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {exercise.primary_muscles.slice(0, 3).map((muscle, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {muscle}
                      </Badge>
                    ))}
                    {exercise.primary_muscles.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{exercise.primary_muscles.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                
                {exercise.average_pump_score !== null && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3 w-3 fill-primary text-primary" />
                    <span>{exercise.average_pump_score.toFixed(1)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredExercises.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No exercises found matching your search.</p>
          </div>
        )}

        {selectedExercise && (
          <ExerciseDetail 
            exercise={selectedExercise}
            open={!!selectedExercise}
            onOpenChange={(open) => !open && setSelectedExercise(null)}
          />
        )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseLibrary;