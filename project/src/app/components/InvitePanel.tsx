"use client";

import { Share2, Copy, Check, QrCode, User as UserIcon, Calendar, Info } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Room } from '../lib/types';
import { api } from '../lib/api';

interface InvitePanelProps {
  room: Room;
  onStart?: () => void;
  isHost: boolean;
  embedded?: boolean;
}

export function InvitePanel({ room, onStart, isHost, embedded = false }: InvitePanelProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Mandatory format: window.location.origin + "/room/" + room_id
  const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/room/${room.room_id}`;
  
  // Mandatory relative path for QR mapped physically to backend
  const rawApiRoute = `/api/rooms/${room.room_id}/qr`;
  const qrCodeUrl = typeof window !== 'undefined' ? api.getStreamUrl(rawApiRoute) : rawApiRoute;

  const copyToClipboard = async (text: string, type: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
      toast.success(`${type === 'link' ? 'Link' : 'Room code'} copied!`);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const content = (
    <div className={`w-full ${embedded ? 'bg-transparent' : 'max-w-md bg-[#121218] rounded-2xl border border-white/5 shadow-2xl'} overflow-hidden`}>
      <div className={`${embedded ? '' : 'p-8'} space-y-8`}>
        {/* Metadata section if embedded */}
        {embedded && (
          <div className="space-y-4 mb-8">
            <div className="aspect-video w-full bg-white/[0.02] rounded-xl flex flex-col items-center justify-center border border-white/5 relative overflow-hidden">
               <div className="z-10 p-2 bg-white rounded-lg shadow-xl shrink-0 mb-3">
                 <img src={qrCodeUrl} alt="Scan to join" className="w-20 h-20" />
               </div>
               <div className="text-white/40 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 justify-center z-10">
                 <QrCode className="w-4 h-4" />
                 Scan to Join
               </div>
               <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="heading-card flex items-center gap-2">
              <Info className="w-4 h-4 text-[var(--primary)]" />
              Quick Share
            </h3>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Anyone with the link can join the synchronized session instantly.
            </p>
          </div>

          <div className="space-y-4">
            {/* Copy Link */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">Invite Link</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2.5 bg-white/[0.03] border border-white/5 rounded-lg text-white/80 text-[11px] font-medium truncate select-all">
                  {inviteLink}
                </div>
                <button
                  onClick={() => copyToClipboard(inviteLink, 'link')}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 group active:scale-95"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-white/20 group-hover:text-white" />}
                </button>
              </div>
            </div>

            {/* Room Code */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">Room Code</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2.5 bg-white/[0.03] border border-white/5 rounded-lg text-white/80 text-xs font-bold tracking-widest uppercase">
                  {room.room_id}
                </div>
                <button
                  onClick={() => copyToClipboard(room.room_id, 'code')}
                  className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 group active:scale-95"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-white/20 group-hover:text-white" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Close Button if not embedded */}
      {!embedded && (
        <div className="px-8 py-4 bg-white/[0.02] border-t border-white/5 flex justify-end">
           <button 
             onClick={() => window.location.reload()} // Quick hack to close modal
             className="text-xs font-bold text-white/40 hover:text-white transition-colors"
           >
             Dismiss
           </button>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      {content}
    </div>
  );
}
