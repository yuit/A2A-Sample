import { Message, TextPart } from '@a2a-js/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import { policyAgent } from '../policyAgent';

/**
 * A2A AgentExecutor implementation that delegates to policyAgent.
 */
export class policyAgentMessageExecutor implements AgentExecutor {
  private readonly agent: policyAgent;

  constructor() {
    this.agent = new policyAgent();
  }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { userMessage, contextId } = requestContext;

    // Log basic info about the incoming request
    console.log(
      '[PolicyAgentExecutor] Incoming request',
      `contextId=${contextId ?? userMessage.contextId ?? 'none'}`
    );

    // Extract the user's text message from the RequestContext
    const textParts = (userMessage.parts ?? []).filter(
      (p): p is TextPart => p.kind === 'text'
    );
    const userText = textParts.map((p) => p.text).join('\n');

    const answer = await this.agent.answerQuery(userText);

    const responseMessage: Message = {
      kind: 'message',
      role: 'agent',
      messageId: uuidv4(),
      parts: [{ kind: 'text', text: answer }],
      contextId,
    };

    eventBus.publish(responseMessage);
    eventBus.finished();
  }

  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
    // No internal long-running work to cancel yet; placeholder for future extension.
    // You might track in-flight tasks here if policyAgent does streaming or long operations.
    return;
  }
}
