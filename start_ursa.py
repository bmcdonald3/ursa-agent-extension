import sys
import os
from ursa.cli.hitl import HITL
from fastmcp import FastMCP

# 1. Monkey-patch URSA to be compatible with FastMCP 3.0+
def fixed_as_mcp_server(self, **kwargs):
    # FastMCP 3.0+ constructor ONLY takes the name.
    mcp = FastMCP("URSA")
    
    # Register all URSA agents as tools
    for name, agent in self.agents.items():
        mcp.tool(
            self._make_agent_tool(name),
            name=name,
            description=agent.description or f"URSA {name} agent"
        )
    
    return mcp

HITL.as_mcp_server = fixed_as_mcp_server

# 2. Set the Environment Variables for the 2026 version of FastMCP
os.environ["FASTMCP_HOST"] = "localhost"
os.environ["FASTMCP_PORT"] = "8000"
os.environ["OPENAI_API_KEY"] = "ollama"
os.environ["URSA_LLM_MODEL__MODEL"] = "ollama:qwen2.5-coder"
os.environ["URSA_LLM_MODEL__BASE_URL"] = "http://localhost:11434/v1"

# 3. Import and run the actual URSA command
from ursa.cli import main
if __name__ == "__main__":
    # Simulate running 'ursa mcp-server --transport streamable-http'
    sys.argv = ["ursa", "mcp-server", "--transport", "streamable-http"]
    main()