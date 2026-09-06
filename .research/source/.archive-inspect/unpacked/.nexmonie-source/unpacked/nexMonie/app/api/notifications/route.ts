import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function GET(){const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});const {data,error}=await client.from('notifications').select('id,title,body,kind,entity_type,entity_id,read_at,metadata,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);if(error)return NextResponse.json({error:error.message},{status:422});return NextResponse.json(data||[])}
