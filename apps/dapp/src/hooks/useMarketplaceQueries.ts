/**
 * React Query hooks for marketplace Kiosk queries
 */

import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { useNetworkVariable } from "../networkConfig";
import { logger } from "../utils/logger";

/**
 * Interface for marketplace listing
 */
export interface MarketplaceListing {
	id: string;
	subscriptionId: string;
	kioskId: string;
	price: string;
	tier: number;
	publication_id: string;
	publication_name?: string;
	expires_at: string;
	seller: string;
}

/**
 * Query all marketplace listings (Kiosk objects with SubscriptionNFT listings)
 *
 * @param useCache - If false, only query from blockchain events, skip localStorage cache
 *
 * Note: This is a simplified implementation. In production, you'd want to:
 * 1. Use an indexer service for better performance
 * 2. Query Kiosk dynamic fields to find listed items
 * 3. Filter by SubscriptionNFT type
 * 4. Handle pagination
 */
export function useMarketplaceListings(useCache: boolean = true) {
	const client = useSuiClient();
	const packageId = useNetworkVariable("packageId");

	return useQuery({
		queryKey: ["marketplace-listings", packageId, useCache],
		queryFn: async () => {
			try {
				logger.info(
					{
						context: "useMarketplaceListings",
						operation: "fetch",
						useCache,
						packageId,
					},
					"Fetching marketplace listings",
				);

				if (!packageId) {
					console.warn("[Marketplace] No packageId, returning empty listings");
					return [];
				}

				// Query ItemListed events from Kiosk
				// This is more reliable than querying dynamic fields
				// Note: ItemListed is a generic event, so we query all and filter by type
				let events;
				let delistedEvents;
				let purchasedEvents;
				try {
					console.log("[Marketplace] Querying ItemListed events...");

					// Query all three event types in parallel
					// Try both with and without generic type filter
					// Some Sui RPC nodes may not support generic type filtering
					const subscriptionNFTType = `${packageId}::subscription::SubscriptionNFT`;

					// First, try querying with generic type (more efficient)
					const itemListedType = `0x2::kiosk::ItemListed<${subscriptionNFTType}>`;
					const itemDelistedType = `0x2::kiosk::ItemDelisted<${subscriptionNFTType}>`;
					const itemPurchasedType = `0x2::kiosk::ItemPurchased<${subscriptionNFTType}>`;

					console.log("[Marketplace] Querying events with types:", {
						itemListedType,
						itemDelistedType,
						itemPurchasedType,
						packageId,
					});

					let listedResult, delistedResult, purchasedResult;

					try {
						// Try querying with generic type first
						[listedResult, delistedResult, purchasedResult] = await Promise.all(
							[
								client.queryEvents({
									query: {
										MoveEventType: itemListedType,
									},
									limit: 500,
									order: "descending",
								}),
								client.queryEvents({
									query: {
										MoveEventType: itemDelistedType,
									},
									limit: 500,
									order: "descending",
								}),
								client.queryEvents({
									query: {
										MoveEventType: itemPurchasedType,
									},
									limit: 500,
									order: "descending",
								}),
							],
						);
					} catch (err: any) {
						// If generic type query fails, fallback to querying all ItemListed events
						console.warn(
							"[Marketplace] Generic type query failed, falling back to query all events:",
							err,
						);

						// Query all ItemListed events (without generic type filter)
						const allListedResult = await client.queryEvents({
							query: {
								MoveEventType: "0x2::kiosk::ItemListed",
							},
							limit: 1000, // Query more since we'll filter manually
							order: "descending",
						});

						const allDelistedResult = await client.queryEvents({
							query: {
								MoveEventType: "0x2::kiosk::ItemDelisted",
							},
							limit: 1000,
							order: "descending",
						});

						const allPurchasedResult = await client.queryEvents({
							query: {
								MoveEventType: "0x2::kiosk::ItemPurchased",
							},
							limit: 1000,
							order: "descending",
						});

						// Filter events by type manually
						listedResult = {
							...allListedResult,
							data: allListedResult.data.filter(
								(e) => e.type === itemListedType,
							),
						};
						delistedResult = {
							...allDelistedResult,
							data: allDelistedResult.data.filter(
								(e) => e.type === itemDelistedType,
							),
						};
						purchasedResult = {
							...allPurchasedResult,
							data: allPurchasedResult.data.filter(
								(e) => e.type === itemPurchasedType,
							),
						};

						console.log(
							"[Marketplace] Fallback query - filtered events:",
							listedResult.data.length,
							"listed,",
							delistedResult.data.length,
							"delisted,",
							purchasedResult.data.length,
							"purchased",
						);
					}

					events = listedResult;
					delistedEvents = delistedResult;
					purchasedEvents = purchasedResult;

					console.log("[Marketplace] Found events:", events.data.length);
					console.log(
						"[Marketplace] Found delisted events:",
						delistedEvents.data.length,
					);
					console.log(
						"[Marketplace] Found purchased events:",
						purchasedEvents.data.length,
					);

					// Debug: Log first few events to verify structure
					if (events.data.length > 0) {
						console.log("[Marketplace] Sample event:", {
							type: events.data[0].type,
							parsedJson: events.data[0].parsedJson,
							packageId,
							expectedType: itemListedType,
						});
					} else {
						console.warn(
							"[Marketplace] No ItemListed events found!",
							"Query type:",
							itemListedType,
							"Package ID:",
							packageId,
						);
					}

					logger.info(
						{
							context: "useMarketplaceListings",
							operation: "fetch_events",
							eventCount: events.data.length,
							delistedCount: delistedEvents.data.length,
							purchasedCount: purchasedEvents.data.length,
						},
						`Found ${events.data.length} ItemListed, ${delistedEvents.data.length} ItemDelisted, ${purchasedEvents.data.length} ItemPurchased events`,
					);
				} catch (err) {
					console.error("[Marketplace] Failed to query events:", err);
					logger.error(
						{
							context: "useMarketplaceListings",
							operation: "fetch_events",
							error: err,
						},
						"Failed to query Kiosk events",
					);
					return [];
				}

				const listings: MarketplaceListing[] = [];
				const processedItemIds = new Set<string>(); // Track processed items to avoid duplicates

				// Build sets of delisted and purchased items to filter them out
				const delistedItemIds = new Set<string>();
				const purchasedItemIds = new Set<string>();

				// Process delisted events
				for (const event of delistedEvents.data) {
					try {
						const parsedEvent = event.parsedJson as any;
						const itemId = parsedEvent?.id;
						if (itemId) {
							delistedItemIds.add(itemId);
							console.log("[Marketplace] Item delisted:", itemId);
						}
					} catch (err) {}
				}

				// Process purchased events
				for (const event of purchasedEvents.data) {
					try {
						const parsedEvent = event.parsedJson as any;
						const itemId = parsedEvent?.id;
						if (itemId) {
							purchasedItemIds.add(itemId);
							console.log("[Marketplace] Item purchased:", itemId);
						}
					} catch (err) {}
				}

				// Get cached listings from localStorage (only if useCache is true)
				const tempCache = useCache
					? JSON.parse(localStorage.getItem("marketplace-temp-cache") || "[]")
					: [];
				const now = Date.now();
				const CACHE_TTL = 30 * 60 * 1000; // Increased to 30 minutes

				console.log(
					"[Marketplace] Querying events - Found events:",
					events.data.length,
				);
				console.log("[Marketplace] Use cache:", useCache);
				console.log("[Marketplace] Found cached listings:", tempCache.length);

				// THEN add cached listings that haven't been indexed yet (as fallback)
				// Only add if not already processed from events and useCache is true
				if (useCache) {
					console.log(
						"[Marketplace] Processing cached listings (fallback for unindexed items)...",
					);
					for (const cached of tempCache) {
						const age = now - cached.timestamp;
						const isValid = age < CACHE_TTL;

						// Skip if already processed from events
						if (processedItemIds.has(cached.subscriptionId)) {
							console.log(
								"[Marketplace] Skipping cached listing (already in events):",
								cached.subscriptionId,
							);
							continue;
						}

						// Skip if item was delisted or purchased
						if (delistedItemIds.has(cached.subscriptionId)) {
							console.log(
								"[Marketplace] Skipping cached listing - item was delisted:",
								cached.subscriptionId,
							);
							continue;
						}
						if (purchasedItemIds.has(cached.subscriptionId)) {
							console.log(
								"[Marketplace] Skipping cached listing - item was purchased:",
								cached.subscriptionId,
							);
							continue;
						}

						console.log(
							"[Marketplace] Checking cached listing:",
							cached.subscriptionId,
							"age:",
							age,
							"ms, valid:",
							isValid,
						);

						if (isValid) {
							try {
								console.log(
									"[Marketplace] Processing cached listing:",
									cached.subscriptionId,
								);

								// Fetch subscription details
								// Note: Objects in Kiosk can still be queried by ID
								const subscriptionObj = await client.getObject({
									id: cached.subscriptionId,
									options: {
										showContent: true,
										showType: true,
										showOwner: true,
									},
								});

								console.log(
									"[Marketplace] Cached object data:",
									subscriptionObj.data,
								);

								if (!subscriptionObj.data) {
									console.warn(
										"[Marketplace] Cached object not found:",
										cached.subscriptionId,
									);
									continue;
								}

								const type = subscriptionObj.data?.type;
								console.log("[Marketplace] Cached object type:", type);

								if (
									!type?.includes(`${packageId}::subscription::SubscriptionNFT`)
								) {
									console.warn(
										"[Marketplace] Cached object is not our SubscriptionNFT. Type:",
										type,
									);
									continue;
								}

								const subContent = subscriptionObj.data?.content;
								if (subContent?.dataType !== "moveObject") {
									console.warn(
										"[Marketplace] Cached object content is not moveObject:",
										subContent?.dataType,
									);
									continue;
								}

								const subFields = (subContent as any).fields;
								console.log(
									"[Marketplace] Cached subscription fields:",
									subFields,
								);

								// Parse tier from enum object
								let tierValue = 0;
								if (typeof subFields.tier === "number") {
									tierValue = subFields.tier;
								} else if (typeof subFields.tier === "string") {
									tierValue = parseInt(subFields.tier, 10);
								} else if (
									subFields.tier &&
									typeof subFields.tier === "object"
								) {
									// Tier is an enum object: {Free: {}}, {Basic: {}}, or {Premium: {}}
									if ("Free" in subFields.tier) tierValue = 0;
									else if ("Basic" in subFields.tier) tierValue = 1;
									else if ("Premium" in subFields.tier) tierValue = 2;
								}

								if (isNaN(tierValue) || tierValue < 0 || tierValue > 2) {
									console.warn(
										"[Marketplace] Invalid tier value:",
										subFields.tier,
										"defaulting to Free",
									);
									tierValue = 0;
								}

								// Fetch publication name
								let publicationName: string | undefined;
								try {
									const publicationObj = await client.getObject({
										id: subFields.publication_id,
										options: { showContent: true },
									});
									if (publicationObj.data?.content?.dataType === "moveObject") {
										const pubFields = (publicationObj.data.content as any)
											.fields;
										publicationName = pubFields.name;
									}
								} catch (err) {
									console.warn(
										"[Marketplace] Failed to fetch publication:",
										err,
									);
								}

								const listing = {
									id: `${cached.kioskId}-${cached.subscriptionId}`,
									subscriptionId: cached.subscriptionId,
									kioskId: cached.kioskId,
									price: cached.price,
									tier: tierValue,
									publication_id: subFields.publication_id,
									publication_name: publicationName,
									expires_at: subFields.expires_at,
									seller: "pending", // Will be fetched later
								};

								listings.push(listing);
								processedItemIds.add(cached.subscriptionId); // Mark as processed

								console.log(
									"[Marketplace] ✅ Added cached listing (not yet indexed):",
									cached.subscriptionId,
									listing,
								);
							} catch (err) {
								console.error(
									"[Marketplace] ❌ Failed to load cached listing:",
									cached.subscriptionId,
									err,
								);
								// Continue with other cached listings
							}
						} else {
							console.log(
								"[Marketplace] Cached listing expired:",
								cached.subscriptionId,
							);
						}
					}
				}

				// Clean up expired cache entries (only if useCache is true)
				if (useCache) {
					const validCache = tempCache.filter(
						(c: any) => now - c.timestamp < CACHE_TTL,
					);
					if (validCache.length !== tempCache.length) {
						localStorage.setItem(
							"marketplace-temp-cache",
							JSON.stringify(validCache),
						);
					}
				}

				// Process each ItemListed event FIRST (prioritize real events over cache)
				// This ensures we get the most up-to-date data from blockchain
				console.log(
					"[Marketplace] Processing",
					events.data.length,
					"ItemListed events...",
				);

				if (events.data.length === 0 && !useCache) {
					const subscriptionNFTType = `${packageId}::subscription::SubscriptionNFT`;
					const expectedEventType = `0x2::kiosk::ItemListed<${subscriptionNFTType}>`;
					console.warn(
						"[Marketplace] ⚠️ No events found and cache is disabled!",
						"This might indicate:",
						"1. Events haven't been indexed yet (wait a few seconds)",
						"2. Event type format is incorrect",
						"3. No listings exist on blockchain",
						"Package ID:",
						packageId,
						"Expected event type:",
						expectedEventType,
					);
				}

				for (const event of events.data) {
					try {
						const parsedEvent = event.parsedJson as any;

						console.log("[Marketplace] Processing event:", {
							eventType: event.type,
							parsedEvent,
						});

						// Extract event data
						const kioskId = parsedEvent?.kiosk;
						const itemId = parsedEvent?.id;
						const price = parsedEvent?.price;

						console.log("[Marketplace] Event details:", {
							kioskId,
							itemId,
							price,
						});

						if (!kioskId || !itemId || !price) {
							console.log("[Marketplace] Skipping event - missing data");
							continue;
						}

						// Check if this is a SubscriptionNFT from our package
						// Note: Objects in Kiosk can still be queried
						// We'll verify if item is still in Kiosk by checking owner
						try {
							console.log("[Marketplace] Fetching object:", itemId);

							const subscriptionObj = await client.getObject({
								id: itemId,
								options: {
									showContent: true,
									showType: true,
									showOwner: true,
								},
							});

							// First, verify item still exists and is in Kiosk
							if (!subscriptionObj.data) {
								console.log(
									"[Marketplace] Skipping - object not found:",
									itemId,
								);
								continue;
							}

							// Verify item is still in Kiosk
							// If owner is ObjectOwner (any Kiosk), item is still in a Kiosk and might be listed
							// Only skip if owner is AddressOwner (purchased) or other types
							const owner = subscriptionObj.data?.owner;
							let isInKiosk = false;
							let actualKioskId = kioskId; // Default to event's kioskId

							if (owner && typeof owner === "object") {
								if ("ObjectOwner" in owner) {
									const ownerId = (owner as { ObjectOwner: string })
										.ObjectOwner;
									// Item is in a Kiosk (might be different from event's kioskId if transferred)
									isInKiosk = true;
									actualKioskId = ownerId; // Use actual Kiosk ID where item is located

									if (ownerId !== kioskId) {
										console.log(
											"[Marketplace] Item is in different Kiosk than event. Event Kiosk:",
											kioskId,
											"Actual Kiosk:",
											ownerId,
											"Continuing to process...",
										);
									}
								} else if ("AddressOwner" in owner) {
									// Item is owned by an address, not in Kiosk anymore (was purchased)
									const addressOwner = (owner as { AddressOwner: string })
										.AddressOwner;
									console.log(
										"[Marketplace] Skipping - item is owned by address (was purchased):",
										addressOwner,
										"Item ID:",
										itemId,
									);
									continue;
								} else {
									// Other owner types (Shared, Immutable) - not in Kiosk
									console.log(
										"[Marketplace] Skipping - item has unexpected owner type:",
										owner,
									);
									continue;
								}
							} else {
								console.log(
									"[Marketplace] Skipping - item has no owner or invalid owner:",
									owner,
								);
								continue;
							}

							// If item was delisted, skip it (but only if it's not in Kiosk anymore)
							// Since we already verified it's in Kiosk, we can check delisted events
							if (delistedItemIds.has(itemId)) {
								// Double-check: if item is still in Kiosk, it might have been re-listed
								// So we'll continue processing to verify
								console.log(
									"[Marketplace] Item was delisted but still in Kiosk - might be re-listed:",
									itemId,
								);
								// Continue to process - if it's in Kiosk, it might be listed again
							}

							// If item was purchased, we already verified it's not (by checking owner)
							// So we can ignore purchasedItemIds check here

							console.log("[Marketplace] Object data:", subscriptionObj.data);
							console.log(
								"[Marketplace] Object type:",
								subscriptionObj.data?.type,
							);
							console.log(
								"[Marketplace] Object owner:",
								subscriptionObj.data?.owner,
								"isInKiosk:",
								isInKiosk,
							);

							const type = subscriptionObj.data?.type;
							if (
								!type?.includes(`${packageId}::subscription::SubscriptionNFT`)
							) {
								console.log(
									"[Marketplace] Skipping - not our SubscriptionNFT. Type:",
									type,
								);
								continue; // Skip if not our SubscriptionNFT
							}

							console.log("[Marketplace] Found our SubscriptionNFT!");

							const subContent = subscriptionObj.data?.content;
							if (subContent?.dataType !== "moveObject") {
								console.log(
									"[Marketplace] Content is not a move object:",
									subContent?.dataType,
								);
								continue;
							}

							const subFields = (subContent as any).fields;
							console.log("[Marketplace] Subscription fields:", subFields);

							// Parse tier from enum object
							let tierValue = 0;
							if (typeof subFields.tier === "number") {
								tierValue = subFields.tier;
							} else if (typeof subFields.tier === "string") {
								tierValue = parseInt(subFields.tier, 10);
							} else if (subFields.tier && typeof subFields.tier === "object") {
								// Tier is an enum object: {Free: {}}, {Basic: {}}, or {Premium: {}}
								if ("Free" in subFields.tier) tierValue = 0;
								else if ("Basic" in subFields.tier) tierValue = 1;
								else if ("Premium" in subFields.tier) tierValue = 2;
							}

							if (isNaN(tierValue) || tierValue < 0 || tierValue > 2) {
								console.warn(
									"[Marketplace] Invalid tier value:",
									subFields.tier,
									"defaulting to Free",
								);
								tierValue = 0;
							}

							// Fetch publication name
							let publicationName: string | undefined;
							try {
								const publicationObj = await client.getObject({
									id: subFields.publication_id,
									options: { showContent: true },
								});
								if (publicationObj.data?.content?.dataType === "moveObject") {
									const pubFields = (publicationObj.data.content as any).fields;
									publicationName = pubFields.name;
								}
							} catch (err) {
								console.warn("[Marketplace] Failed to fetch publication:", err);
							}

							// Get seller address from Kiosk
							// Query Kiosk object to get owner address (use actualKioskId where item is located)
							let seller = "unknown";
							try {
								const kioskObj = await client.getObject({
									id: actualKioskId, // Use actual Kiosk ID where item is located
									options: {
										showContent: true,
									},
								});

								if (kioskObj.data?.content?.dataType === "moveObject") {
									const kioskFields = (kioskObj.data.content as any).fields;
									seller = kioskFields?.owner || "unknown";
								}
							} catch (err) {
								// Continue without seller info
								logger.warn(
									{
										context: "useMarketplaceListings",
										operation: "fetch_seller",
										kioskId: actualKioskId,
										error: err,
									},
									"Failed to fetch seller info from Kiosk",
								);
							}

							const listing = {
								id: `${actualKioskId}-${itemId}`,
								subscriptionId: itemId,
								kioskId: actualKioskId, // Use actual Kiosk ID where item is located
								price: price.toString(),
								tier: tierValue,
								publication_id: subFields.publication_id,
								publication_name: publicationName,
								expires_at: subFields.expires_at,
								seller: seller,
							};

							console.log(
								"[Marketplace] ✅ Adding listing from event:",
								listing,
							);

							// Mark this item as processed
							processedItemIds.add(itemId);

							// Check if already added (shouldn't happen if we process events first)
							const alreadyAdded = listings.find(
								(l) => l.subscriptionId === itemId,
							);
							if (!alreadyAdded) {
								listings.push(listing);
								console.log(
									"[Marketplace] ✅ Added listing from event:",
									itemId,
								);
							} else {
								// Update existing listing with seller info (from event, more reliable)
								alreadyAdded.seller = seller;
								console.log(
									"[Marketplace] Updated existing listing with seller info from event",
								);
							}

							// Remove from temp cache since it's now indexed
							const tempCache = JSON.parse(
								localStorage.getItem("marketplace-temp-cache") || "[]",
							);
							const updatedCache = tempCache.filter(
								(c: any) => c.subscriptionId !== itemId,
							);
							localStorage.setItem(
								"marketplace-temp-cache",
								JSON.stringify(updatedCache),
							);
						} catch (err) {
							logger.warn(
								{
									context: "useMarketplaceListings",
									operation: "fetch_subscription",
									itemId,
									error: err,
								},
								"Failed to fetch subscription details",
							);
						}
					} catch (err) {
						logger.warn(
							{
								context: "useMarketplaceListings",
								operation: "parse_event",
								error: err,
							},
							"Failed to parse ItemListed event",
						);
					}
				}

				logger.info(
					{
						context: "useMarketplaceListings",
						operation: "fetch",
						listingsCount: listings.length,
						eventCount: events.data.length,
						cachedCount: tempCache.length,
						processedFromEvents: processedItemIds.size,
					},
					`Found ${listings.length} marketplace listings (${processedItemIds.size} from events, ${listings.length - processedItemIds.size} from cache)`,
				);

				return listings;
			} catch (error) {
				logger.error(
					{
						context: "useMarketplaceListings",
						operation: "fetch",
						error,
					},
					"Failed to fetch marketplace listings",
				);
				throw error;
			}
		},
		enabled: !!packageId,
		staleTime: 30000, // Consider data fresh for 30 seconds
		refetchOnWindowFocus: true,
	});
}

/**
 * Query user's Kiosk and KioskOwnerCap
 *
 * @returns Kiosk ID and Cap ID if user has a Kiosk, null otherwise
 */
export function useUserKiosk() {
	const client = useSuiClient();
	const account = useCurrentAccount();

	return useQuery({
		queryKey: ["user-kiosk", account?.address],
		queryFn: async () => {
			if (!account) {
				logger.info(
					{
						context: "useUserKiosk",
						operation: "fetch",
					},
					"No account connected",
				);
				return null;
			}

			try {
				logger.info(
					{
						context: "useUserKiosk",
						operation: "fetch",
						address: account.address,
					},
					"Fetching user Kiosk",
				);

				// Query KioskOwnerCap objects (owned by user)
				// Note: Kiosk itself is a shared object, not owned
				const capObjects = await client.getOwnedObjects({
					owner: account.address,
					filter: {
						StructType: "0x2::kiosk::KioskOwnerCap",
					},
					options: {
						showContent: true,
					},
				});

				logger.info(
					{
						context: "useUserKiosk",
						operation: "fetch",
						capCount: capObjects.data.length,
					},
					`Found ${capObjects.data.length} KioskOwnerCap objects`,
				);

				if (capObjects.data.length === 0) {
					logger.info(
						{
							context: "useUserKiosk",
							operation: "fetch",
							address: account.address,
						},
						"User does not have a Kiosk",
					);
					return null;
				}

				// Get Kiosk ID from the first Cap's 'for' field
				const firstCap = capObjects.data[0];
				const capContent = firstCap.data?.content;

				if (capContent?.dataType !== "moveObject") {
					logger.warn(
						{
							context: "useUserKiosk",
							operation: "fetch",
						},
						"KioskOwnerCap content is not a move object",
					);
					return null;
				}

				const capFields = (capContent as any).fields;
				const kioskId = capFields?.for || capFields?.kiosk_id;
				const capId = firstCap.data?.objectId;

				if (!kioskId) {
					logger.warn(
						{
							context: "useUserKiosk",
							operation: "fetch",
							capFields,
						},
						"KioskOwnerCap missing kiosk ID in for field",
					);
					return null;
				}

				if (!kioskId || !capId) {
					logger.warn(
						{
							context: "useUserKiosk",
							operation: "fetch",
							kioskId,
							capId,
						},
						"Found Kiosk or Cap but missing object ID",
					);
					return null;
				}

				logger.info(
					{
						context: "useUserKiosk",
						operation: "fetch",
						kioskId,
						capId,
					},
					"User Kiosk found",
				);

				return {
					kioskId,
					capId,
				};
			} catch (error) {
				logger.error(
					{
						context: "useUserKiosk",
						operation: "fetch",
						error,
						address: account.address,
					},
					"Failed to fetch user Kiosk",
				);
				throw error;
			}
		},
		enabled: !!account,
		staleTime: 300000, // Consider data fresh for 5 minutes (Kiosk doesn't change often)
	});
}

/**
 * Query user's subscriptions that can be listed on marketplace
 *
 * @returns Array of SubscriptionNFT objects owned by user
 */
export function useUserSubscriptionsForListing() {
	const client = useSuiClient();
	const account = useCurrentAccount();
	const packageId = useNetworkVariable("packageId");
	const { data: userKiosk } = useUserKiosk();

	return useQuery({
		queryKey: [
			"user-subscriptions-for-listing",
			account?.address,
			packageId,
			userKiosk?.kioskId,
		],
		queryFn: async () => {
			if (!account || !packageId) {
				return [];
			}

			try {
				logger.info(
					{
						context: "useUserSubscriptionsForListing",
						operation: "fetch",
						address: account.address,
					},
					"Fetching user subscriptions",
				);

				// Query SubscriptionNFT objects owned by user
				const subscriptionObjects = await client.getOwnedObjects({
					owner: account.address,
					filter: {
						StructType: `${packageId}::subscription::SubscriptionNFT`,
					},
					options: {
						showContent: true,
					},
				});

				logger.info(
					{
						context: "useUserSubscriptionsForListing",
						operation: "fetch",
						subscriptionCount: subscriptionObjects.data.length,
					},
					`Found ${subscriptionObjects.data.length} subscriptions`,
				);

				// Parse subscription objects
				const allSubscriptions = subscriptionObjects.data
					.filter((obj) => obj.data?.content?.dataType === "moveObject")
					.map((obj) => {
						const fields = (obj.data?.content as any).fields;

						// Parse tier correctly - it's stored as u8
						let tierValue = 0;
						if (typeof fields.tier === "number") {
							tierValue = fields.tier;
						} else if (typeof fields.tier === "string") {
							tierValue = parseInt(fields.tier, 10);
						}

						// Ensure valid tier (0=Free, 1=Basic, 2=Premium)
						if (isNaN(tierValue) || tierValue < 0 || tierValue > 2) {
							console.warn(
								"[Subscriptions] Invalid tier value:",
								fields.tier,
								"for subscription:",
								obj.data!.objectId,
							);
							tierValue = 0; // Default to Free
						}

						return {
							id: obj.data!.objectId,
							publication_id: fields.publication_id,
							tier: tierValue,
							expires_at: fields.expires_at,
							subscriber: fields.subscriber,
						};
					});

				// Filter out subscriptions that are already listed in Kiosk
				// Query ItemListed events to find which subscriptions are listed
				if (userKiosk?.kioskId) {
					try {
						// Query ItemListed events for this specific Kiosk
						const kioskEvents = await client.queryEvents({
							query: {
								MoveEventType: "0x2::kiosk::ItemListed",
							},
							// limit: 100,
							order: "descending",
						});

						// Get all listed item IDs from events
						const listedItemIds = new Set<string>();

						for (const event of kioskEvents.data) {
							try {
								const parsedEvent = event.parsedJson as any;
								const eventKioskId = parsedEvent?.kiosk;

								// Check if this event is for our Kiosk
								if (eventKioskId === userKiosk.kioskId) {
									const itemId = parsedEvent?.id;
									if (itemId) {
										listedItemIds.add(itemId);
									}
								}
							} catch (err) {}
						}

						logger.info(
							{
								context: "useUserSubscriptionsForListing",
								operation: "filter_listed",
								kioskId: userKiosk.kioskId,
								listedCount: listedItemIds.size,
								total: allSubscriptions.length,
							},
							`Found ${listedItemIds.size} listed items, filtering from ${allSubscriptions.length} subscriptions`,
						);

						// Filter out listed subscriptions
						const unlistedSubscriptions = allSubscriptions.filter(
							(sub) => !listedItemIds.has(sub.id),
						);

						return unlistedSubscriptions;
					} catch (error) {
						logger.warn(
							{
								context: "useUserSubscriptionsForListing",
								operation: "filter_listed",
								error,
							},
							"Failed to filter listed subscriptions, returning all",
						);
						return allSubscriptions;
					}
				}

				return allSubscriptions;
			} catch (error) {
				logger.error(
					{
						context: "useUserSubscriptionsForListing",
						operation: "fetch",
						error,
						address: account.address,
					},
					"Failed to fetch user subscriptions",
				);
				throw error;
			}
		},
		enabled: !!account && !!packageId,
		staleTime: 30000, // Consider data fresh for 30 seconds
	});
}

/**
 * Query user's Publisher objects
 * Publisher is required to create TransferPolicy
 */
export function useUserPublishers() {
	const account = useCurrentAccount();
	const client = useSuiClient();
	const packageId = useNetworkVariable("packageId");

	return useQuery({
		queryKey: ["user-publishers", account?.address, packageId],
		queryFn: async () => {
			if (!account) {
				return [];
			}

			if (!packageId || packageId === "0x0") {
				logger.warn(
					{
						context: "useUserPublishers",
						operation: "fetch",
					},
					"Package ID not set, cannot filter Publishers",
				);
				return [];
			}

			try {
				logger.info(
					{
						context: "useUserPublishers",
						operation: "fetch",
						address: account.address,
						packageId,
					},
					"Querying Publisher objects",
				);

				const publishers = await client.getOwnedObjects({
					owner: account.address,
					filter: {
						StructType: "0x2::package::Publisher",
					},
					options: {
						showContent: true,
						showType: true,
					},
				});

				logger.info(
					{
						context: "useUserPublishers",
						operation: "fetch",
						count: publishers.data.length,
					},
					`Found ${publishers.data.length} Publisher objects (all packages)`,
				);

				// Filter Publishers by package ID - only return Publishers from the current package
				// Note: Publisher struct has field "package" (String), not "package_id"
				const result = publishers.data
					.map((obj) => {
						const content = obj.data?.content;
						if (content?.dataType === "moveObject") {
							const fields = (content as any).fields;
							// Publisher has field "package" (String), which is the package address as string
							const publisherPackage = fields?.package || "";

							// Convert package string to address for comparison
							// Publisher.package is the package address as string (e.g., "0x123...")
							// We need to compare with packageId (also a string address)
							const publisherPackageId = publisherPackage;

							logger.debug(
								{
									context: "useUserPublishers",
									operation: "parse",
									publisherId: obj.data?.objectId,
									publisherPackage,
									publisherPackageId,
									fields: Object.keys(fields || {}),
								},
								"Parsing Publisher object",
							);

							return {
								id: obj.data?.objectId || "",
								packageId: publisherPackageId,
								packageString: publisherPackage, // Keep original for debugging
								moduleName: fields?.module_name || "",
							};
						}
						return null;
					})
					.filter(
						(
							p,
						): p is {
							id: string;
							packageId: string;
							packageString: string;
							moduleName: string;
						} => {
							if (!p) return false;

							// Normalize package IDs for comparison (case-insensitive, trim)
							const normalize = (id: string) => {
								if (!id) return "";
								return id.toLowerCase().trim();
							};

							const normalizedPublisher = normalize(
								p.packageString || p.packageId,
							);
							const normalizedExpected = normalize(packageId);

							// Only return Publishers from the current package
							const matches = normalizedPublisher === normalizedExpected;

							if (!matches) {
								logger.debug(
									{
										context: "useUserPublishers",
										operation: "filter",
										publisherId: p.id,
										publisherPackage: p.packageString,
										normalizedPublisher,
										expectedPackage: packageId,
										normalizedExpected,
										moduleName: p.moduleName,
									},
									"Filtered out Publisher from different package",
								);
							} else {
								console.log(
									"[useUserPublishers] ✅ Matching Publisher found:",
									{
										publisherId: p.id,
										publisherPackage: p.packageString,
										expectedPackage: packageId,
										moduleName: p.moduleName,
									},
								);
							}
							return matches;
						},
					)
					.map((p) => ({
						id: p.id,
						packageId: p.packageId || p.packageString,
					}));

				logger.info(
					{
						context: "useUserPublishers",
						operation: "fetch",
						filteredCount: result.length,
						totalCount: publishers.data.length,
						packageId,
					},
					`Found ${result.length} Publisher objects from package ${packageId}`,
				);

				// Debug: Log all Publishers with their actual fields
				console.log(
					"[useUserPublishers] All Publishers:",
					publishers.data.map((obj) => {
						const content = obj.data?.content;
						if (content?.dataType === "moveObject") {
							const fields = (content as any).fields;
							return {
								id: obj.data?.objectId,
								package: fields?.package, // ✅ Đúng field name (String)
								module_name: fields?.module_name,
								allFields: Object.keys(fields || {}), // Debug: xem tất cả fields
							};
						}
						return { id: obj.data?.objectId, error: "Not a moveObject" };
					}),
				);
				console.log("[useUserPublishers] Expected Package ID:", packageId);
				console.log(
					"[useUserPublishers] Filtered Result (matching package):",
					result,
				);
				return result;
			} catch (error) {
				logger.error(
					{
						context: "useUserPublishers",
						operation: "fetch",
						error,
						address: account.address,
					},
					"Failed to fetch Publisher objects",
				);
				return [];
			}
		},
		enabled: !!account,
		staleTime: 60000, // Consider data fresh for 1 minute
	});
}

/**
 * Query TransferPolicy for SubscriptionNFT
 * TransferPolicy is a shared object, so we can query it directly
 */
export function useTransferPolicy() {
	const client = useSuiClient();
	const packageId = useNetworkVariable("packageId");

	return useQuery({
		queryKey: ["transfer-policy", packageId],
		queryFn: async () => {
			if (!packageId) {
				return null;
			}

			try {
				// First, try to find TransferPolicy from events
				const events = await client.queryEvents({
					query: {
						MoveEventType: `0x2::transfer_policy::TransferPolicyCreated<${packageId}::subscription::SubscriptionNFT>`,
					},
					limit: 1,
					order: "descending",
				});

				if (events.data.length > 0) {
					const parsedJson = events.data[0].parsedJson as {
						id?: string;
					} | null;
					const policyId = parsedJson?.id;
					if (policyId) {
						// Fetch the actual TransferPolicy object
						const policyObj = await client.getObject({
							id: policyId,
							options: {
								showContent: true,
								showType: true,
								showOwner: true,
							},
						});

						if (policyObj.data) {
							logger.info(
								{
									context: "useTransferPolicy",
									operation: "fetch",
									policyId,
								},
								"Found TransferPolicy",
							);
							return {
								id: policyId,
								object: policyObj.data,
							};
						}
					}
				}

				// If not found in events, TransferPolicy is shared so we can't query via getOwnedObjects
				// We need to use the TransferPolicy ID from networkConfig or events only
				// Note: Shared objects cannot be queried via getOwnedObjects
				return null;
			} catch (error) {
				logger.error(
					{
						context: "useTransferPolicy",
						operation: "fetch",
						error,
					},
					"Failed to fetch TransferPolicy",
				);
				return null;
			}
		},
		enabled: !!packageId,
		staleTime: 300000, // Consider data fresh for 5 minutes
	});
}
