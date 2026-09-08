import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
const schema=z.object({id:z.string().uuid()})
export async function POST(request:Request){const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return NextResponse.json({error:'Authentication required.'},{status:401});const p=schema.safeParse(await request.json().catch(()=>null));if(!p.success)return NextResponse.json({error:'Invalid notification.'},{status:400});const {error}=await client.from('notifications').update({read_at:new Date().toISOString()}).eq('id',p.data.id).eq('user_id',user.id);if(error)return NextResponse.json({error:error.message},{status:422});return NextResponse.json({success:true})}
