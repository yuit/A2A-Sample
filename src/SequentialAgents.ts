import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '@a2a-js/sdk';
import { Client as A2AClient, ClientFactory } from '@a2a-js/sdk/client';
import { createUserContent } from '@google/genai';
import {
  BaseAgent,
  type InvocationContext,
  type BaseAgentConfig,
  type Event,
  InMemoryRunner,
  isFinalResponse,
  SequentialAgent,
  toA2AParts,
  toAdkEvent,
} from 'adk/core';

dotenv.config();

const A2A_CLIENT_FACTORY = new ClientFactory();

/**
 * Convert userContent in context (GenAI Content) to A2A Message using adk/core toA2AParts.
 * @param context 
 * @returns 
 */
function contextToA2AMessage(context: InvocationContext): Message | undefined {
  const userContent = context.userContent;
  if (!userContent?.parts?.length) return undefined;
  const parts = toA2AParts(userContent.parts);
  return {
    kind: 'message',
    messageId: uuidv4(),
    contextId: uuidv4(),
    role: 'user',
    parts,
  };
}

export class PolicyA2AClientAgent extends BaseAgent {
  private _a2aClient?: A2AClient;
  private readonly _internalName: string = "PolicyA2AClientAgent";
  private readonly _a2aServerUrl: string = `http://localhost:${process.env.POLICY_AGENT_PORT}`;
  constructor(config: BaseAgentConfig ) {
    super(config);
  }

  protected async *runLiveImpl(
    _context: InvocationContext,
  ): AsyncGenerator<Event, void, void> {
    throw new Error('Live mode is not implemented yet.');
  }

  protected async *runAsyncImpl(
    context: InvocationContext,
  ): AsyncGenerator<Event, void, void> {
    if (!this._a2aClient) {
      this._a2aClient = await A2A_CLIENT_FACTORY.createFromUrl(this._a2aServerUrl);
    }
    const message = contextToA2AMessage(context);
    if (!message) {
      throw new Error('No message to send');
    }
    const response = await this._a2aClient.sendMessage({ message });
    const responseAdkEvent = toAdkEvent(
      response,
      context.invocationId,
      this.name,
    );
    if (!responseAdkEvent) {
      throw new Error('No response event to yield');
    }
    console.debug('Policy A2A Agent response:', response);
    yield responseAdkEvent;
  }
}

const policyA2AClientAgent = new PolicyA2AClientAgent({
  name: "PolicyA2AClientAgent",
  description: `Provides healthcare information about symptoms, health
    conditions, treatments, and procedures using up-to-date web resources.`,
});

const rootAgent = new SequentialAgent({
  name: "Root Sequential Agent",
  description: "Healthcare Routing Agent",
  subAgents: [policyA2AClientAgent],
});

const runner = new InMemoryRunner({
  agent: rootAgent,
  appName: 'Healthcare Runner',
});

async function runAgent(prompt: string) {
  for await (const event of runner.runEphemeral({
    userId: 'user',
    newMessage: createUserContent(prompt),
  })) {
    if (isFinalResponse(event) && event.content?.parts?.[0]?.text) {
      console.log(event.content.parts[0].text);
    }
  }
}

void runAgent('What is the policy on deductible?');