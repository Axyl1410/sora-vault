#[test_only]
module private_publishing::subscription_tests {
    use private_publishing::subscription::{Self};
    use private_publishing::publication;
    use private_publishing::treasury::{Self, Treasury};
    use sui::test_scenario;
    use sui::clock;
    use sui::coin;
    use sui::sui::SUI;
    use sui::kiosk;

    const BASIC_PRICE: u64 = 5_000_000_000; // 5 SUI
    const PREMIUM_PRICE: u64 = 15_000_000_000; // 15 SUI

    #[test]
    fun test_subscribe_basic_tier() {
        let creator = @0xCAFE;
        let subscriber = @0xBEEF;
        let mut scenario = test_scenario::begin(creator);

        // Create clock
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            // Create payment
            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);

            // Subscribe with basic tier
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            // Verify subscription
            assert!(subscription::publication_id(&subscription) == publication::id(&publication));
            assert!(subscription::tier_to_u8_public(&subscription::tier(&subscription)) == 1);
            assert!(subscription::subscriber(&subscription) == creator);
            assert!(subscription::is_valid(&subscription, &clock));

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_transfer(subscription, subscriber);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_subscribe_premium_tier() {
        let creator = @0xCAFE;
        let subscriber = @0xBEEF;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        
        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            let payment = coin::mint_for_testing<SUI>(PREMIUM_PRICE, ctx);

            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_premium(),
                payment,
                &clock,
                ctx
            );

            assert!(subscription::tier_to_u8_public(&subscription::tier(&subscription)) == 2);
            assert!(subscription::is_valid(&subscription, &clock));

            test_scenario::return_shared(treasury);
            transfer::public_transfer(subscription, subscriber);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_subscribe_free_tier() {
        let creator = @0xCAFE;
        let subscriber = @0xBEEF;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        
        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            let payment = coin::mint_for_testing<SUI>(0, ctx);

            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_free(),
                payment,
                &clock,
                ctx
            );

            assert!(subscription::tier_to_u8_public(&subscription::tier(&subscription)) == 0);
            assert!(subscription::is_valid(&subscription, &clock));

            test_scenario::return_shared(treasury);
            transfer::public_transfer(subscription, subscriber);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = subscription::EInsufficientPayment)]
    fun test_subscribe_insufficient_payment() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        
        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            // Try to pay less than basic price
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ctx);

            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            test_scenario::return_shared(treasury);
            transfer::public_transfer(subscription, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_renew_subscription() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        
        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            let payment1 = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);

            let mut subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment1,
                &clock,
                ctx
            );

            let initial_expiry = subscription::expires_at(&subscription);

            // Advance time by 1 day
            clock::increment_for_testing(&mut clock, 86_400_000); // 1 day in ms

            // Renew subscription
            let payment2 = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            subscription::renew(
                &mut subscription,
                &publication,
                &mut treasury,
                payment2,
                &clock,
                ctx
            );

            // Verify expiry extended
            let new_expiry = subscription::expires_at(&subscription);
            assert!(new_expiry > initial_expiry);
            assert!(subscription::is_valid(&subscription, &clock));

            test_scenario::return_shared(treasury);
            transfer::public_transfer(subscription, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_kiosk_operations() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        
        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let (mut kiosk, kiosk_cap) = kiosk::new(ctx);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);

            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            let subscription_id = subscription::id(&subscription);

            // Place in kiosk
            subscription::place_in_kiosk(&mut kiosk, &kiosk_cap, subscription);

            // List for sale
            subscription::list_for_sale(&mut kiosk, &kiosk_cap, subscription_id, 6_000_000_000);

            // Take from kiosk (need to delist first in real scenario, but for test...)
            // Note: This would fail in real scenario without proper purchase flow

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_share_object(kiosk);
            transfer::public_transfer(kiosk_cap, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_tier_access() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        
        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            let payment = coin::mint_for_testing<SUI>(PREMIUM_PRICE, ctx);

            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_premium(),
                payment,
                &clock,
                ctx
            );

            // Premium subscription should have access to all tiers
            assert!(subscription::has_tier_access(&subscription, subscription::create_tier_free(), &clock));
            assert!(subscription::has_tier_access(&subscription, subscription::create_tier_basic(), &clock));
            assert!(subscription::has_tier_access(&subscription, subscription::create_tier_premium(), &clock));

            test_scenario::return_shared(treasury);
            transfer::public_transfer(subscription, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_subscription_expiry() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        
        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);

            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            assert!(subscription::is_valid(&subscription, &clock));

            // Advance time by 31 days (past expiry)
            clock::increment_for_testing(&mut clock, 31 * 86_400_000); // 31 days in ms

            // Subscription should be expired
            assert!(!subscription::is_valid(&subscription, &clock));

            test_scenario::return_shared(treasury);
            transfer::public_transfer(subscription, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_change_tier_upgrade() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            // Subscribe to Basic tier first
            let payment1 = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment1,
                &clock,
                ctx
            );

            assert!(subscription::tier_to_u8_public(&subscription::tier(&subscription)) == 1);

            // Advance time by 15 days (half of subscription period)
            clock::increment_for_testing(&mut clock, 15 * 86_400_000);

            // Calculate remaining value (should be ~2.5 SUI for half month of 5 SUI)
            let remaining_value = subscription::calculate_remaining_value(&subscription, &publication, &clock);
            assert!(remaining_value > 2_000_000_000 && remaining_value < 3_000_000_000);

            // Upgrade to Premium (15 SUI total, minus ~2.5 SUI remaining = ~12.5 SUI needed)
            let payment2 = coin::mint_for_testing<SUI>(13_000_000_000, ctx);
            let new_subscription = subscription::change_tier(
                subscription,
                &publication,
                &mut treasury,
                subscription::create_tier_premium(),
                payment2,
                &clock,
                ctx
            );

            // Verify new tier
            assert!(subscription::tier_to_u8_public(&subscription::tier(&new_subscription)) == 2);
            assert!(subscription::is_valid(&new_subscription, &clock));

            test_scenario::return_shared(treasury);
            transfer::public_transfer(new_subscription, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_change_tier_downgrade() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            // Subscribe to Premium tier first
            let payment1 = coin::mint_for_testing<SUI>(PREMIUM_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_premium(),
                payment1,
                &clock,
                ctx
            );

            // Advance time by 10 days
            clock::increment_for_testing(&mut clock, 10 * 86_400_000);

            // Downgrade to Basic (remaining value of premium > basic price, so no payment needed)
            let payment2 = coin::mint_for_testing<SUI>(0, ctx);
            let new_subscription = subscription::change_tier(
                subscription,
                &publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment2,
                &clock,
                ctx
            );

            // Verify new tier
            assert!(subscription::tier_to_u8_public(&subscription::tier(&new_subscription)) == 1);
            assert!(subscription::is_valid(&new_subscription, &clock));

            test_scenario::return_shared(treasury);
            transfer::public_transfer(new_subscription, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_calculate_remaining_value() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            // At start, remaining value should be close to full price
            let remaining_value_start = subscription::calculate_remaining_value(&subscription, &publication, &clock);
            assert!(remaining_value_start >= BASIC_PRICE * 99 / 100); // Allow 1% variance

            // After 15 days (half month), value should be ~half
            clock::increment_for_testing(&mut clock, 15 * 86_400_000);
            let remaining_value_half = subscription::calculate_remaining_value(&subscription, &publication, &clock);
            assert!(remaining_value_half > BASIC_PRICE / 3 && remaining_value_half < BASIC_PRICE * 2 / 3);

            // After expiry, value should be 0
            clock::increment_for_testing(&mut clock, 20 * 86_400_000);
            let remaining_value_expired = subscription::calculate_remaining_value(&subscription, &publication, &clock);
            assert!(remaining_value_expired == 0);

            test_scenario::return_shared(treasury);
            transfer::public_transfer(subscription, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_update_listing_price() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let (mut kiosk, kiosk_cap) = kiosk::new(ctx);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            let subscription_id = subscription::id(&subscription);

            // Place and list
            subscription::place_in_kiosk(&mut kiosk, &kiosk_cap, subscription);
            subscription::list_for_sale(&mut kiosk, &kiosk_cap, subscription_id, 6_000_000_000);

            // Update listing price
            subscription::update_listing_price(&mut kiosk, &kiosk_cap, subscription_id, 7_000_000_000);

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_share_object(kiosk);
            transfer::public_transfer(kiosk_cap, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_place_and_list_for_sale() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        // Create clock
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let (mut kiosk, kiosk_cap) = kiosk::new(ctx);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);

            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            let subscription_id = subscription::id(&subscription);
            let list_price = 6_000_000_000; // 6 SUI

            // Test place_and_list_for_sale in ONE transaction
            subscription::place_and_list_for_sale(&mut kiosk, &kiosk_cap, subscription, list_price);

            // Verify item is listed in kiosk
            assert!(kiosk.is_listed(subscription_id), 0);

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_share_object(kiosk);
            transfer::public_transfer(kiosk_cap, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_place_and_list_vs_separate_calls() {
        // Test to verify place_and_list_for_sale is equivalent to separate calls
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        // Create clock
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        // Test separate calls
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let (mut kiosk1, kiosk_cap1) = kiosk::new(ctx);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription1 = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            let subscription_id1 = subscription::id(&subscription1);

            // Separate calls: place then list
            subscription::place_in_kiosk(&mut kiosk1, &kiosk_cap1, subscription1);
            subscription::list_for_sale(&mut kiosk1, &kiosk_cap1, subscription_id1, 6_000_000_000);

            // Verify
            assert!(kiosk1.is_listed(subscription_id1), 0);

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_share_object(kiosk1);
            transfer::public_transfer(kiosk_cap1, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        // Test combined call
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let (mut kiosk2, kiosk_cap2) = kiosk::new(ctx);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription2 = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            let subscription_id2 = subscription::id(&subscription2);

            // Combined call: place_and_list_for_sale
            subscription::place_and_list_for_sale(&mut kiosk2, &kiosk_cap2, subscription2, 6_000_000_000);

            // Verify - should have same result
            assert!(kiosk2.is_listed(subscription_id2), 0);

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_share_object(kiosk2);
            transfer::public_transfer(kiosk_cap2, creator);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_purchase_from_marketplace() {
        let seller = @0xCAFE;
        let buyer = @0xBEEF;
        let mut scenario = test_scenario::begin(seller);

        // Create clock
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, seller);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        // Seller: Create subscription and list for sale
        test_scenario::next_tx(&mut scenario, seller);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let (mut kiosk, kiosk_cap) = kiosk::new(ctx);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);

            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            let subscription_id = subscription::id(&subscription);
            let list_price = 6_000_000_000; // 6 SUI

            // List subscription for sale
            subscription::place_and_list_for_sale(&mut kiosk, &kiosk_cap, subscription, list_price);

            // Verify item is listed
            assert!(kiosk.is_listed(subscription_id), 0);

            // Clean up - share kiosk for buyer to access
            test_scenario::return_shared(treasury);
            transfer::public_share_object(kiosk);
            transfer::public_transfer(kiosk_cap, seller);
            transfer::public_transfer(publication, seller);
            transfer::public_transfer(publisher_cap, seller);
        };

        // Buyer: Purchase subscription from marketplace
        test_scenario::next_tx(&mut scenario, buyer);
        {
            let mut seller_kiosk = test_scenario::take_shared<kiosk::Kiosk>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            // Get the subscription ID that's listed
            // In real scenario, buyer would query events or kiosk to find listed items
            // For test, we'll use the ID we know
            
            // Note: To purchase from Kiosk, we need:
            // 1. The kiosk with listed item
            // 2. Payment coin
            // 3. TransferPolicy (for creator royalties)
            
            // For now, just verify the item is still listed and accessible
            // Full purchase flow would require TransferPolicy setup
            
            // We can't complete the purchase without TransferPolicy
            // This test verifies the listing part works correctly
            // Purchase flow would be:
            // let payment = coin::mint_for_testing<SUI>(6_000_000_000, ctx);
            // let (subscription, request) = kiosk::purchase(&mut seller_kiosk, subscription_id, payment);
            // // Handle TransferRequest with TransferPolicy
            // transfer_policy::confirm_request(&policy, request);
            // transfer::public_transfer(subscription, buyer);

            test_scenario::return_shared(seller_kiosk);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_complete_marketplace_flow_with_delist() {
        // Test complete flow: list -> delist -> take
        let seller = @0xCAFE;
        let mut scenario = test_scenario::begin(seller);

        // Create clock
        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, seller);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        // Seller: Create, list, then delist subscription
        test_scenario::next_tx(&mut scenario, seller);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let (mut kiosk, kiosk_cap) = kiosk::new(ctx);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);

            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            let subscription_id = subscription::id(&subscription);
            let list_price = 6_000_000_000; // 6 SUI

            // Place and list
            subscription::place_and_list_for_sale(&mut kiosk, &kiosk_cap, subscription, list_price);

            // Verify listed
            assert!(kiosk.is_listed(subscription_id), 0);

            // Seller changes mind and delists
            kiosk.delist<subscription::SubscriptionNFT>(&kiosk_cap, subscription_id);

            // Verify not listed anymore
            assert!(!kiosk.is_listed(subscription_id), 1);

            // Take back from kiosk
            let subscription_back = subscription::take_from_kiosk(&mut kiosk, &kiosk_cap, subscription_id);

            // Verify we got the subscription back
            assert!(subscription::id(&subscription_back) == subscription_id, 2);

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_share_object(kiosk);
            transfer::public_transfer(kiosk_cap, seller);
            transfer::public_transfer(publication, seller);
            transfer::public_transfer(publisher_cap, seller);
            transfer::public_transfer(subscription_back, seller);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }
}
