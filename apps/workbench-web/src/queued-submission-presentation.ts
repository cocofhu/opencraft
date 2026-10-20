import type { IntlShape } from "@opencraft/i18n";
import type { IdentityAvatarContribution } from "@opencraft/extension-react";
import type { MessageSender } from "@opencraft/appserver-protocol";
import { restoreQueuedInput } from "@opencraft/composer-appserver";
import type { ComposerQueuedSubmissionPresentation } from "@opencraft/composer-editor";
import type { QueuedSubmission } from "@opencraft/chat-runtime";

export function queueSenderPresentation(sender: MessageSender | null | undefined, avatars: IdentityAvatarContribution | null) {
  return sender ? { name: sender.loginName, avatarUrl: avatars?.resolve(sender.kind, sender.loginName) ?? null } : null;
}

export function queuedSubmissionPresentation(
  submission: QueuedSubmission,
  reorderable: boolean,
  avatars: IdentityAvatarContribution | null = null,
  intl?: IntlShape,
): ComposerQueuedSubmissionPresentation {
  const localStatus = submission.pausedReason === "outbox-waiting"
    ? { id: "chat.outbox.waiting", defaultMessage: "Saved in this browser tab · sends automatically after reconnect" }
    : submission.pausedReason === "outbox-unconfirmed"
      ? { id: "chat.outbox.unconfirmed", defaultMessage: "Delivery unconfirmed · check the conversation before sending again" }
      : submission.pausedReason === "outbox-failed"
        ? { id: "chat.outbox.failed", defaultMessage: "Message not sent · remove it and retry after reconnect" } : null;
  return {
    sender: queueSenderPresentation(submission.sender, avatars),
    id: submission.serverSubmissionId ?? submission.commandId,
    preview: submission.preview,
    state: submission.state,
    operation: submission.operation,
    actionable: submission.serverSubmissionId !== null,
    dismissible: (submission.local === true && submission.state !== "submitting") || (submission.state === "failed" && submission.serverSubmissionId === null),
    reorderable: !submission.local && reorderable,
    editableContent: restoreQueuedInput(submission.input),
    pausedReason: localStatus ? intl?.formatMessage(localStatus) ?? localStatus.defaultMessage : submission.pausedReason,
    error: submission.error?.message ?? null,
  };
}
