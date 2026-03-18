"""
Microsoft Agent Framework A2A client for the Find Providers JS agent.

This wraps the remote A2A server (FindProvidersAgent) in a Python
`A2AAgent` so you can use it from Microsoft Agent Framework workflows.
"""

import asyncio
import os
from typing import Final
from a2a.client import A2ACardResolver
from agent_framework.a2a import A2AAgent
import httpx
from dotenv import load_dotenv

load_dotenv()

async def main():
  port: Final[str] = os.getenv("FIND_PROVIDERS_AGENT_PORT", "9997")
  a2a_remote_server_url: Final[str] = f"http://localhost:{port}"

  # 1. Discover the remote agent's capabilities
  async with httpx.AsyncClient(timeout=60.0) as http_client:
      resolver = A2ACardResolver(httpx_client=http_client, base_url=a2a_remote_server_url)
      agent_card = await resolver.get_agent_card()
      print(f"Found agent: {agent_card.name}")

  # 2. Create an A2AAgent and send a message
  async with A2AAgent(
      name=agent_card.name,
      agent_card=agent_card,
      url=a2a_remote_server_url,
  ) as agent:
      response = await agent.run("I am visiting Maimi, FL. Find me a doctor for a physical exam.")
      for message in response.messages:
          print(message.text)

asyncio.run(main())