import os
import ast
import re
import chromadb
from chromadb.utils import embedding_functions
from fastmcp import FastMCP

mcp = FastMCP("URSA-Direct")

# Initialize ChromaDB
client = chromadb.PersistentClient(path="./ursa_rag_db")
emb_fn = embedding_functions.DefaultEmbeddingFunction()
collection = client.get_or_create_collection(name="project_code", embedding_function=emb_fn)

def get_chunks(path, content):
    """Break code into function and class-level chunks."""
    chunks = []
    ext = os.path.splitext(path)[1]
    
    if ext == '.py':
        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
                    start = node.lineno - 1
                    end = node.end_lineno
                    code_block = "\n".join(content.splitlines()[start:end])
                    chunks.append({"id": f"{path}:{node.name}", "text": code_block})
        except:
            chunks.append({"id": path, "text": content})
            
    elif ext in ['.ts', '.js']:
        # Regex to find functions, classes, and arrow function exports
        pattern = r'(?:export\s+)?(?:async\s+)?(?:function|class)\s+([a-zA-Z0-9_]+)|(?:const|let)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>'
        matches = re.finditer(pattern, content)
        # Simplified: if no matches, index whole file; else index found blocks
        # For a learning project, regex is a great starting point for TS
        for match in matches:
            name = match.group(1) or match.group(2)
            chunks.append({"id": f"{path}:{name}", "text": content}) # In production, slice by line offset
            
    if not chunks: # Fallback for other files
        chunks.append({"id": path, "text": content})
    return chunks

@mcp.tool()
def index_project(root_path: str) -> str:
    """Index project with function-level granularity."""
    supported_ext = {'.ts', '.js', '.py', '.json', '.md'}
    total_chunks = 0
    
    for root, _, files in os.walk(root_path):
        if any(ignored in root for ignored in ['node_modules', '.git', 'out', 'dist']):
            continue
            
        for file in files:
            if os.path.splitext(file)[1] in supported_ext:
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    chunks = get_chunks(path, content)
                    for chunk in chunks:
                        collection.upsert(
                            documents=[chunk['text']],
                            ids=[chunk['id']],
                            metadatas=[{"path": path, "type": "code_chunk"}]
                        )
                        total_chunks += 1
    return f"✅ Successfully indexed {total_chunks} code chunks."

@mcp.tool()
def semantic_search(query: str, n_results: int = 3) -> str:
    """Search for relevant code snippets."""
    results = collection.query(query_texts=[query], n_results=n_results)
    output = ""
    for i, doc in enumerate(results['documents'][0]):
        source_id = results['ids'][0][i]
        output += f"--- Result {i+1} ({source_id}) ---\n{doc}\n\n"
    return output

# Existing tools
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

if __name__ == "__main__":
    print("Starting Direct Tools MCP Server on http://localhost:8000/mcp")
    mcp.run(transport="streamable-http")