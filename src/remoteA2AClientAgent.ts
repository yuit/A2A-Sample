import { v4 as uuidv4 } from 'uuid';
import { Message } from '@a2a-js/sdk';
import { type Client as A2AClient, ClientFactory } from '@a2a-js/sdk/client';
import {
  BaseAgent,
  type InvocationContext,
  type BaseAgentConfig,
  type Event,
  toA2AParts,
  toAdkEvent,
} from 'adk/core';
import { logger } from './logger.js';

const A2A_CLIENT_FACTORY = new ClientFactory();
/**
 * Convert userContent in context (GenAI Content) to A2A Message using adk/core toA2AParts.
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

export interface RemoteA2AClientAgentConfig extends BaseAgentConfig {
  a2aServerUrl?: string;
}

export class RemoteA2AClientAgent extends BaseAgent {
  private readonly _a2aServerUrl: string;
  private _a2aClient?: A2AClient;

  constructor(config: RemoteA2AClientAgentConfig) {
    super(config);
    if (!config.a2aServerUrl) {
      throw new Error('a2aServerUrl is required');
    }
    this._a2aServerUrl = config.a2aServerUrl;
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
    logger.debug(`[${this.name}] sending message to ${this._a2aServerUrl}`);
    const response = await this._a2aClient.sendMessage({ message });
    const responseAdkEvent = toAdkEvent(
      response,
      context.invocationId,
      this.name,
    );
    if (!responseAdkEvent) {
      throw new Error('No response event to yield');
    }
    logger.debug(`[${this.name}] RawResponse:`, response);
    logger.debug(`[${this.name}] RawResponseAdkEvent:`, responseAdkEvent);
    yield responseAdkEvent;
  }
}