"use client";

import React, { useState } from "react";
import { Modal } from "./ui/modal";
import { Mic, Volume2, Sliders, AudioLines, Settings2 } from "lucide-react";
import { Button } from "./ui/button";

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceSettingsModal({ isOpen, onClose }: VoiceSettingsModalProps) {
  // Mock Audio Devices
  const mockInputDevices = [
    { id: "default-in", label: "Default Microphone (System)" },
    { id: "scarlett-in", label: "Scarlett Solo USB (Focusrite Audio)" },
    { id: "builtin-in", label: "Built-in Microphone (Realtek High Definition)" },
    { id: "webcam-in", label: "HD Web Camera Microphone" },
  ];

  const mockOutputDevices = [
    { id: "default-out", label: "Default Speaker (System)" },
    { id: "realtek-out", label: "Realtek Speakers (Built-in Audio)" },
    { id: "headphone-out", label: "Stereo Headphones (External USB Audio)" },
    { id: "hdmi-out", label: "NVIDIA HDMI High Definition Audio" },
  ];

  // Local settings states
  const [inputDevice, setInputDevice] = useState("default-in");
  const [outputDevice, setOutputDevice] = useState("default-out");
  const [inputVolume, setInputVolume] = useState(80);
  const [outputVolume, setOutputVolume] = useState(85);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(false);

  const handleReset = () => {
    setInputDevice("default-in");
    setOutputDevice("default-out");
    setInputVolume(80);
    setOutputVolume(85);
    setEchoCancellation(true);
    setNoiseSuppression(true);
    setAutoGainControl(false);
  };

  const footer = (
    <div className="flex w-full items-center justify-between">
      <Button
        variant="ghost"
        onClick={handleReset}
        className="text-white/40 hover:text-white hover:bg-white/5 font-semibold text-xs uppercase tracking-wider"
      >
        Reset Defaults
      </Button>
      <button
        onClick={onClose}
        className="btn-primary min-w-[120px] font-bold"
      >
        Done
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Voice Settings"
      description="Configure your audio hardware and software processing parameters."
      footer={footer}
    >
      <div className="space-y-6 text-left select-none">
        {/* Section 1: Devices */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--primary)] flex items-center gap-1.5 border-b border-white/5 pb-1.5">
            <Settings2 className="w-3.5 h-3.5 text-[var(--primary)]" /> Hardware Setup
          </h3>
          
          <div className="space-y-4">
            {/* Input Device Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/60 flex items-center gap-1.5">
                <Mic className="w-3 h-3 text-white/40" /> Input Device (Microphone)
              </label>
              <select
                value={inputDevice}
                onChange={(e) => setInputDevice(e.target.value)}
                className="w-full bg-[#161620] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"
              >
                {mockInputDevices.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Output Device Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/60 flex items-center gap-1.5">
                <Volume2 className="w-3 h-3 text-white/40" /> Output Device (Speakers/Headphones)
              </label>
              <select
                value={outputDevice}
                onChange={(e) => setOutputDevice(e.target.value)}
                className="w-full bg-[#161620] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[var(--primary)] transition-colors cursor-pointer"
              >
                {mockOutputDevices.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Volume Levels */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--primary)] flex items-center gap-1.5 border-b border-white/5 pb-1.5">
            <Sliders className="w-3.5 h-3.5 text-[var(--primary)]" /> Volume Levels
          </h3>
          
          <div className="space-y-3">
            {/* Input Volume */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-white/60">Input Volume (Gain)</span>
                <span className="text-[var(--primary)] font-bold">{inputVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={inputVolume}
                onChange={(e) => setInputVolume(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--primary)] my-2"
              />
            </div>

            {/* Output Volume */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-white/60">Output Volume</span>
                <span className="text-[var(--primary)] font-bold">{outputVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={outputVolume}
                onChange={(e) => setOutputVolume(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[var(--primary)] my-2"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Audio Processing Toggles */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--primary)] flex items-center gap-1.5 border-b border-white/5 pb-1.5">
            <AudioLines className="w-3.5 h-3.5 text-[var(--primary)]" /> Audio Processing (DSP)
          </h3>
          
          <div className="space-y-2.5">
            {/* Echo Cancellation Toggle */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
              <div>
                <p className="text-xs font-semibold text-white/90">Echo Cancellation</p>
                <p className="text-[10px] text-white/40">Prevents microphone feedback loop from speakers</p>
              </div>
              <button
                onClick={() => setEchoCancellation(!echoCancellation)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  echoCancellation ? "bg-[var(--primary)]" : "bg-white/10"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ease-in-out ${
                    echoCancellation ? "translate-x-4.5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Noise Suppression Toggle */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
              <div>
                <p className="text-xs font-semibold text-white/90">Noise Suppression</p>
                <p className="text-[10px] text-white/40">Removes background noise and hums</p>
              </div>
              <button
                onClick={() => setNoiseSuppression(!noiseSuppression)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  noiseSuppression ? "bg-[var(--primary)]" : "bg-white/10"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ease-in-out ${
                    noiseSuppression ? "translate-x-4.5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Auto Gain Control Toggle */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
              <div>
                <p className="text-xs font-semibold text-white/90">Automatic Gain Control</p>
                <p className="text-[10px] text-white/40">Dynamically normalizes input microphone level</p>
              </div>
              <button
                onClick={() => setAutoGainControl(!autoGainControl)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  autoGainControl ? "bg-[var(--primary)]" : "bg-white/10"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ease-in-out ${
                    autoGainControl ? "translate-x-4.5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
