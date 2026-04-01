import sys
import os

# 1. The URSA/Ollama Trick: Treat Ollama as an OpenAI endpoint
os.environ["OPENAI_API_KEY"] = "ollama"
os.environ["OPENAI_BASE_URL"] = "http://localhost:11434/v1"

# 2. Tell URSA to use the OpenAI provider, but with your local model
os.environ["URSA_LLM_MODEL__MODEL"] = "openai:qwen2.5-coder"

# 3. Network settings for the MCP server
os.environ["FASTMCP_HOST"] = "localhost"
os.environ["FASTMCP_PORT"] = "8000"

# 4. Patch FastMCP 3.2 compatibility
from ursa.cli.hitl import HITL
from fastmcp import FastMCP

def fixed_as_mcp_server(self, **kwargs):
    mcp = FastMCP("URSA")
    for name, agent in self.agents.items():
        # URSA's internal method to map agents to MCP tools
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
    sys.argv = ["ursa", "mcp-server", "--transport", "streamable-http"]
    main()