/** Open the customer chat (optionally sending a prompt) from anywhere in the UI. */
export function openChat(prompt?: string) {
  window.dispatchEvent(new CustomEvent("agentic:open-chat", { detail: { prompt } }));
}
