export interface AssistantClientMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function sanitizeAssistantMessages(
  messages: ReadonlyArray<{ role: string; content: string }>,
): AssistantClientMessage[] {
  return messages
    .filter(
      (message): message is typeof message & { role: 'user' | 'assistant' } =>
        message.role === 'user' || message.role === 'assistant',
    )
    .map(({ role, content }) => ({ role, content }));
}
