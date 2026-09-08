/**
 * @fileOverview Standard hook for managing asynchronous action states.
 */

import { useState, useCallback } from 'react';
import { ActionState, ActionStatus } from '@/types';
import { handleError } from '@/lib/error-handler';

export function useAsync<T = any, Args extends any[] = any[]>(
  asyncFn: (...args: Args) => Promise<T>
) {
  const [state, setState] = useState<ActionState<T>>({
    status: 'idle',
    data: null,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args) => {
      setState((prev) => ({ ...prev, status: 'loading', error: null }));
      try {
        const data = await asyncFn(...args);
        setState({
          status: 'success',
          data,
          error: null,
          timestamp: new Date().toISOString(),
        });
        return data;
      } catch (err: any) {
        const mappedError = handleError(err);
        setState({
          status: 'failed',
          data: null,
          error: mappedError.message,
          timestamp: new Date().toISOString(),
        });
        throw mappedError;
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      data: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isFailed: state.status === 'failed',
  };
}
