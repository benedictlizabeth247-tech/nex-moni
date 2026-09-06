
"use client"

import React, { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { 
  Share2, 
  Copy, 
  Check, 
  Camera, 
  AtSign, 
  MessageCircle, 
  Gift, 
  Sparkles 
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface InviteDialogProps {
  trigger: React.ReactNode
}

export function InviteDialog({ trigger }: InviteDialogProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()
  const referralCode = "NEX-" + Math.random().toString(36).substring(2, 8).toUpperCase()

  const handleCopy = () => {
    navigator.clipboard.writeText(`Join me on nex Monie! Use my code ${referralCode} to get a starter bonus. https://nexmonie.com/join`)
    setCopied(true)
    toast({
      title: "Link Copied!",
      description: "Share it with your friends to start earning.",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-[92vw] sm:max-w-md rounded-[40px] p-0 overflow-hidden border-none shadow-[0_30px_90px_-20px_rgba(0,0,0,0.2)]">
        {/* Elite Gradient Header */}
        <div className="relative h-56 bg-gradient-to-br from-[#005F56] to-[#0D9B85] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
             <div className="absolute top-0 left-0 w-40 h-40 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-[80px]" />
             <div className="absolute bottom-0 right-0 w-60 h-60 bg-accent/20 rounded-full translate-x-1/4 translate-y-1/4 blur-[100px]" />
          </div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 bg-white/10 backdrop-blur-xl rounded-[32px] flex items-center justify-center mb-4 border border-white/20 shadow-2xl">
               <Gift size={48} className="text-white drop-shadow-lg" />
            </div>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full border border-white/20 shadow-sm">
               <Sparkles size={14} className="text-white" />
               <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Elite Rewards Active</span>
            </div>
          </div>
        </div>

        <div className="p-8 text-center bg-white">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-[26px] font-light text-[#1A1A1A] leading-tight text-center">
              Grow the <span className="font-light">nex</span><span className="font-bold">Monie</span> Circle
            </DialogTitle>
            <p className="text-[14px] text-gray-500 font-medium px-4 mt-2 leading-relaxed">
              Invite your trusted network and receive a USD reward for every successful activation.
            </p>
          </DialogHeader>

          <Card className="bg-gray-50/80 border-none p-6 mb-10 rounded-[30px] flex flex-col items-center gap-2 group transition-all">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.25em] mb-1">Your Unique Code</span>
            <div className="flex items-center gap-6">
               <span className="text-[28px] font-black text-primary tracking-tighter">{referralCode}</span>
               <button 
                onClick={handleCopy}
                className="w-12 h-12 rounded-2xl bg-white shadow-soft flex items-center justify-center text-primary active:scale-90 transition-all border border-gray-100/50 hover:shadow-md"
               >
                 {copied ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
               </button>
            </div>
          </Card>

          <div className="grid grid-cols-4 gap-6 mb-2">
             <ShareButton icon={<MessageCircle className="text-emerald-500" />} label="WhatsApp" />
             <ShareButton icon={<Camera className="text-[#E4405F]" />} label="Insta" />
             <ShareButton icon={<AtSign className="text-[#1DA1F2]" />} label="X" />
             <ShareButton icon={<Share2 className="text-gray-400" />} label="More" />
          </div>
        </div>
        
        <div className="p-5 bg-gray-50/50 border-t border-gray-50 flex items-center justify-center">
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">nex Monie Global Rewards Program</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ShareButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className="flex flex-col items-center gap-2 active:scale-95 transition-all group">
      <div className="w-14 h-14 rounded-2xl bg-white shadow-soft flex items-center justify-center group-hover:shadow-lg group-hover:-translate-y-1 transition-all border border-gray-50">
        {React.cloneElement(icon as React.ReactElement<Record<string, unknown>>, { size: 24 })}
      </div>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{label}</span>
    </button>
  )
}
