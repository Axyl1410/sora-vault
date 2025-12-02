/**
 * ArticleEpochExtension Component
 * Allows anyone to extend the storage duration of an article and its images
 * Displays list of users who have extended the article
 */

import { useSuiClient } from "@mysten/dapp-kit";
import {
	CheckCircledIcon,
	ClockIcon,
	InfoCircledIcon,
	ReloadIcon,
} from "@radix-ui/react-icons";
import {
	Badge,
	Box,
	Button,
	Callout,
	Card,
	Flex,
	Separator,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useExtendArticleEpochs } from "../../hooks/useExtendArticle";
import { useNetworkVariable } from "../../networkConfig";
import type { Article } from "../../types";
import { logger } from "../../utils/logger";
import { shortenAddress } from "../../utils/sui";

interface ArticleEpochExtensionProps {
	article: Article;
}

interface ExtensionEvent {
	extender: string;
	additionalEpochs: number;
	timestamp: number;
	txDigest?: string;
}

export function ArticleEpochExtension({ article }: ArticleEpochExtensionProps) {
	const [epochs, setEpochs] = useState("5");
	const [extenders, setExtenders] = useState<ExtensionEvent[]>([]);
	const [loadingExtenders, setLoadingExtenders] = useState(false);
	const [extensionSuccess, setExtensionSuccess] = useState(false);

	const { extendArticleEpochs, isExtending, error } = useExtendArticleEpochs();
	const suiClient = useSuiClient();
	const packageId = useNetworkVariable("packageId");

	// Load extension events on mount
	useEffect(() => {
		loadExtensionEvents();
	}, [article.id]);

	// Reload events after successful extension
	useEffect(() => {
		if (extensionSuccess) {
			const timer = setTimeout(() => {
				loadExtensionEvents();
				setExtensionSuccess(false);
			}, 2000);
			return () => clearTimeout(timer);
		}
	}, [extensionSuccess]);

	const loadExtensionEvents = async () => {
		setLoadingExtenders(true);
		try {
			logger.info(
				{
					context: "ArticleEpochExtension",
					operation: "loadEvents",
					articleId: article.id,
				},
				"Loading extension events",
			);

			// Query events from Sui
			if (!packageId) {
				logger.warn(
					{
						context: "ArticleEpochExtension",
						operation: "loadEvents",
					},
					"Package ID not configured, cannot load events",
				);
				return;
			}

			const events = await suiClient.queryEvents({
				query: {
					MoveEventType: `${packageId}::article::ArticleEpochExtended`,
				},
			});

			// Filter events for this article and parse
			const articleExtensions: ExtensionEvent[] = [];

			for (const event of events.data) {
				try {
					const parsedEvent = event.parsedJson as any;

					// Check if this event is for our article
					if (parsedEvent.article_id === article.id) {
						articleExtensions.push({
							extender: parsedEvent.extender,
							additionalEpochs: Number(parsedEvent.additional_epochs),
							timestamp: Number(parsedEvent.timestamp),
							txDigest: event.id?.txDigest,
						});
					}
				} catch (err) {
					logger.warn(
						{
							context: "ArticleEpochExtension",
							operation: "parseEvent",
							error: err,
						},
						"Failed to parse event",
					);
				}
			}

			// Sort by timestamp (most recent first)
			articleExtensions.sort((a, b) => b.timestamp - a.timestamp);

			setExtenders(articleExtensions);

			logger.info(
				{
					context: "ArticleEpochExtension",
					operation: "loadEvents",
					count: articleExtensions.length,
				},
				`Loaded ${articleExtensions.length} extension events`,
			);
		} catch (err) {
			logger.error(
				{
					context: "ArticleEpochExtension",
					operation: "loadEvents",
					error: err,
				},
				"Failed to load extension events",
			);
		} finally {
			setLoadingExtenders(false);
		}
	};

	const handleExtend = async () => {
		const epochCount = Number.parseInt(epochs, 10);

		if (Number.isNaN(epochCount) || epochCount < 1) {
			logger.warn(
				{
					context: "ArticleEpochExtension",
					operation: "handleExtend",
					epochs,
				},
				"Invalid epoch count",
			);
			return;
		}

		try {
			const result = await extendArticleEpochs({
				articleId: article.id,
				articleBlobId: article.walrus_blob_id,
				imageMetadata: article.image_metadata,
				additionalEpochs: epochCount,
			});

			if (result.success) {
				setExtensionSuccess(true);
				logger.info(
					{
						context: "ArticleEpochExtension",
						operation: "handleExtend",
						result,
					},
					"Extension successful",
				);
			}
		} catch (err) {
			logger.error(
				{
					context: "ArticleEpochExtension",
					operation: "handleExtend",
					error: err,
				},
				"Extension failed",
			);
		}
	};

	const totalEpochsExtended = extenders.reduce(
		(sum, ext) => sum + ext.additionalEpochs,
		0,
	);

	return (
		<Card>
			<Flex direction="column" gap="4">
				{/* Header */}
				<Flex align="center" gap="2">
					<ClockIcon width="20" height="20" />
					<Text size="3" weight="bold">
						Storage Extension
					</Text>
				</Flex>

				<Separator size="4" />

				{/* Info */}
				<Callout.Root color="blue" size="1">
					<Callout.Icon>
						<InfoCircledIcon />
					</Callout.Icon>
					<Callout.Text>
						Anyone can extend the storage duration of this article and its
						images on Walrus. Each epoch is approximately 1 month of storage.
					</Callout.Text>
				</Callout.Root>

				{/* Extension Form */}
				<Flex direction="column" gap="3">
					<Flex gap="2" align="end">
						<Box style={{ flex: 1 }}>
							<Text size="2" weight="medium" mb="1">
								Additional Epochs
							</Text>
							<TextField.Root
								type="number"
								min="1"
								value={epochs}
								onChange={(e) => setEpochs(e.target.value)}
								placeholder="5"
								disabled={isExtending}
							/>
						</Box>
						<Button
							onClick={handleExtend}
							disabled={isExtending || !epochs}
							style={{ minWidth: "120px" }}
						>
							{isExtending ? (
								<>
									<ReloadIcon className="animate-spin" />
									Extending...
								</>
							) : (
								<>
									<ClockIcon />
									Gia hạn
								</>
							)}
						</Button>
					</Flex>

					<Text size="1" color="gray">
						Extending by {epochs || "0"} epoch(s) ≈{" "}
						{Number.parseInt(epochs || "0", 10)} month(s)
					</Text>
				</Flex>

				{/* Success Message */}
				{extensionSuccess && (
					<Callout.Root color="green">
						<Callout.Icon>
							<CheckCircledIcon />
						</Callout.Icon>
						<Callout.Text>
							Successfully extended storage! The article and all images will be
							available for longer.
						</Callout.Text>
					</Callout.Root>
				)}

				{/* Error Message */}
				{error && (
					<Callout.Root color="red">
						<Callout.Icon>
							<InfoCircledIcon />
						</Callout.Icon>
						<Callout.Text>
							<Text weight="bold" size="2">
								Extension failed
							</Text>
							<Text size="1">{error.message}</Text>
						</Callout.Text>
					</Callout.Root>
				)}

				<Separator size="4" />

				{/* Extenders List */}
				<Flex direction="column" gap="3">
					<Flex justify="between" align="center">
						<Text size="2" weight="bold">
							Extension History
						</Text>
						{totalEpochsExtended > 0 && (
							<Badge color="green" size="1">
								+{totalEpochsExtended} epochs total
							</Badge>
						)}
					</Flex>

					{loadingExtenders ? (
						<Flex justify="center" py="4">
							<ReloadIcon className="animate-spin" />
						</Flex>
					) : extenders.length === 0 ? (
						<Text size="2" color="gray" style={{ fontStyle: "italic" }}>
							No extensions yet. Be the first to extend this article!
						</Text>
					) : (
						<Flex direction="column" gap="2">
							{extenders.map((ext, index) => (
								<Card key={index} variant="surface" size="1">
									<Flex justify="between" align="center">
										<Flex direction="column" gap="1">
											<Flex align="center" gap="2">
												<Text size="2" weight="medium">
													{shortenAddress(ext.extender)}
												</Text>
												<Badge color="blue" size="1">
													+{ext.additionalEpochs} epochs
												</Badge>
											</Flex>
											<Text size="1" color="gray">
												{new Date(ext.timestamp * 1000).toLocaleDateString()} at{" "}
												{new Date(ext.timestamp * 1000).toLocaleTimeString()}
											</Text>
										</Flex>
										{ext.txDigest && (
											<Text
												size="1"
												color="gray"
												style={{ fontFamily: "monospace" }}
												title={ext.txDigest}
											>
												{ext.txDigest.slice(0, 8)}...
											</Text>
										)}
									</Flex>
								</Card>
							))}
						</Flex>
					)}
				</Flex>
			</Flex>
		</Card>
	);
}
