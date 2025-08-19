import { useAuth } from "@/contexts/AuthContext";
import { TodayWorkouts } from "@/components/TodayWorkouts";
import { WeeklyProgressTracker } from "@/components/WeeklyProgressTracker";
import { AppHeader } from "@/components/AppHeader";
const Index = () => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto px-6 lg:px-8">
        {/* Hero Section - CRED inspired with crisp typography */}
        <div className="text-center mb-20 pt-12 pb-8">
          <h1 className="typography-hero mb-8">
            crafted for the
            <br />
            <span className="font-normal">committed</span>
          </h1>
          <p className="typography-subtitle max-w-xl mx-auto mb-6">
            exclusive training companion for those serious about progress
          </p>
          {user && (
            <p className="text-xs text-muted-foreground font-light tracking-wide uppercase">
              welcome back, {user.email.split('@')[0]}
            </p>
          )}
        </div>

        {/* Progress Section - Clean and minimal */}
        <div className="mb-20 flex justify-center">
          <div className="w-full max-w-xl space-y-6">
            <TodayWorkouts />
            <WeeklyProgressTracker />
          </div>
        </div>
      </div>
    </div>
  );
};
export default Index;