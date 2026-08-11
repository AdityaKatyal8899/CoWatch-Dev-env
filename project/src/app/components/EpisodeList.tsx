"use client";

import { ListVideo, Lock, Play } from 'lucide-react';
import type { Video } from '../lib/types';
import { api } from '../lib/api';
import { cn, formatDuration } from '../lib/utils';

interface EpisodeListProps {
  episodes: Video[];
  currentVideoId?: string;
  isHost: boolean;
  onSelect?: (episode: Video) => void;
}

/**
 * Shared episode/playlist rows for collection rooms. Rendered both in the
 * sidebar "Episodes" tab and the player overlay. Host clicks to switch;
 * guests see a read-only queue with the current episode highlighted.
 */
export function EpisodeList({ episodes, currentVideoId, isHost, onSelect }: EpisodeListProps) {
  return (
    <div className="space-y-2">
      {episodes.map((ep) => {
        const isCurrent = ep.video_id === currentVideoId;
        const ready = ep.processing_status === 'ready';
        const clickable = isHost && !isCurrent && ready && !!onSelect;
        return (
          <button
            key={ep.video_id}
            disabled={!clickable}
            onClick={() => onSelect?.(ep)}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl p-2.5 border transition-all text-left",
              isCurrent
                ? "border-[var(--primary)]/40 bg-[var(--primary)]/10"
                : "border-white/5 bg-white/[0.02]",
              clickable
                ? "hover:border-[var(--primary)]/30 hover:bg-white/[0.06] cursor-pointer"
                : isHost ? "opacity-50 cursor-not-allowed" : "cursor-default"
            )}
          >
            <div className="w-16 h-10 rounded-lg bg-[#121212] flex items-center justify-center overflow-hidden shrink-0 border border-white/5">
              {ep.thumbnail_url ? (
                <img src={api.getStreamUrl(ep.thumbnail_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <ListVideo className="w-3.5 h-3.5 text-white/10" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-bold truncate", isCurrent ? "text-[var(--primary)]" : "text-white/70")}>
                {ep.title}
              </p>
              {ep.duration ? (
                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-0.5">
                  {formatDuration(ep.duration)}
                </p>
              ) : null}
            </div>
            {isCurrent && (
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--primary)] flex items-center gap-1 shrink-0">
                <Play className="w-3 h-3" fill="currentColor" /> Now
              </span>
            )}
            {!isHost && (
              <Lock className="w-3.5 h-3.5 text-white/15 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}
