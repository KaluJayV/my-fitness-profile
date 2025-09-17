import { toast } from 'sonner';

/**
 * Enhanced error handling utilities for workout operations
 */
export class WorkoutErrorHandler {
  private static readonly ERROR_CODES = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    PERMISSION_ERROR: 'PERMISSION_ERROR',
    DATA_CORRUPTION: 'DATA_CORRUPTION',
    MIGRATION_ERROR: 'MIGRATION_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR'
  } as const;

  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // Progressive delays

  /**
   * Handles errors with appropriate user feedback and retry logic
   */
  static async handleError(
    error: any,
    context: string,
    options: {
      retryable?: boolean;
      showToast?: boolean;
      fallbackAction?: () => void;
      onRetry?: () => Promise<any>;
    } = {}
  ): Promise<{ success: boolean; error?: string }> {
    const { retryable = false, showToast = true, fallbackAction, onRetry } = options;

    console.error(`Error in ${context}:`, error);

    const errorInfo = this.categorizeError(error);
    
    if (showToast) {
      this.showErrorToast(errorInfo, context);
    }

    // Attempt retry for retryable errors
    if (retryable && onRetry && this.isRetryableError(errorInfo.code)) {
      const retryResult = await this.attemptRetry(onRetry, context);
      if (retryResult.success) {
        return retryResult;
      }
    }

    // Execute fallback if provided
    if (fallbackAction) {
      try {
        fallbackAction();
      } catch (fallbackError) {
        console.error('Fallback action failed:', fallbackError);
      }
    }

    return { success: false, error: errorInfo.message };
  }

  /**
   * Categorizes errors for appropriate handling
   */
  private static categorizeError(error: any): { 
    code: string; 
    message: string; 
    severity: 'low' | 'medium' | 'high' | 'critical' 
  } {
    // Network/API errors
    if (error.code === 'PGRST116' || error.message?.includes('not found')) {
      return {
        code: this.ERROR_CODES.NETWORK_ERROR,
        message: 'Data not found. It may have been deleted or moved.',
        severity: 'medium'
      };
    }

    if (error.code?.startsWith('PGRST') || error.message?.includes('database')) {
      return {
        code: this.ERROR_CODES.NETWORK_ERROR,
        message: 'Database connection issue. Please check your internet connection.',
        severity: 'high'
      };
    }

    // Permission errors
    if (error.code === '42501' || error.message?.includes('permission')) {
      return {
        code: this.ERROR_CODES.PERMISSION_ERROR,
        message: 'You don\'t have permission to perform this action.',
        severity: 'high'
      };
    }

    // Validation errors
    if (error.message?.includes('validation') || error.message?.includes('invalid')) {
      return {
        code: this.ERROR_CODES.VALIDATION_ERROR,
        message: 'The data format is invalid. Please try regenerating the workout.',
        severity: 'medium'
      };
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return {
        code: this.ERROR_CODES.TIMEOUT_ERROR,
        message: 'The operation timed out. Please try again.',
        severity: 'medium'
      };
    }

    // Default unknown error
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred. Please try again.',
      severity: 'medium'
    };
  }

  /**
   * Shows appropriate toast notification for error
   */
  private static showErrorToast(
    errorInfo: { code: string; message: string; severity: string },
    context: string
  ) {
    const title = this.getErrorTitle(errorInfo.severity as any);
    
    if (errorInfo.severity === 'critical') {
      toast.error(title, {
        description: `${errorInfo.message}\n\nContext: ${context}`,
        duration: 10000,
      });
    } else if (errorInfo.severity === 'high') {
      toast.error(title, {
        description: errorInfo.message,
        duration: 6000,
      });
    } else if (errorInfo.severity === 'medium') {
      toast.error(title, {
        description: errorInfo.message,
        duration: 4000,
      });
    } else {
      toast(errorInfo.message, {
        duration: 3000,
      });
    }
  }

  private static getErrorTitle(severity: 'low' | 'medium' | 'high' | 'critical'): string {
    switch (severity) {
      case 'critical': return 'Critical Error';
      case 'high': return 'Error';
      case 'medium': return 'Warning';
      case 'low': return 'Notice';
      default: return 'Error';
    }
  }

  /**
   * Determines if an error is retryable
   */
  private static isRetryableError(errorCode: string): boolean {
    return [
      this.ERROR_CODES.NETWORK_ERROR,
      this.ERROR_CODES.TIMEOUT_ERROR
    ].includes(errorCode as any);
  }

  /**
   * Attempts retry with exponential backoff
   */
  private static async attemptRetry(
    operation: () => Promise<any>,
    context: string
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    for (let attempt = 0; attempt < this.RETRY_DELAYS.length; attempt++) {
      try {
        toast(`Retrying ${context}... (${attempt + 1}/${this.RETRY_DELAYS.length})`, {
          duration: 2000,
        });

        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAYS[attempt]));
        
        const result = await operation();
        
        toast.success(`${context} succeeded after retry`);
        return { success: true, result };
      } catch (retryError) {
        console.error(`Retry ${attempt + 1} failed:`, retryError);
        
        if (attempt === this.RETRY_DELAYS.length - 1) {
          toast.error(`${context} failed after ${this.RETRY_DELAYS.length} attempts`);
          return { 
            success: false, 
            error: retryError instanceof Error ? retryError.message : 'Retry failed' 
          };
        }
      }
    }

    return { success: false, error: 'All retries failed' };
  }

  /**
   * Wraps async operations with timeout and error handling
   */
  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 30000,
    context: string = 'Operation'
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${context} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      throw new Error(`${context} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates user permissions before operations
   */
  static async validateUserPermissions(
    userId: string | null,
    operation: string
  ): Promise<{ hasPermission: boolean; error?: string }> {
    if (!userId) {
      return {
        hasPermission: false,
        error: 'You must be logged in to perform this action'
      };
    }

    // Add any additional permission checks here
    return { hasPermission: true };
  }

  /**
   * Creates a safe operation wrapper with full error handling
   */
  static createSafeOperation<T>(
    operation: () => Promise<T>,
    context: string,
    options: {
      timeout?: number;
      retryable?: boolean;
      requireAuth?: boolean;
      userId?: string | null;
    } = {}
  ) {
    const { timeout = 30000, retryable = true, requireAuth = false, userId = null } = options;

    return async (): Promise<{ success: boolean; data?: T; error?: string }> => {
      try {
        // Check permissions if required
        if (requireAuth) {
          const permissionCheck = await this.validateUserPermissions(userId, context);
          if (!permissionCheck.hasPermission) {
            return { success: false, error: permissionCheck.error };
          }
        }

        // Execute with timeout
        const result = await this.withTimeout(operation, timeout, context);
        return { success: true, data: result };

      } catch (error) {
        const errorResult = await this.handleError(error, context, {
          retryable,
          onRetry: retryable ? operation : undefined
        });

        return {
          success: errorResult.success,
          error: errorResult.error
        };
      }
    };
  }
}