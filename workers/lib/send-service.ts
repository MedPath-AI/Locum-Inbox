// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { sendEmail, type SendEmailParams } from "../email-sender";
import { storeAttachments, type StoredAttachment } from "./attachments";
import type { SendStatus } from "./schemas";
import { Folders } from "../../shared/folders";
import type { MailboxDO } from "../durableObject";
import type { Env } from "../types";

type RateLimitedMailboxStub = DurableObjectStub<MailboxDO> & {
	checkSendRateLimit: () => Promise<string | null>;
	updateSendStatus: (
		id: string,
		status: SendStatus,
		error?: string | null,
	) => Promise<unknown>;
};

interface OutboundEmailRecord {
	id: string;
	subject: string;
	sender: string;
	recipient: string;
	cc?: string | null;
	bcc?: string | null;
	date: string;
	body: string;
	in_reply_to?: string | null;
	email_references?: string | null;
	thread_id?: string | null;
	message_id?: string | null;
	raw_headers?: string | null;
}

interface SendRecordedEmailParams {
	env: Env;
	stub: DurableObjectStub<MailboxDO>;
	record: OutboundEmailRecord;
	email: SendEmailParams;
	attachments?: SendEmailParams["attachments"];
	afterSent?: () => Promise<void>;
}

export type SendRecordedEmailResult =
	| { status: "sent"; messageId: string }
	| { status: "failed"; messageId: string; error: string }
	| { status: "rate_limited"; error: string };

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export async function sendRecordedEmail({
	env,
	stub,
	record,
	email,
	attachments,
	afterSent,
}: SendRecordedEmailParams): Promise<SendRecordedEmailResult> {
	const mailboxStub = stub as RateLimitedMailboxStub;
	const rateLimitError = await mailboxStub.checkSendRateLimit();
	if (rateLimitError) return { status: "rate_limited", error: rateLimitError };

	const attachmentData: StoredAttachment[] = await storeAttachments(
		env.BUCKET,
		record.id,
		attachments,
	);

	await stub.createEmail(
		Folders.SENT,
		{
			...record,
			send_status: "queued",
			send_error: null,
		},
		attachmentData,
	);

	await mailboxStub.updateSendStatus(record.id, "sending");

	try {
		await sendEmail(env.EMAIL, email);
	} catch (error) {
		const message = errorMessage(error);
		console.error("Email send failed:", message);
		await mailboxStub.updateSendStatus(record.id, "failed", message);
		return { status: "failed", messageId: record.id, error: message };
	}

	await mailboxStub.updateSendStatus(record.id, "sent");
	if (afterSent) {
		await afterSent().catch((error) => {
			console.error("Post-send side effect failed:", errorMessage(error));
		});
	}
	return { status: "sent", messageId: record.id };
}
