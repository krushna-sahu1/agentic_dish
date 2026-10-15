"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Friendly copy for recognition errors (shown as toasts). */
export function speechErrorMessage(code: SpeechRecognitionErrorCode | string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow mic permission in your browser to talk to us.";
    case "no-speech":
      return "I didn't hear anything. Tap the mic and try again.";
    case "network":
      return "Voice input needs an internet connection. Check your connection and try again.";
    case "audio-capture":
      return "No microphone found. Plug one in or type your message instead.";
    default:
      return "Voice input stopped. Please try again or type your message.";
  }
}

export interface SpeechInput {
  /** null until checked in the browser. */
  supported: boolean | null;
  listening: boolean;
  /** Live transcript (final + interim) for the current utterance. */
  transcript: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

/**
 * Browser speech-to-text (Web Speech API). Single utterance: the browser stops
 * on its own when the user stops speaking, then `onFinal` gets the text.
 */
export function useSpeechInput({
  lang = "en-IN",
  onFinal,
  onError,
}: {
  lang?: string;
  onFinal: (text: string) => void;
  onError?: (code: SpeechRecognitionErrorCode) => void;
}): SpeechInput {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const failedRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);
  onFinalRef.current = onFinal;
  onErrorRef.current = onError;

  useEffect(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      finalRef.current = final;
      interimRef.current = interim;
      setTranscript(final + interim);
    };
    rec.onerror = (e) => {
      failedRef.current = true;
      if (e.error !== "aborted") onErrorRef.current?.(e.error);
    };
    rec.onend = () => {
      setListening(false);
      setTranscript("");
      if (failedRef.current) return;
      // Some browsers end without marking the last chunk final after a manual stop.
      onFinalRef.current((finalRef.current || interimRef.current).trim());
    };

    recRef.current = rec;
    setSupported(true);
    return () => {
      rec.onresult = rec.onerror = rec.onend = null;
      rec.abort();
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (!navigator.onLine) return void onErrorRef.current?.("network");
    finalRef.current = interimRef.current = "";
    failedRef.current = false;
    setTranscript("");
    try {
      rec.start();
      setListening(true);
    } catch {
      // InvalidStateError: already started.
    }
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { supported, listening, transcript, start, stop, toggle };
}
