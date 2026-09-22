"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type SpeechErrorEvent = { error: string; message?: string };

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechConstructor = new () => Recognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechConstructor;
    webkitSpeechRecognition?: SpeechConstructor;
  }
}

export function useVox(onFinal: (transcript: string) => void) {
  const recognitionRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const [supported, setSupported] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)), 0);
    return () => {
      window.clearTimeout(handle);
      recognitionRef.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Constructor) {
      setSupported(false);
      setError("Voice recognition is not supported in this browser. Use the command field instead.");
      return;
    }
    recognitionRef.current?.abort();
    const recognition = new Constructor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    finalRef.current = "";
    setTranscript("");
    setError(null);
    setListening(true);
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalRef.current += result[0].transcript;
        else interim += result[0].transcript;
      }
      setTranscript(`${finalRef.current}${interim}`.trim());
    };
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed": "Microphone access was denied. Typed commands are still available.",
        "audio-capture": "No microphone was found. Typed commands are still available.",
        "no-speech": "No speech was detected. Try again when you are ready.",
        aborted: "Listening canceled.",
        network: "Voice recognition could not reach the browser speech service.",
      };
      if (event.error !== "aborted") setError(messages[event.error] ?? "Voice recognition stopped unexpectedly.");
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const finalText = finalRef.current.trim();
      if (finalText) onFinal(finalText);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Voice recognition is already active.");
    }
  }, [onFinal]);

  const cancel = useCallback(() => {
    finalRef.current = "";
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setListening(false);
    setTranscript("");
  }, []);

  return { supported, listening, transcript, error, start, cancel, clearError: () => setError(null) };
}
