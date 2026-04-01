import subprocess
from fastmcp import FastMCP

# 1. Create a Direct Tool server (Bypassing URSA Agents for now)
mcp = FastMCP("URSA-Direct-Tools")

# 2. Expose raw, functional tools directly to the MCP bridge
@mcp.tool()
def write_to_file(path: str, content: str) -> str:
    """Write content to a specific file path."""
    try:
        with open(path, 'w') as f:
            f.write(content)
        return f"Successfully wrote to {path}"
    except Exception as e:
        return f"Error writing file: {str(e)}"

@mcp.tool()
def run_command(command: str) -> str:
    """Execute a shell command."""
    try:
        result = subprocess.run(command, shell=True, text=True, capture_output=True, timeout=60)
        return f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    except Exception as e:
        return f"Command execution failed: {str(e)}"

# 3. Start the Server
if __name__ == "__main__":
    print("🚀 Starting Direct Tools MCP Server on http://localhost:8000/mcp")
    mcp.run(transport="streamable-http")