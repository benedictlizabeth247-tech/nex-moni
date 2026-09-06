import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('query')?.trim()
  if (!query) return NextResponse.json([])

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const safe = query.replace(/[%_]/g, '\\$&')
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nex_user_id, display_name, email, photo_url')
    .or(`nex_user_id.eq.${safe},display_name.ilike.%${safe}%,email.ilike.%${safe}%`)
    .neq('id', auth.user.id)
    .eq('status', 'active')
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(profile => ({
    id: profile.id,
    displayName: profile.display_name,
    username: profile.display_name || profile.email?.split('@')[0] || 'nex user',
    nexUserId: profile.nex_user_id,
    photoURL: profile.photo_url || '',
  })))
}
