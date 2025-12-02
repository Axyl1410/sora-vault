/**
 * CommentThread - Nested comment tree display
 */

import { Flex } from "@radix-ui/themes";
import type { CommentThread as CommentThreadType } from "../../types";
import { CommentItem } from "./CommentItem";

interface CommentThreadProps {
	comments: CommentThreadType[];
	articleId: string;
	subscriptionId: string;
	currentUserAddress?: string;
	onCommentAction?: () => void;
	depth?: number;
}

export function CommentThread({
	comments,
	articleId,
	subscriptionId,
	currentUserAddress,
	onCommentAction,
	depth = 0,
}: CommentThreadProps) {
	return (
		<Flex direction="column" gap="3">
			{comments.map((comment) => (
				<Flex key={comment.id} direction="column" gap="2">
					<CommentItem
						comment={comment}
						articleId={articleId}
						subscriptionId={subscriptionId}
						currentUserAddress={currentUserAddress}
						onReplySuccess={onCommentAction}
						onUpdateSuccess={onCommentAction}
						onDeleteSuccess={onCommentAction}
						depth={depth}
					/>

					{/* Render nested replies */}
					{comment.replies && comment.replies.length > 0 && (
						<CommentThread
							comments={comment.replies}
							articleId={articleId}
							subscriptionId={subscriptionId}
							currentUserAddress={currentUserAddress}
							onCommentAction={onCommentAction}
							depth={depth + 1}
						/>
					)}
				</Flex>
			))}
		</Flex>
	);
}
