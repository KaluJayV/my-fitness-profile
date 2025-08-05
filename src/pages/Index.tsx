import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Dumbbell } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">G(ai)ns</h1>
          <p className="text-xl text-muted-foreground">Your AI-powered fitness companion</p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
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
                <Dumbbell className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Generate Workouts</CardTitle>
              <CardDescription>
                Get AI-generated workout plans tailored to your profile and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full text-base py-6" variant="outline" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
