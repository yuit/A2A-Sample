"""
High-level Python client entrypoint for talking to the Policy and Research A2A agents,
using ADK Python's RemoteA2aAgent via a small helper named remote_to_a2a.
"""

import os
from typing import Final

from dotenv import load_dotenv
from google.genai.types import Content, Part
from google.adk.agents.remote_a2a_agent import (
  AGENT_CARD_WELL_KNOWN_PATH,
  RemoteA2aAgent,
)
from google.adk.agents.sequential_agent import SequentialAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts import InMemoryArtifactService
from google.adk.memory import InMemoryMemoryService

# Load env so we can read the ports configured for the JS servers.
load_dotenv()

def remote_to_a2a(
  name: str,
  base_url: str,
  description: str,
) -> RemoteA2aAgent:
  """
  Helper that creates a RemoteA2aAgent pointing at an A2A HTTP server.

  base_url should be the agent's base URL (for example "http://localhost:4000");
  the well-known agent-card path is appended automatically.
  """
  agent_card_url = f"{base_url}{AGENT_CARD_WELL_KNOWN_PATH}"
  return RemoteA2aAgent(
    name=name,
    description=description,
    agent_card=agent_card_url,
  )

policy_port: Final[str] = os.getenv("POLICY_AGENT_PORT", "9999")
research_port: Final[str] = os.getenv("RESEARCH_AGENT_PORT", "9998")

policy_base_url: Final[str] = f"http://localhost:{policy_port}"
research_base_url: Final[str] = f"http://localhost:{research_port}"
policy_agent = remote_to_a2a(
  name="policy_agent",
  base_url=policy_base_url,
  description="Policy A2A agent (remote, via JS server).",
)
research_agent = remote_to_a2a(
  name="research_agent",
  base_url=research_base_url,
  description="Research A2A agent (remote, via JS server).",
)
root_agent = SequentialAgent(
  name="policy_and_research_sequential_agent",
  description="Sequential agent that calls the Policy then Research A2A agents.",
  sub_agents=[policy_agent, research_agent],
)