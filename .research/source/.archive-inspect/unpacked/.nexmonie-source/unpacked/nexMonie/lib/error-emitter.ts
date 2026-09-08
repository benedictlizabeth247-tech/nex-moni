'use client';

import { EventEmitter } from 'events';

class ErrorEmitter extends EventEmitter {}

/** App-wide emitter for surfacing data/permission errors (e.g. Supabase RLS denials) to the UI. */
export const errorEmitter = new ErrorEmitter();
