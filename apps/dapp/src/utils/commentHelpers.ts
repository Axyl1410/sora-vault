/**
 * Utility functions for comment operations
 */

import type { Comment, CommentThread } from "../types";

/**
 * Build nested comment tree from flat array of comments
 */
export function buildCommentThread(comments: Comment[]): CommentThread[] {
	const commentMap = new Map<string, CommentThread>();
	const rootComments: CommentThread[] = [];

	// Create map of all comments with replies array
	comments.forEach((comment) => {
		commentMap.set(comment.id, { ...comment, replies: [] });
	});

	// Build tree structure by linking parents and children
	comments.forEach((comment) => {
		const commentWithReplies = commentMap.get(comment.id);
		if (!commentWithReplies) return;

		if (comment.parent_comment_id) {
			const parent = commentMap.get(comment.parent_comment_id);
			if (parent) {
				parent.replies.push(commentWithReplies);
			} else {
				// Parent not found, treat as root
				rootComments.push(commentWithReplies);
			}
		} else {
			rootComments.push(commentWithReplies);
		}
	});

	// Sort root comments by created_at (newest first)
	rootComments.sort((a, b) => parseInt(b.created_at) - parseInt(a.created_at));

	// Sort replies by created_at (oldest first)
	rootComments.forEach((comment) => {
		sortRepliesRecursively(comment);
	});

	return rootComments;
}

/**
 * Recursively sort replies by created_at (oldest first)
 */
function sortRepliesRecursively(comment: CommentThread): void {
	comment.replies.sort(
		(a, b) => parseInt(a.created_at) - parseInt(b.created_at),
	);

	comment.replies.forEach((reply) => {
		sortRepliesRecursively(reply);
	});
}

/**
 * Flatten comment thread back to array
 */
export function flattenCommentThread(comments: CommentThread[]): Comment[] {
	const result: Comment[] = [];

	function flatten(comment: CommentThread) {
		const { replies, ...commentData } = comment;
		result.push(commentData);
		replies.forEach(flatten);
	}

	comments.forEach(flatten);
	return result;
}

/**
 * Count total comments including replies
 */
export function countComments(comments: CommentThread[]): number {
	let count = 0;

	function countRecursive(comment: CommentThread) {
		count += 1;
		comment.replies.forEach(countRecursive);
	}

	comments.forEach(countRecursive);
	return count;
}

/**
 * Find comment by ID in tree
 */
export function findCommentById(
	comments: CommentThread[],
	commentId: string,
): CommentThread | null {
	for (const comment of comments) {
		if (comment.id === commentId) {
			return comment;
		}
		const found = findCommentById(comment.replies, commentId);
		if (found) {
			return found;
		}
	}
	return null;
}

/**
 * Get maximum nesting depth
 */
export function getMaxDepth(comments: CommentThread[]): number {
	if (comments.length === 0) return 0;

	let maxDepth = 1;

	function getDepth(comment: CommentThread, currentDepth: number): number {
		if (comment.replies.length === 0) {
			return currentDepth;
		}
		return Math.max(
			...comment.replies.map((reply) => getDepth(reply, currentDepth + 1)),
		);
	}

	comments.forEach((comment) => {
		const depth = getDepth(comment, 1);
		if (depth > maxDepth) {
			maxDepth = depth;
		}
	});

	return maxDepth;
}

/**
 * Filter deleted comments from tree
 */
export function filterDeletedComments(
	comments: CommentThread[],
): CommentThread[] {
	return comments
		.filter((comment) => !comment.is_deleted)
		.map((comment) => ({
			...comment,
			replies: filterDeletedComments(comment.replies),
		}));
}

/**
 * Get all comment authors (unique)
 */
export function getUniqueAuthors(comments: CommentThread[]): string[] {
	const authors = new Set<string>();

	function collectAuthors(comment: CommentThread) {
		authors.add(comment.author);
		comment.replies.forEach(collectAuthors);
	}

	comments.forEach(collectAuthors);
	return Array.from(authors);
}
