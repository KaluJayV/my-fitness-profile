import { useAuth } from "@/contexts/AuthContext";
import { TodayWorkouts } from "@/components/TodayWorkouts";
import { WeeklyProgressTracker } from "@/components/WeeklyProgressTracker";
import { AppHeader } from "@/components/AppHeader";
const Index = () => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container mx-auto p-4 lg:p-6">
        {/* Hero Section - CRED inspired */}
        <div className="text-center mb-16 pt-8 pb-12">
          <h1 className="typography-hero mb-6 animate-fade-up">
            crafted for the
            <br />
            <span className="font-light">committed</span>
          </h1>
          <p className="typography-subtitle max-w-2xl mx-auto mb-8 animate-fade-up" style={{animationDelay: '0.2s'}}>
            G(ai)ns is your exclusive training companion.<br />
            designed for those serious about progress.
          </p>
          {user && (
            <p className="text-sm text-muted-foreground/80 font-light tracking-wide animate-fade-up" style={{animationDelay: '0.4s'}}>
              welcome back, {user.email.split('@')[0]}
            </p>
          )}
        </div>

        {/* Progress Section */}
        <div className="mb-16 flex justify-center animate-fade-up" style={{animationDelay: '0.6s'}}>
          <div className="w-full max-w-2xl space-y-8">
            <TodayWorkouts />
            <WeeklyProgressTracker />
          </div>
        </div>
      </div>
    </div>
  );
};
export default Index;