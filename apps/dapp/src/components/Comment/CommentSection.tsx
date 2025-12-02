/**
 * CommentSection - Main comment section container
 */

import { useCurrentAccount } from "@mysten/dapp-kit";
import { ChatBubbleIcon, InfoCircledIcon } from "@radix-ui/react-icons";
import {
	Box,
	Callout,
	Card,
	Flex,
	Heading,
	Separator,
	Text,
} from "@radix-ui/themes";
import { useArticleComments } from "../../hooks/useCommentQueries";
import type { CommentThread as CommentThreadType } from "../../types";
import { CommentForm } from "./CommentForm";
import { CommentThread } from "./CommentThread";

interface CommentSectionProps {
	articleId: string;
	subscriptionId?: string;
	hasAccess: boolean;
}

export function CommentSection({
	articleId,
	subscriptionId,
	hasAccess,
}: CommentSectionProps) {
	const account = useCurrentAccount();

	// Use React Query hook to fetch comments
	const {
		data: comments = [],
		isLoading: loading,
		error: queryError,
		refetch,
	} = useArticleComments(articleId);

	// Convert query error to string for display
	const error = queryError ? "Failed to load comments" : null;

	const handleCommentAction = () => {
		// Refetch comments after any action (create, reply, update, delete)
		refetch();
	};

	if (!hasAccess) {
		return (
			<Box mt="6">
				<Separator size="4" mb="4" />
				<Card>
					<Callout.Root color="blue">
						<Callout.Icon>
							<InfoCircledIcon />
						</Callout.Icon>
						<Callout.Text>
							Subscribe to this publication to view and post comments.
						</Callout.Text>
					</Callout.Root>
				</Card>
			</Box>
		);
	}

	if (!account) {
		return (
			<Box mt="6">
				<Separator size="4" mb="4" />
				<Card>
					<Callout.Root color="blue">
						<Callout.Icon>
							<InfoCircledIcon />
						</Callout.Icon>
						<Callout.Text>
							Connect your wallet to view and post comments.
						</Callout.Text>
					</Callout.Root>
				</Card>
			</Box>
		);
	}

	if (!subscriptionId) {
		return (
			<Box mt="6">
				<Separator size="4" mb="4" />
				<Card>
					<Callout.Root color="orange">
						<Callout.Icon>
							<InfoCircledIcon />
						</Callout.Icon>
						<Callout.Text>
							No active subscription found. Please subscribe to comment.
						</Callout.Text>
					</Callout.Root>
				</Card>
			</Box>
		);
	}

	return (
		<Box mt="6">
			<Separator size="4" mb="4" />

			<Flex direction="column" gap="4">
				<Flex align="center" gap="2">
					<ChatBubbleIcon width="20" height="20" />
					<Heading size="5">Comments ({comments.length})</Heading>
				</Flex>

				{/* Comment Form */}
				<Card>
					<CommentForm
						articleId={articleId}
						subscriptionId={subscriptionId}
						onSuccess={handleCommentAction}
					/>
				</Card>

				{/* Comments List */}
				{loading ? (
					<Card>
						<Text color="gray">Loading comments...</Text>
					</Card>
				) : error ? (
					<Callout.Root color="red">
						<Callout.Icon>
							<InfoCircledIcon />
						</Callout.Icon>
						<Callout.Text>{error}</Callout.Text>
					</Callout.Root>
				) : comments.length === 0 ? (
					<Card>
						<Text color="gray" size="2">
							No comments yet. Be the first to comment!
						</Text>
					</Card>
				) : (
					<CommentThread
						comments={comments}
						articleId={articleId}
						subscriptionId={subscriptionId}
						currentUserAddress={account.address}
						onCommentAction={handleCommentAction}
					/>
				)}
			</Flex>
		</Box>
	);
}
