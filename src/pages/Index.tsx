import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Dumbbell, Library, CalendarDays, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { TodayWorkouts } from "@/components/TodayWorkouts";

const Index = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold mb-4">G(ai)ns</h1>
            <p className="text-xl text-muted-foreground">Your AI-powered fitness companion</p>
            {user && (
              <p className="text-sm text-muted-foreground mt-2">
                Welcome back, {user.email}!
              </p>
            )}
          </div>
          <Button onClick={signOut} variant="outline" size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Today's Workouts Section */}
        <div className="mb-8">
          <TodayWorkouts />
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Set Up Your Profile</CardTitle>
              <CardDescription>
                Configure your fitness goals, experience level, and available equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full text-base py-6">
                <Link to="/profile">
                  Go to Profile
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Library className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Exercise Library</CardTitle>
              <CardDescription>
                Browse and rate exercises with detailed demonstrations and muscle targeting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full text-base py-6" variant="secondary">
                <Link to="/exercises">
                  Browse Exercises
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CalendarDays className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Workout Calendar</CardTitle>
              <CardDescription>
                View your scheduled workouts in a calendar format and track your fitness journey
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full text-base py-6" variant="secondary">
                <Link to="/calendar">
                  View Calendar
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Dumbbell className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Generate Workouts</CardTitle>
              <CardDescription>
                Get AI-generated workout plans tailored to your profile and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full text-base py-6">
                <Link to="/generator">
                  Generate Workouts
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
