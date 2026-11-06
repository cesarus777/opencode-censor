// This is a tripwire, not a general secret detector. Only a closed command grammar
// can cross the provider boundary; free-form history never crosses it.
export function containsSensitiveData(value: string): boolean {
  return /(?:secret|token|password|passwd|credential|authorization|api[_-]?key|private[_ -]?key|\.env|\.ssh|\.aws|-----BEGIN|sk-[\w-]+|gh[pousr]_|AKIA[A-Z0-9]{16}|https?:\/\/[^\s]*@)/i.test(
    value,
  );
}
export function intentContext(
  messages: unknown,
  maxMessages: number,
  maxCharacters: number,
): string[] {
  if (!Array.isArray(messages)) throw new Error("Invalid context");
  const intents = new Set<string>();
  const vocabulary = [
    "inspect",
    "debug",
    "test",
    "build",
    "fix",
    "refactor",
    "document",
    "review",
  ];
  let remaining = maxCharacters;
  for (const message of messages.slice(-maxMessages)) {
    if (
      !message ||
      typeof message !== "object" ||
      !("type" in message) ||
      message.type !== "user" ||
      !("text" in message) ||
      typeof message.text !== "string"
    )
      continue;
    const text = message.text.slice(0, remaining);
    remaining -= text.length;
    if (containsSensitiveData(text)) continue;
    for (const word of vocabulary)
      if (new RegExp(`\\b${word}\\b`, "i").test(text)) intents.add(word);
    if (remaining <= 0) break;
  }
  return [...intents];
}
