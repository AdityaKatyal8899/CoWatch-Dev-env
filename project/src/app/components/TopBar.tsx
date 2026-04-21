import { LogOut, Crown, Eye, Link } from 'lucide-react';
import { Play } from 'lucide-react';
import { toast } from 'sonner';

interface TopBarProps {
  roomId: string;
  roomName: string;
  isHost: boolean;
  onLeave: () => void;
}

export function TopBar({ roomId, roomName, isHost, onLeave }: TopBarProps) {
  const copyRoomId = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    toast.success('Invite link copied!');
  };

  return (
    <div className="h-14 bg-[#0B0B0F] border-b border-white/5 px-4 lg:px-6 flex items-center justify-between shrink-0">
      {/* Left: Room Info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[var(--primary)] to-purple-600 shadow-lg shadow-[var(--primary)]/20">
            <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[13px] font-semibold text-white tracking-tight truncate max-w-[120px] sm:max-w-[300px]">{roomName}</h1>
            <p className="text-[10px] text-white/20 font-medium uppercase tracking-widest">Live Room</p>
          </div>
        </div>
      </div>

      {/* Center: Status */}
      <div className={`px-3 py-1 rounded-full flex items-center gap-2 border ${
        isHost 
          ? 'bg-[var(--primary)]/10 border-[var(--primary)]/20 text-[var(--primary)]' 
          : 'bg-white/5 border-white/10 text-white/40'
      }`}>
        {isHost ? (
          <>
            <Crown className="w-3 h-3" />
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Presenter</span>
          </>
        ) : (
          <>
            <Eye className="w-3 h-3" />
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Viewer</span>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        <button
          onClick={copyRoomId}
          title="Copy Link"
          className="p-2 sm:px-4 sm:py-[1px] bg-white/3 border border-white/10 rounded-[8px] text-[11px] font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center shrink-0"
        >
          <span className="hidden sm:inline">Copy Link</span>
          <Link className="w-3.5 h-3.5 sm:hidden" />
        </button>
        <button
          onClick={onLeave}
          title="Exit"
          className="p-2 sm:px-3 sm:py-[6px] bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-[8px] text-red-500 text-[11px] font-semibold transition-all flex items-center gap-2 justify-center shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Exit</span>
        </button>
      </div>
    </div>
  );
}