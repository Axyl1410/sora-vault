/**
 * SubscriptionCard - displays a user's subscription with status and actions
 */

import { InfoCircledIcon } from "@radix-ui/react-icons";
import {
	Badge,
	Button,
	Callout,
	Card,
	Dialog,
	Flex,
	Heading,
	Select,
	Text,
} from "@radix-ui/themes";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChangeTier } from "../../hooks/useSubscription";
import { useRenewSubscription } from "../../hooks/useSubscriptionPurchase";
import type { SubscriptionWithPublication } from "../../types";
import { Tier } from "../../types";
import { logger } from "../../utils/logger";
import {
	daysRemaining,
	formatTimestamp,
	getTierColor,
	getTierName,
	isSubscriptionExpired,
	mistToSui,
} from "../../utils/sui";

interface SubscriptionCardProps {
	subscription: SubscriptionWithPublication;
	onRenew?: () => void;
}

export function SubscriptionCard({
	subscription,
	onRenew,
}: SubscriptionCardProps) {
	const navigate = useNavigate();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [tierChangeDialogOpen, setTierChangeDialogOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedNewTier, setSelectedNewTier] = useState<Tier>(
		subscription.tier,
	);
	const { renewSubscription } = useRenewSubscription();
	const { changeTier } = useChangeTier();

	const tierName = getTierName(subscription.tier);
	const tierColor = getTierColor(subscription.tier);
	const expired = isSubscriptionExpired(subscription.expires_at);
	const daysLeft = daysRemaining(subscription.expires_at);
	const isExpiringSoon = !expired && daysLeft <= 7;

	// Get renewal price
	const getRenewalPrice = () => {
		if (!subscription.publication) return 0n;
		if (subscription.tier === 0) return 0n; // Free tier
		return subscription.tier === 1
			? BigInt(subscription.publication.basic_price)
			: BigInt(subscription.publication.premium_price);
	};

	const renewalPrice = getRenewalPrice();
	const renewalPriceSui = mistToSui(renewalPrice.toString());

	const handleRenew = async () => {
		if (!subscription.publication) {
			setError("Publication information not available");
			return;
		}

		try {
			setLoading(true);
			setError(null);

			await renewSubscription(
				subscription.id,
				subscription.publication.id,
				renewalPrice,
			);

			// Close dialog and call success callback
			setDialogOpen(false);
			if (onRenew) {
				onRenew();
			}

			// Reload to refresh data
			window.location.reload();
		} catch (err: any) {
			logger.error(
				{
					context: "SubscriptionCard",
					operation: "renew_subscription",
					error: err,
					subscriptionId: subscription.id,
					publicationId: subscription.publication?.id,
				},
				"Subscription renewal error",
			);
			setError(err.message || "Failed to renew subscription");
		} finally {
			setLoading(false);
		}
	};

	const getNewTierPrice = (tier: Tier) => {
		if (!subscription.publication) return 0n;
		if (tier === Tier.Free) return 0n;
		return tier === Tier.Basic
			? BigInt(subscription.publication.basic_price)
			: BigInt(subscription.publication.premium_price);
	};

	const handleChangeTier = async () => {
		if (!subscription.publication) {
			setError("Publication information not available");
			return;
		}

		if (selectedNewTier === subscription.tier) {
			setError("Please select a different tier");
			return;
		}

		try {
			setLoading(true);
			setError(null);

			const newTierPrice = getNewTierPrice(selectedNewTier);

			await changeTier(
				subscription.id,
				subscription.publication.id,
				selectedNewTier,
				newTierPrice,
			);

			setTierChangeDialogOpen(false);
			if (onRenew) {
				onRenew();
			}

			window.location.reload();
		} catch (err: any) {
			logger.error(
				{
					context: "SubscriptionCard",
					operation: "change_tier",
					error: err,
					subscriptionId: subscription.id,
					oldTier: subscription.tier,
					newTier: selectedNewTier,
				},
				"Tier change error",
			);
			setError(err.message || "Failed to change tier");
		} finally {
			setLoading(false);
		}
	};

	const getStatusBadge = () => {
		if (expired) {
			return (
				<Badge color="red" size="2">
					Expired
				</Badge>
			);
		}
		if (isExpiringSoon) {
			return (
				<Badge color="orange" size="2">
					Expiring Soon
				</Badge>
			);
		}
		return (
			<Badge color="green" size="2">
				Active
			</Badge>
		);
	};

	return (
		<Card>
			<Flex direction="column" gap="4">
				{/* Header */}
				<Flex justify="between" align="start" wrap="wrap" gap="2">
					<Flex direction="column" gap="2">
						<Flex align="center" gap="2">
							<Heading size="4">
								{subscription.publication?.name || "Unknown Publication"}
							</Heading>
						</Flex>
						<Badge color={tierColor} size="2">
							{tierName} Tier
						</Badge>
					</Flex>
					{getStatusBadge()}
				</Flex>

				{/* Details */}
				<Flex direction="column" gap="2">
					<Flex justify="between">
						<Text size="2" color="gray">
							Subscribed:
						</Text>
						<Text size="2">{formatTimestamp(subscription.subscribed_at)}</Text>
					</Flex>
					<Flex justify="between">
						<Text size="2" color="gray">
							Expires:
						</Text>
						<Text size="2" color={expired ? "red" : undefined}>
							{formatTimestamp(subscription.expires_at)}
						</Text>
					</Flex>
					<Flex justify="between">
						<Text size="2" color="gray">
							Days Remaining:
						</Text>
						<Text
							size="2"
							weight="bold"
							color={expired ? "red" : isExpiringSoon ? "orange" : "green"}
						>
							{expired ? "0" : daysLeft}
						</Text>
					</Flex>
				</Flex>

				{/* Actions */}
				<Flex gap="2" wrap="wrap">
					<Button
						size="2"
						variant="soft"
						onClick={() => {
							if (subscription.publication) {
								navigate(`/publications/${subscription.publication.id}`);
							}
						}}
						style={{ flex: 1 }}
					>
						View Publication
					</Button>

					<Dialog.Root
						open={tierChangeDialogOpen}
						onOpenChange={setTierChangeDialogOpen}
					>
						<Dialog.Trigger>
							<Button size="2" variant="soft" color="blue" style={{ flex: 1 }}>
								Change Tier
							</Button>
						</Dialog.Trigger>

						<Dialog.Content>
							<Dialog.Title>Change Subscription Tier</Dialog.Title>
							<Dialog.Description size="2" mb="4">
								Upgrade or downgrade your subscription tier
							</Dialog.Description>

							<Flex direction="column" gap="4">
								<Card>
									<Flex direction="column" gap="3">
										<Flex justify="between">
											<Text weight="bold">Current Tier:</Text>
											<Badge color={tierColor}>{tierName}</Badge>
										</Flex>

										<Flex direction="column" gap="2">
											<Text weight="bold">New Tier:</Text>
											<Select.Root
												value={selectedNewTier.toString()}
												onValueChange={(value) =>
													setSelectedNewTier(parseInt(value) as Tier)
												}
											>
												<Select.Trigger />
												<Select.Content>
													{subscription.publication?.free_tier_enabled && (
														<Select.Item value="0">
															Free Tier (0 SUI)
														</Select.Item>
													)}
													<Select.Item value="1">
														Basic Tier (
														{mistToSui(
															subscription.publication?.basic_price || "0",
														)}{" "}
														SUI/month)
													</Select.Item>
													<Select.Item value="2">
														Premium Tier (
														{mistToSui(
															subscription.publication?.premium_price || "0",
														)}{" "}
														SUI/month)
													</Select.Item>
												</Select.Content>
											</Select.Root>
										</Flex>

										<Callout.Root color="blue">
											<Callout.Icon>
												<InfoCircledIcon />
											</Callout.Icon>
											<Callout.Text size="1">
												Your new subscription will include remaining time from
												current subscription plus 30 days.
											</Callout.Text>
										</Callout.Root>
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
									<Button
										onClick={handleChangeTier}
										disabled={loading || selectedNewTier === subscription.tier}
									>
										{loading ? "Processing..." : "Confirm Change"}
									</Button>
								</Flex>
							</Flex>
						</Dialog.Content>
					</Dialog.Root>

					<Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
						<Dialog.Trigger>
							<Button
								size="2"
								variant={expired || isExpiringSoon ? "solid" : "soft"}
								style={{ flex: 1 }}
							>
								Renew
							</Button>
						</Dialog.Trigger>

						<Dialog.Content>
							<Dialog.Title>Renew Subscription</Dialog.Title>
							<Dialog.Description size="2" mb="4">
								Renew your {tierName} tier subscription?
							</Dialog.Description>

							<Flex direction="column" gap="4">
								<Card>
									<Flex direction="column" gap="2">
										<Flex justify="between">
											<Text weight="bold">Publication:</Text>
											<Text>{subscription.publication?.name || "Unknown"}</Text>
										</Flex>
										<Flex justify="between">
											<Text weight="bold">Tier:</Text>
											<Badge color={tierColor}>{tierName}</Badge>
										</Flex>
										<Flex justify="between">
											<Text weight="bold">Price:</Text>
											<Text>{renewalPriceSui} SUI</Text>
										</Flex>
										<Flex justify="between">
											<Text weight="bold">New Duration:</Text>
											<Text>+30 days</Text>
										</Flex>
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
									<Button onClick={handleRenew} disabled={loading}>
										{loading ? "Processing..." : "Confirm Renewal"}
									</Button>
								</Flex>
							</Flex>
						</Dialog.Content>
					</Dialog.Root>
				</Flex>
			</Flex>
		</Card>
	);
}
