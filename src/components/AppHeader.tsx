import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Home, 
  User, 
  Library, 
  CalendarDays, 
  Dumbbell, 
  BarChart3, 
  Menu,
  ArrowLeft 
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
}

export const AppHeader = ({ title, showBack = false }: AppHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const isHomePage = location.pathname === '/';
  
  const getInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const navigationItems = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/generator", icon: Dumbbell, label: "Generate Workouts" },
    { to: "/exercises", icon: Library, label: "Exercise Library" },
    { to: "/calendar", icon: CalendarDays, label: "Workout Calendar" },
    { to: "/analytics", icon: BarChart3, label: "Analytics" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          {showBack && !isHomePage && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          )}
          
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold hidden sm:inline">G(ai)ns</span>
            </Link>
            
            {title && (
              <>
                <span className="text-muted-foreground hidden sm:inline">/</span>
                <h1 className="text-lg font-semibold">{title}</h1>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Navigation Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <Menu className="h-4 w-4" />
                <span className="hidden md:inline">Navigation</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link 
                      to={item.to} 
                      className={`flex items-center gap-2 ${isActive ? 'bg-accent' : ''}`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {user?.email ? getInitials(user.email) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">Manage your account</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};