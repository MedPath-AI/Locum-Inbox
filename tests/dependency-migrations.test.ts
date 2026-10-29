import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

describe("dependency migrations", () => {
	it("uses the supported Agents AI SDK provider", () => {
		const agentSource = readFileSync("workers/agent/index.ts", "utf8");

		expect(packageJson.dependencies.ai).toMatch(/^\^7\./);
		expect(packageJson.dependencies["@ai-sdk/provider"]).toMatch(/^\^4\./);
		expect(packageJson.dependencies).not.toHaveProperty("workers-ai-provider");
		expect(agentSource).toContain('from "agents/models/ai-sdk"');
	});

	it("does not bypass peer dependency validation", () => {
		expect(() => readFileSync(".npmrc", "utf8")).toThrow();
	});

	it("uses the stateless MCP v2 server", () => {
		const mcpSource = readFileSync("workers/mcp/index.ts", "utf8");

		expect(packageJson.dependencies).not.toHaveProperty("@modelcontextprotocol/sdk");
		expect(mcpSource).toContain('from "agents/mcp/server"');
		expect(mcpSource).not.toContain("McpAgent");
	});
});
