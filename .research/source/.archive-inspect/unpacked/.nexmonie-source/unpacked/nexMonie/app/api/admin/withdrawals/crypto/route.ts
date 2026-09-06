import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { custody } from '@/services/custody/index'
const schema=z.object({withdrawalId:z.string().uuid()})
export async function POST(request:Request){
 const auth=await createClient(); const {data:{user}}=await auth.auth.getUser(); if(!user)return NextResponse.json({error:'Admin access required.'},{status:403})
 const admin=createAdminClient(); const {data:staff}=await admin.from('admin_staff').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle(); if(!staff)return NextResponse.json({error:'Admin access required.'},{status:403})
 const parsed=schema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:'Invalid withdrawal.'},{status:400})
 const {data:wdr,error:werr}=await admin.from('withdrawal_requests').select('id,user_id,amount,currency,destination,destination_type,network,status,reservation_status').eq('id',parsed.data.withdrawalId).single(); if(werr||!wdr)return NextResponse.json({error:'Withdrawal not found.'},{status:404})
 if(wdr.destination_type!=='crypto'||wdr.status!=='processing'||wdr.reservation_status!=='reserved')return NextResponse.json({error:'Crypto withdrawal is not ready for settlement.'},{status:422})
 try{
  const result=await custody.createWithdrawal({userId:wdr.user_id,asset:wdr.currency,network:String(wdr.network||''),address:wdr.destination,amount:Number(wdr.amount)})
  const providerReference=String((result as any)?.reference||(result as any)?.id||(result as any)?.withdrawalId||'')
  const providerStatus=String((result as any)?.status||'submitted')
  const {data,error}=await admin.rpc('admin_record_crypto_submission',{p_actor_user_id:user.id,p_withdrawal_id:wdr.id,p_provider_reference:providerReference,p_provider_status:providerStatus,p_provider_metadata:result})
  if(error)throw error
  return NextResponse.json({success:true,submission:data,provider:result})
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Crypto custody submission failed.'},{status:502})}
}
