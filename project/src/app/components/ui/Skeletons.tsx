"use client";

import { cn } from "../../lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "rect" | "circle" | "text" | "card";
}

export function Skeleton({ className, variant = "rect", style, ...props }: SkeletonProps) {
  return (
    <div
      style={style}
      {...props}
      className={cn(
        "animate-skeleton bg-white/[0.03] overflow-hidden relative",
        variant === "circle" ? "rounded-full" : 
        variant === "card" ? "rounded-2xl" : "rounded-lg",
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
    </div>
  );
}

export function VideoCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-4 border border-white/5 space-y-4">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2 opacity-50" />
      </div>
    </div>
  );
}

export function CollectionRowSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {[1, 2, 3].map((i) => (
        <div key={i} className="w-[300px] shrink-0 glass-card rounded-2xl p-4 border border-white/5 flex gap-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2 opacity-50" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2 w-1/4 opacity-50" />
      </div>
    </div>
  );
}
