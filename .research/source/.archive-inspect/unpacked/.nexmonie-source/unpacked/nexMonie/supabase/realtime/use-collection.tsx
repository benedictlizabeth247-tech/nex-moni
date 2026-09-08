"use client"

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * useCollection - Real-time Supabase Table Subscriber.
 * Handles network failures and missing tables gracefully.
 */
export function useCollection<T = any>(config: { 
  table: string; 
  userId?: string; 
  order?: string; 
  limit?: number;
  filter?: { column: string; value: any };
} | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!config) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        let query = supabase.from(config.table).select('*');

        if (config.userId) {
          query = query.eq('user_id', config.userId);
        }

        if (config.filter) {
          query = query.eq(config.filter.column, config.filter.value);
        }

        if (config.order) {
          query = query.order(config.order, { ascending: false });
        }

        if (config.limit) {
          query = query.limit(config.limit);
        }

        const { data: items, error: err } = await query;

        // If the error is 42P01 (Table not found), we just set data to empty array
        // to avoid breaking the UI during schema synchronization.
        if (err) {
          if (err.code === '42P01') {
            setData([]);
            return;
          }
          throw err;
        }

        setData((items || []) as T[]);
        setError(null);
      } catch (err: any) {
        // Suppress noisy network errors but log others for tracking
        if (err.message !== 'Failed to fetch') {
          setError(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Unique channel instance ID to prevent callback errors
    const instanceId = Math.random().toString(36).substring(2, 10);
    const channelName = `${config.table}_changes_${instanceId}`;
    
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: config.table,
        ...(config.userId ? { filter: `user_id=eq.${config.userId}` } : {})
      }, () => {
        fetchData();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [
    config?.table, 
    config?.userId, 
    config?.order, 
    config?.limit, 
    JSON.stringify(config?.filter)
  ]);

  return { data, loading, error };
}
