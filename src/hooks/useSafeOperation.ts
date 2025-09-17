import { useState, useCallback } from 'react';
import { WorkoutErrorHandler } from '@/utils/WorkoutErrorHandler';

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  lastOperation: string | null;
  retryCount: number;
}

export interface SafeOperationOptions {
  timeout?: number;
  retryable?: boolean;
  requireAuth?: boolean;
  userId?: string | null;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  loadingMessage?: string;
}

/**
 * Hook for managing loading states and safe operations with error handling
 */
export const useSafeOperation = () => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    lastOperation: null,
    retryCount: 0
  });

  const executeOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string,
    options: SafeOperationOptions = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> => {
    const { onSuccess, onError, loadingMessage } = options;

    setLoadingState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      lastOperation: loadingMessage || context,
      retryCount: 0
    }));

    try {
      const safeOperation = WorkoutErrorHandler.createSafeOperation(
        operation,
        context,
        options
      );

      const result = await safeOperation();

      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        error: result.success ? null : result.error || 'Operation failed',
        retryCount: result.success ? 0 : prev.retryCount + 1
      }));

      if (result.success && onSuccess && result.data) {
        onSuccess(result.data);
      } else if (!result.success && onError) {
        onError(result.error || 'Operation failed');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
      
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        retryCount: prev.retryCount + 1
      }));

      if (onError) {
        onError(errorMessage);
      }

      return { success: false, error: errorMessage };
    }
  }, []);

  const retry = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string,
    options: SafeOperationOptions = {}
  ) => {
    return executeOperation(operation, `${context} (Retry)`, options);
  }, [executeOperation]);

  const clearError = useCallback(() => {
    setLoadingState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  const reset = useCallback(() => {
    setLoadingState({
      isLoading: false,
      error: null,
      lastOperation: null,
      retryCount: 0
    });
  }, []);

  return {
    loadingState,
    executeOperation,
    retry,
    clearError,
    reset,
    isLoading: loadingState.isLoading,
    error: loadingState.error,
    hasError: !!loadingState.error,
    canRetry: loadingState.retryCount < 3 && !!loadingState.error
  };
};