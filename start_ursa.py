import sys
import os

# 1. Force the URSA configuration to use Ollama via the OpenAI-compatible endpoint
# Using the URSA_LLM_MODEL__ prefix ensures these populate the ModelConfig object directly.
os.environ["URSA_LLM_MODEL__MODEL"] = "openai:qwen2.5-coder"
os.environ["URSA_LLM_MODEL__BASE_URL"] = "http://localhost:11434/v1"

# 2. Set the API key to 'ollama' as recommended in URSA's documentation
# We use a custom env var and point URSA to it to avoid 'not-needed' collisions.
os.environ["MY_OLLAMA_KEY"] = "ollama"
os.environ["URSA_LLM_MODEL__API_KEY_ENV"] = "MY_OLLAMA_KEY"

# 3. Network settings for the MCP server
os.environ["FASTMCP_HOST"] = "localhost"
os.environ["FASTMCP_PORT"] = "8000"

# 4. Patch FastMCP 3.2 compatibility
from ursa.cli.hitl import HITL
from fastmcp import FastMCP

def fixed_as_mcp_server(self, **kwargs):
    mcp = FastMCP("URSA")
    for name, agent in self.agents.items():
        mcp.tool(
            self._make_agent_tool(name),
            name=name,
            description=agent.description or f"URSA {name} agent"
        )
    return mcp

HITL.as_mcp_server = fixed_as_mcp_server

# 5. Start the Server
from ursa.cli import main
if __name__ == "__main__":
    # Explicitly set sys.argv to ignore any local config files
    sys.argv = ["ursa", "mcp-server", "--transport", "streamable-http"]
    main()