import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
const schema=z.object({withdrawalId:z.string().uuid(),status:z.enum(['completed','failed']),providerReference:z.string().trim().min(1).max(200),reason:z.string().trim().max(500).optional()})
export async function POST(request:Request){
 const auth=await createClient();const {data:{user}}=await auth.auth.getUser();if(!user)return NextResponse.json({error:'Admin access required.'},{status:403});
 const admin=createAdminClient();const {data:staff}=await admin.from('admin_staff').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle();if(!staff)return NextResponse.json({error:'Admin access required.'},{status:403});
 const p=schema.safeParse(await request.json().catch(()=>null));if(!p.success)return NextResponse.json({error:'Invalid crypto settlement status.'},{status:400});
 const {data:wdr,error:werr}=await admin.from('withdrawal_requests').select('id,destination_type,status,reservation_status').eq('id',p.data.withdrawalId).single();if(werr||!wdr)return NextResponse.json({error:'Withdrawal not found.'},{status:404});
 if(wdr.destination_type!=='crypto'||wdr.status!=='processing'||wdr.reservation_status!=='reserved')return NextResponse.json({error:'Withdrawal is not awaiting crypto settlement.'},{status:422});
 await admin.from('withdrawal_requests').update({provider_reference:p.data.providerReference,provider_status:p.data.status,admin_note:p.data.reason||null}).eq('id',p.data.withdrawalId);
 if(p.data.status==='completed'){const {data,error}=await admin.rpc('admin_settle_withdrawal',{p_actor_user_id:user.id,p_withdrawal_id:p.data.withdrawalId,p_note:`Crypto provider ${p.data.providerReference} confirmed completion.`});if(error)return NextResponse.json({error:error.message},{status:422});return NextResponse.json(data)}
 const {data,error}=await admin.rpc('admin_fail_withdrawal',{p_actor_user_id:user.id,p_withdrawal_id:p.data.withdrawalId,p_reason:p.data.reason||`Crypto provider ${p.data.providerReference} reported failure.`});if(error)return NextResponse.json({error:error.message},{status:422});return NextResponse.json(data)
}
