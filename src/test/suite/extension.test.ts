import * as assert from 'assert';
import * as sinon from 'sinon';
import { LLMClient } from '../../llmClient';
import { McpBridge } from '../../mcp';
import { Orchestrator } from '../../orchestrator';

suite('URSA-Coder Integration Test Suite', () => {
    let llmClient: LLMClient;
    let mcpBridge: McpBridge;
    let orchestrator: Orchestrator;

    setup(() => {
        llmClient = new LLMClient('test_api_key', 'https://openrouter.ai/api/v1', {
            'HTTP-Referer': 'https://github.com/ursa-coder',
            'X-Title': 'URSA Coder VS Code Extension'
        });
        mcpBridge = new McpBridge();
        orchestrator = new Orchestrator(llmClient, mcpBridge, 'test-model');
    });

    teardown(() => {
        sinon.restore();
    });

    test('LLMClient configures correct baseURL and headers', () => {
        const config = llmClient.getConfig();
        assert.strictEqual(config.baseURL, 'https://openrouter.ai/api/v1');
        assert.ok(config.defaultHeaders['HTTP-Referer']);
        assert.ok(config.defaultHeaders['X-Title']);
    });

    test('McpBridge connects and retrieves available URSA tools', async () => {
        // Mock the MCP SDK client behavior
        const mockTools = [
            { 
                name: 'plan', 
                description: 'Formulate an execution plan',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            },
            { 
                name: 'execute', 
                description: 'Run code in sandbox',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: { type: 'string' }
                    },
                    required: ['command']
                }
            }
        ];
        sinon.stub(mcpBridge, 'connect').resolves();
        sinon.stub(mcpBridge, 'listTools').resolves(mockTools);

        await mcpBridge.connect('http://localhost:8000/mcp');
        const tools = await mcpBridge.listTools();
        
        assert.strictEqual(tools.length, 2);
        assert.strictEqual(tools[0].name, 'plan');
    });

    test('McpBridge formats tool execution requests correctly', async () => {
        const executeStub = sinon.stub(mcpBridge, 'callTool').resolves({ result: 'success' });
        
        const response = await mcpBridge.callTool('execute', { command: 'ls -la' });
        
        assert.strictEqual(executeStub.calledOnce, true);
        assert.deepStrictEqual(executeStub.firstCall.args, ['execute', { command: 'ls -la' }]);
        assert.strictEqual(response.result, 'success');
    });

    test('Orchestrator halts loop when model returns final answer', async () => {
        // Simulate a model response that does NOT request a tool call
        const llmResponse = {
            content: "The task is complete.",
            toolCalls: []
        };
        sinon.stub(llmClient, 'complete').resolves(llmResponse);
        const mcpSpy = sinon.spy(mcpBridge, 'callTool');

        const finalOutput = await orchestrator.processPrompt("Summarize the project status.");

        assert.strictEqual(finalOutput, "The task is complete.");
        assert.strictEqual(mcpSpy.notCalled, true);
    });
});