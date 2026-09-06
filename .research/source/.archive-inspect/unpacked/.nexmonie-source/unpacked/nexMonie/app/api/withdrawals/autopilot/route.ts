import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
const schema=z.object({withdrawalId:z.string().uuid()})
export async function POST(request:Request){
 const client=await createClient(); const {data:{user}}=await client.auth.getUser(); if(!user)return NextResponse.json({error:'Authentication required.'},{status:401})
 const parsed=schema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:'Invalid withdrawal.'},{status:400})
 const {data,error}=await client.rpc('route_autopilot_withdrawal',{p_withdrawal_id:parsed.data.withdrawalId}); if(error)return NextResponse.json({error:error.message},{status:422}); return NextResponse.json(data)
}
