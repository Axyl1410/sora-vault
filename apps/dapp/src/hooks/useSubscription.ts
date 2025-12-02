/**
 * Custom hooks for subscription-related operations
 */

import {
	useCurrentAccount,
	useSignAndExecuteTransaction,
	useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { MODULES, SYSTEM_OBJECTS } from "../config/constants";
import { useNetworkVariable } from "../networkConfig";
import { Tier } from "../types";
import { logger } from "../utils/logger";
import { buildTarget } from "../utils/sui";

/**
 * Hook to subscribe to a publication
 */
export function useSubscribe() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();
	const packageId = useNetworkVariable("packageId");
	const treasuryId = useNetworkVariable("treasuryId");

	const subscribe = async (
		publicationId: string,
		tier: Tier,
		paymentAmount: bigint,
	) => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		const tx = new Transaction();

		// Split coins for payment
		const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(paymentAmount)]);

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

		// Call subscribe function
		// Contract signature: subscribe(publication, treasury, tier, payment, clock, ctx)
		const subscription = tx.moveCall({
			target: buildTarget(packageId, MODULES.SUBSCRIPTION, "subscribe"),
			arguments: [
				tx.object(publicationId),
				tx.object(treasuryId),
				tierArg,
				payment,
				tx.object(SYSTEM_OBJECTS.CLOCK),
			],
		});

		// Transfer subscription to sender
		tx.transferObjects([subscription], account.address);

		const result = await signAndExecute({
			transaction: tx,
		});

		return result;
	};

	return { subscribe };
}

/**
 * Hook to renew an existing subscription
 */
export function useRenewSubscription() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const packageId = useNetworkVariable("packageId");
	const treasuryId = useNetworkVariable("treasuryId");

	const renew = async (
		subscriptionId: string,
		publicationId: string,
		paymentAmount: bigint,
	) => {
		const tx = new Transaction();

		// Split coins for payment
		const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(paymentAmount)]);

		// Call renew function
		// Contract signature: renew(subscription, publication, treasury, payment, clock, ctx)
		tx.moveCall({
			target: buildTarget(packageId, MODULES.SUBSCRIPTION, "renew"),
			arguments: [
				tx.object(subscriptionId),
				tx.object(publicationId),
				tx.object(treasuryId),
				payment,
				tx.object(SYSTEM_OBJECTS.CLOCK),
			],
		});

		const result = await signAndExecute({
			transaction: tx,
		});

		return result;
	};

	return { renew };
}

/**
 * Hook to place subscription in Kiosk
 */
export function usePlaceInKiosk() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const packageId = useNetworkVariable("packageId");

	const placeInKiosk = async (
		kioskId: string,
		kioskCapId: string,
		subscriptionId: string,
	) => {
		const tx = new Transaction();

		tx.moveCall({
			target: buildTarget(packageId, MODULES.SUBSCRIPTION, "place_in_kiosk"),
			arguments: [
				tx.object(kioskId),
				tx.object(kioskCapId),
				tx.object(subscriptionId),
			],
		});

		const result = await signAndExecute({
			transaction: tx,
		});

		return result;
	};

	return { placeInKiosk };
}

/**
 * Hook to place subscription in Kiosk and list for sale in one transaction
 * This is more efficient and reliable than calling place + list separately
 */
export function usePlaceAndListForSale() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const client = useSuiClient();
	const packageId = useNetworkVariable("packageId");

	const placeAndListForSale = async (
		kioskId: string,
		kioskCapId: string,
		subscriptionId: string,
		price: bigint,
	) => {
		try {
			logger.info(
				{
					context: "usePlaceAndListForSale",
					operation: "place_and_list",
					kioskId,
					kioskCapId,
					subscriptionId,
					price: price.toString(),
				},
				"Placing and listing subscription for sale",
			);

			const tx = new Transaction();

			tx.moveCall({
				target: buildTarget(
					packageId,
					MODULES.SUBSCRIPTION,
					"place_and_list_for_sale",
				),
				arguments: [
					tx.object(kioskId),
					tx.object(kioskCapId),
					tx.object(subscriptionId),
					tx.pure.u64(price),
				],
			});

			const result = await signAndExecute({
				transaction: tx,
			});

			logger.info(
				{
					context: "usePlaceAndListForSale",
					operation: "place_and_list",
					txDigest: result.digest,
				},
				"Transaction executed, fetching full details...",
			);

			// Query the transaction to get events and object changes
			// signAndExecuteTransaction from dapp-kit doesn't return events reliably
			const txResult = await client.waitForTransaction({
				digest: result.digest,
				options: {
					showEffects: true,
					showObjectChanges: true,
					showEvents: true,
				},
			});

			logger.info(
				{
					context: "usePlaceAndListForSale",
					operation: "place_and_list",
					txDigest: result.digest,
					effects: txResult.effects,
					events: txResult.events,
					objectChanges: txResult.objectChanges,
				},
				"Place and list successful with full details",
			);

			// Return combined result
			return {
				...result,
				effects: txResult.effects,
				events: txResult.events,
				objectChanges: txResult.objectChanges,
			};
		} catch (error) {
			logger.error(
				{
					context: "usePlaceAndListForSale",
					operation: "place_and_list",
					error,
					kioskId,
					subscriptionId,
				},
				"Failed to place and list subscription",
			);
			throw error;
		}
	};

	return { placeAndListForSale };
}

/**
 * Hook to list subscription for sale in Kiosk
 * Note: Subscription must already be in the Kiosk
 */
export function useListSubscriptionForSale() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const packageId = useNetworkVariable("packageId");

	const listForSale = async (
		kioskId: string,
		kioskCapId: string,
		subscriptionId: string,
		price: bigint,
	) => {
		const tx = new Transaction();

		tx.moveCall({
			target: buildTarget(packageId, MODULES.SUBSCRIPTION, "list_for_sale"),
			arguments: [
				tx.object(kioskId),
				tx.object(kioskCapId),
				tx.object(subscriptionId),
				tx.pure.u64(price),
			],
		});

		const result = await signAndExecute({
			transaction: tx,
		});

		return result;
	};

	return { listForSale };
}

/**
 * Hook to change subscription tier (upgrade/downgrade)
 */
export function useChangeTier() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();
	const packageId = useNetworkVariable("packageId");
	const treasuryId = useNetworkVariable("treasuryId");

	const changeTier = async (
		oldSubscriptionId: string,
		publicationId: string,
		newTier: Tier,
		paymentAmount: bigint,
	) => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		const tx = new Transaction();

		const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(paymentAmount)]);

		const tierFunctionMap: Record<Tier, string> = {
			[Tier.Free]: "create_tier_free",
			[Tier.Basic]: "create_tier_basic",
			[Tier.Premium]: "create_tier_premium",
		};

		const tierArg = tx.moveCall({
			target: buildTarget(
				packageId,
				MODULES.SUBSCRIPTION,
				tierFunctionMap[newTier],
			),
			arguments: [],
		});

		const newSubscription = tx.moveCall({
			target: buildTarget(packageId, MODULES.SUBSCRIPTION, "change_tier"),
			arguments: [
				tx.object(oldSubscriptionId),
				tx.object(publicationId),
				tx.object(treasuryId),
				tierArg,
				payment,
				tx.object(SYSTEM_OBJECTS.CLOCK),
			],
		});

		tx.transferObjects([newSubscription], account.address);

		return await signAndExecute({ transaction: tx });
	};

	return { changeTier };
}

/**
 * Hook to change tier with auto-listing on Kiosk
 */
export function useChangeTierWithKiosk() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();
	const packageId = useNetworkVariable("packageId");
	const treasuryId = useNetworkVariable("treasuryId");

	const changeTierWithKiosk = async (
		oldSubscriptionId: string,
		publicationId: string,
		newTier: Tier,
		paymentAmount: bigint,
		kioskId: string,
		kioskCapId: string,
		suggestedPrice: bigint,
	) => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		const tx = new Transaction();

		const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(paymentAmount)]);

		const tierFunctionMap: Record<Tier, string> = {
			[Tier.Free]: "create_tier_free",
			[Tier.Basic]: "create_tier_basic",
			[Tier.Premium]: "create_tier_premium",
		};

		const tierArg = tx.moveCall({
			target: buildTarget(
				packageId,
				MODULES.SUBSCRIPTION,
				tierFunctionMap[newTier],
			),
			arguments: [],
		});

		const newSubscription = tx.moveCall({
			target: buildTarget(
				packageId,
				MODULES.SUBSCRIPTION,
				"change_tier_with_kiosk",
			),
			arguments: [
				tx.object(oldSubscriptionId),
				tx.object(publicationId),
				tx.object(treasuryId),
				tierArg,
				payment,
				tx.object(kioskId),
				tx.object(kioskCapId),
				tx.pure.u64(suggestedPrice),
				tx.object(SYSTEM_OBJECTS.CLOCK),
			],
		});

		tx.transferObjects([newSubscription], account.address);

		return await signAndExecute({ transaction: tx });
	};

	return { changeTierWithKiosk };
}

/**
 * Hook to update listing price
 */
export function useUpdateListingPrice() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const packageId = useNetworkVariable("packageId");

	const updateListingPrice = async (
		kioskId: string,
		kioskCapId: string,
		subscriptionId: string,
		newPrice: bigint,
	) => {
		const tx = new Transaction();

		tx.moveCall({
			target: buildTarget(
				packageId,
				MODULES.SUBSCRIPTION,
				"update_listing_price",
			),
			arguments: [
				tx.object(kioskId),
				tx.object(kioskCapId),
				tx.object(subscriptionId),
				tx.pure.u64(newPrice),
			],
		});

		return await signAndExecute({ transaction: tx });
	};

	return { updateListingPrice };
}

/**
 * Hook to calculate remaining value
 */
export function useCalculateRemainingValue() {
	const client = useSuiClient();
	const packageId = useNetworkVariable("packageId");
	const account = useCurrentAccount();

	const calculateRemainingValue = async (
		subscriptionId: string,
		publicationId: string,
	): Promise<bigint> => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		try {
			const tx = new Transaction();

			tx.moveCall({
				target: buildTarget(
					packageId,
					MODULES.SUBSCRIPTION,
					"calculate_remaining_value",
				),
				arguments: [
					tx.object(subscriptionId),
					tx.object(publicationId),
					tx.object(SYSTEM_OBJECTS.CLOCK),
				],
			});

			// Use devInspect to call view function without executing transaction
			const result = await client.devInspectTransactionBlock({
				transactionBlock: tx,
				sender: account.address,
			});

			// Parse u64 return value
			const returnValues = result.results?.[0]?.returnValues;
			if (!returnValues || returnValues.length === 0) {
				logger.warn(
					{
						context: "useCalculateRemainingValue",
						operation: "devInspect",
						subscriptionId,
						publicationId,
					},
					"No return value from calculate_remaining_value",
				);
				return 0n;
			}

			// Return value is [bytes, type] tuple
			const [valueBytes] = returnValues[0];

			// Convert bytes to bigint
			// For u64, bytes are little-endian
			let value = 0n;
			for (let i = 0; i < valueBytes.length; i++) {
				value += BigInt(valueBytes[i]) << BigInt(8 * i);
			}

			logger.info(
				{
					context: "useCalculateRemainingValue",
					operation: "devInspect",
					subscriptionId,
					value: value.toString(),
				},
				`Calculated remaining value: ${value} MIST`,
			);

			return value;
		} catch (error) {
			logger.error(
				{
					context: "useCalculateRemainingValue",
					operation: "devInspect",
					error,
					subscriptionId,
					publicationId,
				},
				"Failed to calculate remaining value",
			);
			// Return 0n instead of throwing to allow UI to continue
			return 0n;
		}
	};

	return { calculateRemainingValue };
}
