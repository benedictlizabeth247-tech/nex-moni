
'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

/**
 * useUser - Hook to track the current Supabase auth session.
 * Includes resilience against fetch failures during session recovery.
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const finishInitialization = (nextUser: User | null) => {
      if (cancelled || initialized.current) return;
      initialized.current = true;
      setUser(nextUser);
      setLoading(false);
    };

    const timeout = window.setTimeout(() => finishInitialization(null), 4000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => finishInitialization(session?.user ?? null))
      .catch(() => finishInitialization(null));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (initialized.current) {
        setUser(session?.user ?? null);
        return;
      }
      finishInitialization(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
