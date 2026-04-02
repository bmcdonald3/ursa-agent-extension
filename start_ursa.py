import os
import chromadb
from chromadb.utils import embedding_functions
from fastmcp import FastMCP

mcp = FastMCP("URSA-Direct")

# Initialize ChromaDB
client = chromadb.PersistentClient(path="./ursa_rag_db")
# Using a local embedding function (no API key needed)
emb_fn = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
collection = client.get_or_create_collection(name="project_code", embedding_function=emb_fn)

@mcp.tool()
def index_project(root_path: str) -> str:
    """Index all code files in the project for semantic search."""
    supported_ext = {'.ts', '.js', '.py', '.json', '.md'}
    count = 0
    for root, _, files in os.walk(root_path):
        if 'node_modules' in root or '.git' in root:
            continue
        for file in files:
            if os.path.splitext(file)[1] in supported_ext:
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Basic chunking by file (can be improved to function-level)
                    collection.upsert(
                        documents=[content],
                        ids=[path],
                        metadatas=[{"path": path}]
                    )
                    count += 1
    return f"Indexed {count} files successfully."

@mcp.tool()
def semantic_search(query: str, n_results: int = 3) -> str:
    """Search the codebase for relevant snippets using natural language."""
    results = collection.query(query_texts=[query], n_results=n_results)
    output = ""
    for i, doc in enumerate(results['documents'][0]):
        path = results['metadatas'][0][i]['path']
        output += f"--- Source: {path} ---\n{doc}\n\n"
    return output