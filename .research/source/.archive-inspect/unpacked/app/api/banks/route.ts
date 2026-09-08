import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EMPTY_BANKS: Array<{ id: string; name: string }> = [];

/**
 * GET /api/banks
 * Fetches the list of banks from Supabase PostgreSQL.
 * Never fabricates bank data. If the operational bank directory is unavailable, returns an empty list.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: banks, error } = await supabase
      .from('banks')
      .select('*')
      .order('name', { ascending: true });

    if (error || !banks) {
      return NextResponse.json(EMPTY_BANKS, { status: 200 });
    }

    return NextResponse.json(banks);
  } catch (error: any) {
    return NextResponse.json(EMPTY_BANKS, { status: 200 });
  }
}
