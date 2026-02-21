export {}

declare module "../__mocks__/vscode.js" {
	const vscodeMock: any
	export default vscodeMock
	export const workspace: any
	export const window: any
	export const commands: any
	export const languages: any
	export const extensions: any
	export const env: any
	export const Uri: any
	export const Range: any
	export const Position: any
	export const Selection: any
	export const Disposable: any
	export const ThemeIcon: any
	export const FileType: any
	export const DiagnosticSeverity: any
	export const OverviewRulerLane: any
	export const EventEmitter: any
	export const CodeAction: any
	export const CodeActionKind: any
}
