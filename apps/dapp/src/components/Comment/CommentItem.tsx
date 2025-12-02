/**
 * CommentItem - Individual comment display with actions
 */

import {
	ChatBubbleIcon,
	InfoCircledIcon,
	Pencil1Icon,
	TrashIcon,
} from "@radix-ui/react-icons";
import {
	Badge,
	Box,
	Button,
	Callout,
	Card,
	Dialog,
	Flex,
	Text,
	TextArea,
} from "@radix-ui/themes";
import { useState } from "react";
import { useDeleteComment, useUpdateComment } from "../../hooks/useComment";
import type { Comment } from "../../types";
import { logger } from "../../utils/logger";
import { formatTimestamp } from "../../utils/sui";
import { CommentForm } from "./CommentForm";

interface CommentItemProps {
	comment: Comment;
	articleId: string;
	subscriptionId: string;
	currentUserAddress?: string;
	onReplySuccess?: () => void;
	onUpdateSuccess?: () => void;
	onDeleteSuccess?: () => void;
	depth?: number;
}

export function CommentItem({
	comment,
	articleId,
	subscriptionId,
	currentUserAddress,
	onReplySuccess,
	onUpdateSuccess,
	onDeleteSuccess,
	depth = 0,
}: CommentItemProps) {
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { updateComment } = useUpdateComment();
	const { deleteComment } = useDeleteComment();

	const isAuthor = currentUserAddress && comment.author === currentUserAddress;
	const isDeleted = comment.is_deleted;
	const isEdited = comment.updated_at !== comment.created_at;

	const handleUpdate = async () => {
		if (!editContent.trim()) {
			setError("Comment cannot be empty");
			return;
		}

		try {
			setLoading(true);
			setError(null);

			await updateComment(comment.id, editContent);

			setEditDialogOpen(false);
			if (onUpdateSuccess) {
				onUpdateSuccess();
			}
		} catch (err: any) {
			logger.error(
				{
					context: "CommentItem",
					operation: "update_comment",
					error: err,
					commentId: comment.id,
				},
				"Comment update error",
			);
			setError(err.message || "Failed to update comment");
		} finally {
			setLoading(false);
		}
	};

	const handleDelete = async () => {
		try {
			setLoading(true);
			setError(null);

			await deleteComment(comment.id);

			setDeleteDialogOpen(false);
			if (onDeleteSuccess) {
				onDeleteSuccess();
			}
		} catch (err: any) {
			logger.error(
				{
					context: "CommentItem",
					operation: "delete_comment",
					error: err,
					commentId: comment.id,
				},
				"Comment delete error",
			);
			setError(err.message || "Failed to delete comment");
		} finally {
			setLoading(false);
		}
	};

	if (isDeleted) {
		return (
			<Card style={{ opacity: 0.6, marginLeft: `${depth * 24}px` }}>
				<Text size="2" color="gray" style={{ fontStyle: "italic" }}>
					[Comment deleted]
				</Text>
			</Card>
		);
	}

	return (
		<Box style={{ marginLeft: `${depth * 24}px` }}>
			<Card>
				<Flex direction="column" gap="3">
					{/* Comment Header */}
					<Flex justify="between" align="start">
						<Flex direction="column" gap="1">
							<Flex align="center" gap="2">
								<Text
									size="2"
									weight="bold"
									style={{
										fontFamily: "monospace",
										fontSize: "11px",
									}}
								>
									{comment.author.slice(0, 6)}...{comment.author.slice(-4)}
								</Text>
								{isAuthor && (
									<Badge color="blue" size="1">
										You
									</Badge>
								)}
								{isEdited && (
									<Badge color="gray" size="1">
										Edited
									</Badge>
								)}
							</Flex>
							<Text size="1" color="gray">
								{formatTimestamp(comment.created_at)}
							</Text>
						</Flex>
					</Flex>

					{/* Comment Content */}
					<Text size="2">{comment.content}</Text>

					{/* Actions */}
					<Flex gap="2">
						<Button
							size="1"
							variant="soft"
							onClick={() => setShowReplyForm(!showReplyForm)}
						>
							<ChatBubbleIcon width="12" height="12" />
							Reply
						</Button>

						{isAuthor && (
							<>
								<Dialog.Root
									open={editDialogOpen}
									onOpenChange={setEditDialogOpen}
								>
									<Dialog.Trigger>
										<Button size="1" variant="soft" color="gray">
											<Pencil1Icon width="12" height="12" />
											Edit
										</Button>
									</Dialog.Trigger>

									<Dialog.Content>
										<Dialog.Title>Edit Comment</Dialog.Title>
										<Flex direction="column" gap="3" mt="3">
											<TextArea
												value={editContent}
												onChange={(e) => setEditContent(e.target.value)}
												rows={4}
												disabled={loading}
											/>

											{error && (
												<Callout.Root color="red">
													<Callout.Icon>
														<InfoCircledIcon />
													</Callout.Icon>
													<Callout.Text>{error}</Callout.Text>
												</Callout.Root>
											)}

											<Flex gap="3" justify="end">
												<Dialog.Close>
													<Button
														variant="soft"
														color="gray"
														disabled={loading}
													>
														Cancel
													</Button>
												</Dialog.Close>
												<Button
													onClick={handleUpdate}
													disabled={loading || !editContent.trim()}
												>
													{loading ? "Updating..." : "Update"}
												</Button>
											</Flex>
										</Flex>
									</Dialog.Content>
								</Dialog.Root>

								<Dialog.Root
									open={deleteDialogOpen}
									onOpenChange={setDeleteDialogOpen}
								>
									<Dialog.Trigger>
										<Button size="1" variant="soft" color="red">
											<TrashIcon width="12" height="12" />
											Delete
										</Button>
									</Dialog.Trigger>

									<Dialog.Content>
										<Dialog.Title>Delete Comment</Dialog.Title>
										<Dialog.Description size="2" mt="2">
											Are you sure you want to delete this comment? This action
											cannot be undone.
										</Dialog.Description>

										{error && (
											<Callout.Root color="red" mt="3">
												<Callout.Icon>
													<InfoCircledIcon />
												</Callout.Icon>
												<Callout.Text>{error}</Callout.Text>
											</Callout.Root>
										)}

										<Flex gap="3" mt="4" justify="end">
											<Dialog.Close>
												<Button variant="soft" color="gray" disabled={loading}>
													Cancel
												</Button>
											</Dialog.Close>
											<Button
												color="red"
												onClick={handleDelete}
												disabled={loading}
											>
												{loading ? "Deleting..." : "Delete"}
											</Button>
										</Flex>
									</Dialog.Content>
								</Dialog.Root>
							</>
						)}
					</Flex>

					{/* Reply Form */}
					{showReplyForm && (
						<Box mt="2">
							<CommentForm
								articleId={articleId}
								subscriptionId={subscriptionId}
								parentCommentId={comment.id}
								onSuccess={() => {
									setShowReplyForm(false);
									if (onReplySuccess) {
										onReplySuccess();
									}
								}}
								onCancel={() => setShowReplyForm(false)}
								placeholder="Write your reply..."
							/>
						</Box>
					)}
				</Flex>
			</Card>
		</Box>
	);
}
