/**
 * ArticleEditor Component
 * Rich text editor for creating encrypted articles with Seal + Walrus
 */

import {
	useCurrentAccount,
	useSignAndExecuteTransaction,
	useSuiClient,
} from "@mysten/dapp-kit";
import {
	CheckCircledIcon,
	Cross2Icon,
	CrossCircledIcon,
	ImageIcon,
	InfoCircledIcon,
	PlusIcon,
} from "@radix-ui/react-icons";
import {
	Box,
	Button,
	Callout,
	Card,
	Container,
	Flex,
	Heading,
	IconButton,
	Select,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useState } from "react";
import { UI } from "../../config/constants";
import {
	usePublisherLayout,
	usePublisherPreferences,
} from "../../contexts/PublisherThemeContext";
import { usePublishEncryptedArticle } from "../../hooks/useEncryptedArticle";
import { useSealSession } from "../../providers/SealSessionProvider";
import { uploadImageToWalrus } from "../../services/walrus";
import { type ImageMetadata, Tier, type TierString } from "../../types";
import { logger } from "../../utils/logger";

export interface ArticleEditorProps {
	publicationId: string;
	publisherCapId: string;
	statsId: string;
	onSuccess?: (result: any) => void;
	onCancel?: () => void;
}

const TIER_OPTIONS: {
	value: TierString;
	label: string;
	description: string;
}[] = [
	{
		value: "Free",
		label: "Free Tier",
		description: "Available to all subscribers with free access",
	},
	{
		value: "Basic",
		label: "Basic Tier",
		description: "Requires Basic subscription or higher",
	},
	{
		value: "Premium",
		label: "Premium Tier",
		description: "Requires Premium subscription",
	},
];

export function ArticleEditor({
	publicationId,
	publisherCapId,
	statsId,
	onSuccess,
	onCancel,
}: ArticleEditorProps) {
	const [title, setTitle] = useState("");
	const [excerpt, setExcerpt] = useState("");
	const [content, setContent] = useState("");
	const [selectedTier, setSelectedTier] = useState<TierString>("Free");
	const [images, setImages] = useState<
		Array<{ file: File; preview: string; alt: string }>
	>([]);
	const [uploadingImages, setUploadingImages] = useState(false);

	const { publishArticle, isPublishing, error, sessionReady } =
		usePublishEncryptedArticle();
	const { initializeSession, isInitializing } = useSealSession();
	const client = useSuiClient();
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();

	// Publisher theme
	const layout = usePublisherLayout();
	const preferences = usePublisherPreferences();

	const [publishSuccess, setPublishSuccess] = useState(false);

	// Validation
	const isTitleValid =
		title.length >= UI.MIN_ARTICLE_TITLE_LENGTH &&
		title.length <= UI.MAX_ARTICLE_TITLE_LENGTH;
	const isExcerptValid = excerpt.length <= UI.MAX_EXCERPT_LENGTH;
	const isContentValid = content.length > 0;
	const canSubmit =
		isTitleValid &&
		isExcerptValid &&
		isContentValid &&
		!isPublishing &&
		sessionReady;

	const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;

		const newImages = Array.from(files).map((file) => ({
			file,
			preview: URL.createObjectURL(file),
			alt: "",
		}));

		setImages([...images, ...newImages]);
	};

	const handleImageRemove = (index: number) => {
		const newImages = [...images];
		URL.revokeObjectURL(newImages[index].preview);
		newImages.splice(index, 1);
		setImages(newImages);
	};

	const handleImageAltChange = (index: number, alt: string) => {
		const newImages = [...images];
		newImages[index].alt = alt;
		setImages(newImages);
	};

	const handlePublish = async () => {
		if (!canSubmit || !account) return;

		try {
			// Map string tier to enum
			const tierMap: Record<TierString, Tier> = {
				Free: Tier.Free,
				Basic: Tier.Basic,
				Premium: Tier.Premium,
			};

			// Upload images to Walrus and create metadata
			const imageMetadata: ImageMetadata[] = [];

			if (images.length > 0) {
				setUploadingImages(true);

				for (let i = 0; i < images.length; i++) {
					const image = images[i];
					try {
						logger.info(
							{
								context: "ArticleEditor",
								operation: "upload_image",
								imageIndex: i,
								fileName: image.file.name,
							},
							`Uploading image ${i + 1}/${images.length}`,
						);

						const result = await uploadImageToWalrus(
							image.file,
							client,
							account.address,
							signAndExecute,
							5, // 5 epochs storage
						);

						imageMetadata.push({
							blob_id: result.blobId,
							width: result.width,
							height: result.height,
							alt: image.alt || `Image ${i + 1}`,
							position: i,
						});

						logger.info(
							{
								context: "ArticleEditor",
								operation: "upload_image",
								imageIndex: i,
								blobId: result.blobId,
							},
							`Image ${i + 1}/${images.length} uploaded successfully`,
						);
					} catch (err) {
						logger.error(
							{
								context: "ArticleEditor",
								operation: "upload_image",
								error: err,
								fileName: image.file.name,
								imageIndex: i,
							},
							`Failed to upload image ${i + 1}`,
						);

						// Continue with other images, but log the failure
						// You can decide whether to block publish or allow it with warning
						throw new Error(`Failed to upload image: ${image.file.name}`);
					}
				}

				setUploadingImages(false);
			}

			const result = await publishArticle({
				publicationId,
				publisherCapId,
				statsId,
				title,
				excerpt,
				content,
				tier: tierMap[selectedTier],
				imageMetadata: imageMetadata.length > 0 ? imageMetadata : undefined,
			});

			setPublishSuccess(true);

			if (onSuccess) {
				onSuccess(result);
			}

			// Cleanup image previews
			images.forEach((img) => URL.revokeObjectURL(img.preview));

			// Reset form after 2 seconds
			setTimeout(() => {
				setTitle("");
				setExcerpt("");
				setContent("");
				setSelectedTier("Free");
				setImages([]);
				setPublishSuccess(false);
			}, 2000);
		} catch (err) {
			logger.error(
				{
					context: "ArticleEditor",
					operation: "publish",
					error: err,
					publicationId,
					title,
				},
				"Publish failed",
			);
			// Error is handled by the hook
		}
	};

	const handleInitializeSession = async () => {
		try {
			await initializeSession();
		} catch (err) {
			logger.error(
				{
					context: "ArticleEditor",
					operation: "initialize_session",
					error: err,
				},
				"Session initialization failed",
			);
		}
	};

	return (
		<Container size="3" py="6">
			<Card style={{ padding: `var(--space-${layout.cardPadding})` }}>
				<Flex direction="column" gap={layout.cardGap}>
					<Box>
						<Heading size="6" mb="2">
							Publish New Article
						</Heading>
						{preferences.showFormHelpers && (
							<Text color="gray" size="2">
								Your article will be encrypted with Seal and stored on Walrus
							</Text>
						)}
					</Box>

					{/* Seal Session Status */}
					{!sessionReady && (
						<Callout.Root color="blue">
							<Callout.Icon>
								<InfoCircledIcon />
							</Callout.Icon>
							<Callout.Text>
								Seal encryption requires a session key. Click below to
								initialize your session.
								<Box mt="2">
									<Button
										size="1"
										onClick={handleInitializeSession}
										disabled={isInitializing}
									>
										{isInitializing
											? "Initializing..."
											: "Initialize Seal Session"}
									</Button>
								</Box>
							</Callout.Text>
						</Callout.Root>
					)}

					{/* Success Message */}
					{publishSuccess && (
						<Callout.Root color="green">
							<Callout.Icon>
								<CheckCircledIcon />
							</Callout.Icon>
							<Callout.Text>
								Article published successfully! Encrypted with Seal and uploaded
								to Walrus.
							</Callout.Text>
						</Callout.Root>
					)}

					{/* Error Message */}
					{error && (
						<Callout.Root color="red">
							<Callout.Icon>
								<CrossCircledIcon />
							</Callout.Icon>
							<Callout.Text>{error.message}</Callout.Text>
						</Callout.Root>
					)}

					{/* Title Input */}
					<Box>
						<Text as="label" size="2" weight="bold" mb="1">
							Title *
						</Text>
						<TextField.Root
							placeholder="Enter article title..."
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							size="3"
						/>
						{preferences.showAdvancedAnalytics && (
							<Text size="1" color="gray">
								{title.length} / {UI.MAX_ARTICLE_TITLE_LENGTH} characters
							</Text>
						)}
					</Box>

					{/* Excerpt Input */}
					<Box>
						<Text as="label" size="2" weight="bold" mb="1">
							Excerpt
						</Text>
						<TextArea
							placeholder="Brief summary or teaser (optional)..."
							value={excerpt}
							onChange={(e) => setExcerpt(e.target.value)}
							rows={2}
							size="3"
						/>
						{preferences.showAdvancedAnalytics && (
							<Text size="1" color="gray">
								{excerpt.length} / {UI.MAX_EXCERPT_LENGTH} characters
							</Text>
						)}
					</Box>

					{/* Tier Selection */}
					<Box>
						<Text as="label" size="2" weight="bold" mb="1">
							Access Tier *
						</Text>
						<Select.Root
							value={selectedTier}
							onValueChange={(value) => setSelectedTier(value as TierString)}
						>
							<Select.Trigger placeholder="Select tier..." />
							<Select.Content>
								{TIER_OPTIONS.map((option) => (
									<Select.Item key={option.value} value={option.value}>
										<Flex direction="column" gap="1">
											<Text weight="bold">{option.label}</Text>
											<Text size="1" color="gray">
												{option.description}
											</Text>
										</Flex>
									</Select.Item>
								))}
							</Select.Content>
						</Select.Root>
					</Box>

					{/* Content Editor */}
					<Box>
						<Text as="label" size="2" weight="bold" mb="1">
							Content *
						</Text>
						<TextArea
							placeholder="Write your article content here... (will be encrypted with Seal)"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							rows={15}
							size="3"
						/>
						{preferences.showAdvancedAnalytics && (
							<Text size="1" color="gray">
								{content.length} characters • Markdown supported
							</Text>
						)}
					</Box>

					{/* Image Upload Section */}
					<Box>
						<Flex justify="between" align="center" mb="2">
							<Text as="label" size="2" weight="bold">
								Images (optional)
							</Text>
							<Button
								size="1"
								variant="soft"
								onClick={() => document.getElementById("image-upload")?.click()}
								disabled={isPublishing}
							>
								<PlusIcon width="14" height="14" />
								Add Images
							</Button>
							<input
								id="image-upload"
								type="file"
								accept="image/*"
								multiple
								style={{ display: "none" }}
								onChange={handleImageAdd}
							/>
						</Flex>

						{images.length > 0 && (
							<Card>
								<Flex direction="column" gap="3">
									{images.map((image, index) => (
										<Flex key={index} gap="3" align="start">
											<Box
												style={{
													position: "relative",
													width: "120px",
													height: "80px",
												}}
											>
												<img
													src={image.preview}
													alt={image.alt || `Image ${index + 1}`}
													style={{
														width: "100%",
														height: "100%",
														objectFit: "cover",
														borderRadius: "var(--radius-2)",
													}}
												/>
												<IconButton
													size="1"
													variant="solid"
													color="red"
													style={{
														position: "absolute",
														top: "4px",
														right: "4px",
													}}
													onClick={() => handleImageRemove(index)}
												>
													<Cross2Icon width="12" height="12" />
												</IconButton>
											</Box>
											<Box style={{ flex: 1 }}>
												<TextField.Root
													placeholder="Alt text (for accessibility)"
													value={image.alt}
													onChange={(e) =>
														handleImageAltChange(index, e.target.value)
													}
													size="2"
												/>
												<Text size="1" color="gray" mt="1">
													{image.file.name} (
													{(image.file.size / 1024).toFixed(1)} KB)
												</Text>
											</Box>
										</Flex>
									))}
								</Flex>
							</Card>
						)}

						{images.length === 0 && preferences.showFormHelpers && (
							<Callout.Root color="blue" size="1">
								<Callout.Icon>
									<ImageIcon />
								</Callout.Icon>
								<Callout.Text size="1">
									Images will be uploaded to Walrus and can be encrypted with
									Seal
								</Callout.Text>
							</Callout.Root>
						)}
					</Box>

					{/* Action Buttons */}
					<Flex gap="3" justify="end">
						{onCancel && (
							<Button
								variant="soft"
								color="gray"
								onClick={onCancel}
								disabled={isPublishing}
							>
								Cancel
							</Button>
						)}
						<Button
							onClick={handlePublish}
							disabled={!canSubmit || uploadingImages}
							size="3"
						>
							{isPublishing || uploadingImages ? (
								<>
									<Box as="span" mr="2">
										⏳
									</Box>
									{uploadingImages ? "Uploading images..." : "Publishing..."}
								</>
							) : (
								<>
									<Box as="span" mr="2">
										🔒
									</Box>
									Publish Encrypted Article
								</>
							)}
						</Button>
					</Flex>

					{/* Publishing Status */}
					{(isPublishing || uploadingImages) && (
						<Callout.Root>
							<Callout.Icon>
								<InfoCircledIcon />
							</Callout.Icon>
							<Callout.Text>
								<Box mb="1">
									<Text weight="bold">Publishing in progress...</Text>
								</Box>
								<Text size="1" color="gray" as="div">
									{uploadingImages && "Uploading images to Walrus..."}
									<br />
									{isPublishing && (
										<>
											1. Encrypting content with Seal
											<br />
											2. Uploading to Walrus
											<br />
											3. Creating on-chain article
										</>
									)}
								</Text>
							</Callout.Text>
						</Callout.Root>
					)}
				</Flex>
			</Card>
		</Container>
	);
}
