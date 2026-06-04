import { useMemo, useEffect, useRef, useState, useCallback } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import type { ChatKitOptions } from "@openai/chatkit";
import { createClientSecretFetcher, workflowId } from "../lib/chatkitSession";

// ─── Types ────────────────────────────────────────────────────────────────────
type VoiceState = "idle" | "recording" | "processing" | "error";

// ─── Web Speech API types (browser global) ────────────────────────────────────
interface SpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEvent) => any) | null;
  onend: ((ev: Event) => any) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionStatic {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
  item(index: number): SpeechRecognitionResult;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

// ─── Voice Button Component ───────────────────────────────────────────────────
function VoiceButton() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [statusText, setStatusText] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US"; // Change to 'ur-PK' for Urdu
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setVoiceState("processing");
      setStatusText("Injecting...");
      injectTextIntoChatKit(transcript);
      setTimeout(() => {
        setVoiceState("idle");
        setStatusText("");
      }, 800);
    };

    recognition.onend = () => {
      if (voiceState === "recording") {
        setVoiceState("idle");
        setStatusText("");
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setVoiceState("error");
      if (e.error === "not-allowed") {
        setStatusText("Mic permission do!");
      } else if (e.error === "no-speech") {
        setStatusText("Kuch suna nahi...");
      } else {
        setStatusText("Error: " + e.error);
      }
      setTimeout(() => {
        setVoiceState("idle");
        setStatusText("");
      }, 2500);
    };

    recognitionRef.current = recognition;
  }, []);

  // Inject transcript into ChatKit's composer input
  const injectTextIntoChatKit = useCallback((text: string) => {
    // ChatKit uses a contenteditable div or textarea — try multiple selectors
    const selectors = [
      "textarea[placeholder]",
      'div[contenteditable="true"]',
      ".chatkit-composer textarea",
      ".chatkit-composer [contenteditable]",
      'textarea[data-testid]',
      "textarea",
    ];

    let inputEl: HTMLElement | null = null;

    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) {
        inputEl = el;
        break;
      }
    }

    if (!inputEl) {
      console.warn("[VoiceButton] ChatKit input field not found.");
      return;
    }

    if (
      inputEl instanceof HTMLTextAreaElement ||
      inputEl instanceof HTMLInputElement
    ) {
      // React synthetic event trick — set native value then dispatch
      const nativeDesc =
        Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value"
        ) ||
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

      if (nativeDesc?.set) {
        nativeDesc.set.call(inputEl, text);
      }
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // contenteditable div
      inputEl.innerText = text;
      inputEl.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }

    inputEl.focus();
  }, []);

  const handleClick = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (voiceState === "recording") {
      recognition.stop();
      setVoiceState("idle");
      setStatusText("");
    } else {
      try {
        recognition.start();
        setVoiceState("recording");
        setStatusText("Listening...");
      } catch {
        // Already started — stop and restart
        recognition.stop();
        setTimeout(() => {
          recognition.start();
          setVoiceState("recording");
          setStatusText("Listening...");
        }, 300);
      }
    }
  }, [voiceState]);

  if (!supported) return null;

  return (
    <>
      {/* Status pill */}
      {statusText && (
        <div
          style={{
            position: "fixed",
            bottom: 92,
            right: 28,
            background:
              voiceState === "error"
                ? "#e24b4a"
                : voiceState === "recording"
                ? "#102b2d"
                : "#233a48",
            color: "#fff",
            fontSize: 13,
            padding: "5px 14px",
            borderRadius: 20,
            zIndex: 9999,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {statusText}
        </div>
      )}

      {/* Mic button */}
      <button
        onClick={handleClick}
        title={
          voiceState === "recording" ? "Stop recording" : "Start voice input"
        }
        aria-label={
          voiceState === "recording" ? "Stop recording" : "Start voice input"
        }
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          fontSize: 20,
          transition: "background 0.2s, transform 0.1s",
          transform: voiceState === "recording" ? "scale(1.1)" : "scale(1)",
          background:
            voiceState === "recording"
              ? "#e24b4a"
              : voiceState === "processing"
              ? "#233a48"
              : "#102b2d",
          boxShadow:
            voiceState === "recording"
              ? "0 0 0 4px rgba(226,75,74,0.25)"
              : "0 2px 12px rgba(0,0,0,0.35)",
          outline:
            voiceState === "recording"
              ? "2px solid rgba(226,75,74,0.5)"
              : "none",
        }}
      >
        {voiceState === "recording" ? "⏹" : voiceState === "processing" ? "⏳" : "🎤"}
      </button>
    </>
  );
}

// ─── Main ChatKitPanel ────────────────────────────────────────────────────────
export function ChatKitPanel() {
  const getClientSecret = useMemo(
    () => createClientSecretFetcher(workflowId),
    []
  );

  const options: ChatKitOptions = {
    api: {
      getClientSecret,
    },
    theme: {
      colorScheme: "dark",
      radius: "pill",
      density: "compact",
      color: {
        grayscale: {
          hue: 0,
          tint: 0,
        },
        accent: {
          primary: "#233a48",
          level: 1,
        },
        surface: {
          background: "#102b2d",
          foreground: "#0e2025",
        },
      },
      typography: {
        baseSize: 16,
        fontFamily:
          '"OpenAI Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
        fontFamilyMono:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "DejaVu Sans Mono", "Courier New", monospace',
        fontSources: [
          {
            family: "OpenAI Sans",
            src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2",
            weight: 400,
            style: "normal",
            display: "swap",
          },
        ],
      },
    },
    composer: {
      placeholder: "Just click and grade in seconds",
      attachments: {
        enabled: true,
        maxCount: 5,
        maxSize: 10485760,
      },
      tools: [
        {
          id: "search_docs",
          label: "Search docs",
          shortLabel: "Docs",
          placeholderOverride: "Search documentation",
          icon: "book-open",
          pinned: true,
        },
      ],
      models: [
        {
          id: "gpt-5",
          label: "gpt-5",
          description: "Balanced intelligence",
          default: true,
        },
      ],
    },
    startScreen: {
      greeting: "Grade Smarter, Grade Faster",
      prompts: [],
    },
  };

  const chatkit = useChatKit(options);

  return (
    <div className="flex h-[90vh] w-full" style={{ position: "relative" }}>
      <ChatKit control={chatkit.control} className="h-full w-full" />

      {/* Voice button floats on top of ChatKit */}
      <VoiceButton />
    </div>
  );
}