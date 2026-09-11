"use client";

import { useState, useEffect, useCallback } from "react";
import { Room } from "livekit-client";

export interface VoiceSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  inputVolume: number;        // 0 to 100
  outputVolume: number;       // 0 to 100
  echoCancellation: boolean;  // false for pure audio on headphones (eliminates comb-filtering)
  noiseSuppression: boolean;  // removes background fans/hiss
  autoGainControl: boolean;   // false prevents OS ducking & volume pumping
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  kind: "audioinput" | "audiooutput";
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  inputDeviceId: "default",
  outputDeviceId: "default",
  inputVolume: 80,
  outputVolume: 85,
  echoCancellation: false, // Default OFF to protect video player clarity from WebRTC notch filters
  noiseSuppression: true,
  autoGainControl: false,  // Default OFF to prevent OS communications volume ducking
};

const STORAGE_KEY = "cowatch_voice_settings";

/**
 * Reads persisted voice settings from localStorage with fallback to defaults
 */
export function loadVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return DEFAULT_VOICE_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_VOICE_SETTINGS,
      ...parsed,
    };
  } catch (e) {
    console.warn("[audioSettings] Failed to parse stored voice settings, using defaults", e);
    return DEFAULT_VOICE_SETTINGS;
  }
}

/**
 * Persists voice settings into localStorage
 */
export function saveVoiceSettings(settings: VoiceSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("[audioSettings] Failed to save voice settings", e);
  }
}

/**
 * Queries connected physical audio input (microphones) and output (speakers/headphones) devices
 */
export async function getAvailableAudioDevices(): Promise<{
  inputs: AudioDeviceOption[];
  outputs: AudioDeviceOption[];
}> {
  if (typeof window === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return {
      inputs: [{ deviceId: "default", label: "Default Microphone", kind: "audioinput" }],
      outputs: [{ deviceId: "default", label: "Default Speaker", kind: "audiooutput" }],
    };
  }

  try {
    // 1. Check if we have permission to see device labels
    let devices = await navigator.mediaDevices.enumerateDevices();
    const hasLabels = devices.some((d) => (d.kind === "audioinput" || d.kind === "audiooutput") && d.label.length > 0);

    // If labels are empty, prompt user for temporary permission to read hardware names
    if (!hasLabels) {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach((track) => track.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch (permErr) {
        console.warn("[audioSettings] Microphone permission prompt was denied or dismissed:", permErr);
      }
    }

    const inputs: AudioDeviceOption[] = [];
    const outputs: AudioDeviceOption[] = [];

    devices.forEach((dev) => {
      if (dev.kind === "audioinput") {
        inputs.push({
          deviceId: dev.deviceId || "default",
          label: dev.label || `Microphone ${inputs.length + 1}`,
          kind: "audioinput",
        });
      } else if (dev.kind === "audiooutput") {
        outputs.push({
          deviceId: dev.deviceId || "default",
          label: dev.label || `Speaker / Headphone ${outputs.length + 1}`,
          kind: "audiooutput",
        });
      }
    });

    // Ensure fallback defaults exist if empty
    if (inputs.length === 0) {
      inputs.push({ deviceId: "default", label: "Default Microphone (System)", kind: "audioinput" });
    }
    if (outputs.length === 0) {
      outputs.push({ deviceId: "default", label: "Default Speaker (System)", kind: "audiooutput" });
    }

    return { inputs, outputs };
  } catch (err) {
    console.error("[audioSettings] Error enumerating audio devices:", err);
    return {
      inputs: [{ deviceId: "default", label: "Default Microphone (System)", kind: "audioinput" }],
      outputs: [{ deviceId: "default", label: "Default Speaker (System)", kind: "audiooutput" }],
    };
  }
}

/**
 * Custom React hook for accessing and updating voice settings with live device enumeration
 */
export function useVoiceSettings() {
  const [settings, setSettingsState] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [inputDevices, setInputDevices] = useState<AudioDeviceOption[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDeviceOption[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(true);

  // Load stored settings on mount
  useEffect(() => {
    setSettingsState(loadVoiceSettings());
  }, []);

  // Refresh available devices
  const refreshDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    const { inputs, outputs } = await getAvailableAudioDevices();
    setInputDevices(inputs);
    setOutputDevices(outputs);
    setIsLoadingDevices(false);
  }, []);

  useEffect(() => {
    refreshDevices();

    // Listen for hardware plug/unplug events
    if (typeof window !== "undefined" && navigator.mediaDevices?.addEventListener) {
      const handleDeviceChange = () => {
        console.log("[audioSettings] Audio hardware change detected, refreshing device list...");
        refreshDevices();
      };
      navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
      };
    }
  }, [refreshDevices]);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      saveVoiceSettings(updated);
      return updated;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    setSettingsState(DEFAULT_VOICE_SETTINGS);
    saveVoiceSettings(DEFAULT_VOICE_SETTINGS);
  }, []);

  return {
    settings,
    updateSettings,
    resetDefaults,
    inputDevices,
    outputDevices,
    isLoadingDevices,
    refreshDevices,
  };
}
