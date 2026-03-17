import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { FindProvidersAgent } from '../multiServerMCPClient.js';
import { ExecutionEventBus, RequestContext, AgentExecutor } from '@a2a-js/sdk/server';
import { AgentCard, Message, TextPart } from '@a2a-js/sdk';
import { initA2AServer } from './utils.js';
import { logger } from '../logger.js';

dotenv.config();

const FIND_PROVIDERS_AGENT_PORT = process.env.FIND_PROVIDERS_AGENT_PORT;
if (!FIND_PROVIDERS_AGENT_PORT) {
  throw new Error('FIND_PROVIDERS_AGENT_PORT is not set');
}
const FIND_PROVIDERS_AGENT_BASE_URL = `http://localhost:${FIND_PROVIDERS_AGENT_PORT}`;

export const FIND_PROVIDERS_AGENT_CARD: AgentCard = {
  name: 'Find Providers Agent',
  description: 'Finds doctors and healthcare providers using MCP-backed tools.',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  url: FIND_PROVIDERS_AGENT_BASE_URL,
  skills: [
    {
      id: 'find_providers',
      name: 'Find providers',
      description: 'Searches for doctors and providers matching a location or criteria.',
      tags: ['providers', 'doctors', 'network'],
    },
  ],
  capabilities: { pushNotifications: false },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  additionalInterfaces: [
    { url: `${FIND_PROVIDERS_AGENT_BASE_URL}/a2a/jsonrpc`, transport: 'JSONRPC' },
    { url: `${FIND_PROVIDERS_AGENT_BASE_URL}/a2a/rest`, transport: 'HTTP+JSON' },
  ],
};

/**
 * A2A AgentExecutor that returns a message.
 */
// @ts-ignore TS6196 - reserved for CLI executor selection
class FindProvidersAgentExecutor implements AgentExecutor {
  private readonly agent: FindProvidersAgent;

  constructor() {
    this.agent = new FindProvidersAgent();
  }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { userMessage, contextId } = requestContext;

    logger.debug(
      '[FindProvidersAgentExecutor] Incoming request',
      `contextId=${contextId ?? userMessage.contextId ?? 'none'}`
    );

    // Extract the user's text message from the RequestContext
    const textParts = (userMessage.parts ?? []).filter(
      (p): p is TextPart => p.kind === 'text',
    );
    const question = textParts.map((p) => p.text).join('\n');

    const answer = await this.agent.answerQuery(question);
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
    // You might track in-flight tasks here if FindProvidersAgent does streaming or long operations.
    return;
  }
}
initA2AServer({
  executor: new FindProvidersAgentExecutor(),
  name: 'FIND_PROVIDERS_AGENT',
  agentCard: FIND_PROVIDERS_AGENT_CARD,
  url: FIND_PROVIDERS_AGENT_BASE_URL,
  port: FIND_PROVIDERS_AGENT_PORT,
});