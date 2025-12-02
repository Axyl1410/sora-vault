/**
 * Hooks for marketplace transactions (purchase, etc.)
 */

import {
	useCurrentAccount,
	useSignAndExecuteTransaction,
	useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useQueryClient } from "@tanstack/react-query";
import { useNetworkVariable } from "../networkConfig";
import { logger } from "../utils/logger";

/**
 * Hook to purchase subscription from Kiosk marketplace
 *
 * @returns Function to execute purchase transaction
 */
export function usePurchaseFromKiosk() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();
	const client = useSuiClient();
	const packageId = useNetworkVariable("packageId");

	const purchase = async (
		kioskId: string,
		subscriptionId: string,
		price: bigint,
		transferPolicyId?: string,
	) => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		try {
			logger.info(
				{
					context: "usePurchaseFromKiosk",
					operation: "purchase",
					kioskId,
					subscriptionId,
					price: price.toString(),
					transferPolicyId,
				},
				"Initiating purchase from Kiosk",
			);

			// If no transfer policy ID provided, try to find one
			let policyId = transferPolicyId;
			if (!policyId) {
				logger.info(
					{
						context: "usePurchaseFromKiosk",
						operation: "purchase",
					},
					"No TransferPolicy ID provided, querying from events...",
				);

				// Query for TransferPolicy<SubscriptionNFT> events
				// Note: This is a simplified approach - in production, you'd cache this
				try {
					const events = await client.queryEvents({
						query: {
							MoveEventType: `0x2::transfer_policy::TransferPolicyCreated<${packageId}::subscription::SubscriptionNFT>`,
						},
						limit: 10, // Query more events to find the right one
						order: "descending",
					});

					logger.info(
						{
							context: "usePurchaseFromKiosk",
							operation: "purchase",
							eventCount: events.data.length,
						},
						`Found ${events.data.length} TransferPolicyCreated events`,
					);

					if (events.data.length > 0) {
						// Get the most recent TransferPolicy
						// The event should have the policy ID in parsedJson
						const latestEvent = events.data[0];
						policyId = latestEvent.parsedJson?.id;

						logger.info(
							{
								context: "usePurchaseFromKiosk",
								operation: "purchase",
								policyId,
								eventData: latestEvent.parsedJson,
							},
							"Found TransferPolicy from events",
						);

						// Verify the policy exists
						if (policyId) {
							try {
								const policyObj = await client.getObject({
									id: policyId,
									options: {
										showType: true,
									},
								});

								if (!policyObj.data) {
									logger.warn(
										{
											context: "usePurchaseFromKiosk",
											operation: "purchase",
											policyId,
										},
										"TransferPolicy object not found, trying next event...",
									);

									// Try next event if available
									if (events.data.length > 1) {
										policyId = events.data[1].parsedJson?.id;
									} else {
										policyId = undefined;
									}
								} else {
									logger.info(
										{
											context: "usePurchaseFromKiosk",
											operation: "purchase",
											policyId,
											policyType: policyObj.data.type,
										},
										"Verified TransferPolicy exists",
									);
								}
							} catch (err) {
								logger.warn(
									{
										context: "usePurchaseFromKiosk",
										operation: "purchase",
										policyId,
										error: err,
									},
									"Failed to verify TransferPolicy, will try anyway",
								);
							}
						}
					}
				} catch (err) {
					logger.error(
						{
							context: "usePurchaseFromKiosk",
							operation: "purchase",
							error: err,
						},
						"Failed to query TransferPolicy events",
					);
				}
			}

			// If no transfer policy ID provided, throw error
			if (!policyId) {
				throw new Error(
					"No TransferPolicy found for SubscriptionNFT. " +
						"Subscriptions cannot be purchased from Kiosk without a transfer policy.",
				);
			}

			// Calculate royalty amount (default 10% = 1000 bps, min = 0)
			// This matches DEFAULT_ROYALTY_BPS in marketplace_policies.move
			const royaltyBps = 1000; // 10%
			const minRoyalty = 0n;
			const calculatedRoyalty = (price * BigInt(royaltyBps)) / 10000n;
			const royaltyAmount =
				calculatedRoyalty > minRoyalty ? calculatedRoyalty : minRoyalty;

			logger.info(
				{
					context: "usePurchaseFromKiosk",
					operation: "purchase",
					price: price.toString(),
					royaltyAmount: royaltyAmount.toString(),
				},
				"Calculated royalty amount",
			);

			const tx = new Transaction();

			// 1. Split payment from gas coin (for seller)
			const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(price)]);

			// 2. Split royalty payment from gas coin (for publisher)
			const [royaltyPayment] = tx.splitCoins(tx.gas, [
				tx.pure.u64(royaltyAmount),
			]);

			// 3. Purchase from Kiosk
			// kiosk::purchase returns: (item, TransferRequest)
			const [subscription, transferRequest] = tx.moveCall({
				target: "0x2::kiosk::purchase",
				arguments: [tx.object(kioskId), tx.object(subscriptionId), payment],
				typeArguments: [`${packageId}::subscription::SubscriptionNFT`],
			});

			// 4. Pay royalty to satisfy TransferPolicy rule
			// This must be called before confirm_request
			// pay_royalty takes &mut TransferRequest and adds receipt
			tx.moveCall({
				target: `${packageId}::marketplace_policies::pay_royalty`,
				arguments: [
					tx.object(policyId),
					transferRequest, // &mut TransferRequest - modifies it but still available
					royaltyPayment,
				],
			});

			// 5. Confirm TransferRequest
			// confirm_request takes TransferRequest by value and consumes it
			// After pay_royalty adds receipt, confirm_request can verify all rules are satisfied
			tx.moveCall({
				target: "0x2::transfer_policy::confirm_request",
				arguments: [
					tx.object(policyId),
					transferRequest, // TransferRequest - consumed here
				],
				typeArguments: [`${packageId}::subscription::SubscriptionNFT`],
			});

			// 6. Transfer subscription to buyer
			tx.transferObjects([subscription], tx.pure.address(account.address));

			logger.info(
				{
					context: "usePurchaseFromKiosk",
					operation: "purchase",
					subscriptionId,
				},
				"Executing purchase transaction",
			);

			const result = await signAndExecute({ transaction: tx });

			logger.info(
				{
					context: "usePurchaseFromKiosk",
					operation: "purchase",
					txDigest: result.digest,
				},
				"Purchase successful",
			);

			return result;
		} catch (error) {
			logger.error(
				{
					context: "usePurchaseFromKiosk",
					operation: "purchase",
					error,
					kioskId,
					subscriptionId,
				},
				"Purchase failed",
			);
			throw error;
		}
	};

	return { purchase };
}

/**
 * Hook to create a new Kiosk for the user
 *
 * @returns Function to create Kiosk
 */
export function useCreateKiosk() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();
	const queryClient = useQueryClient();

	const createKiosk = async () => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		try {
			logger.info(
				{
					context: "useCreateKiosk",
					operation: "create",
					address: account.address,
				},
				"Creating new Kiosk",
			);

			const tx = new Transaction();

			// Create new Kiosk using default() function
			// This automatically shares the Kiosk and transfers KioskOwnerCap to sender
			tx.moveCall({
				target: "0x2::kiosk::default",
				arguments: [],
			});

			logger.info(
				{
					context: "useCreateKiosk",
					operation: "create",
				},
				"Executing create Kiosk transaction",
			);

			const result = await signAndExecute({ transaction: tx });

			logger.info(
				{
					context: "useCreateKiosk",
					operation: "create",
					txDigest: result.digest,
				},
				"Kiosk created successfully",
			);

			// Wait a bit for blockchain to index
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Invalidate and refetch user Kiosk query
			await queryClient.invalidateQueries({
				queryKey: ["user-kiosk", account.address],
			});

			// Also refetch immediately
			await queryClient.refetchQueries({
				queryKey: ["user-kiosk", account.address],
			});

			logger.info(
				{
					context: "useCreateKiosk",
					operation: "create",
				},
				"Invalidated and refetched user-kiosk query",
			);

			return result;
		} catch (error) {
			logger.error(
				{
					context: "useCreateKiosk",
					operation: "create",
					error,
				},
				"Failed to create Kiosk",
			);
			throw error;
		}
	};

	return { createKiosk };
}

/**
 * Hook to create TransferPolicy for SubscriptionNFT
 * Requires Publisher object to prove package ownership
 *
 * @returns Function to create TransferPolicy
 */
export function useCreateTransferPolicy() {
	const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
	const account = useCurrentAccount();
	const client = useSuiClient();
	const packageId = useNetworkVariable("packageId");
	const queryClient = useQueryClient();

	const createTransferPolicy = async (
		publisherId: string,
		royaltyBps?: number,
		minRoyalty?: bigint,
	) => {
		if (!account) {
			throw new Error("Wallet not connected");
		}

		try {
			logger.info(
				{
					context: "useCreateTransferPolicy",
					operation: "create",
					publisherId,
					packageId,
					royaltyBps,
					minRoyalty: minRoyalty?.toString(),
				},
				"Creating TransferPolicy for SubscriptionNFT",
			);

			// Verify Publisher object exists and belongs to correct package
			try {
				const publisherObj = await client.getObject({
					id: publisherId,
					options: {
						showContent: true,
						showType: true,
					},
				});

				if (!publisherObj.data) {
					throw new Error(`Publisher object ${publisherId} not found`);
				}

				const publisherContent = publisherObj.data.content;
				if (publisherContent?.dataType === "moveObject") {
					const fields = (publisherContent as any).fields;
					// Publisher struct has field "package" (String), not "package_id"
					const publisherPackage = fields?.package || "";
					const publisherPackageId = publisherPackage; // package field is the package address as string

					logger.info(
						{
							context: "useCreateTransferPolicy",
							operation: "verify_publisher",
							publisherPackage,
							publisherPackageId,
							expectedPackageId: packageId,
							match:
								publisherPackageId === packageId ||
								publisherPackage === packageId,
							publisherType: publisherObj.data.type,
							publisherFields: fields,
							moduleName: fields?.module_name,
						},
						"Verifying Publisher package ID",
					);

					if (
						publisherPackage &&
						publisherPackageId !== packageId &&
						publisherPackage !== packageId
					) {
						throw new Error(
							`❌ Publisher package ID mismatch!\n\n` +
								`Expected Package ID: ${packageId}\n` +
								`Publisher Package: ${publisherPackage}\n` +
								`Publisher Module: ${fields?.module_name || "unknown"}\n\n` +
								`The Publisher object must be from the same package as SubscriptionNFT.\n` +
								`Please use a Publisher object from package ${packageId}.\n\n` +
								`If you deployed a new contract, make sure to:\n` +
								`1. Update packageId in networkConfig.ts\n` +
								`2. Use the Publisher object from the new deployment`,
						);
					}

					if (!publisherPackage) {
						logger.warn(
							{
								context: "useCreateTransferPolicy",
								operation: "verify_publisher",
								fields: Object.keys(fields || {}),
							},
							"Publisher object does not have package field",
						);
					}
				} else {
					logger.warn(
						{
							context: "useCreateTransferPolicy",
							operation: "verify_publisher",
							contentType: publisherContent?.dataType,
						},
						"Publisher object content is not a moveObject",
					);
				}
			} catch (err: any) {
				logger.error(
					{
						context: "useCreateTransferPolicy",
						operation: "verify_publisher",
						error: err,
						publisherId,
					},
					"Failed to verify Publisher",
				);
				throw new Error(`Invalid Publisher: ${err.message}`);
			}

			const tx = new Transaction();

			if (royaltyBps !== undefined && minRoyalty !== undefined) {
				// Create policy with royalty rule
				tx.moveCall({
					target: `${packageId}::marketplace_policies::create_transfer_policy_with_royalty`,
					arguments: [
						tx.object(publisherId),
						tx.pure.u16(royaltyBps),
						tx.pure.u64(minRoyalty),
					],
				});
			} else {
				// Create policy without royalty rule (can add later)
				tx.moveCall({
					target: `${packageId}::marketplace_policies::create_transfer_policy`,
					arguments: [tx.object(publisherId)],
				});
			}

			const result = await signAndExecute({ transaction: tx });

			logger.info(
				{
					context: "useCreateTransferPolicy",
					operation: "create",
					txDigest: result.digest,
				},
				"TransferPolicy created successfully",
			);

			// Wait for indexing
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Invalidate queries to refetch TransferPolicy
			await queryClient.invalidateQueries({
				queryKey: ["transfer-policy", packageId],
			});

			return result;
		} catch (error) {
			logger.error(
				{
					context: "useCreateTransferPolicy",
					operation: "create",
					error,
				},
				"Failed to create TransferPolicy",
			);
			throw error;
		}
	};

	return { createTransferPolicy };
}
