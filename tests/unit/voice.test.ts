import { describe, expect, it } from "vitest";
import { speechErrorMessage } from "@/components/chat/useSpeechInput";
import { customerSystemPrompt } from "@/lib/agents/customer/prompt";

describe("speechErrorMessage", () => {
  it("explains a blocked microphone", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/mic permission/i);
    expect(speechErrorMessage("service-not-allowed")).toBe(speechErrorMessage("not-allowed"));
  });
  it("explains silence", () => {
    expect(speechErrorMessage("no-speech")).toMatch(/didn't hear anything/i);
  });
  it("explains a lost connection", () => {
    expect(speechErrorMessage("network")).toMatch(/internet connection/i);
  });
  it("falls back to a generic message", () => {
    expect(speechErrorMessage("bad-grammar")).toMatch(/try again or type/i);
  });
});

describe("customer prompt", () => {
  it("tells the agent voice input may mishear dish names", () => {
    expect(customerSystemPrompt({ restaurantName: "Test", loggedIn: true })).toContain(
      "Voice messages may have misheard words. Match unclear dish names to the closest menu item, or ask if unsure.",
    );
  });
});
