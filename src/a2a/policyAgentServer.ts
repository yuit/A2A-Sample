import dotenv from 'dotenv';
import { AGENT_CARD_PATH, AgentCard, Message, TextPart } from '@a2a-js/sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentExecutor,
  ExecutionEventBus,
  DefaultRequestHandler,
  InMemoryTaskStore,
  RequestContext,
} from '@a2a-js/sdk/server';
import express from 'express';
import {
  agentCardHandler,
  jsonRpcHandler,
  restHandler,
  UserBuilder,
} from '@a2a-js/sdk/server/express';
import { policyAgent } from '../policyAgent';

/**
 * A2A AgentExecutor implementation that delegates to policyAgent.
 */
export class policyAgentExecutor implements AgentExecutor {
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

// --- A2A server wiring for policyAgentExecutor ---
// Load configuration from .env at project root
dotenv.config();

const PORT = process.env.POLICY_AGENT_PORT || 4000;
const BASE_URL = `http://localhost:${PORT}`;
const agentCard: AgentCard = {
  name: 'Policy Agent',
  description: 'Answers healthcare policy questions using an internal PDF.',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  url: BASE_URL,
  skills: [
    {
      id: 'insurance_coverage',
      name: 'Insurance coverage',
      description: 'Provides information about insurance coverage options and details.',
      tags: ['insurance', 'coverage'],
      examples: ['What does my policy cover?', 'Are mental health services included?'],
    },
  ],
  capabilities: {
    pushNotifications: false,
  },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  additionalInterfaces: [
    { url: `${BASE_URL}/a2a/jsonrpc`, transport: 'JSONRPC' },
    { url: `${BASE_URL}/a2a/rest`, transport: 'HTTP+JSON' },
  ],
};

const executor = new policyAgentExecutor();
const taskStore = new InMemoryTaskStore();
const requestHandler = new DefaultRequestHandler(agentCard, taskStore, executor);

const app = express();

app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
app.use(
  '/a2a/jsonrpc',
  jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication })
);
app.use(
  '/a2a/rest',
  restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication })
);

app.listen(PORT, () => {
  console.log(`🚀 PolicyAgent A2A server listening on ${BASE_URL}`);
  console.log(
    `Agent card available at ${BASE_URL}/${AGENT_CARD_PATH}`
  );
});

