"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Ghost, Home, ArrowLeft } from "lucide-react";
import { cn } from "./lib/utils";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0A] p-6">
      {/* Ambient brand glow — mirrors Auth / landing pages */}
      <div className="animated-gradient absolute -left-48 top-1/4 h-96 w-96 rounded-full bg-[var(--primary)]/20 blur-3xl" />
      <div
        className="animated-gradient absolute -right-48 bottom-1/4 h-96 w-96 rounded-full bg-[var(--primary)]/20 blur-3xl"
        style={{ animationDelay: "-5s" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass-card relative w-full max-w-md rounded-3xl p-10 text-center"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 14 }}
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)] shadow-xl shadow-[var(--primary)]/20"
        >
          <Ghost size={30} className="text-white" />
        </motion.div>

        <h1 className="bg-gradient-to-r from-[#9333EA] to-[#EC4899] bg-clip-text text-7xl font-extrabold tracking-tight text-transparent">
          404
        </h1>

        <h2 className="heading-section mt-4">This room doesn&apos;t exist</h2>

        <p className="text-body mt-2">
          The page you&apos;re looking for may have ended, moved, or the link is
          broken. Let&apos;s get you back to the watch party.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-primary">
            <Home size={16} /> Back to home
          </Link>
          <button onClick={() => router.back()} className="btn-secondary">
            <ArrowLeft size={16} /> Go back
          </button>
        </div>
      </motion.div>
    </div>
  );
}
