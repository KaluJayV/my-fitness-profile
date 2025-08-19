import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, TrendingUp, TrendingDown, Minus, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CoreLiftMax {
  core_lift_type: string;
  exercise_name: string;
  current_1rm: number;
  last_performed: string;
  improvement_30d: number;
}

const CORE_LIFT_ICONS = {
  squat: "🏋️",
  bench: "💪",
  deadlift: "⚡",
  overhead_press: "🚀"
};

const CORE_LIFT_NAMES = {
  squat: "Squat",
  bench: "Bench Press", 
  deadlift: "Deadlift",
  overhead_press: "Overhead Press"
};

export const CoreLiftDashboard = () => {
  const { user } = useAuth();
  const [coreLiftMaxes, setCoreLiftMaxes] = useState<CoreLiftMax[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCoreLiftMaxes();
    }
  }, [user]);

  const fetchCoreLiftMaxes = async () => {
    try {
      if (!user) {
        console.log('CoreLiftDashboard: No user found');
        setCoreLiftMaxes([]);
        return;
      }

      console.log('CoreLiftDashboard: Fetching core lift maxes for user:', user.id);
      
      // Add timestamp to prevent caching issues
      const { data, error } = await supabase
        .rpc('get_current_core_lift_maxes', { p_user_id: user.id });

      console.log('CoreLiftDashboard: Raw data response:', { data, error });

      if (error) {
        console.error('CoreLiftDashboard: Database error:', error);
        throw error;
      }

      const cleanData = data || [];
      console.log('CoreLiftDashboard: Processed data:', cleanData);
      
      // Ensure we clear any stale data
      setCoreLiftMaxes(cleanData);
    } catch (error) {
      console.error('CoreLiftDashboard: Error fetching core lift maxes:', error);
      setCoreLiftMaxes([]); // Clear data on error
    } finally {
      setLoading(false);
    }
  };

  const renderTrendIcon = (improvement: number) => {
    if (improvement > 0) {
      return <TrendingUp className="h-4 w-4 text-success" />;
    } else if (improvement < 0) {
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    }
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getImprovementColor = (improvement: number) => {
    if (improvement > 0) return "text-success";
    if (improvement < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  const getDaysSinceLastPerformed = (lastPerformed: string) => {
    const days = Math.floor((Date.now() - new Date(lastPerformed).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (!user || loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Core Lift Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
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
          <Dumbbell className="h-5 w-5" />
          Core Lift Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {coreLiftMaxes.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {coreLiftMaxes.map((lift) => {
              const daysSince = getDaysSinceLastPerformed(lift.last_performed);
              const isStale = daysSince > 14;
              
              return (
                <div key={lift.core_lift_type} className="space-y-2 p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{CORE_LIFT_ICONS[lift.core_lift_type as keyof typeof CORE_LIFT_ICONS]}</span>
                      <h4 className="font-medium text-sm">{CORE_LIFT_NAMES[lift.core_lift_type as keyof typeof CORE_LIFT_NAMES]}</h4>
                    </div>
                    {renderTrendIcon(lift.improvement_30d)}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-2xl font-bold">{Math.round(lift.current_1rm)}kg</div>
                    <div className={`text-xs ${getImprovementColor(lift.improvement_30d)}`}>
                      {lift.improvement_30d > 0 ? '+' : ''}{Math.round(lift.improvement_30d * 10) / 10}kg (30d)
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Timer className="h-3 w-3" />
                    <span>{daysSince}d ago</span>
                    {isStale && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 ml-1">
                        Stale
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Dumbbell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No core lifts detected</p>
            <p className="text-xs">Perform squats, bench press, deadlifts, or overhead press to see progress</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};