import { Crown, User as UserIcon } from 'lucide-react';
import type { User } from '../lib/types';

interface ParticipantsProps {
  participants: User[];
  hostId: string;
}

export function Participants({ participants, hostId }: ParticipantsProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Participants</h3>
          <div className="px-3 py-1 bg-[var(--primary)]/10 rounded-full border border-[var(--primary)]/30">
            <span className="text-[var(--primary)] text-sm font-medium">{participants.length}</span>
          </div>
        </div>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {participants.map((participant) => {
          const isHost = participant.id === hostId;
          return (
            <div 
              key={participant.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                isHost 
                  ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/30' 
                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
              }`}
            >
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isHost 
                  ? 'bg-[var(--primary)] text-[var(--bg)]' 
                  : 'bg-white/10'
              }`}>
                {isHost ? (
                  <Crown className="w-5 h-5 text-white" fill="currentColor" />
                ) : (
                  <UserIcon className="w-5 h-5 text-white" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {participant.name}
                </p>
                {isHost && (
                  <p className="text-[var(--primary)] text-xs font-medium">Host</p>
                )}
              </div>

              {/* Status Indicator */}
              <div className={`w-2 h-2 rounded-full ${
                isHost ? 'bg-[var(--primary)]' : 'bg-white/30'
              }`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}