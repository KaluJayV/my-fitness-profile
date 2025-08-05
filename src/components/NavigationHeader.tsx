import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, LogOut } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface NavigationHeaderProps {
  title?: string;
  showBack?: boolean;
  showHome?: boolean;
  showSignOut?: boolean;
}

export const NavigationHeader = ({ 
  title, 
  showBack = true, 
  showHome = true, 
  showSignOut = true 
}: NavigationHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  
  const isHomePage = location.pathname === '/';

  return (
    <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        {showBack && !isHomePage && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        
        {showHome && !isHomePage && (
          <Button 
            variant="ghost" 
            size="sm" 
            asChild
            className="flex items-center gap-2"
          >
            <Link to="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
        )}
        
        {title && (
          <h1 className="text-lg font-semibold ml-2">{title}</h1>
        )}
      </div>

      {showSignOut && (
        <Button 
          onClick={signOut} 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      )}
    </div>
  );
};