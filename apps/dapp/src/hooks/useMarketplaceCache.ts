/**
 * Cache for marketplace events that haven't been indexed yet
 * This allows us to show listings immediately after they're created
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CachedListing {
	subscriptionId: string;
	kioskId: string;
	price: string;
	timestamp: number;
	txDigest: string;
}

interface MarketplaceCacheState {
	cachedListings: CachedListing[];
	addListing: (listing: CachedListing) => void;
	removeListing: (subscriptionId: string) => void;
	getCachedListings: () => CachedListing[];
	clearOldListings: () => void;
}

// Keep cached listings for 30 minutes
const CACHE_TTL = 30 * 60 * 1000;

export const useMarketplaceCache = create<MarketplaceCacheState>()(
	persist(
		(set, get) => ({
			cachedListings: [],

			addListing: (listing: CachedListing) => {
				set((state) => {
					// Remove duplicates
					const filtered = state.cachedListings.filter(
						(l) => l.subscriptionId !== listing.subscriptionId,
					);
					return {
						cachedListings: [...filtered, listing],
					};
				});
			},

			removeListing: (subscriptionId: string) => {
				set((state) => ({
					cachedListings: state.cachedListings.filter(
						(l) => l.subscriptionId !== subscriptionId,
					),
				}));
			},

			getCachedListings: () => {
				const now = Date.now();
				// Filter out expired listings
				const validListings = get().cachedListings.filter(
					(l) => now - l.timestamp < CACHE_TTL,
				);

				// Update state to remove expired
				if (validListings.length !== get().cachedListings.length) {
					set({ cachedListings: validListings });
				}

				return validListings;
			},

			clearOldListings: () => {
				const now = Date.now();
				set((state) => ({
					cachedListings: state.cachedListings.filter(
						(l) => now - l.timestamp < CACHE_TTL,
					),
				}));
			},
		}),
		{
			name: "marketplace-cache",
		},
	),
);
