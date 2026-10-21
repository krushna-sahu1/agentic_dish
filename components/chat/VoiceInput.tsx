"use client";

import { createContext, useContext } from "react";
import { ArrowUp, Mic } from "lucide-react";
import { toast } from "sonner";
import { CopilotChatView, type CopilotChatViewProps } from "@copilotkit/react-core/v2";
import { cn } from "@/lib/utils";
import { useChatActions } from "./chat-actions";
import { CHAT_SUGGESTIONS, useChatUi } from "./chat-ui";
import { speechErrorMessage, useSpeechInput, type SpeechInput } from "./useSpeechInput";

const VoiceCtx = createContext<SpeechInput | null>(null);

/**
 * `chatView` slot for CopilotChat: shows the live transcript in the input while
 * listening and sends the final text through submitUserMessage (§14 voice seam).
 *
 * It also swaps CopilotKit's default input for our own composer (a floating
 * pill with a growing textarea, a mic button and a round send button) so the
 * keyboard, the suggestion chips and the 16px type all stay under our control.
 */
export function VoiceChatView(props: CopilotChatViewProps) {
  const { submitUserMessage } = useChatActions();
  const { onInputChange } = props;
  const speech = useSpeechInput({
    onFinal: (text) => {
      onInputChange?.("");
      if (text) void submitUserMessage(text);
    },
    onError: (code) => toast.error(speechErrorMessage(code), { id: "voice-error" }),
  });
  return (
    <VoiceCtx.Provider value={speech}>
      <CopilotChatView
        {...props}
        inputValue={speech.listening ? speech.transcript : props.inputValue}
        input={{ children: Composer, sendButton: ComposerSendButton }}
      />
    </VoiceCtx.Provider>
  );
}

type ComposerProps = {
  textArea: React.ReactElement;
  sendButton: React.ReactElement;
  disclaimer: React.ReactElement;
  containerRef?: React.Ref<HTMLDivElement>;
};

/** The docked composer: suggestion chips, the input pill and the disclaimer. */
function Composer({ textArea, sendButton, disclaimer, containerRef }: ComposerProps) {
  const { hasMessages } = useChatUi();
  return (
    <div className="chat-composer" ref={containerRef}>
      {hasMessages ? <SuggestionChips /> : null}
      <div className="chat-composer__pill">
        <MicButton />
        <div className="chat-composer__field">{textArea}</div>
        {sendButton}
      </div>
      <div className="chat-composer__disclaimer">{disclaimer}</div>
    </div>
  );
}

/** Horizontally scrollable shortcuts — the welcome cards, once the chat starts. */
function SuggestionChips() {
  const { sendSuggestion } = useChatUi();
  return (
    <div className="chat-chips" role="group" aria-label="Suggested questions">
      {CHAT_SUGGESTIONS.map((s) => (
        <button key={s.title} type="button" className="chat-chip" onClick={() => sendSuggestion(s.message)}>
          {s.title}
        </button>
      ))}
    </div>
  );
}

/** Round accent send button (becomes a stop button while the agent runs). */
function ComposerSendButton({ onClick, disabled, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const isStop = children !== undefined && children !== null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={isStop ? "Stop generating" : "Send message"}
      title={isStop ? "Stop" : "Send"}
      data-testid="copilot-send-button"
      className={cn("chat-send", className)}
      {...props}
    >
      {children ?? <ArrowUp aria-hidden />}
    </button>
  );
}

// CopilotKit resets `[data-copilotkit] button` (background, color, radius), so the
// mic uses its own `.chat-mic` class, which out-specifies that reset.
function MicButton() {
  const speech = useContext(VoiceCtx);
  if (!speech) return null;

  if (speech.supported === false) {
    const why = "Voice input isn't supported in this browser";
    return (
      // Disabled buttons don't fire hover events, so the tooltip lives on the wrapper.
      <span title={why} className="inline-flex">
        <button type="button" disabled aria-label={why} data-testid="chat-mic" className="chat-mic">
          <Mic aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={speech.toggle}
        disabled={speech.supported === null}
        aria-pressed={speech.listening}
        aria-label={speech.listening ? "Stop voice input" : "Start voice input"}
        title={speech.listening ? "Stop listening" : "Speak your message"}
        data-testid="chat-mic"
        data-listening={speech.listening ? "true" : "false"}
        className="chat-mic"
      >
        <Mic aria-hidden />
      </button>
      <span className="sr-only" aria-live="polite">
        {speech.listening ? "Listening…" : ""}
      </span>
    </>
  );
}
