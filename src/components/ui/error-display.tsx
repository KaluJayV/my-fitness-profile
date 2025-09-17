import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Wifi, Database, Shield, Clock } from 'lucide-react';

interface ErrorDisplayProps {
  error: string | null;
  context?: string;
  canRetry?: boolean;
  onRetry?: () => void;
  className?: string;
}

interface LoadingStateProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

/**
 * Enhanced error display component with contextual information
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  context,
  canRetry = false,
  onRetry,
  className = ''
}) => {
  if (!error) return null;

  const getErrorIcon = (errorText: string) => {
    if (errorText.includes('network') || errorText.includes('connection')) {
      return <Wifi className="h-4 w-4" />;
    }
    if (errorText.includes('database') || errorText.includes('not found')) {
      return <Database className="h-4 w-4" />;
    }
    if (errorText.includes('permission') || errorText.includes('unauthorized')) {
      return <Shield className="h-4 w-4" />;
    }
    if (errorText.includes('timeout')) {
      return <Clock className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  const getErrorSeverity = (errorText: string): 'default' | 'destructive' => {
    if (errorText.includes('critical') || errorText.includes('permission')) {
      return 'destructive';
    }
    return 'default';
  };

  return (
    <Alert variant={getErrorSeverity(error)} className={className}>
      {getErrorIcon(error)}
      <AlertDescription className="flex flex-col gap-3">
        <div>
          <strong>{context ? `${context}: ` : ''}Error</strong>
          <p className="mt-1">{error}</p>
        </div>
        {canRetry && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="self-start"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

/**
 * Enhanced loading state component
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  isLoading,
  message = 'Loading...',
  className = ''
}) => {
  if (!isLoading) return null;

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="font-medium">{message}</p>
            <p className="text-sm text-muted-foreground">Please wait...</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Error boundary fallback component
 */
export const ErrorBoundaryFallback: React.FC<ErrorBoundaryFallbackProps> = ({
  error,
  resetError,
  context = 'Application'
}) => {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">
            {context} encountered an unexpected error.
          </p>
          <details className="text-left mb-4 p-3 bg-muted rounded text-sm">
            <summary className="cursor-pointer font-medium">Error Details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">
              {error.message}
            </pre>
          </details>
          <Button onClick={resetError} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Inline error message component
 */
export const InlineError: React.FC<{ error: string | null; className?: string }> = ({
  error,
  className = ''
}) => {
  if (!error) return null;

  return (
    <div className={`flex items-center gap-2 text-destructive text-sm ${className}`}>
      <AlertTriangle className="h-4 w-4" />
      <span>{error}</span>
    </div>
  );
};

/**
 * Success feedback component
 */
interface SuccessFeedbackProps {
  message: string;
  visible: boolean;
  className?: string;
}

export const SuccessFeedback: React.FC<SuccessFeedbackProps> = ({
  message,
  visible,
  className = ''
}) => {
  if (!visible) return null;

  return (
    <Alert className={`border-green-200 bg-green-50 ${className}`}>
      <AlertDescription className="text-green-800">
        {message}
      </AlertDescription>
    </Alert>
  );
};