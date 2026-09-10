"use client";

import { useState, useEffect, useRef } from 'react';
import { Send } from './icons';
import { Flag, Volume2, VolumeX } from 'lucide-react';
import type { ChatMessage, Room } from '../lib/types';
import { InvitePanel } from './InvitePanel';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUsername: string;
  room: Room;
  isHost: boolean;
  onReportMessage?: (msg: ChatMessage) => void;
}

export function Chat({ 
  messages, 
  onSendMessage, 
  currentUsername,
  onReportMessage
}: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cowatch_chat_sound_enabled');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevMessagesCountRef = useRef<number>(messages.length);
  const isInitialMountRef = useRef<boolean>(true);
  const lastSoundTimeRef = useRef<number>(0);

  // Initialize notification sound effect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio('/sounds/text.mp3');
      audio.volume = 0.55;
      audioRef.current = audio;
    }
  }, []);

  // Persist sound toggle preference
  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('cowatch_chat_sound_enabled', String(next));
      }
      return next;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Trigger notification sound on new incoming messages from other participants
  useEffect(() => {
    scrollToBottom();

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevMessagesCountRef.current = messages.length;
      return;
    }

    if (messages.length > prevMessagesCountRef.current) {
      const newMessages = messages.slice(prevMessagesCountRef.current);
      const hasIncomingParticipantText = newMessages.some(
        msg => msg.userId !== 'system' && msg.username !== currentUsername
      );

      if (hasIncomingParticipantText && soundEnabled && audioRef.current) {
        const now = Date.now();
        if (now - lastSoundTimeRef.current > 250) { // 250ms debounce
          lastSoundTimeRef.current = now;
          try {
            audioRef.current.currentTime = 0;
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
              playPromise.catch(() => {
                // Ignore browser autoplay restriction if user hasn't interacted yet
              });
            }
          } catch (e) {
            // Safe fallback
          }
        }
      }
    }

    prevMessagesCountRef.current = messages.length;
  }, [messages, currentUsername, soundEnabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getThemeColor = (theme?: string) => {
    if (!theme) return 'var(--primary, #8B5CF6)';
    if (theme.startsWith('gradient:')) {
      const parts = theme.split(':');
      return parts[2] || '#8B5CF6';
    }
    if (theme.startsWith('custom:')) {
      const parts = theme.split(':');
      return parts[2] || '#8B5CF6';
    }
    const PRESET_THEMES: Record<string, string> = {
      'default-dark': '#FFFFFF',
      'neo-purple': '#8B5CF6',
      'midnight-blue': '#3B82F6',
      'cyber-green': '#22C55E',
      'warm-minimal': '#F59E0B'
    };
    return PRESET_THEMES[theme] || 'var(--primary, #8B5CF6)';
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg,#0B0B0F)] min-h-0 transition-colors duration-300">
      <div className="flex-1 overflow-hidden relative flex flex-col min-h-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/20 text-xs text-center font-medium">
                No messages yet.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSystem = msg.userId === 'system';
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center w-full my-1 animate-fade-in">
                    <span 
                      className="text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1 rounded-full text-center border"
                      style={{
                        backgroundColor: 'rgba(var(--primary-rgb, 139, 92, 246), 0.08)',
                        borderColor: 'rgba(var(--primary-rgb, 139, 92, 246), 0.2)',
                        color: 'var(--primary, #FFFFFF)'
                      }}
                    >
                      {msg.message}
                    </span>
                  </div>
                );
              }

              const isOwnMessage = msg.username === currentUsername;
              const themeColor = getThemeColor(msg.theme);
              
              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col gap-1.5 ${isOwnMessage ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span 
                      className="text-[10px] font-bold uppercase tracking-widest transition-colors"
                      style={{ color: isOwnMessage ? 'var(--primary, #FFFFFF)' : (msg.theme ? themeColor : 'rgba(255, 255, 255, 0.5)') }}
                    >
                      {msg.username} {isOwnMessage && <span className="opacity-60 text-[9px] lowercase font-normal">(you)</span>}
                    </span>
                    <span className="text-[9px] font-medium text-white/30">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div className={`flex items-center gap-2 max-w-[85%] group/msg w-full ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div 
                      className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed transition-all duration-300 shadow-md"
                      style={isOwnMessage ? {
                        background: 'var(--primary-gradient, var(--primary))',
                        color: 'var(--primary-foreground, #FFFFFF)',
                        boxShadow: '0 4px 16px rgba(var(--primary-rgb, 139, 92, 246), 0.25)'
                      } : msg.theme ? { 
                        backgroundColor: `${themeColor}15`,
                        borderColor: `${themeColor}40`,
                        borderWidth: '1px',
                        color: '#FFFFFF',
                        boxShadow: `0 2px 12px ${themeColor}15`
                      } : {
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderWidth: '1px',
                        color: 'rgba(255, 255, 255, 0.9)'
                      }}
                    >
                      <p className="break-words font-medium">{msg.message}</p>
                    </div>
                    {!isOwnMessage && (
                      <button
                        onClick={() => onReportMessage?.(msg)}
                        title="Report Message"
                        className="opacity-0 group-hover/msg:opacity-100 p-1 hover:bg-white/5 rounded text-white/30 hover:text-yellow-500 transition-all cursor-pointer shrink-0"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t border-white/5 bg-[var(--bg,#0B0B0F)] transition-colors duration-300">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              title={soundEnabled ? "Chat Notification Sound: Enabled (Click to Mute)" : "Chat Notification Sound: Muted (Click to Enable)"}
              className={`p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
                soundEnabled 
                  ? "bg-white/[0.04] border-white/10 text-white/70 hover:text-white hover:bg-white/10" 
                  : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message..."
              className="flex-1 bg-white/[0.03] min-h-[44px] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--primary)] transition-all font-medium"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-all disabled:opacity-20 shadow-md group cursor-pointer"
              style={{ background: 'var(--primary-gradient, var(--primary))', color: 'var(--primary-foreground, #ffffff)' }}
            >
              <Send className="w-4 h-4 text-inherit transition-transform group-hover:scale-110" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}