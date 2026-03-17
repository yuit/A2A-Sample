import { MultiServerMCPClient as LangChainMultiServerMCPClient } from '@langchain/mcp-adapters';
import { createAgent } from 'langchain';
import { ChatAnthropic } from '@langchain/anthropic';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

// Load configuration from .env at project root
dotenv.config();

/**
 * High-level wrapper for setting up a Claude + MCP tools agent
 * that can answer provider queries.
 */
export class FindProvidersAgent {
  private _agent: ReturnType<typeof createAgent> | null = null;
  private _mcpClient: LangChainMultiServerMCPClient | null = null;
  /**
   * Initialize the underlying LangChain MultiServerMCPClient and Claude agent.
   * Safe to call multiple times; subsequent calls will reuse the existing agent.
   */
  async initialize() {
    if (this._agent && this._mcpClient) {
      return; // Agent already initialized
    }
    logger.info('[FindProvidersAgent] Initializing MCP client');
    this._mcpClient = new LangChainMultiServerMCPClient({
      findDoctors: {
        transport: 'stdio',
        command: 'node',
        args: ['dist/mcpServer/findDoctors.js'],
      },
    });

    const tools = await this._mcpClient.getTools();

    const model = new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      temperature: 0,
    });

    this._agent = createAgent({
      model,
      tools,
    });
  }

  /**
   * Call the underlying LangChain agent with a natural-language query
   * and return the final assistant message content.
   */
  async answerQuery(question: string): Promise<string> {
    if (!this._agent) {
      await this.initialize();
    }
    logger.info('[FindProvidersAgent] Answering query', question);
    const result = await this._agent!.invoke({
      messages: [{ role: 'user', content: question }],
    });

    // LangChain agents return a state object with a messages array.
    const messages = (result as any).messages ?? [];
    const last = messages[messages.length - 1];
    if (!last) {
      return '';
    }

    const content = last.content;
    logger.info('[FindProvidersAgent] Content', content);
    if (typeof content === 'string') {
      return content;
    } else if (Array.isArray(content)) {
      // If content is a structured array, join any text parts.
      return content
        .map((part: any) => (typeof part === 'string' ? part : part.text ?? ''))
        .join(' ')
        .trim();
    } else {
      return 'Unknown content type';
    }
  }

  /**
   * Close the underlying MCP client and release resources.
   */
  async close(): Promise<void> {
    if (this._mcpClient) {
      logger.info('[FindProvidersAgent] Closing MCP client');
      await this._mcpClient.close();
      this._mcpClient = null;
    }
    this._agent = null;
  }
}