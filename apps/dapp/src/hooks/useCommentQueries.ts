/**
 * React Query hooks for fetching and managing comments
 */

import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { useNetworkVariable } from "../networkConfig";
import type { Comment, CommentThread } from "../types";
import { buildCommentThread } from "../utils/commentHelpers";
import { logger } from "../utils/logger";

/**
 * Query comments for an article by fetching CommentCreated events
 * and building a nested comment thread
 *
 * @param articleId - The article ID to fetch comments for
 * @returns React Query result with CommentThread array
 */
export function useArticleComments(articleId: string) {
	const client = useSuiClient();
	const packageId = useNetworkVariable("packageId");

	return useQuery({
		queryKey: ["comments", articleId],
		queryFn: async () => {
			try {
				logger.info(
					{
						context: "useArticleComments",
						operation: "fetch",
						articleId,
					},
					"Fetching comments for article",
				);

				// 1. Query CommentCreated events
				const events = await client.queryEvents({
					query: {
						MoveEventType: `${packageId}::comment::CommentCreated`,
					},
				});

				logger.info(
					{
						context: "useArticleComments",
						operation: "fetch",
						totalEvents: events.data.length,
					},
					`Found ${events.data.length} total CommentCreated events`,
				);

				// 2. Filter by article_id
				const articleCommentEvents = events.data.filter((event: any) => {
					const parsedJson = event.parsedJson as any;
					return parsedJson.article_id === articleId;
				});

				logger.info(
					{
						context: "useArticleComments",
						operation: "fetch",
						articleId,
						matchingEvents: articleCommentEvents.length,
					},
					`Found ${articleCommentEvents.length} comments for article`,
				);

				// 3. Extract comment IDs from events
				const commentIds = articleCommentEvents.map(
					(event: any) => (event.parsedJson as any).comment_id,
				);

				if (commentIds.length === 0) {
					logger.info(
						{
							context: "useArticleComments",
							operation: "fetch",
							articleId,
						},
						"No comments found for article",
					);
					return [];
				}

				// 4. Fetch comment objects
				const commentObjects = await client.multiGetObjects({
					ids: commentIds,
					options: { showContent: true },
				});

				logger.info(
					{
						context: "useArticleComments",
						operation: "fetch",
						fetchedObjects: commentObjects.length,
					},
					`Fetched ${commentObjects.length} comment objects`,
				);

				// 5. Parse comment objects
				const comments: Comment[] = commentObjects
					.filter((obj) => obj.data?.content?.dataType === "moveObject")
					.map((obj) => {
						const fields = (obj.data?.content as any).fields;
						return {
							id: obj.data!.objectId,
							article_id: fields.article_id,
							author: fields.author,
							parent_comment_id: fields.parent_comment_id || null,
							content: fields.content,
							created_at: fields.created_at,
							updated_at: fields.updated_at,
							is_deleted: fields.is_deleted,
						};
					})
					.filter((comment) => !comment.is_deleted);

				logger.info(
					{
						context: "useArticleComments",
						operation: "fetch",
						activeComments: comments.length,
					},
					`Parsed ${comments.length} active comments`,
				);

				// 6. Build comment thread
				const threads = buildCommentThread(comments);

				logger.info(
					{
						context: "useArticleComments",
						operation: "fetch",
						rootComments: threads.length,
					},
					`Built comment thread with ${threads.length} root comments`,
				);

				return threads;
			} catch (error) {
				logger.error(
					{
						context: "useArticleComments",
						operation: "fetch",
						error,
						articleId,
					},
					"Failed to fetch comments",
				);
				throw error;
			}
		},
		enabled: !!articleId && !!packageId,
		staleTime: 30000, // Consider data fresh for 30 seconds
		refetchOnWindowFocus: true,
	});
}

/**
 * Get total comment count for an article (including replies)
 *
 * @param articleId - The article ID
 * @returns React Query result with comment count
 */
export function useArticleCommentCount(articleId: string) {
	const { data: comments = [] } = useArticleComments(articleId);

	const countCommentsRecursive = (threads: CommentThread[]): number => {
		let count = 0;
		for (const thread of threads) {
			count += 1; // Count this comment
			count += countCommentsRecursive(thread.replies); // Count replies
		}
		return count;
	};

	return countCommentsRecursive(comments);
}
