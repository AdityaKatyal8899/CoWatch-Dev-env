"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "default" | "destructive";
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "default",
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100] animate-in fade-in duration-300" />
        <Dialog.Content 
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-24px)] max-w-md max-h-[92dvh] flex flex-col bg-[#0E0E14] border border-white/10 p-4 sm:p-6 rounded-2xl shadow-2xl z-[101] outline-none animate-in zoom-in-95 fade-in duration-300",
            variant === "destructive" ? "border-red-500/20 shadow-red-500/5" : "shadow-purple-500/10",
            className
          )}
        >
          {/* Header - Fixed at top */}
          <div className="flex items-start justify-between gap-3 shrink-0 pb-3 border-b border-white/5">
            <div className="min-w-0 pr-2">
              <Dialog.Title className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-white/50 text-[11px] sm:text-xs mt-0.5 leading-snug">
                  {description}
                </Dialog.Description>
              )}
            </div>
            
            <Dialog.Close asChild>
              <button 
                onClick={onClose}
                className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-xl transition-colors text-white/60 hover:text-white shrink-0 cursor-pointer border border-white/5"
                title="Close"
                aria-label="Close modal"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body - Scrollable inside modal if content exceeds mobile screen height */}
          <div className="flex-1 overflow-y-auto min-h-0 py-3 pr-1 custom-scrollbar">
            {children}
          </div>

          {/* Footer - Fixed at bottom */}
          {footer && (
            <div className="shrink-0 pt-3 border-t border-white/5 flex items-center justify-between gap-2 bg-[#0E0E14]">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmModalProps extends ModalProps {
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      variant={variant}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isLoading} className="font-bold">
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isLoading}
            className="font-bold min-w-[100px]"
          >
            {isLoading ? "Processing..." : confirmLabel}
          </Button>
        </>
      }
    />
  );
}
