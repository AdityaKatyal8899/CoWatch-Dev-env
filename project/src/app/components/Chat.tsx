import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Share2 } from 'lucide-react';
import type { ChatMessage, Room } from '../lib/types';
import { InvitePanel } from './InvitePanel';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUsername: string;
  room: Room;
  isHost: boolean;
}

export function Chat({ 
  messages, 
  onSendMessage, 
  currentUsername 
}: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  return (
    <div className="flex flex-col h-full bg-[#0B0B0F]">
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/20 text-xs text-center font-medium">
                No messages yet.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwnMessage = msg.username === currentUsername;
              return (
                <div 
                  key={msg.id} 
                  className={`flex flex-col gap-1.5 ${isOwnMessage ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 px-1">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${
                      isOwnMessage ? 'text-[var(--primary)]' : 'text-white/40'
                    }`}>
                      {msg.username}
                    </span>
                    <span className="text-[9px] font-medium text-white/20">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    isOwnMessage 
                      ? 'bg-[var(--primary)] text-[var(--bg)]' 
                      : 'bg-white/[0.03] border border-white/5 text-white/80'
                  }`}>
                    <p className="break-words">{msg.message}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-[#0B0B0F]">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message..."
              className="flex-1 bg-white/[0.03] min-h-[44px] border border-white/5 rounded-lg px-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--primary)]/40 transition-all font-medium"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 disabled:opacity-20 group"
            >
              <Send className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}