/**
 * MarketplacePage - Subscription marketplace for buying/selling NFTs
 */

import { useCurrentAccount } from "@mysten/dapp-kit";
import {
	InfoCircledIcon,
	MagnifyingGlassIcon,
	PlusCircledIcon,
} from "@radix-ui/react-icons";
import {
	Badge,
	Box,
	Button,
	Callout,
	Card,
	Container,
	Dialog,
	Flex,
	Heading,
	Select,
	Tabs,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	useCreateKiosk,
	useCreateTransferPolicy,
	usePurchaseFromKiosk,
} from "../hooks/useMarketplace";
import {
	useMarketplaceListings,
	useTransferPolicy,
	useUserKiosk,
	useUserPublishers,
	useUserSubscriptionsForListing,
} from "../hooks/useMarketplaceQueries";
import {
	usePlaceAndListForSale,
	useUpdateListingPrice,
} from "../hooks/useSubscription";
import type { SubscriptionNFT } from "../types";
import { Tier } from "../types";
import { logger } from "../utils/logger";
import {
	daysRemaining,
	formatTimestamp,
	getTierColor,
	getTierName,
	mistToSui,
} from "../utils/sui";

export function MarketplacePage() {
	const account = useCurrentAccount();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState("browse");
	const [searchTier, setSearchTier] = useState<string>("all");
	const [creatingKiosk, setCreatingKiosk] = useState(false);
	const [kioskError, setKioskError] = useState<string | null>(null);
	const [creatingPolicy, setCreatingPolicy] = useState(false);
	const [policyError, setPolicyError] = useState<string | null>(null);
	const [showCreatePolicy, setShowCreatePolicy] = useState(false);
	const [royaltyBps, setRoyaltyBps] = useState<string>("1000"); // 10% default
	const [minRoyalty, setMinRoyalty] = useState<string>("0");
	const [useCache, setUseCache] = useState<boolean>(false); // Default: no cache, query directly from blockchain

	// Marketplace queries
	// useCache=false means only query from blockchain events, skip localStorage cache
	const { data: marketplaceListings = [], isLoading: listingsLoading } =
		useMarketplaceListings(useCache);
	const { data: userKiosk } = useUserKiosk();
	const { data: userSubscriptions = [] } = useUserSubscriptionsForListing();
	const { data: userPublishers = [], isLoading: loadingPublishers } =
		useUserPublishers();
	const { data: transferPolicy, isLoading: loadingPolicy } =
		useTransferPolicy();

	// Debug logging
	console.log("[MarketplacePage] Publishers:", userPublishers);
	console.log("[MarketplacePage] TransferPolicy:", transferPolicy);
	console.log("[MarketplacePage] Loading Publishers:", loadingPublishers);
	console.log("[MarketplacePage] Loading Policy:", loadingPolicy);

	// Marketplace actions
	const { updateListingPrice } = useUpdateListingPrice();
	const { purchase } = usePurchaseFromKiosk();
	const { createKiosk } = useCreateKiosk();
	const { createTransferPolicy } = useCreateTransferPolicy();

	const filteredListings = marketplaceListings.filter((listing) => {
		if (searchTier === "all") return true;
		return listing.tier.toString() === searchTier;
	});

	return (
		<Container size="4" py="6">
			<Flex direction="column" gap="6">
				<Flex justify="between" align="center">
					<Flex direction="column" gap="2">
						<Heading size="8">Subscription Marketplace</Heading>
						<Text color="gray" size="3">
							Buy and sell subscription NFTs
						</Text>
					</Flex>
					<Flex gap="2" align="center">
						<Text size="2" color="gray">
							{useCache ? "Using cache" : "Direct from blockchain"}
						</Text>
						<Button
							size="1"
							variant={useCache ? "soft" : "solid"}
							onClick={() => {
								setUseCache(!useCache);
								// Invalidate query to refetch with new cache setting
								queryClient.invalidateQueries({
									queryKey: ["marketplace-listings"],
								});
							}}
						>
							{useCache ? "Disable Cache" : "Enable Cache"}
						</Button>
					</Flex>
				</Flex>

				<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
					<Tabs.List>
						<Tabs.Trigger value="browse">
							<MagnifyingGlassIcon width="16" height="16" />
							Browse Listings
						</Tabs.Trigger>
						<Tabs.Trigger value="my-listings">
							<PlusCircledIcon width="16" height="16" />
							My Listings
						</Tabs.Trigger>
					</Tabs.List>

					<Box pt="4">
						{/* Browse Listings Tab */}
						<Tabs.Content value="browse">
							<Flex direction="column" gap="4">
								{/* TransferPolicy Status */}
								<Card>
									{transferPolicy ? (
										<Callout.Root color="green">
											<Callout.Icon>
												<InfoCircledIcon />
											</Callout.Icon>
											<Callout.Text>
												<Flex direction="column" gap="2">
													<Text weight="bold">✅ TransferPolicy is active</Text>
													<Text size="2" color="gray">
														Policy ID: {transferPolicy.id.slice(0, 10)}...
														{transferPolicy.id.slice(-8)}
													</Text>
													<Text size="2">
														Marketplace purchases are enabled.
													</Text>
												</Flex>
											</Callout.Text>
										</Callout.Root>
									) : userPublishers.length > 0 && !showCreatePolicy ? (
										<Callout.Root color="orange">
											<Callout.Icon>
												<InfoCircledIcon />
											</Callout.Icon>
											<Callout.Text>
												<Flex direction="column" gap="2">
													<Text weight="bold">
														⚠️ TransferPolicy is required
													</Text>
													<Text size="2">
														TransferPolicy is required for purchases. Create one
														to enable marketplace purchases.
													</Text>
													<Button
														onClick={() => setShowCreatePolicy(true)}
														size="2"
													>
														Create TransferPolicy
													</Button>
												</Flex>
											</Callout.Text>
										</Callout.Root>
									) : userPublishers.length === 0 ? (
										<Callout.Root color="red">
											<Callout.Icon>
												<InfoCircledIcon />
											</Callout.Icon>
											<Callout.Text>
												<Flex direction="column" gap="2">
													<Text weight="bold">❌ No Publisher Found</Text>
													<Text size="2">
														You need a Publisher object to create
														TransferPolicy. Publisher is typically created when
														deploying the contract and transferred to the
														deployer.
													</Text>
													<Text size="1" color="gray">
														If you are the contract deployer, check your wallet
														for Publisher objects. If not, contact the contract
														deployer to create TransferPolicy.
													</Text>
												</Flex>
											</Callout.Text>
										</Callout.Root>
									) : null}
								</Card>

								{/* Create TransferPolicy Form */}
								{showCreatePolicy && userPublishers.length > 0 && (
									<Card>
										<Flex direction="column" gap="3">
											<Heading size="4">Create TransferPolicy</Heading>
											<Text size="2" color="gray">
												TransferPolicy enables purchases in the marketplace. You
												can set royalty fees (optional).
											</Text>

											<Flex direction="column" gap="2">
												<Text size="2" weight="bold">
													Publisher:
												</Text>
												{userPublishers.length > 0 ? (
													<Select.Root defaultValue={userPublishers[0]?.id}>
														<Select.Trigger />
														<Select.Content>
															{userPublishers.map((publisher) => (
																<Select.Item
																	key={publisher.id}
																	value={publisher.id}
																>
																	{publisher.id.slice(0, 10)}...
																	{publisher.id.slice(-8)}
																	<Text size="1" color="gray">
																		{" "}
																		(Package: {publisher.packageId.slice(0, 8)}
																		...)
																	</Text>
																</Select.Item>
															))}
														</Select.Content>
													</Select.Root>
												) : (
													<Text size="2" color="red">
														No Publisher found for current package. Please check
														package ID in networkConfig.ts
													</Text>
												)}
												<Text size="1" color="gray">
													Only Publishers matching current package ID are shown
												</Text>
											</Flex>

											<Flex direction="column" gap="2">
												<Text size="2" weight="bold">
													Royalty (basis points, 1000 = 10%):
												</Text>
												<TextField.Root
													value={royaltyBps}
													onChange={(e) => setRoyaltyBps(e.target.value)}
													placeholder="1000"
												/>
												<Text size="1" color="gray">
													Optional: Percentage of sale price as royalty
													(0-10000)
												</Text>
											</Flex>

											<Flex direction="column" gap="2">
												<Text size="2" weight="bold">
													Minimum Royalty (MIST):
												</Text>
												<TextField.Root
													value={minRoyalty}
													onChange={(e) => setMinRoyalty(e.target.value)}
													placeholder="0"
												/>
												<Text size="1" color="gray">
													Optional: Minimum royalty amount in MIST
												</Text>
											</Flex>

											<Flex gap="2">
												<Button
													onClick={async () => {
														try {
															setCreatingPolicy(true);
															setPolicyError(null);

															const publisherId = userPublishers[0]?.id;
															if (!publisherId) {
																throw new Error("No Publisher found");
															}

															const royalty = royaltyBps
																? parseInt(royaltyBps)
																: undefined;
															const min = minRoyalty
																? BigInt(minRoyalty)
																: undefined;

															await createTransferPolicy(
																publisherId,
																royalty,
																min,
															);

															// Invalidate TransferPolicy query to refetch
															await queryClient.invalidateQueries({
																queryKey: ["transfer-policy"],
															});
															await queryClient.refetchQueries({
																queryKey: ["transfer-policy"],
															});

															setShowCreatePolicy(false);
															setRoyaltyBps("1000");
															setMinRoyalty("0");
														} catch (err: any) {
															logger.error(
																{
																	context: "MarketplacePage",
																	operation: "createTransferPolicy",
																	error: err,
																},
																"Failed to create TransferPolicy",
															);
															setPolicyError(
																err.message ||
																	"Failed to create TransferPolicy",
															);
														} finally {
															setCreatingPolicy(false);
														}
													}}
													size="2"
													disabled={creatingPolicy}
												>
													{creatingPolicy
														? "Creating..."
														: "Create TransferPolicy"}
												</Button>
												<Button
													onClick={() => {
														setShowCreatePolicy(false);
														setPolicyError(null);
													}}
													size="2"
													variant="soft"
													disabled={creatingPolicy}
												>
													Cancel
												</Button>
											</Flex>

											{policyError && (
												<Text size="1" color="red">
													{policyError}
												</Text>
											)}
										</Flex>
									</Card>
								)}

								{/* Filters */}
								<Card>
									<Flex gap="3" align="center">
										<Text weight="bold" size="2">
											Filter by Tier:
										</Text>
										<Select.Root
											value={searchTier}
											onValueChange={setSearchTier}
										>
											<Select.Trigger />
											<Select.Content>
												<Select.Item value="all">All Tiers</Select.Item>
												<Select.Item value="0">Free Tier</Select.Item>
												<Select.Item value="1">Basic Tier</Select.Item>
												<Select.Item value="2">Premium Tier</Select.Item>
											</Select.Content>
										</Select.Root>
									</Flex>
								</Card>

								{/* Listings Grid */}
								{listingsLoading ? (
									<Card>
										<Text color="gray">Loading marketplace listings...</Text>
									</Card>
								) : filteredListings.length === 0 ? (
									<Card>
										<Callout.Root color="blue">
											<Callout.Icon>
												<InfoCircledIcon />
											</Callout.Icon>
											<Callout.Text>
												No listings available at the moment. Check back later!
											</Callout.Text>
										</Callout.Root>
									</Card>
								) : (
									<Flex direction="column" gap="3">
										{filteredListings.map((listing) => (
											<MarketplaceListing
												key={listing.id}
												listing={listing}
												onPurchase={async () => {
													try {
														await purchase(
															listing.kioskId,
															listing.subscriptionId,
															BigInt(listing.price),
														);
													} catch (err) {
														logger.error(
															{
																context: "MarketplacePage",
																operation: "purchase",
																error: err,
															},
															"Purchase failed",
														);
													}
												}}
											/>
										))}
									</Flex>
								)}
							</Flex>
						</Tabs.Content>

						{/* My Listings Tab */}
						<Tabs.Content value="my-listings">
							<Flex direction="column" gap="4">
								{!account ? (
									<Card>
										<Callout.Root color="blue">
											<Callout.Icon>
												<InfoCircledIcon />
											</Callout.Icon>
											<Callout.Text>
												Connect your wallet to view your subscriptions.
											</Callout.Text>
										</Callout.Root>
									</Card>
								) : userSubscriptions.length === 0 ? (
									<Card>
										<Callout.Root color="blue">
											<Callout.Icon>
												<InfoCircledIcon />
											</Callout.Icon>
											<Callout.Text>
												You don't have any subscriptions to list. Subscribe to a
												publication first!
											</Callout.Text>
										</Callout.Root>
									</Card>
								) : (
									<Flex direction="column" gap="3">
										{!userKiosk && (
											<Card>
												<Callout.Root color="orange">
													<Callout.Icon>
														<InfoCircledIcon />
													</Callout.Icon>
													<Callout.Text>
														<Flex direction="column" gap="3">
															<Text>
																You need to create a Kiosk to list subscriptions
																for sale.
															</Text>
															<Button
																onClick={async () => {
																	try {
																		setCreatingKiosk(true);
																		setKioskError(null);
																		await createKiosk();
																		// Query will be automatically refetched via invalidateQueries
																		// No need to reload page
																	} catch (err: any) {
																		logger.error(
																			{
																				context: "MarketplacePage",
																				operation: "createKiosk",
																				error: err,
																			},
																			"Failed to create Kiosk",
																		);
																		setKioskError(
																			err.message || "Failed to create Kiosk",
																		);
																	} finally {
																		setCreatingKiosk(false);
																	}
																}}
																size="2"
																disabled={creatingKiosk}
															>
																<PlusCircledIcon />
																{creatingKiosk ? "Creating..." : "Create Kiosk"}
															</Button>
															{kioskError && (
																<Text size="1" color="red">
																	{kioskError}
																</Text>
															)}
														</Flex>
													</Callout.Text>
												</Callout.Root>
											</Card>
										)}
										{userSubscriptions.map((subscription) => (
											<UserSubscriptionListing
												key={subscription.id}
												subscription={subscription}
												userKiosk={userKiosk}
												onList={async () => {
													// Invalidate queries to refetch listings and subscriptions
													await queryClient.invalidateQueries({
														queryKey: ["marketplace-listings"],
													});
													await queryClient.invalidateQueries({
														queryKey: [
															"user-subscriptions-for-listing",
															account?.address,
														],
													});
												}}
											/>
										))}
									</Flex>
								)}
							</Flex>
						</Tabs.Content>
					</Box>
				</Tabs.Root>
			</Flex>
		</Container>
	);
}

// Marketplace listing card
interface MarketplaceListingProps {
	listing: any;
	onPurchase: () => void;
}

function MarketplaceListing({ listing, onPurchase }: MarketplaceListingProps) {
	const [loading, setLoading] = useState(false);

	const handleBuy = async () => {
		try {
			setLoading(true);
			// TODO: Implement purchase from Kiosk
			logger.info(
				{ context: "MarketplaceListing", listingId: listing.id },
				"Purchasing subscription",
			);
			onPurchase();
		} catch (err) {
			logger.error(
				{
					context: "MarketplaceListing",
					operation: "buy",
					error: err,
					listingId: listing.id,
				},
				"Purchase failed",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Flex justify="between" align="start">
					<Flex direction="column" gap="1">
						<Heading size="4">
							{listing.publication_name || "Unknown Publication"}
						</Heading>
						<Badge color={getTierColor(listing.tier)}>
							{getTierName(listing.tier)} Tier
						</Badge>
					</Flex>
					<Badge color="green" size="2">
						For Sale
					</Badge>
				</Flex>

				<Flex direction="column" gap="2">
					<Flex justify="between">
						<Text size="2" color="gray">
							Price:
						</Text>
						<Text size="2" weight="bold">
							{mistToSui(listing.price)} SUI
						</Text>
					</Flex>
					<Flex justify="between">
						<Text size="2" color="gray">
							Expires:
						</Text>
						<Text size="2">{formatTimestamp(listing.expires_at)}</Text>
					</Flex>
					<Flex justify="between">
						<Text size="2" color="gray">
							Days Remaining:
						</Text>
						<Text size="2" weight="bold" color="green">
							{daysRemaining(listing.expires_at)}
						</Text>
					</Flex>
				</Flex>

				<Button onClick={handleBuy} disabled={loading}>
					{loading ? "Processing..." : "Buy Subscription"}
				</Button>
			</Flex>
		</Card>
	);
}

// User's subscription listing card
interface UserSubscriptionListingProps {
	subscription: any; // Subscription object from useUserSubscriptionsForListing
	userKiosk: { kioskId: string; capId: string } | null | undefined;
	onList: () => void;
}

function UserSubscriptionListing({
	subscription,
	userKiosk,
	onList,
}: UserSubscriptionListingProps) {
	const [listDialogOpen, setListDialogOpen] = useState(false);
	const [priceDialogOpen, setPriceDialogOpen] = useState(false);
	const [listPrice, setListPrice] = useState("");
	const [newPrice, setNewPrice] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isListed, setIsListed] = useState(false);

	const account = useCurrentAccount();
	const queryClient = useQueryClient();
	const { placeAndListForSale } = usePlaceAndListForSale();
	const { updateListingPrice } = useUpdateListingPrice();

	const handleListForSale = async () => {
		if (!listPrice || parseFloat(listPrice) <= 0) {
			setError("Please enter a valid price");
			return;
		}

		try {
			setLoading(true);
			setError(null);

			const priceInMist = BigInt(parseFloat(listPrice) * 1_000_000_000);

			if (!userKiosk) {
				setError("You need to create a Kiosk first");
				return;
			}

			logger.info(
				{
					context: "UserSubscriptionListing",
					operation: "list_for_sale",
					subscriptionId: subscription.id,
					price: priceInMist.toString(),
					kioskId: userKiosk.kioskId,
				},
				"Listing subscription on Kiosk",
			);

			// Place in Kiosk and list for sale in one transaction
			// This is more efficient and reliable than separate calls
			const result = await placeAndListForSale(
				userKiosk.kioskId,
				userKiosk.capId,
				subscription.id,
				priceInMist,
			);

			logger.info(
				{
					context: "UserSubscriptionListing",
					operation: "list_for_sale",
					txDigest: result.digest,
					subscriptionId: subscription.id,
					events: result.events,
					objectChanges: result.objectChanges,
				},
				"Subscription listed successfully",
			);

			// Log ItemListed event if found
			const itemListedEvent = result.events?.find((e) =>
				e.type.includes("ItemListed"),
			);
			if (itemListedEvent) {
				console.log(
					"[List] ItemListed event found in transaction:",
					itemListedEvent,
				);
				logger.info(
					{
						context: "UserSubscriptionListing",
						operation: "list_for_sale",
						event: itemListedEvent,
					},
					"ItemListed event emitted",
				);

				// Cache this listing immediately so it shows up before indexing
				const eventData = itemListedEvent.parsedJson as any;
				if (eventData) {
					const cachedListing = {
						subscriptionId: eventData.id,
						kioskId: eventData.kiosk,
						price: eventData.price,
						timestamp: Date.now(),
						txDigest: result.digest,
					};

					// Store in localStorage for immediate display
					const existingCache = JSON.parse(
						localStorage.getItem("marketplace-temp-cache") || "[]",
					);
					existingCache.push(cachedListing);
					localStorage.setItem(
						"marketplace-temp-cache",
						JSON.stringify(existingCache),
					);

					console.log(
						"[List] Cached listing for immediate display:",
						cachedListing,
					);
				}
			} else {
				console.warn("[List] No ItemListed event found in transaction!");
				logger.warn(
					{
						context: "UserSubscriptionListing",
						operation: "list_for_sale",
						allEvents: result.events,
					},
					"No ItemListed event found",
				);
			}

			setListDialogOpen(false);
			setIsListed(true);

			// Wait longer for blockchain to index the event
			// Testnet can be slow to index events
			console.log("[List] Waiting 5 seconds for blockchain to index...");
			await new Promise((resolve) => setTimeout(resolve, 5000));

			console.log("[List] Invalidating queries...");
			// Invalidate queries to refetch listings and user subscriptions
			// This will remove the subscription from "My Listings" and add it to "Browse"
			await queryClient.invalidateQueries({
				queryKey: ["marketplace-listings"],
			});
			await queryClient.invalidateQueries({
				queryKey: ["user-subscriptions-for-listing"],
			});

			// Force refetch to ensure UI updates
			console.log("[List] Refetching queries...");
			await queryClient.refetchQueries({
				queryKey: ["marketplace-listings"],
			});
			await queryClient.refetchQueries({
				queryKey: ["user-subscriptions-for-listing", account?.address],
			});

			console.log("[List] Done! Listing should now appear in Browse tab");

			if (onList) {
				onList();
			}
		} catch (err: any) {
			logger.error(
				{
					context: "UserSubscriptionListing",
					operation: "list_for_sale",
					error: err,
					subscriptionId: subscription.id,
				},
				"Listing failed",
			);
			setError(err.message || "Failed to list subscription");
		} finally {
			setLoading(false);
		}
	};

	const handleUpdatePrice = async () => {
		if (!newPrice || parseFloat(newPrice) <= 0) {
			setError("Please enter a valid price");
			return;
		}

		try {
			setLoading(true);
			setError(null);

			const priceInMist = BigInt(parseFloat(newPrice) * 1_000_000_000);

			if (!userKiosk) {
				setError("Kiosk not found");
				return;
			}

			logger.info(
				{
					context: "UserSubscriptionListing",
					operation: "update_price",
					subscriptionId: subscription.id,
					newPrice: priceInMist.toString(),
					kioskId: userKiosk.kioskId,
				},
				"Updating listing price",
			);

			await updateListingPrice(
				userKiosk.kioskId,
				userKiosk.capId,
				subscription.id,
				priceInMist,
			);

			setPriceDialogOpen(false);
			onList();
		} catch (err: any) {
			logger.error(
				{
					context: "UserSubscriptionListing",
					operation: "update_price",
					error: err,
					subscriptionId: subscription.id,
				},
				"Price update failed",
			);
			setError(err.message || "Failed to update price");
		} finally {
			setLoading(false);
		}
	};

	const tierName = getTierName(subscription.tier);
	const tierColor = getTierColor(subscription.tier);
	const daysLeft = daysRemaining(subscription.expires_at);

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Flex justify="between" align="start">
					<Flex direction="column" gap="1">
						<Badge color={tierColor}>{tierName} Tier</Badge>
						<Text size="1" color="gray">
							ID: {subscription.id.slice(0, 8)}...
						</Text>
					</Flex>
					{isListed && <Badge color="green">Listed</Badge>}
				</Flex>

				<Flex direction="column" gap="2">
					<Flex justify="between">
						<Text size="2" color="gray">
							Expires:
						</Text>
						<Text size="2">{formatTimestamp(subscription.expires_at)}</Text>
					</Flex>
					<Flex justify="between">
						<Text size="2" color="gray">
							Days Remaining:
						</Text>
						<Text size="2" weight="bold" color="green">
							{daysLeft}
						</Text>
					</Flex>
				</Flex>

				<Flex gap="2">
					{!isListed ? (
						<Dialog.Root open={listDialogOpen} onOpenChange={setListDialogOpen}>
							<Dialog.Trigger>
								<Button size="2" style={{ flex: 1 }}>
									List for Sale
								</Button>
							</Dialog.Trigger>

							<Dialog.Content>
								<Dialog.Title>List Subscription for Sale</Dialog.Title>
								<Dialog.Description size="2" mb="4">
									Set a price for your {tierName} tier subscription
								</Dialog.Description>

								<Flex direction="column" gap="4">
									<Card>
										<Flex direction="column" gap="2">
											<Text size="1" color="gray">
												Suggested price based on remaining time: ~{daysLeft}{" "}
												days left
											</Text>
											<TextField.Root
												placeholder="Price in SUI"
												type="number"
												step="0.1"
												value={listPrice}
												onChange={(e) => setListPrice(e.target.value)}
											>
												<TextField.Slot side="right">SUI</TextField.Slot>
											</TextField.Root>
										</Flex>
									</Card>

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
											<Button variant="soft" color="gray" disabled={loading}>
												Cancel
											</Button>
										</Dialog.Close>
										<Button onClick={handleListForSale} disabled={loading}>
											{loading ? "Listing..." : "List Now"}
										</Button>
									</Flex>
								</Flex>
							</Dialog.Content>
						</Dialog.Root>
					) : (
						<Dialog.Root
							open={priceDialogOpen}
							onOpenChange={setPriceDialogOpen}
						>
							<Dialog.Trigger>
								<Button size="2" variant="soft" style={{ flex: 1 }}>
									Update Price
								</Button>
							</Dialog.Trigger>

							<Dialog.Content>
								<Dialog.Title>Update Listing Price</Dialog.Title>

								<Flex direction="column" gap="4" mt="4">
									<TextField.Root
										placeholder="New price in SUI"
										type="number"
										step="0.1"
										value={newPrice}
										onChange={(e) => setNewPrice(e.target.value)}
									>
										<TextField.Slot side="right">SUI</TextField.Slot>
									</TextField.Root>

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
											<Button variant="soft" color="gray" disabled={loading}>
												Cancel
											</Button>
										</Dialog.Close>
										<Button onClick={handleUpdatePrice} disabled={loading}>
											{loading ? "Updating..." : "Update Price"}
										</Button>
									</Flex>
								</Flex>
							</Dialog.Content>
						</Dialog.Root>
					)}
				</Flex>
			</Flex>
		</Card>
	);
}
