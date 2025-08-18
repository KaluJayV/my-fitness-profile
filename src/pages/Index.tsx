import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dumbbell, Library, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { TodayWorkouts } from "@/components/TodayWorkouts";
import { QuickAnalytics } from "@/components/QuickAnalytics";
import { AppHeader } from "@/components/AppHeader";
const Index = () => {
  const {
    user
  } = useAuth();
  return <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto p-4 lg:p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Welcome to G(ai)ns</h1>
          <p className="text-xl text-muted-foreground">Your AI-powered fitness companion</p>
          {user && <p className="text-sm text-muted-foreground mt-2">
              Ready to crush your goals, {user.email.split('@')[0]}?
            </p>}
        </div>

        {/* Today's Workouts and Analytics Section */}
        <div className="mb-8 flex justify-center">
          <div className="w-full max-w-2xl space-y-6">
            <TodayWorkouts />
            <QuickAnalytics />
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Dumbbell className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Generate Workouts</CardTitle>
              
            </CardHeader>
            <CardContent className="h-24 flex items-center">
              <Button asChild className="w-full text-base py-6">
                <Link to="/generator">
                  Generate Workouts
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Library className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Exercise Library</CardTitle>
              
            </CardHeader>
            <CardContent className="h-24 flex items-center">
              <Button asChild className="w-full text-base py-6">
                <Link to="/exercises">
                  Browse Exercises
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Workout Calendar</CardTitle>
              
            </CardHeader>
            <CardContent className="h-24 flex items-center">
              <Button asChild className="w-full text-base py-6">
                <Link to="/calendar">
                  View Calendar
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
};
export default Index;