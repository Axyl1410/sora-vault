/**
 * Custom hooks for comment-related operations
 */

import {
	useCurrentAccount,
	useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { MODULES, SYSTEM_OBJECTS } from "../config/constants";
import { useNetworkVariable } from "../networkConfig";
import { buildTarget } from "../utils/sui";

/**
 * Hook to create a comment on an article
 */
export function useCreateComment() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();
	const packageId = useNetworkVariable("packageId");

	const createComment = async (
		articleId: string,
		subscriptionId: string,
		content: string,
	) => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		const tx = new Transaction();

		const comment = tx.moveCall({
			target: buildTarget(packageId, MODULES.COMMENT, "create_comment"),
			arguments: [
				tx.object(articleId),
				tx.object(subscriptionId),
				tx.pure.string(content),
				tx.object(SYSTEM_OBJECTS.CLOCK),
			],
		});

		tx.transferObjects([comment], account.address);

		return await signAndExecute({ transaction: tx });
	};

	return { createComment };
}

/**
 * Hook to reply to an existing comment
 */
export function useReplyToComment() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();
	const packageId = useNetworkVariable("packageId");

	const replyToComment = async (
		articleId: string,
		subscriptionId: string,
		parentCommentId: string,
		content: string,
	) => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		const tx = new Transaction();

		// Contract signature: reply_to_comment(article, parent_comment, subscription, content, clock, ctx)
		const reply = tx.moveCall({
			target: buildTarget(packageId, MODULES.COMMENT, "reply_to_comment"),
			arguments: [
				tx.object(articleId),
				tx.object(parentCommentId),
				tx.object(subscriptionId),
				tx.pure.string(content),
				tx.object(SYSTEM_OBJECTS.CLOCK),
			],
		});

		tx.transferObjects([reply], account.address);

		return await signAndExecute({ transaction: tx });
	};

	return { replyToComment };
}

/**
 * Hook to update a comment (author only)
 */
export function useUpdateComment() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const packageId = useNetworkVariable("packageId");

	const updateComment = async (commentId: string, newContent: string) => {
		const tx = new Transaction();

		tx.moveCall({
			target: buildTarget(packageId, MODULES.COMMENT, "update_comment"),
			arguments: [
				tx.object(commentId),
				tx.pure.string(newContent),
				tx.object(SYSTEM_OBJECTS.CLOCK),
			],
		});

		return await signAndExecute({ transaction: tx });
	};

	return { updateComment };
}

/**
 * Hook to delete a comment (author only)
 */
export function useDeleteComment() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const packageId = useNetworkVariable("packageId");

	const deleteComment = async (commentId: string) => {
		const tx = new Transaction();

		tx.moveCall({
			target: buildTarget(packageId, MODULES.COMMENT, "delete_comment"),
			arguments: [tx.object(commentId), tx.object(SYSTEM_OBJECTS.CLOCK)],
		});

		return await signAndExecute({ transaction: tx });
	};

	return { deleteComment };
}
