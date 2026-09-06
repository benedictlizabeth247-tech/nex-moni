/**
 * @fileOverview Reusable error handling utility for nexMonie.
 */

export type AppErrorType = 
  | 'unauthorized' 
  | 'forbidden' 
  | 'not_found' 
  | 'network_error' 
  | 'validation_error' 
  | 'server_error' 
  | 'timeout' 
  | 'unknown';

export interface AppError {
  type: AppErrorType;
  message: string;
  originalError?: any;
}

export const handleError = (error: any): AppError => {
  // Simulating future Supabase error mapping
  if (error?.message === 'Failed to fetch' || !navigator.onLine) {
    return {
      type: 'network_error',
      message: 'Network unreachable. Please check your connection.',
    };
  }

  if (error?.status === 401) {
    return {
      type: 'unauthorized',
      message: 'Session expired. Please sign in again.',
    };
  }

  return {
    type: 'unknown',
    message: error?.message || 'An unexpected error occurred. Please try again.',
    originalError: error,
  };
};
