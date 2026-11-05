import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { EmailSender } from "../../../../platform/email/email-sender.js";
import { AppError } from "../../../../platform/errors/app-error.js";
import type { EmailOutboxMessage } from "../../domain/email-outbox-message.js";
import type { OutboxRepository, OutboxErrorLogger } from "../ports.js";
import { drainOutbox } from "../drain-outbox.js";

describe("drain outbox", () => {
  const claim = jest.fn<OutboxRepository["claim"]>();
  const markSent = jest.fn<OutboxRepository["markSent"]>();
  const markFailed = jest.fn<OutboxRepository["markFailed"]>();
  const findProfile = jest.fn<OutboxRepository["findProfile"]>();
  const enqueue = jest.fn<OutboxRepository["enqueue"]>();
  const cleanup = jest.fn<OutboxRepository["cleanup"]>();
  const send = jest.fn<EmailSender["send"]>();
  const error = jest.fn<OutboxErrorLogger["error"]>();
  const message: EmailOutboxMessage = {
    id: "one",
    userId: "user",
    kind: "reminder",
    toEmail: "private@example.com",
    subject: "private subject",
    html: "<p>body</p>",
    text: "body",
    attempts: 1,
  };
  const second = { ...message, id: "two" };
  const run = () =>
    drainOutbox({
      outbox: { claim, markSent, markFailed, findProfile, enqueue, cleanup },
      email: { send },
      logger: { error },
      batchSize: 10,
    });
  beforeEach(() => {
    jest.resetAllMocks();
    claim.mockResolvedValue([message, second]);
    send.mockResolvedValue();
    markSent.mockResolvedValue();
    markFailed.mockResolvedValue();
  });
  it("claims a batch and sends all messages", async () => {
    await expect(run()).resolves.toEqual({ claimed: 2, sent: 2, retried: 0, failed: 0 });
    expect(claim).toHaveBeenCalledWith(10);
    expect(send).toHaveBeenCalledWith({
      to: message.toEmail,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    expect(markSent).toHaveBeenCalledTimes(2);
  });
  it("handles an empty claim", async () => {
    claim.mockResolvedValue([]);
    await expect(run()).resolves.toEqual({ claimed: 0, sent: 0, retried: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });
  it("records retryable and terminal failures without private data in logs", async () => {
    const terminal = { ...second, attempts: 5 };
    claim.mockResolvedValue([message, terminal]);
    send.mockRejectedValue(new AppError("unavailable", "BREVO_REJECTED", "failed"));
    await expect(run()).resolves.toEqual({ claimed: 2, sent: 0, retried: 1, failed: 1 });
    expect(markFailed).toHaveBeenCalledWith(message, "BREVO_REJECTED");
    expect(markFailed).toHaveBeenCalledWith(terminal, "BREVO_REJECTED");
    expect(error).toHaveBeenCalledWith({
      event: "notifications.outbox_send_failed",
      outboxId: "one",
      errorCode: "BREVO_REJECTED",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain(message.toEmail);
    expect(JSON.stringify(error.mock.calls)).not.toContain(message.subject);
  });
  it("uses SEND_FAILED for ordinary errors", async () => {
    claim.mockResolvedValue([message]);
    send.mockRejectedValue(new Error("failed"));
    await run();
    expect(markFailed).toHaveBeenCalledWith(message, "SEND_FAILED");
  });
  it("continues sending after a markSent failure", async () => {
    markSent.mockRejectedValueOnce(new Error("failed"));
    await expect(run()).resolves.toEqual({ claimed: 2, sent: 1, retried: 0, failed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith({
      event: "notifications.outbox_update_failed",
      outboxId: "one",
      errorCode: "OUTBOX_UPDATE_FAILED",
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain(message.toEmail);
    expect(JSON.stringify(error.mock.calls)).not.toContain(message.subject);
  });
});
