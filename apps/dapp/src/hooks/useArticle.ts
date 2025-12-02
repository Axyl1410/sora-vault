/**
 * Custom hooks for article-related operations
 */

import {
	useCurrentAccount,
	useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";
import { MODULES } from "../config/constants";
import { useNetworkVariable } from "../networkConfig";
import { type ImageMetadata, Tier } from "../types";
import { buildTarget } from "../utils/sui";

/**
 * Hook to publish a new article
 */
export function usePublishArticle() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();
	const packageId = useNetworkVariable("packageId");
	const treasuryId = useNetworkVariable("treasuryId");

	const publishArticle = async (
		publicationId: string,
		publisherCapId: string,
		title: string,
		excerpt: string,
		walrusBlobId: string,
		sealKeyId: string, // Hex string
		tier: Tier,
		imageMetadata?: ImageMetadata[],
	) => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		const tx = new Transaction();

		// Convert seal key ID from hex string to bytes
		const sealKeyIdBytes = fromHex(sealKeyId);

		// Construct Tier enum via Move call
		const tierFunctionMap: Record<Tier, string> = {
			[Tier.Free]: "create_tier_free",
			[Tier.Basic]: "create_tier_basic",
			[Tier.Premium]: "create_tier_premium",
		};

		const tierArg = tx.moveCall({
			target: buildTarget(
				packageId,
				MODULES.SUBSCRIPTION,
				tierFunctionMap[tier],
			),
			arguments: [],
		});

		// Prepare image metadata JSON
		const imageMetadataJson = imageMetadata
			? JSON.stringify({ images: imageMetadata })
			: "{}";

		// Split coins for article deposit (1% of premium price)
		const depositAmount = 1_000_000_000n; // 1 SUI as maximum deposit
		const [deposit] = tx.splitCoins(tx.gas, [tx.pure.u64(depositAmount)]);

		// Call publish_article function
		// Note: Article is now a shared object (not returned), so no transfer needed
		tx.moveCall({
			target: buildTarget(packageId, MODULES.ARTICLE, "publish_article"),
			arguments: [
				tx.object(publicationId),
				tx.object(treasuryId),
				tx.object(publisherCapId),
				tx.pure.string(title),
				tx.pure.string(excerpt),
				tx.pure.string(walrusBlobId),
				tx.pure.vector("u8", sealKeyIdBytes),
				tierArg,
				tx.pure.u64(Math.floor(Date.now() / 1000)), // published_at timestamp in seconds
				tx.pure.string(imageMetadataJson),
				deposit,
			],
		});

		const result = await signAndExecute({
			transaction: tx,
		});

		return result;
	};

	return { publishArticle };
}

/**
 * Hook to update article metadata
 */
export function useUpdateArticle() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const packageId = useNetworkVariable("packageId");

	const updateArticle = async (
		articleId: string,
		publisherCapId: string,
		newTitle: string,
		newExcerpt: string,
		imageMetadata?: ImageMetadata[],
	) => {
		const tx = new Transaction();

		const imageMetadataJson = imageMetadata
			? JSON.stringify({ images: imageMetadata })
			: "{}";

		tx.moveCall({
			target: buildTarget(packageId, MODULES.ARTICLE, "update_article"),
			arguments: [
				tx.object(articleId),
				tx.object(publisherCapId),
				tx.pure.string(newTitle),
				tx.pure.string(newExcerpt),
				tx.pure.string(imageMetadataJson),
			],
		});

		const result = await signAndExecute({
			transaction: tx,
		});

		return result;
	};

	return { updateArticle };
}

/**
 * Hook to archive an article
 */
export function useArchiveArticle() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const packageId = useNetworkVariable("packageId");

	const archiveArticle = async (articleId: string, publisherCapId: string) => {
		const tx = new Transaction();

		tx.moveCall({
			target: buildTarget(packageId, MODULES.ARTICLE, "archive_article"),
			arguments: [tx.object(articleId), tx.object(publisherCapId)],
		});

		const result = await signAndExecute({
			transaction: tx,
		});

		return result;
	};

	return { archiveArticle };
}
