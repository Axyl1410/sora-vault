/**
 * Article Reader Page
 * Displays encrypted articles with decrypt capability and access gates
 */

import { InfoCircledIcon } from "@radix-ui/react-icons";
import {
	Callout,
	Card,
	Container,
	Flex,
	Heading,
	Separator,
	Spinner,
} from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ArticleAccessGate } from "../components/Article/ArticleAccessGate";
import { ArticleReader } from "../components/Article/ArticleReader";
import { CommentSection } from "../components/Comment/CommentSection";
import { useArticleAccess } from "../hooks/useAccessQueries";
import { usePublisherCaps } from "../hooks/usePublisherCaps";
import {
	fetchArticleById,
	fetchPublicationById,
} from "../utils/graphqlQueries";

export function ArticleReaderPage() {
	const { articleId } = useParams();

	// Fetch article data
	const {
		data: article,
		isLoading: articleLoading,
		error: articleError,
	} = useQuery({
		queryKey: ["article", articleId],
		queryFn: () => fetchArticleById(articleId!),
		enabled: !!articleId,
	});

	// Fetch publication data (needed for access gate)
	const { data: publication, isLoading: publicationLoading } = useQuery({
		queryKey: ["publication", article?.publication_id],
		queryFn: () => fetchPublicationById(article!.publication_id),
		enabled: !!article?.publication_id,
	});

	// Check user's access to this article
	const { data: accessData, isLoading: accessLoading } =
		useArticleAccess(articleId);

	// Get publisher caps to check if user is owner
	const { data: publisherCaps } = usePublisherCaps();
	const publisherCap = publisherCaps?.find(
		(cap) => cap.publication_id === article?.publication_id,
	);

	const isLoading = articleLoading || publicationLoading || accessLoading;
	const hasAccess = accessData?.hasAccess || false;

	// No article ID provided
	if (!articleId) {
		return (
			<Container py="6">
				<Callout.Root color="red">
					<Callout.Icon>
						<InfoCircledIcon />
					</Callout.Icon>
					<Callout.Text>Article ID not provided</Callout.Text>
				</Callout.Root>
			</Container>
		);
	}

	// Loading state
	if (isLoading) {
		return (
			<Container py="6">
				<Flex justify="center" align="center" style={{ minHeight: "400px" }}>
					<Spinner size="3" />
				</Flex>
			</Container>
		);
	}

	// Error state
	if (articleError || !article) {
		return (
			<Container py="6">
				<Callout.Root color="red">
					<Callout.Icon>
						<InfoCircledIcon />
					</Callout.Icon>
					<Callout.Text>
						{articleError?.message || "Article not found"}
					</Callout.Text>
				</Callout.Root>
			</Container>
		);
	}

	// Publication not found
	if (!publication) {
		return (
			<Container py="6">
				<Callout.Root color="red">
					<Callout.Icon>
						<InfoCircledIcon />
					</Callout.Icon>
					<Callout.Text>Publication not found</Callout.Text>
				</Callout.Root>
			</Container>
		);
	}

	return (
		<Container size="4" py="6">
			<Flex direction="column" gap="6">
				{/* Article Header */}
				<Card>
					<Flex direction="column" gap="3">
						<Heading size="8">{article.title}</Heading>
						<Separator size="4" />
					</Flex>
				</Card>

				{/* Access Gate or Article Reader */}
				{hasAccess ? (
					<>
						{accessData?.method === "owner" && !publisherCap ? (
							<Callout.Root color="amber">
								<Callout.Icon>
									<InfoCircledIcon />
								</Callout.Icon>
								<Callout.Text>
									Publisher capability not found. Please refresh the page.
								</Callout.Text>
							</Callout.Root>
						) : (
							<ArticleReader
								article={article}
								subscriptionId={
									accessData?.method === "subscription"
										? accessData.objectId
										: undefined
								}
								readTokenId={
									accessData?.method === "token"
										? accessData.objectId
										: undefined
								}
								publisherCapId={
									accessData?.method === "owner" ? publisherCap?.id : undefined
								}
								publicationId={
									accessData?.method === "owner" ? publication.id : undefined
								}
								onSubscribe={() => {}}
								onPurchaseToken={() => {}}
							/>
						)}

						{/* Comment Section */}
						<CommentSection
							articleId={articleId}
							subscriptionId={
								accessData?.method === "subscription"
									? accessData.objectId
									: undefined
							}
							hasAccess={hasAccess}
						/>
					</>
				) : (
					<ArticleAccessGate
						article={article}
						publication={publication}
						hasAccess={hasAccess}
						accessMethod={accessData?.method}
						onAccessGranted={() => {
							// Reload to refresh access status
							window.location.reload();
						}}
					/>
				)}
			</Flex>
		</Container>
	);
}
