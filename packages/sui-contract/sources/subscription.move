/// Module: subscription
/// Manages subscription NFTs with tier-based access and Kiosk integration
module private_publishing::subscription {
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use private_publishing::publication::{Self, Publication};
    use private_publishing::treasury::{Self, Treasury};

    // Constants
    const SECONDS_PER_MONTH: u64 = 30 * 24 * 60 * 60; // 30 days

    // Error codes
    const EInvalidTier: u64 = 1;
    const EInsufficientPayment: u64 = 2;
    const EInvalidPublicationId: u64 = 3;

    // Events
    public struct SubscriptionCreated has copy, drop {
        subscription_id: ID,
        publication_id: ID,
        subscriber: address,
        tier: u8,
        expires_at: u64,
    }

    public struct SubscriptionRenewed has copy, drop {
        subscription_id: ID,
        new_expiry: u64,
    }

    public struct SubscriptionTierChanged has copy, drop {
        old_subscription_id: ID,
        new_subscription_id: ID,
        publication_id: ID,
        subscriber: address,
        old_tier: u8,
        new_tier: u8,
        new_expires_at: u64,
    }

    /// Subscription tiers with different access levels
    public enum Tier has copy, drop, store {
        Free,
        Basic,
        Premium,
    }

    /// NFT representing a subscription to a publication
    public struct SubscriptionNFT has key, store {
        id: UID,
        publication_id: ID,
        tier: Tier,
        subscribed_at: u64,
        expires_at: u64,
        subscriber: address,
    }

    /// Creates a new subscription NFT
    /// Validates payment based on tier and publication pricing
    /// Collects treasury fee from payment
    /// Note: Caller should call analytics::record_subscription() and analytics::record_revenue()
    /// Note: SubscriptionNFT remains owned by subscriber (can be traded/sold in Kiosk)
    public fun subscribe(
        publication: & Publication,
        treasury: &mut Treasury,
        tier: Tier,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ): SubscriptionNFT {
        let subscriber = ctx.sender();
        let publication_id = publication::id(publication);
        let current_time = clock::timestamp_ms(clock) / 1000; // Convert to seconds

        // Validate tier and payment
        let required_payment = match (tier) {
            Tier::Free => {
                assert!(publication::free_tier_enabled(publication), EInvalidTier);
                0
            },
            Tier::Basic => publication::basic_price(publication),
            Tier::Premium => publication::premium_price(publication),
        };

        let paid_amount = coin::value(&payment);
        assert!(paid_amount >= required_payment, EInsufficientPayment);

        // Transfer payment to creator (or destroy if free)
        if (required_payment > 0) {
            // Collect treasury fee and get creator's portion
            let _creator_amount = treasury::collect_subscription_fee(
                treasury,
                &mut payment,
                publication_id,
                subscriber,
                ctx
            );

            // Transfer remaining payment to creator
            transfer::public_transfer(payment, publication::creator(publication));
        } else {
            // For free tier, payment should be empty, destroy the coin
            coin::destroy_zero(payment);
        };

        // Calculate expiry (30 days from now)
        let expires_at = current_time + SECONDS_PER_MONTH;

        let subscription_uid = object::new(ctx);
        let subscription_id = object::uid_to_inner(&subscription_uid);

        event::emit(SubscriptionCreated {
            subscription_id,
            publication_id,
            subscriber,
            tier: tier_to_u8(&tier),
            expires_at,
        });

        SubscriptionNFT {
            id: subscription_uid,
            publication_id,
            tier,
            subscribed_at: current_time,
            expires_at,
            subscriber,
        }
    }

    /// Renews an existing subscription
    /// Extends expiry by 30 days
    /// Collects treasury fee from payment
    /// Note: Caller should call analytics::record_revenue() if needed
    public fun renew(
        subscription: &mut SubscriptionNFT,
        publication: &Publication,
        treasury: &mut Treasury,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let publication_id = publication::id(publication);
        assert!(subscription.publication_id == publication_id, EInvalidPublicationId);

        // Validate payment
        let required_payment = match (subscription.tier) {
            Tier::Free => 0,
            Tier::Basic => publication::basic_price(publication),
            Tier::Premium => publication::premium_price(publication),
        };

        let paid_amount = coin::value(&payment);
        assert!(paid_amount >= required_payment, EInsufficientPayment);

        // Transfer payment to creator (or destroy if free)
        if (required_payment > 0) {
            // Collect treasury fee and get creator's portion
            let _creator_amount = treasury::collect_subscription_fee(
                treasury,
                &mut payment,
                publication_id,
                subscription.subscriber,
                ctx
            );

            // Transfer remaining payment to creator
            transfer::public_transfer(payment, publication::creator(publication));
        } else {
            // For free tier renewal, payment should be empty, destroy the coin
            coin::destroy_zero(payment);
        };

        // Extend expiry
        let current_time = clock::timestamp_ms(clock) / 1000;

        // If not expired, extend from current expiry, otherwise from now
        if (subscription.expires_at > current_time) {
            subscription.expires_at = subscription.expires_at + SECONDS_PER_MONTH;
        } else {
            subscription.expires_at = current_time + SECONDS_PER_MONTH;
        };

        event::emit(SubscriptionRenewed {
            subscription_id: object::id(subscription),
            new_expiry: subscription.expires_at,
        });
    }

    /// Changes subscription tier (upgrade or downgrade)
    /// Calculates prorated refund/payment based on remaining time
    /// Returns new subscription NFT and destroys the old one
    public fun change_tier(
        old_subscription: SubscriptionNFT,
        publication: &Publication,
        treasury: &mut Treasury,
        new_tier: Tier,
        mut payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ): SubscriptionNFT {
        let subscriber = ctx.sender();
        let publication_id = publication::id(publication);
        let current_time = clock::timestamp_ms(clock) / 1000;
        
        // Verify subscription belongs to same publication
        assert!(old_subscription.publication_id == publication_id, EInvalidPublicationId);
        
        // Calculate remaining value of old subscription
        let remaining_value = calculate_remaining_value(&old_subscription, publication, clock);
        
        // Calculate new tier price
        let new_price = match (new_tier) {
            Tier::Free => {
                assert!(publication::free_tier_enabled(publication), EInvalidTier);
                0
            },
            Tier::Basic => publication::basic_price(publication),
            Tier::Premium => publication::premium_price(publication),
        };
        
        // Calculate required additional payment
        let required_payment = if (new_price > remaining_value) {
            new_price - remaining_value
        } else {
            0
        };
        
        let paid_amount = coin::value(&payment);
        assert!(paid_amount >= required_payment, EInsufficientPayment);
        
        // Process payment if needed
        if (required_payment > 0) {
            treasury::collect_subscription_fee(
                treasury,
                &mut payment,
                publication_id,
                subscriber,
                ctx
            );
            transfer::public_transfer(payment, publication::creator(publication));
        } else {
            coin::destroy_zero(payment);
        };
        
        // Calculate new expiry (current time + remaining time + 30 days)
        let remaining_time = if (old_subscription.expires_at > current_time) {
            old_subscription.expires_at - current_time
        } else {
            0
        };
        
        let new_expires_at = current_time + remaining_time + SECONDS_PER_MONTH;
        
        // Store old subscription data for event
        let old_subscription_id = object::id(&old_subscription);
        let old_tier = tier_to_u8(&old_subscription.tier);
        
        // Destroy old subscription
        let SubscriptionNFT { id: old_id, publication_id: _, tier: _, subscribed_at: _, expires_at: _, subscriber: _ } = old_subscription;
        object::delete(old_id);
        
        // Create new subscription
        let subscription_uid = object::new(ctx);
        let subscription_id = object::uid_to_inner(&subscription_uid);
        
        event::emit(SubscriptionTierChanged {
            old_subscription_id,
            new_subscription_id: subscription_id,
            publication_id,
            subscriber,
            old_tier,
            new_tier: tier_to_u8(&new_tier),
            new_expires_at,
        });
        
        SubscriptionNFT {
            id: subscription_uid,
            publication_id,
            tier: new_tier,
            subscribed_at: current_time,
            expires_at: new_expires_at,
            subscriber,
        }
    }

    /// Changes tier and automatically lists old subscription on Kiosk if it has remaining value
    /// Useful for upgrading and selling the old subscription
    public fun change_tier_with_kiosk(
        old_subscription: SubscriptionNFT,
        publication: &Publication,
        treasury: &mut Treasury,
        new_tier: Tier,
        mut payment: Coin<SUI>,
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        suggested_price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): SubscriptionNFT {
        // Calculate if old subscription has remaining value
        let has_value = calculate_remaining_value(&old_subscription, publication, clock) > 0;
        
        // If old subscription has value, place it in kiosk first
        if (has_value) {
            let old_sub_id = object::id(&old_subscription);
            kiosk::place(kiosk, cap, old_subscription);
            kiosk::list<SubscriptionNFT>(kiosk, cap, old_sub_id, suggested_price);
            
            // Create new subscription directly without destroying old one
            let subscriber = ctx.sender();
            let publication_id = publication::id(publication);
            let current_time = clock::timestamp_ms(clock) / 1000;
            
            // Calculate new tier price
            let new_price = match (new_tier) {
                Tier::Free => {
                    assert!(publication::free_tier_enabled(publication), EInvalidTier);
                    0
                },
                Tier::Basic => publication::basic_price(publication),
                Tier::Premium => publication::premium_price(publication),
            };
            
            let paid_amount = coin::value(&payment);
            assert!(paid_amount >= new_price, EInsufficientPayment);
            
            // Process payment
            if (new_price > 0) {
                treasury::collect_subscription_fee(
                    treasury,
                    &mut payment,
                    publication_id,
                    subscriber,
                    ctx
                );
                transfer::public_transfer(payment, publication::creator(publication));
            } else {
                coin::destroy_zero(payment);
            };
            
            // Create new subscription with full 30 days
            let new_expires_at = current_time + SECONDS_PER_MONTH;
            let subscription_uid = object::new(ctx);
            let subscription_id = object::uid_to_inner(&subscription_uid);
            
            event::emit(SubscriptionTierChanged {
                old_subscription_id: old_sub_id,
                new_subscription_id: subscription_id,
                publication_id,
                subscriber,
                old_tier: 0, // Will be updated by event
                new_tier: tier_to_u8(&new_tier),
                new_expires_at,
            });
            
            SubscriptionNFT {
                id: subscription_uid,
                publication_id,
                tier: new_tier,
                subscribed_at: current_time,
                expires_at: new_expires_at,
                subscriber,
            }
        } else {
            // If no value, use regular change_tier
            change_tier(old_subscription, publication, treasury, new_tier, payment, clock, ctx)
        }
    }

    /// Places subscription NFT in a Kiosk
    public fun place_in_kiosk(
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        subscription: SubscriptionNFT,
    ) {
        kiosk::place(kiosk, cap, subscription);
    }

    /// Takes subscription NFT from Kiosk
    public fun take_from_kiosk(
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        subscription_id: ID,
    ): SubscriptionNFT {
        kiosk::take<SubscriptionNFT>(kiosk, cap, subscription_id)
    }

    /// Places subscription in Kiosk and lists for sale in one transaction
    /// This is more efficient than calling place_in_kiosk + list_for_sale separately
    public fun place_and_list_for_sale(
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        subscription: SubscriptionNFT,
        price: u64,
    ) {
        kiosk::place_and_list<SubscriptionNFT>(kiosk, cap, subscription, price);
    }

    /// Lists subscription for sale in Kiosk marketplace
    /// Note: Subscription must already be in the Kiosk
    public fun list_for_sale(
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        subscription_id: ID,
        price: u64,
    ) {
        kiosk::list<SubscriptionNFT>(kiosk, cap, subscription_id, price);
    }

    /// Updates the listing price of a subscription already in Kiosk
    /// Note: This requires de-listing and re-listing
    public fun update_listing_price(
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        subscription_id: ID,
        new_price: u64,
    ) {
        // De-list the subscription
        kiosk::delist<SubscriptionNFT>(kiosk, cap, subscription_id);
        
        // Re-list with new price
        kiosk::list<SubscriptionNFT>(kiosk, cap, subscription_id, new_price);
    }

    /// Checks if subscription is valid (not expired)
    public fun is_valid(subscription: &SubscriptionNFT, clock: &Clock): bool {
        let current_time = clock::timestamp_ms(clock) / 1000;
        subscription.expires_at > current_time
    }

    /// Verifies subscription has required tier or higher
    public fun has_tier_access(subscription: &SubscriptionNFT, required_tier: Tier, clock: &Clock): bool {
        if (!is_valid(subscription, clock)) {
            return false
        };

        let subscription_tier_level = tier_to_u8(&subscription.tier);
        let required_tier_level = tier_to_u8(&required_tier);

        subscription_tier_level >= required_tier_level
    }

    // === Helper Functions ===

    /// Calculates the remaining value of a subscription based on time left
    /// Returns 0 if subscription is expired
    public fun calculate_remaining_value(
        subscription: &SubscriptionNFT,
        publication: &Publication,
        clock: &Clock
    ): u64 {
        let current_time = clock::timestamp_ms(clock) / 1000;
        
        // If expired, no remaining value
        if (subscription.expires_at <= current_time) {
            return 0
        };
        
        let remaining_time = subscription.expires_at - current_time;
        
        // Get tier price
        let monthly_price = match (subscription.tier) {
            Tier::Free => 0,
            Tier::Basic => publication::basic_price(publication),
            Tier::Premium => publication::premium_price(publication),
        };
        
        if (monthly_price == 0) {
            return 0
        };
        
        // Calculate prorated value: (price * remaining_time) / SECONDS_PER_MONTH
        (monthly_price * remaining_time) / SECONDS_PER_MONTH
    }

    /// Calculates a suggested price for selling subscription on marketplace
    /// Based on remaining value with a small discount (90% of remaining value)
    public fun calculate_suggested_price(
        subscription: &SubscriptionNFT,
        publication: &Publication,
        clock: &Clock
    ): u64 {
        let remaining_value = calculate_remaining_value(subscription, publication, clock);
        
        // Apply 10% discount to make it attractive for buyers
        (remaining_value * 90) / 100
    }

    /// Converts Tier enum to u8 for comparison
    fun tier_to_u8(tier: &Tier): u8 {
        match (tier) {
            Tier::Free => 0,
            Tier::Basic => 1,
            Tier::Premium => 2,
        }
    }

    /// Public helper to convert Tier to u8 (for other modules)
    public fun tier_to_u8_public(tier: &Tier): u8 {
        tier_to_u8(tier)
    }

    /// Check if tier is Free
    public fun is_tier_free(tier: &Tier): bool {
        tier_to_u8(tier) == 0
    }

    /// Check if tier is Basic
    public fun is_tier_basic(tier: &Tier): bool {
        tier_to_u8(tier) == 1
    }

    /// Check if tier is Premium
    public fun is_tier_premium(tier: &Tier): bool {
        tier_to_u8(tier) == 2
    }

    // === Accessor Functions ===

    public fun id(subscription: &SubscriptionNFT): ID {
        object::id(subscription)
    }

    public fun publication_id(subscription: &SubscriptionNFT): ID {
        subscription.publication_id
    }

    public fun tier(subscription: &SubscriptionNFT): Tier {
        subscription.tier
    }

    public fun subscribed_at(subscription: &SubscriptionNFT): u64 {
        subscription.subscribed_at
    }

    public fun expires_at(subscription: &SubscriptionNFT): u64 {
        subscription.expires_at
    }

    public fun subscriber(subscription: &SubscriptionNFT): address {
        subscription.subscriber
    }

    // === Tier Constructor Functions (for TypeScript tests) ===

    /// Creates a Free tier enum value
    public fun create_tier_free(): Tier { Tier::Free }

    /// Creates a Basic tier enum value
    public fun create_tier_basic(): Tier { Tier::Basic }

    /// Creates a Premium tier enum value
    public fun create_tier_premium(): Tier { Tier::Premium }

    // === Test-only functions ===

    #[test_only]
    public fun create_for_testing(
        publication_id: ID,
        tier: Tier,
        expires_at: u64,
        ctx: &mut TxContext
    ): SubscriptionNFT {
        SubscriptionNFT {
            id: object::new(ctx),
            publication_id,
            tier,
            subscribed_at: 0,
            expires_at,
            subscriber: ctx.sender(),
        }
    }
}
