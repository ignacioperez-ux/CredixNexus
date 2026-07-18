"use client";

import { useEffect, useRef, useState } from "react";

// Dictado por voz reutilizable (Web Speech API). No esta en la lib estandar de TS -> tipos minimos.
type SpeechRec = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void; onerror: () => void; start: () => void; stop: () => void;
};
type VoiceWindow = { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };

/** Dictado por voz. `onText` recibe cada transcript FINAL para agregarlo al campo. Degrada:
 *  si el navegador no soporta SpeechRecognition, `supported` es false (no mostrar el boton). */
export function useDictation(lang: string, onText: (text: string) => void): { supported: boolean; listening: boolean; toggle: () => void } {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const cbRef = useRef(onText);
  cbRef.current = onText;

  useEffect(() => {
    const w = window as unknown as VoiceWindow;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function toggle() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as VoiceWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last?.[0]?.transcript?.trim();
      if (text) cbRef.current(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return { supported, listening, toggle };
}
