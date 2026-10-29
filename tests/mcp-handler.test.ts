import { describe, expect, it } from "vitest";
import { createEmailMcpHandler } from "../workers/mcp";
import type { Env } from "../workers/types";

const executionContext = {
	waitUntil() {},
	passThroughOnException() {},
} as unknown as ExecutionContext;

function createHandler() {
	const env = {
		BUCKET: {
			head: async () => null,
		},
	} as unknown as Env;

	return createEmailMcpHandler(env);
}

async function mcpRequest(method: string, params: Record<string, unknown> = {}) {
	const response = await createHandler()(
		new Request("https://box.locumdoctor.sg/mcp", {
			method: "POST",
			headers: {
				Accept: "application/json, text/event-stream",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method,
				params,
			}),
		}),
		{} as Env,
		executionContext,
	);

	const body = await response.text();
	const payload = response.headers.get("content-type")?.includes("text/event-stream")
		? JSON.parse(body.match(/^data: (.+)$/m)?.[1] ?? "null")
		: JSON.parse(body);

	return { response, payload };
}

describe("MCP v2 handler", () => {
	it("initializes over stateless Streamable HTTP", async () => {
		const { response, payload } = await mcpRequest("initialize", {
			protocolVersion: "2025-06-18",
			capabilities: {},
			clientInfo: { name: "vitest", version: "1.0.0" },
		});

		expect(response.status).toBe(200);
		expect(payload.result.serverInfo).toEqual({
			name: "agentic-inbox",
			version: "1.0.0",
		});
	});

	it("exposes the expected email tools", async () => {
		const { response, payload } = await mcpRequest("tools/list");
		const names = payload.result.tools.map((tool: { name: string }) => tool.name);

		expect(response.status).toBe(200);
		expect(names).toEqual(expect.arrayContaining([
			"list_mailboxes",
			"list_emails",
			"get_email",
			"draft_reply",
			"send_email",
			"move_email",
		]));
	});
});
