
'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * useDoc - Real-time Supabase Single Row Subscriber.
 * Handles network failures and row deletions gracefully.
 */
export function useDoc<T = any>(config: { table: string; id: string } | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!config || !config.id) {
      setLoading(false);
      return;
    }

    const fetchDoc = async () => {
      try {
        const { data: item, error: err } = await supabase
          .from(config.table)
          .select('*')
          .eq('id', config.id)
          .single();

        if (err) throw err;
        setData(item as T);
        setError(null);
      } catch (err: any) {
        // Filter out noisy network errors or "PGRST116" (not found) from UI
        if (err.message !== 'Failed to fetch' && err.code !== 'PGRST116') {
          setError(err);
        }
        if (err.code === 'PGRST116') setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();

    const instanceId = Math.random().toString(36).substring(2, 10);
    const channelName = `doc_${config.table}_${config.id}_${instanceId}`;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: config.table,
        filter: `id=eq.${config.id}`
      }, () => {
        fetchDoc();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [config?.table, config?.id]);

  return { data, loading, error };
}
