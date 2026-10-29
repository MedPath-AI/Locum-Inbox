import { describe, expect, it } from "vitest";

import { parseSearchQuery } from "../app/lib/search-parser";

describe("parseSearchQuery", () => {
	it("separates supported operators from free text", () => {
		expect(
			parseSearchQuery(
				'urgent shift from:"Doctor Jobs" in:inbox is:unread has:attachment',
			),
		).toEqual({
			query: "urgent shift",
			from: "Doctor Jobs",
			folder: "inbox",
			is_read: false,
			has_attachment: true,
		});
	});

	it("normalizes date filters", () => {
		const result = parseSearchQuery(
			"roster after:2026-10-01 before:2026-11-01",
		);

		expect(result.query).toBe("roster");
		expect(result.date_start).toBe("2026-10-01T00:00:00.000Z");
		expect(result.date_end).toBe("2026-11-01T00:00:00.000Z");
	});

	it("ignores unsupported operator values without losing free text", () => {
		expect(parseSearchQuery("locum is:unknown")).toEqual({ query: "locum" });
	});
});
