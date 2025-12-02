/**
 * Hook for extending article epoch storage
 * Handles extending both article content blob and all image blobs
 */

import {
	useCurrentAccount,
	useSignAndExecuteTransaction,
	useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import { useNetworkVariable } from "../networkConfig";
import { extendBlobEpochs } from "../services/walrus";
import { logger } from "../utils/logger";

interface ImageMetadata {
	blob_id: string;
	width?: number;
	height?: number;
	alt?: string;
	position?: number;
}

interface ExtendArticleParams {
	articleId: string;
	articleBlobId: string;
	imageMetadata: string; // JSON string
	additionalEpochs: number;
}

interface ExtendResult {
	success: boolean;
	articleExtended: boolean;
	imagesExtended: number;
	totalImages: number;
	txDigest?: string;
	error?: Error;
}

export function useExtendArticleEpochs() {
	const [isExtending, setIsExtending] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const account = useCurrentAccount();
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const suiClient = useSuiClient();
	const packageId = useNetworkVariable("packageId");

	const extendArticleEpochs = async (
		params: ExtendArticleParams,
	): Promise<ExtendResult> => {
		if (!account) {
			const err = new Error("Wallet not connected");
			setError(err);
			throw err;
		}

		setIsExtending(true);
		setError(null);

		const result: ExtendResult = {
			success: false,
			articleExtended: false,
			imagesExtended: 0,
			totalImages: 0,
		};

		try {
			logger.info(
				{
					context: "useExtendArticle",
					operation: "extendArticleEpochs",
					articleId: params.articleId,
					additionalEpochs: params.additionalEpochs,
				},
				"Starting epoch extension",
			);

			// Parse image metadata to get image blob IDs
			let imageBlobs: ImageMetadata[] = [];
			try {
				const metadata = JSON.parse(params.imageMetadata || "{}");
				imageBlobs = metadata.images || [];
				result.totalImages = imageBlobs.length;

				logger.info(
					{
						context: "useExtendArticle",
						operation: "extendArticleEpochs",
						imageCount: imageBlobs.length,
					},
					`Found ${imageBlobs.length} images to extend`,
				);
			} catch (err) {
				logger.warn(
					{
						context: "useExtendArticle",
						operation: "parseImageMetadata",
						error: err,
					},
					"Failed to parse image metadata, continuing with article blob only",
				);
			}

			// Step 1: Extend article blob
			logger.info(
				{
					context: "useExtendArticle",
					operation: "extendArticleBlob",
					blobId: params.articleBlobId,
				},
				"Extending article blob",
			);

			try {
				await extendBlobEpochs(
					params.articleBlobId,
					params.additionalEpochs,
					suiClient,
					account.address,
					signAndExecute,
				);
				result.articleExtended = true;
				logger.info(
					{
						context: "useExtendArticle",
						operation: "extendArticleBlob",
					},
					"Article blob extended successfully",
				);
			} catch (err) {
				logger.error(
					{
						context: "useExtendArticle",
						operation: "extendArticleBlob",
						error: err,
					},
					"Failed to extend article blob",
				);
				throw new Error(
					`Failed to extend article blob: ${err instanceof Error ? err.message : "Unknown error"}`,
				);
			}

			// Step 2: Extend all image blobs
			if (imageBlobs.length > 0) {
				logger.info(
					{
						context: "useExtendArticle",
						operation: "extendImageBlobs",
						count: imageBlobs.length,
					},
					`Extending ${imageBlobs.length} image blobs`,
				);

				for (let i = 0; i < imageBlobs.length; i++) {
					const imageBlob = imageBlobs[i];
					try {
						logger.info(
							{
								context: "useExtendArticle",
								operation: "extendImageBlob",
								index: i,
								blobId: imageBlob.blob_id,
							},
							`Extending image ${i + 1}/${imageBlobs.length}`,
						);

						await extendBlobEpochs(
							imageBlob.blob_id,
							params.additionalEpochs,
							suiClient,
							account.address,
							signAndExecute,
						);
						result.imagesExtended++;

						logger.info(
							{
								context: "useExtendArticle",
								operation: "extendImageBlob",
								index: i,
							},
							`Image ${i + 1}/${imageBlobs.length} extended successfully`,
						);
					} catch (err) {
						// Log error but continue with other images
						logger.error(
							{
								context: "useExtendArticle",
								operation: "extendImageBlob",
								index: i,
								blobId: imageBlob.blob_id,
								error: err,
							},
							`Failed to extend image ${i + 1}/${imageBlobs.length}`,
						);
						// We don't throw here, just continue with remaining images
					}
				}
			}

			// Step 3: Call Move function to emit event
			logger.info(
				{
					context: "useExtendArticle",
					operation: "emitEvent",
					articleId: params.articleId,
				},
				"Emitting extension event on-chain",
			);

			const tx = new Transaction();

			// Call the extend_article_epochs function
			if (!packageId) {
				throw new Error("Package ID not configured");
			}

			tx.moveCall({
				target: `${packageId}::article::extend_article_epochs`,
				arguments: [
					tx.object(params.articleId),
					tx.pure.u64(params.additionalEpochs),
					tx.object("0x6"), // Clock object ID
				],
			});

			const txResult = await signAndExecute({ transaction: tx });
			result.txDigest = txResult.digest;

			logger.info(
				{
					context: "useExtendArticle",
					operation: "emitEvent",
					txDigest: txResult.digest,
				},
				"Event emitted successfully",
			);

			result.success = true;
			return result;
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			logger.error(
				{
					context: "useExtendArticle",
					operation: "extendArticleEpochs",
					error,
				},
				"Epoch extension failed",
			);

			setError(error);
			result.error = error;
			throw error;
		} finally {
			setIsExtending(false);
		}
	};

	return {
		extendArticleEpochs,
		isExtending,
		error,
	};
}
