import { useAuth } from "@/contexts/AuthContext";
import { TodayWorkouts } from "@/components/TodayWorkouts";
import { WeeklyProgressTracker } from "@/components/WeeklyProgressTracker";
import { AppHeader } from "@/components/AppHeader";
const Index = () => {
  const { user, session, loading } = useAuth();

  // Debug: If no user but we're still on this page, force redirect
  if (!loading && !user) {
    window.location.href = '/auth';
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto p-4 lg:p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Welcome to G(ai)ns</h1>
          <p className="text-xl text-muted-foreground">Your AI-powered fitness companion</p>
          {user && (
            <p className="text-sm text-muted-foreground mt-2">
              Ready to crush your goals, {user.email?.split('@')[0]}?
            </p>
          )}
        </div>

        {/* Today's Workouts and Weekly Progress */}
        <div className="mb-8 flex justify-center">
          <div className="w-full max-w-2xl space-y-6">
            <TodayWorkouts />
            <WeeklyProgressTracker />
          </div>
        </div>
      </div>
    </div>
  );
};
export default Index;