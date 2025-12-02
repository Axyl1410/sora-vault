/**
 * CommentForm - Form for creating and replying to comments
 */

import { InfoCircledIcon } from "@radix-ui/react-icons";
import { Box, Button, Callout, Flex, Text, TextArea } from "@radix-ui/themes";
import { useState } from "react";
import { useCreateComment, useReplyToComment } from "../../hooks/useComment";
import { logger } from "../../utils/logger";

interface CommentFormProps {
	articleId: string;
	subscriptionId: string;
	parentCommentId?: string;
	onSuccess?: () => void;
	onCancel?: () => void;
	placeholder?: string;
}

export function CommentForm({
	articleId,
	subscriptionId,
	parentCommentId,
	onSuccess,
	onCancel,
	placeholder = "Write your comment...",
}: CommentFormProps) {
	const [content, setContent] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { createComment } = useCreateComment();
	const { replyToComment } = useReplyToComment();

	const handleSubmit = async () => {
		if (!content.trim()) {
			setError("Comment cannot be empty");
			return;
		}

		try {
			setLoading(true);
			setError(null);

			if (parentCommentId) {
				await replyToComment(
					articleId,
					subscriptionId,
					parentCommentId,
					content,
				);
			} else {
				await createComment(articleId, subscriptionId, content);
			}

			setContent("");
			if (onSuccess) {
				onSuccess();
			}
		} catch (err: any) {
			logger.error(
				{
					context: "CommentForm",
					operation: parentCommentId ? "reply_to_comment" : "create_comment",
					error: err,
					articleId,
					parentCommentId,
				},
				"Comment submission error",
			);
			setError(err.message || "Failed to post comment");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Box>
			<TextArea
				placeholder={placeholder}
				value={content}
				onChange={(e) => setContent(e.target.value)}
				rows={parentCommentId ? 2 : 4}
				disabled={loading}
			/>

			{error && (
				<Callout.Root color="red" size="1" mt="2">
					<Callout.Icon>
						<InfoCircledIcon />
					</Callout.Icon>
					<Callout.Text>{error}</Callout.Text>
				</Callout.Root>
			)}

			<Flex gap="2" mt="2" justify="end">
				{onCancel && (
					<Button
						variant="soft"
						color="gray"
						size="2"
						onClick={onCancel}
						disabled={loading}
					>
						Cancel
					</Button>
				)}
				<Button
					size="2"
					onClick={handleSubmit}
					disabled={loading || !content.trim()}
				>
					{loading ? "Posting..." : parentCommentId ? "Reply" : "Post Comment"}
				</Button>
			</Flex>
		</Box>
	);
}
