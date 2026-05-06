"use client";

import { cn } from "./utils";

interface LoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
  fullscreen?: boolean;
}

export function Loader({ className, size = "md", label, fullscreen }: LoaderProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-16 h-16 border-4",
  };

  const loaderContent = (
    <div className={cn("flex flex-col items-center justify-center gap-6", className)}>
      <div className="relative">
        <div
          className={cn(
            "rounded-full border-t-[var(--primary)] border-r-[var(--primary)] border-b-white/5 border-l-white/5 animate-spin",
            sizeClasses[size]
          )}
          style={{
            boxShadow: size === "lg" ? "0 0 40px var(--primary)" : "none",
            animationDuration: "1s",
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
          }}
        />
        {size === "lg" && (
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
        )}
      </div>
      {label && (
        <div
          className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
        >
          <p className={cn(
            "text-white font-black uppercase tracking-[0.3em] italic",
            size === "sm" ? "text-[8px]" : size === "md" ? "text-[10px]" : "text-sm"
          )}>
            {label}
          </p>
          <div className="flex gap-1">
             <div className="w-1 h-1 bg-[var(--primary)] rounded-full animate-bounce [animation-delay:-0.3s]" />
             <div className="w-1 h-1 bg-[var(--primary)] rounded-full animate-bounce [animation-delay:-0.15s]" />
             <div className="w-1 h-1 bg-[var(--primary)] rounded-full animate-bounce" />
          </div>
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0A0A0A] flex items-center justify-center p-6 animate-in fade-in duration-500">
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
}
