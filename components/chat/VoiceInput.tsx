"use client";

import { createContext, useContext } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { CopilotChatInput, CopilotChatView, type CopilotChatViewProps } from "@copilotkit/react-core/v2";
import { cn } from "@/lib/utils";
import { useChatActions } from "./chat-actions";
import { speechErrorMessage, useSpeechInput, type SpeechInput } from "./useSpeechInput";

const VoiceCtx = createContext<SpeechInput | null>(null);

/**
 * `chatView` slot for CopilotChat: shows the live transcript in the input while
 * listening and sends the final text through submitUserMessage (§14 voice seam).
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
      <CopilotChatView {...props} inputValue={speech.listening ? speech.transcript : props.inputValue} input={{ sendButton: SendWithMic }} />
    </VoiceCtx.Provider>
  );
}

function SendWithMic(props: React.ComponentProps<typeof CopilotChatInput.SendButton>) {
  return (
    <>
      <MicButton />
      <CopilotChatInput.SendButton {...props} />
    </>
  );
}

// CopilotKit resets `[data-copilotkit] button` (background, color, radius) with higher
// specificity than utilities, so the button stays bare and the inner span draws the circle.
const button = "group inline-flex shrink-0 rounded-full focus-visible:outline-none";
const circle = "inline-flex size-9 items-center justify-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-ring";

function MicButton() {
  const speech = useContext(VoiceCtx);
  if (!speech) return null;

  if (speech.supported === false) {
    const why = "Voice input isn't supported in this browser";
    return (
      // Disabled buttons don't fire hover events, so the tooltip lives on the wrapper.
      <span title={why} className="inline-flex">
        <button type="button" disabled aria-label={why} data-testid="chat-mic" className={cn(button, "cursor-not-allowed")}>
          <span className={cn(circle, "text-muted-foreground opacity-50")}>
            <Mic className="size-[18px]" aria-hidden />
          </span>
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
        className={button}
      >
        <span
          className={cn(
            circle,
            speech.listening ? "animate-pulse bg-destructive text-destructive-foreground" : "text-muted-foreground group-hover:bg-muted group-hover:text-foreground",
          )}
        >
          <Mic className="size-[18px]" aria-hidden />
        </span>
      </button>
      <span className="sr-only" aria-live="polite">
        {speech.listening ? "Listening…" : ""}
      </span>
    </>
  );
}
