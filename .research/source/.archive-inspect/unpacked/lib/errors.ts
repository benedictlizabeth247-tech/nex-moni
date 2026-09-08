'use client';

export type DataAccessContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

/**
 * Generic data/permission error (e.g. a Supabase RLS policy denial) surfaced to the UI
 * via the app-wide error emitter. Not tied to any specific backend.
 */
export class DataPermissionError extends Error {
  path: string;
  operation: string;
  requestResourceData?: any;

  constructor(context: DataAccessContext) {
    super(`Permission denied: ${context.operation} at ${context.path}`);
    this.name = 'DataPermissionError';
    this.path = context.path;
    this.operation = context.operation;
    this.requestResourceData = context.requestResourceData;
  }
}
