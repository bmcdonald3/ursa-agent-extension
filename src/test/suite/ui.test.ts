import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('URSA-Coder UI Bridge Test Suite', () => {
    test('Extension contributes the URSA Coder sidebar view', () => {
        const extension = vscode.extensions.getExtension('your-publisher.ursa-coder');
        assert.ok(extension?.packageJSON.contributes.views.ursaCoder);
    });

    test('ChatViewProvider handles message from Webview', async () => {
        // This test ensures that when the UI sends a 'sendPrompt' command, 
        // the extension logic is actually triggered.
        const provider = (global as any).chatProvider; // Assuming you store it here for testing
        const orchestratorSpy = sinon.spy(provider['_orchestrator'], 'processPrompt');
        
        // Mock a message coming from the HTML/JS frontend
        await provider['_onDidReceiveMessage']({
            command: 'sendPrompt',
            text: 'Test Prompt'
        });

        assert.strictEqual(orchestratorSpy.calledOnceWith('Test Prompt'), true);
    });
});