import { describe, expect, it } from "vitest";

import {
	buildReferencesChain,
	buildThreadingHeaders,
	escapeHtml,
	stripHtmlToText,
	textToHtml,
	validateSender,
} from "../workers/lib/email-helpers";

describe("email helpers", () => {
	it("normalizes recipients and validates the mailbox sender", () => {
		expect(
			validateSender(
				["Doctor@example.com", "Team@example.com"],
				{ email: "Jobs@LocumDoctor.sg", name: "Doctor Jobs" },
				"jobs@locumdoctor.sg",
			),
		).toEqual({
			toStr: "doctor@example.com, team@example.com",
			fromEmail: "jobs@locumdoctor.sg",
			fromDomain: "locumdoctor.sg",
		});
	});

	it("escapes plain text before creating HTML", () => {
		expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
			"&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
		);
		expect(textToHtml("one\ntwo")).toBe(
			'<div style="white-space:pre-wrap">one<br>two</div>',
		);
	});

	it("removes executable blocks when producing plain text", () => {
		expect(
			stripHtmlToText(
				"<style>.hidden{display:none}</style><p>Hello <strong>Doctor</strong></p><script>alert(1)</script>",
			),
		).toBe("Hello Doctor");
	});

	it("preserves reply threading references", () => {
		const chain = buildReferencesChain({
			id: "internal-id",
			message_id: "message-id@example.com",
			thread_id: "thread-id",
			email_references: '["first@example.com"]',
			subject: "Shift",
			sender: "sender@example.com",
			recipient: "jobs@locumdoctor.sg",
			date: "2026-10-29T00:00:00.000Z",
			read: true,
			starred: false,
		});

		expect(chain).toEqual({
			originalMsgId: "message-id@example.com",
			references: ["first@example.com", "message-id@example.com"],
			threadId: "thread-id",
		});
		expect(
			buildThreadingHeaders(chain.originalMsgId, chain.references),
		).toEqual({
			"In-Reply-To": "<message-id@example.com>",
			References: "<first@example.com> <message-id@example.com>",
		});
	});
});
