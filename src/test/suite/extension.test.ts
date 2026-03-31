import * as assert from 'assert';
import * as sinon from 'sinon';
import { OpenRouterClient } from '../../openrouter';
import { McpBridge } from '../../mcp';
import { Orchestrator } from '../../orchestrator';

suite('URSA-Coder Integration Test Suite', () => {
    let openRouterClient: OpenRouterClient;
    let mcpBridge: McpBridge;
    let orchestrator: Orchestrator;

    setup(() => {
        openRouterClient = new OpenRouterClient('test_api_key');
        mcpBridge = new McpBridge();
        orchestrator = new Orchestrator(openRouterClient, mcpBridge);
    });

    teardown(() => {
        sinon.restore();
    });

    test('OpenRouterClient configures correct baseURL and headers', () => {
        const config = openRouterClient.getConfig();
        assert.strictEqual(config.baseURL, 'https://openrouter.ai/api/v1');
        assert.ok(config.defaultHeaders['HTTP-Referer']);
        assert.ok(config.defaultHeaders['X-Title']);
    });

    test('McpBridge connects and retrieves available URSA tools', async () => {
        // Mock the MCP SDK client behavior
        const mockTools = [
            { name: 'plan', description: 'Formulate an execution plan' },
            { name: 'execute', description: 'Run code in sandbox' }
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
        sinon.stub(openRouterClient, 'complete').resolves(llmResponse);
        const mcpSpy = sinon.spy(mcpBridge, 'callTool');

        const finalOutput = await orchestrator.processPrompt("Summarize the project status.");

        assert.strictEqual(finalOutput, "The task is complete.");
        assert.strictEqual(mcpSpy.notCalled, true);
    });
});