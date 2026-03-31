import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('ursa-coder.start', () => {
		vscode.window.showInformationMessage('URSA Coder activated!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}