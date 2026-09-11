"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal } from "./ui/modal";
import { Mic, Volume2, Sliders, AudioLines, Settings2, Check, RefreshCw, Sparkles, VolumeX } from "lucide-react";
import { Button } from "./ui/button";
import { VoiceSettings, useVoiceSettings, DEFAULT_VOICE_SETTINGS } from "../lib/audioSettings";
import { cn } from "../lib/utils";

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSettings?: VoiceSettings;
  onSettingsChange?: (newSettings: VoiceSettings) => void;
  onDeviceSwitch?: (kind: "audioinput" | "audiooutput", deviceId: string) => void;
}

export function VoiceSettingsModal({
  isOpen,
  onClose,
  activeSettings,
  onSettingsChange,
  onDeviceSwitch,
}: VoiceSettingsModalProps) {
  const {
    settings: hookSettings,
    updateSettings: hookUpdateSettings,
    resetDefaults: hookResetDefaults,
    inputDevices,
    outputDevices,
    isLoadingDevices,
    refreshDevices,
  } = useVoiceSettings();

  // Prefer activeSettings passed from parent (e.g. VoiceSidebar), fallback to local hook state
  const currentSettings = activeSettings || hookSettings;

  const handleUpdate = (partial: Partial<VoiceSettings>) => {
    const next = { ...currentSettings, ...partial };
    if (onSettingsChange) {
      onSettingsChange(next);
    }
    hookUpdateSettings(partial);
  };

  const handleInputDeviceChange = (deviceId: string) => {
    handleUpdate({ inputDeviceId: deviceId });
    if (onDeviceSwitch) {
      onDeviceSwitch("audioinput", deviceId);
    }
  };

  const handleOutputDeviceChange = (deviceId: string) => {
    handleUpdate({ outputDeviceId: deviceId });
    if (onDeviceSwitch) {
      onDeviceSwitch("audiooutput", deviceId);
    }
  };

  const handleReset = () => {
    if (onSettingsChange) {
      onSettingsChange(DEFAULT_VOICE_SETTINGS);
    }
    hookResetDefaults();
  };

  // ----------------------------------------------------
  // Live Microphone Test Level Visualizer
  // ----------------------------------------------------
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const stopMicTest = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsTestingMic(false);
    setMicLevel(0);
  };

  const startMicTest = async () => {
    try {
      stopMicTest();
      const constraints: MediaStreamConstraints = {
        audio: currentSettings.inputDeviceId !== "default"
          ? { deviceId: { exact: currentSettings.inputDeviceId } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setIsTestingMic(true);

      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Scale 0-255 to percentage and apply inputVolume gain
        const scaled = Math.min(100, Math.round((avg / 128) * (currentSettings.inputVolume / 80) * 100));
        setMicLevel(scaled);
        animFrameRef.current = requestAnimationFrame(checkLevel);
      };
      checkLevel();
    } catch (e) {
      console.warn("[VoiceSettingsModal] Failed to start mic test:", e);
      setIsTestingMic(false);
    }
  };

  // Stop mic test when modal closes or unmounts
  useEffect(() => {
    if (!isOpen) {
      stopMicTest();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, []);

  const footer = (
    <div className="flex w-full items-center justify-between pt-1">
      <Button
        variant="ghost"
        onClick={handleReset}
        className="text-white/40 hover:text-white hover:bg-white/5 font-semibold text-xs uppercase tracking-wider h-9 px-3"
      >
        Reset Defaults
      </Button>
      <button
        onClick={() => {
          stopMicTest();
          onClose();
        }}
        className="btn-primary min-w-[120px] h-9 px-5 font-bold text-xs shadow-lg shadow-purple-600/25"
      >
        Done
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopMicTest();
        onClose();
      }}
      title="Voice Settings"
      description="Configure hardware and processing parameters for crystal-clear audio."
      footer={footer}
      className="max-w-2xl"
    >
      <div className="space-y-4 text-left select-none">
        
        {/* Pro-Tip Alert Banner */}
        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="text-[11px] leading-snug">
            <span className="font-bold text-white">Pro Tip:</span> Select <strong>Laptop Mic</strong> as Input and turn <strong>Echo Cancellation OFF</strong> with headphones to preserve 48kHz movie audio.
          </div>
        </div>

        {/* Section 1: Hardware Setup (2 Columns) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between border-b border-white/5 pb-1">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--primary)] flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-[var(--primary)]" /> Hardware Setup
            </h3>
            <button
              onClick={() => refreshDevices()}
              disabled={isLoadingDevices}
              className="text-[10px] text-white/40 hover:text-white flex items-center gap-1 transition-colors"
              title="Refresh audio device list"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingDevices ? "animate-spin text-purple-400" : ""}`} />
              Refresh Devices
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Input Device Selection */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-white/60 flex items-center gap-1.5">
                <Mic className="w-3 h-3 text-purple-400" /> Input Device (Microphone)
              </label>
              <select
                value={currentSettings.inputDeviceId}
                onChange={(e) => handleInputDeviceChange(e.target.value)}
                className="w-full bg-[#161620] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-[var(--primary)] transition-colors cursor-pointer truncate"
              >
                {inputDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Output Device Selection */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-white/60 flex items-center gap-1.5">
                <Volume2 className="w-3 h-3 text-purple-400" /> Output Device (Speakers/Headphones)
              </label>
              <select
                value={currentSettings.outputDeviceId}
                onChange={(e) => handleOutputDeviceChange(e.target.value)}
                className="w-full bg-[#161620] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-[var(--primary)] transition-colors cursor-pointer truncate"
              >
                {outputDevices.map((dev) => (
                  <option key={dev.deviceId} value={dev.deviceId}>
                    {dev.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Volume Levels & Colored Progress Sliders (2 Columns) */}
        <div className="space-y-2.5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--primary)] flex items-center gap-1.5 border-b border-white/5 pb-1">
            <Sliders className="w-3.5 h-3.5 text-[var(--primary)]" /> Volume Levels & Calibration
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Input Volume & Live VU Meter */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex justify-between items-center text-[11px] font-medium">
                <span className="text-white/70 flex items-center gap-1">
                  <Mic className="w-3 h-3 text-white/40" /> Input Volume (Gain)
                </span>
                <span className="text-[var(--primary)] font-bold">{currentSettings.inputVolume}%</span>
              </div>
              
              {/* Colored Progression Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={currentSettings.inputVolume}
                onChange={(e) => handleUpdate({ inputVolume: Number(e.target.value) })}
                style={{
                  background: `linear-gradient(to right, #9333EA 0%, #A855F7 ${currentSettings.inputVolume}%, rgba(255, 255, 255, 0.1) ${currentSettings.inputVolume}%, rgba(255, 255, 255, 0.1) 100%)`
                }}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />

              {/* Mic Test Button & Level Meter */}
              <div className="pt-1 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={isTestingMic ? stopMicTest : startMicTest}
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all shrink-0 cursor-pointer",
                    isTestingMic
                      ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                      : "bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30"
                  )}
                >
                  {isTestingMic ? "Stop Test" : "Test Mic Level"}
                </button>
                <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-purple-400 to-pink-500 transition-all duration-75"
                    style={{ width: `${micLevel}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Output Volume */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between space-y-2">
              <div className="flex justify-between items-center text-[11px] font-medium">
                <span className="text-white/70 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-white/40" /> Output Volume (Voice Chat)
                </span>
                <span className="text-[var(--primary)] font-bold">{currentSettings.outputVolume}%</span>
              </div>

              {/* Colored Progression Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={currentSettings.outputVolume}
                onChange={(e) => handleUpdate({ outputVolume: Number(e.target.value) })}
                style={{
                  background: `linear-gradient(to right, #9333EA 0%, #A855F7 ${currentSettings.outputVolume}%, rgba(255, 255, 255, 0.1) ${currentSettings.outputVolume}%, rgba(255, 255, 255, 0.1) 100%)`
                }}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />

              <div className="text-[10px] text-white/40 flex items-center justify-between pt-1">
                <span>0% (Muted)</span>
                <span>Independent voice level</span>
                <span>100% (Max)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Audio Processing DSP Toggles (Horizontal Cards with Smooth Drag Knobs) */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--primary)] flex items-center gap-1.5 border-b border-white/5 pb-1">
            <AudioLines className="w-3.5 h-3.5 text-[var(--primary)]" /> Audio Processing (DSP)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Echo Cancellation Card */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors flex flex-col justify-between space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-white/90">Echo Cancellation</p>
                  <p className="text-[10px] text-white/40 leading-tight mt-0.5">Stops mic feedback from open speakers</p>
                </div>
                
                {/* Working Animated Switch Knob */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentSettings.echoCancellation}
                  onClick={() => handleUpdate({ echoCancellation: !currentSettings.echoCancellation })}
                  className={cn(
                    "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none",
                    currentSettings.echoCancellation ? "bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]" : "bg-white/15"
                  )}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                    style={{
                      transform: currentSettings.echoCancellation ? "translateX(22px)" : "translateX(3px)",
                    }}
                  />
                </button>
              </div>

              {!currentSettings.echoCancellation ? (
                <div className="text-[9px] text-emerald-400 font-medium flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  <Check className="w-2.5 h-2.5 shrink-0" /> Best for Headphones (Clean audio)
                </div>
              ) : (
                <div className="text-[9px] text-white/30 px-1.5 py-0.5">Filters mic feedback</div>
              )}
            </div>

            {/* Noise Suppression Card */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors flex flex-col justify-between space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-white/90">Noise Suppression</p>
                  <p className="text-[10px] text-white/40 leading-tight mt-0.5">Removes room fans and mic hiss</p>
                </div>
                
                {/* Working Animated Switch Knob */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentSettings.noiseSuppression}
                  onClick={() => handleUpdate({ noiseSuppression: !currentSettings.noiseSuppression })}
                  className={cn(
                    "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none",
                    currentSettings.noiseSuppression ? "bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]" : "bg-white/15"
                  )}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                    style={{
                      transform: currentSettings.noiseSuppression ? "translateX(22px)" : "translateX(3px)",
                    }}
                  />
                </button>
              </div>

              <div className="text-[9px] text-white/40 px-1.5 py-0.5">
                {currentSettings.noiseSuppression ? "Background noise filtered" : "Raw audio input"}
              </div>
            </div>

            {/* Auto Gain Control Card */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors flex flex-col justify-between space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-white/90">Auto Gain (AGC)</p>
                  <p className="text-[10px] text-white/40 leading-tight mt-0.5">Normalizes mic levels dynamically</p>
                </div>
                
                {/* Working Animated Switch Knob */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentSettings.autoGainControl}
                  onClick={() => handleUpdate({ autoGainControl: !currentSettings.autoGainControl })}
                  className={cn(
                    "relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none",
                    currentSettings.autoGainControl ? "bg-purple-600 shadow-[0_0_10px_rgba(147,51,234,0.5)]" : "bg-white/15"
                  )}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out"
                    style={{
                      transform: currentSettings.autoGainControl ? "translateX(22px)" : "translateX(3px)",
                    }}
                  />
                </button>
              </div>

              {!currentSettings.autoGainControl ? (
                <div className="text-[9px] text-emerald-400 font-medium flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  <Check className="w-2.5 h-2.5 shrink-0" /> Recommended OFF (No ducking)
                </div>
              ) : (
                <div className="text-[9px] text-white/30 px-1.5 py-0.5">Auto mic leveling active</div>
              )}
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
}
