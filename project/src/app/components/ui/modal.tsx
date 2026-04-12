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
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "default",
}: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] animate-in fade-in duration-300" />
        <Dialog.Content 
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#0D0D0D] border border-white/10 p-6 rounded-2xl shadow-2xl z-[101] outline-none animate-in zoom-in-95 fade-in duration-300",
            variant === "destructive" ? "border-red-500/20 shadow-red-500/5" : "shadow-purple-500/5"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-bold text-white tracking-tight">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {description && (
            <Dialog.Description className="text-white/60 text-sm mb-6 leading-relaxed">
              {description}
            </Dialog.Description>
          )}

          <div className="mb-6">{children}</div>

          {footer && (
            <div className="flex justify-end gap-3 pt-2">
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
            loading={isLoading}
            className="font-bold min-w-[100px]"
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
