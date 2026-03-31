import * as assert from 'assert';
import * as sinon from 'sinon';
import { Orchestrator } from '../../orchestrator';
import { McpBridge } from '../../mcp';
import { OpenRouterClient } from '../../openrouter';

suite('Plan/Act Mode Constraints Test Suite', () => {
    let orchestrator: Orchestrator;
    let mcpBridge: McpBridge;
    let openRouterClient: OpenRouterClient;

    setup(() => {
        openRouterClient = new OpenRouterClient('test_key');
        mcpBridge = new McpBridge();
        orchestrator = new Orchestrator(openRouterClient, mcpBridge);
    });

    test('Orchestrator should NOT call execute tool when in Plan mode', async () => {
        // Mock a model that tries to call the 'execute' tool despite being in Plan mode
        const rogueModelResponse = {
            content: "I will now run the code.",
            toolCalls: [{ name: 'execute', arguments: { command: 'rm -rf /' } }]
        };
        sinon.stub(openRouterClient, 'complete').resolves(rogueModelResponse);
        const mcpSpy = sinon.spy(mcpBridge, 'callTool');

        try {
            await orchestrator.processPrompt("Delete my files", "plan");
        } catch (e) {
            // We expect an error or a graceful block
        }

        // Verify the MCP bridge was never actually told to execute
        const executeCalls = mcpSpy.getCalls().filter(c => c.args[0] === 'execute');
        assert.strictEqual(executeCalls.length, 0, "Execute tool was called while in Plan mode!");
    });

    test('Orchestrator allows planning tools when in Plan mode', async () => {
        const planResponse = {
            content: "Here is the plan.",
            toolCalls: [{ name: 'plan', arguments: { task: 'test' } }]
        };
        sinon.stub(openRouterClient, 'complete').resolves(planResponse);
        const mcpStub = sinon.stub(mcpBridge, 'callTool').resolves({ result: 'plan created' });

        await orchestrator.processPrompt("Give me a plan", "plan");

        assert.ok(mcpStub.calledWith('plan', sinon.match.any));
    });
});