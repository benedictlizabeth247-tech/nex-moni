
"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronLeft, 
  MessageSquare, 
  Phone, 
  Mail, 
  FileText, 
  Search,
  ShieldCheck,
  Zap,
  CreditCard,
  UserCheck
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BottomNav } from '@/components/layout/BottomNav'
import { createClient } from '@/lib/supabase/client'
import { NexLogo } from '@/components/ui/NexLogo'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const FAQ_CATEGORIES = [
  {
    category: "Account & Security",
    icon: <ShieldCheck size={18} className="text-primary" />,
    items: [
      { 
        q: "How do I upgrade my account to nex Elite?", 
        a: "To upgrade to nex Elite, you simply need to maintain a minimum average balance of ₦500,000 for three consecutive months. Alternatively, you can complete the advanced KYC verification in your profile settings to unlock higher transaction limits immediately." 
      },
      { 
        q: "Is my money safe with nex Monie?", 
        a: "Absolutely. All deposits with nex Monie are fully insured by the Nigeria Deposit Insurance Corporation (NDIC) up to the maximum legal limit. Furthermore, we use bank-grade AES-256 encryption to protect your data and offer multi-factor authentication for every transaction." 
      },
      { 
        q: "What should I do if I lose my phone?", 
        a: "If your device is lost or stolen, please contact our emergency response line (+234 800 NEX HELP) immediately from another device. We can remotely de-authorize your session and lock your account within seconds to prevent unauthorized access." 
      }
    ]
  },
  {
    category: "Transactions & Fees",
    icon: <Zap size={18} className="text-accent" />,
    items: [
      { 
        q: "How long do transfers take to reach other banks?", 
        a: "Internal nex-to-nex transfers are always instant. Transfers to other Nigerian banks are processed via NIP and typically arrive within 30 seconds to 2 minutes. On rare occasions, banking network congestion may cause delays of up to 30 minutes." 
      },
      { 
        q: "What are the transaction fees?", 
        a: "We believe in transparency. All nex-to-nex transfers are 100% free. For transfers to other banks, nex Basic users pay ₦10 after the first 3 free transfers each month. nex Elite and Premium members enjoy unlimited free transfers." 
      }
    ]
  },
  {
    category: "Savings & NexVault",
    icon: <CreditCard size={18} className="text-emerald-500" />,
    items: [
      { 
        q: "How does NexVault work?", 
        a: "NexVault is our premium fixed-deposit feature. It allows you to lock away funds for a period of 3, 6, or 12 months. During this time, your money earns a highly competitive interest rate of up to 18.5% per annum, paid directly into your wallet upon maturity." 
      },
      { 
        q: "Can I withdraw from my savings early?", 
        a: "For regular daily savings, you can withdraw at any time for free. For NexVault (Fixed) accounts, early liquidation is possible but will result in a 25% forfeiture of the accrued interest to date. The principal amount always remains safe." 
      }
    ]
  }
]

export default function SupportPage() {
  const router = useRouter()
  const [chatOpen, setChatOpen] = useState(false)
  const [ticketsOpen, setTicketsOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [tickets, setTickets] = useState<Array<{id:string;subject:string;status:string;category:string;updated_at:string}>>([])
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [ticketMessages, setTicketMessages] = useState<Array<{id:string;sender_role:string;body:string;created_at:string}>>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadTickets = async () => {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data, error: ticketError } = await supabase.from('support_tickets').select('id,subject,status,category,updated_at').eq('user_id', uid).order('updated_at', { ascending: false })
    if (ticketError) throw ticketError
    setTickets((data ?? []) as typeof tickets)
  }

  const loadMessages = async (ticketId: string) => {
    const supabase = createClient()
    const { data, error: messageError } = await supabase.from('support_messages').select('id,sender_role,body,created_at').eq('ticket_id', ticketId).order('created_at', { ascending: true })
    if (messageError) throw messageError
    setTicketMessages((data ?? []) as typeof ticketMessages)
  }

  useEffect(() => { void loadTickets().catch(() => {}) }, [])

  useEffect(() => {
    if (!selectedTicket) return
    void loadMessages(selectedTicket).catch(() => {})
    const supabase = createClient()
    const channel = supabase.channel(`support-${selectedTicket}`).on('postgres_changes', { event:'INSERT', schema:'public', table:'support_messages', filter:`ticket_id=eq.${selectedTicket}` }, payload => setTicketMessages(prev => prev.some(m => m.id === String(payload.new.id)) ? prev : [...prev, payload.new as any])).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [selectedTicket])

  const startConversation = async () => {
    if (subject.trim().length < 3 || message.trim().length < 1) { setError('Enter a subject and message.'); return }
    setBusy(true); setError('')
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('support_create_ticket', { p_subject: subject.trim(), p_category: 'general', p_message: message.trim() })
      if (rpcError) throw rpcError
      setSubject(''); setMessage(''); setChatOpen(false); setTicketsOpen(true); await loadTickets(); const id = String((data as any)?.id ?? ''); if (id) setSelectedTicket(id)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start conversation.') } finally { setBusy(false) }
  }

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim()) return
    setBusy(true); setError('')
    try { const supabase = createClient(); const { error: rpcError } = await supabase.rpc('support_add_message', { p_ticket_id: selectedTicket, p_body: reply.trim() }); if (rpcError) throw rpcError; setReply(''); await loadMessages(selectedTicket); await loadTickets() }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to send message.') } finally { setBusy(false) }
  }

  return (
    <main className="min-h-screen pb-32 bg-[#F8FAF9]">
      <header className="px-4 pt-6 pb-6 bg-white sticky top-0 z-20 border-b border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-primary hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <NexLogo />
          <div className="w-10" />
        </div>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
          <Input 
            placeholder="Search for topics, guides or help..." 
            className="pl-12 h-14 rounded-2xl bg-gray-50 border-none shadow-inner text-[15px] focus-visible:ring-1 focus-visible:ring-primary/20" 
          />
        </div>
      </header>

      <div className="px-4 py-8">
        <div className="mb-10 text-center px-4">
          <h1 className="text-[28px] font-bold text-[#1A1A1A] mb-2 leading-tight">Help Center</h1>
          <p className="text-gray-500 text-[15px] font-medium leading-relaxed">
            Our expert support team is available 24/7 to assist you with any inquiries or issues.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-10">
          <ContactCard onClick={() => { setChatOpen(true); setTicketsOpen(false); setError('') }}
            icon={<MessageSquare className="text-primary" />} title="Live Chat" subtitle="Start a conversation" />
          <ContactCard 
            icon={<Phone className="text-accent" />} 
            title="Call Us" 
            subtitle="Toll-free 24/7" 
          />
          <ContactCard 
            icon={<Mail className="text-blue-500" />} 
            title="Email Support" 
            subtitle="Get help from our support team" 
            onClick={() => router.push('/admin-login')} 
          />
          <ContactCard onClick={() => { setTicketsOpen(true); setChatOpen(false); setError(''); void loadTickets().catch(e => setError(e.message)) }}
            icon={<FileText className="text-emerald-500" />} title="My Tickets" subtitle="View history" />
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
        {chatOpen && <Card className="mb-8 rounded-[28px] border-none bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between"><div><h2 className="text-[18px] font-bold text-[#1A1A1A]">Start a conversation</h2><p className="mt-1 text-[11px] text-gray-400">Send your request and continue the conversation here.</p></div><button onClick={() => setChatOpen(false)} className="text-gray-400">×</button></div>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="What do you need help with?" className="mt-4 h-12 w-full rounded-xl bg-gray-50 px-3 text-sm outline-none" />
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe the issue or question" className="mt-2 min-h-28 w-full rounded-xl bg-gray-50 p-3 text-sm outline-none" />
          <button disabled={busy} onClick={() => void startConversation()} className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white">{busy ? 'Sending…' : 'Send message'}</button>
        </Card>}
        {ticketsOpen && <Card className="mb-8 rounded-[28px] border-none bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between"><h2 className="text-[18px] font-bold text-[#1A1A1A]">My conversations</h2><button onClick={() => setTicketsOpen(false)} className="text-gray-400">×</button></div>
          <div className="mt-4 space-y-2">{tickets.map(t => <button key={t.id} onClick={() => setSelectedTicket(t.id)} className={`w-full rounded-2xl p-3 text-left ${selectedTicket===t.id?'bg-primary/10':'bg-gray-50'}`}><div className="flex justify-between gap-2"><b className="truncate text-xs">{t.subject}</b><span className="text-[9px] text-primary">{t.status}</span></div><p className="mt-1 text-[9px] text-gray-400">{t.category} · {new Date(t.updated_at).toLocaleString()}</p></button>)}{!tickets.length&&<p className="py-6 text-center text-xs text-gray-400">No conversations yet.</p>}</div>
          {selectedTicket && <div className="mt-4 border-t border-gray-100 pt-4"><div className="max-h-56 space-y-2 overflow-y-auto">{ticketMessages.map(m => <div key={m.id} className={`max-w-[82%] rounded-2xl px-3 py-2 text-[10px] ${m.sender_role==='user'?'ml-auto bg-primary text-white':'bg-gray-100 text-[#1A1A1A]'}`}><p>{m.body}</p><span className="mt-1 block text-[8px] opacity-60">{new Date(m.created_at).toLocaleString()}</span></div>)}</div><div className="mt-3 flex gap-2"><input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply" className="h-11 min-w-0 flex-1 rounded-xl bg-gray-50 px-3 text-[10px] outline-none"/><button disabled={busy} onClick={() => void sendReply()} className="rounded-xl bg-primary px-4 text-[10px] font-black text-white">Send</button></div></div>}
        </Card>}

        <h2 className="text-[18px] font-bold text-[#1A1A1A] mb-6 flex items-center gap-2">
          Frequently Asked Questions
        </h2>

        <div className="space-y-8">
          {FAQ_CATEGORIES.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                {cat.icon}
                <h3 className="text-[14px] font-bold text-gray-500 uppercase tracking-widest">{cat.category}</h3>
              </div>
              
              <Card className="border-none shadow-soft rounded-[24px] bg-white overflow-hidden">
                <Accordion type="single" collapsible className="w-full">
                  {cat.items.map((item, i) => (
                    <AccordionItem key={i} value={`item-${catIdx}-${i}`} className="border-gray-50 px-5 last:border-0">
                      <AccordionTrigger className="text-[15px] font-bold text-left hover:no-underline hover:text-primary transition-colors py-5">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-[14px] leading-relaxed text-gray-500 pb-5">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-primary/5 rounded-[32px] border border-primary/10 text-center">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="text-white" size={24} />
          </div>
          <h3 className="text-[18px] font-bold text-primary mb-2">Still need help?</h3>
          <p className="text-gray-500 text-[14px] mb-6 px-4">
            If you couldn't find what you were looking for, our community and agents are always ready.
          </p>
          <button className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all">
            Start a Conversation
          </button>
        </div>
      </div>

      <BottomNav />
    </main>
  )
}

function ContactCard({ icon, title, subtitle, onClick }: { icon: React.ReactNode, title: string, subtitle: string, onClick?: () => void }) {
  return (
    <Card onClick={onClick} onKeyDown={(event) => { if (onClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick() } }} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} className="p-5 border-none shadow-soft rounded-[24px] bg-white flex flex-col items-center text-center gap-3 active:scale-95 hover:shadow-md transition-all cursor-pointer">
      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
        {React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, { size: 24 })}
      </div>
      <div>
        <h3 className="text-[14px] font-bold text-[#1A1A1A] mb-0.5">{title}</h3>
        <p className="text-[11px] text-gray-400 font-medium">{subtitle}</p>
      </div>
    </Card>
  )
}
