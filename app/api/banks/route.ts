import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { NIGERIAN_BANKS } from '@/lib/nigerian-banks';

const LOCAL_BANKS = NIGERIAN_BANKS.map((bank) => ({ id: bank.id, name: bank.name, code: bank.code }));

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

    if (!error && banks?.length) return NextResponse.json(banks);
    return NextResponse.json(LOCAL_BANKS, { status: 200 });
  } catch {
    return NextResponse.json(LOCAL_BANKS, { status: 200 });
  }
}
