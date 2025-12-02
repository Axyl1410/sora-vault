#[test_only]
module private_publishing::seal_policy_tests {
    use private_publishing::seal_policy;
    use private_publishing::publication;
    use private_publishing::article;
    use private_publishing::subscription;
    use private_publishing::treasury::{Self, Treasury};
    use sui::test_scenario;
    use sui::clock;
    use sui::coin;
    use sui::sui::SUI;

    const PREMIUM_PRICE: u64 = 15_000_000_000; // 15 SUI

    #[test]
    fun test_seal_approve_owner_valid() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let published_at = clock::timestamp_ms(&clock) / 1000;

            // Create article with specific seal_key_id
            let seal_key_id = b"seal_key_123";
            let deposit = coin::mint_for_testing<SUI>(PREMIUM_PRICE / 100, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Test Article".to_string(),
                b"Test excerpt".to_string(),
                b"walrus_blob_123".to_string(),
                seal_key_id,
                subscription::create_tier_basic(),
                published_at,
                b"{}".to_string(),
                deposit,
                ctx
            );

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        // Test owner can approve access with correct seal_key_id
        test_scenario::next_tx(&mut scenario, creator);
        {
            let article = test_scenario::take_shared(&scenario);
            let publication = test_scenario::take_from_sender(&scenario);
            let publisher_cap = test_scenario::take_from_sender(&scenario);
            let seal_key_id = article::seal_key_id(&article);

            // This should succeed - owner with correct cap and seal_key_id
            seal_policy::seal_approve_owner(
                seal_key_id,
                &publisher_cap,
                &article,
                &publication,
            );

            test_scenario::return_shared(article);
            test_scenario::return_to_sender(&scenario, publication);
            test_scenario::return_to_sender(&scenario, publisher_cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = seal_policy::EAccessDenied)]
    fun test_seal_approve_owner_wrong_seal_key_id() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let published_at = clock::timestamp_ms(&clock) / 1000;

            let seal_key_id = b"seal_key_123";
            let deposit = coin::mint_for_testing<SUI>(PREMIUM_PRICE / 100, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Test Article".to_string(),
                b"Test excerpt".to_string(),
                b"walrus_blob_123".to_string(),
                seal_key_id,
                subscription::create_tier_basic(),
                published_at,
                b"{}".to_string(),
                deposit,
                ctx
            );

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        // Test owner cannot approve with wrong seal_key_id
        test_scenario::next_tx(&mut scenario, creator);
        {
            let article = test_scenario::take_shared(&scenario);
            let publication = test_scenario::take_from_sender(&scenario);
            let publisher_cap = test_scenario::take_from_sender(&scenario);
            let wrong_seal_key_id = b"wrong_key";

            // This should abort - wrong seal_key_id
            seal_policy::seal_approve_owner(
                wrong_seal_key_id,
                &publisher_cap,
                &article,
                &publication,
            );

            test_scenario::return_shared(article);
            test_scenario::return_to_sender(&scenario, publication);
            test_scenario::return_to_sender(&scenario, publisher_cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = seal_policy::EAccessDenied)]
    fun test_seal_approve_owner_wrong_publication() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Create first publication and article
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication1, publisher_cap1) = publication::create_for_testing(ctx);
            let published_at = clock::timestamp_ms(&clock) / 1000;

            let seal_key_id = b"seal_key_123";
            let deposit = coin::mint_for_testing<SUI>(PREMIUM_PRICE / 100, ctx);
            article::publish_article(
                &mut publication1,
                &mut treasury,
                &publisher_cap1,
                b"Test Article".to_string(),
                b"Test excerpt".to_string(),
                b"walrus_blob_123".to_string(),
                seal_key_id,
                subscription::create_tier_basic(),
                published_at,
                b"{}".to_string(),
                deposit,
                ctx
            );

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_transfer(publication1, creator);
            transfer::public_transfer(publisher_cap1, creator);
        };

        // Create second publication with different cap
        test_scenario::next_tx(&mut scenario, creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let (publication2, publisher_cap2) = publication::create_for_testing(ctx);

            transfer::public_transfer(publication2, creator);
            transfer::public_transfer(publisher_cap2, creator);
        };

        // Test owner cannot approve with PublisherCap from different publication
        test_scenario::next_tx(&mut scenario, creator);
        {
            let article = test_scenario::take_shared(&scenario);
            let publication1 = test_scenario::take_from_sender(&scenario);
            let publisher_cap2 = test_scenario::take_from_sender(&scenario); // Wrong cap
            let seal_key_id = article::seal_key_id(&article);

            // This should abort - PublisherCap is for different publication
            seal_policy::seal_approve_owner(
                seal_key_id,
                &publisher_cap2,
                &article,
                &publication1,
            );

            test_scenario::return_shared(article);
            test_scenario::return_to_sender(&scenario, publication1);
            test_scenario::return_to_sender(&scenario, publisher_cap2);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = seal_policy::EAccessDenied)]
    fun test_seal_approve_owner_article_from_different_publication() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Create first publication and article
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication1, publisher_cap1) = publication::create_for_testing(ctx);
            let published_at = clock::timestamp_ms(&clock) / 1000;

            let seal_key_id1 = b"seal_key_123";
            let deposit1 = coin::mint_for_testing<SUI>(PREMIUM_PRICE / 100, ctx);
            article::publish_article(
                &mut publication1,
                &mut treasury,
                &publisher_cap1,
                b"Article 1".to_string(),
                b"Test excerpt 1".to_string(),
                b"walrus_blob_1".to_string(),
                seal_key_id1,
                subscription::create_tier_basic(),
                published_at,
                b"{}".to_string(),
                deposit1,
                ctx
            );

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_transfer(publication1, creator);
            transfer::public_transfer(publisher_cap1, creator);
        };

        // Create second publication and article
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication2, publisher_cap2) = publication::create_for_testing(ctx);
            let published_at = clock::timestamp_ms(&clock) / 1000;

            let seal_key_id2 = b"seal_key_456";
            let deposit2 = coin::mint_for_testing<SUI>(PREMIUM_PRICE / 100, ctx);
            article::publish_article(
                &mut publication2,
                &mut treasury,
                &publisher_cap2,
                b"Article 2".to_string(),
                b"Test excerpt 2".to_string(),
                b"walrus_blob_2".to_string(),
                seal_key_id2,
                subscription::create_tier_basic(),
                published_at,
                b"{}".to_string(),
                deposit2,
                ctx
            );

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_transfer(publication2, creator);
            transfer::public_transfer(publisher_cap2, creator);
        };

        // Store article IDs
        let article1_id;
        test_scenario::next_tx(&mut scenario, creator);
        {
            let article2 = test_scenario::take_shared(&scenario);
            test_scenario::return_shared(article2);

            let article1 = test_scenario::take_shared(&scenario);
            article1_id = article::id(&article1);
            test_scenario::return_shared(article1);
        };

        // Test owner cannot approve article from publication1 using publication2's cap
        test_scenario::next_tx(&mut scenario, creator);
        {
            let article1 = test_scenario::take_shared_by_id<article::Article>(&scenario, article1_id);
            let publication2 = test_scenario::take_from_sender(&scenario);
            let publisher_cap2 = test_scenario::take_from_sender(&scenario);
            let seal_key_id1 = article::seal_key_id(&article1);

            // This should abort - article belongs to publication1 but cap is for publication2
            seal_policy::seal_approve_owner(
                seal_key_id1,
                &publisher_cap2,
                &article1,
                &publication2,
            );

            test_scenario::return_shared(article1);
            test_scenario::return_to_sender(&scenario, publication2);
            test_scenario::return_to_sender(&scenario, publisher_cap2);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_seal_approve_owner_multiple_articles_same_publication() {
        let creator = @0xCAFE;
        let mut scenario = test_scenario::begin(creator);

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);
            let (mut publication, publisher_cap) = publication::create_for_testing(ctx);
            let published_at = clock::timestamp_ms(&clock) / 1000;

            // Create first article
            let seal_key_id1 = b"seal_key_111";
            let deposit1 = coin::mint_for_testing<SUI>(PREMIUM_PRICE / 100, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Article 1".to_string(),
                b"Test excerpt 1".to_string(),
                b"walrus_blob_1".to_string(),
                seal_key_id1,
                subscription::create_tier_basic(),
                published_at,
                b"{}".to_string(),
                deposit1,
                ctx
            );

            // Create second article
            let seal_key_id2 = b"seal_key_222";
            let deposit2 = coin::mint_for_testing<SUI>(PREMIUM_PRICE / 100, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Article 2".to_string(),
                b"Test excerpt 2".to_string(),
                b"walrus_blob_2".to_string(),
                seal_key_id2,
                subscription::create_tier_basic(),
                published_at,
                b"{}".to_string(),
                deposit2,
                ctx
            );

            // Clean up
            test_scenario::return_shared(treasury);
            transfer::public_transfer(publication, creator);
            transfer::public_transfer(publisher_cap, creator);
        };

        // Store article IDs
        let article1_id;
        let article2_id;
        test_scenario::next_tx(&mut scenario, creator);
        {
            let article2 = test_scenario::take_shared(&scenario);
            article2_id = article::id(&article2);
            test_scenario::return_shared(article2);

            let article1 = test_scenario::take_shared(&scenario);
            article1_id = article::id(&article1);
            test_scenario::return_shared(article1);
        };

        // Test owner can approve both articles with same PublisherCap
        test_scenario::next_tx(&mut scenario, creator);
        {
            let article1 = test_scenario::take_shared_by_id<article::Article>(&scenario, article1_id);
            let article2 = test_scenario::take_shared_by_id<article::Article>(&scenario, article2_id);
            let publication = test_scenario::take_from_sender(&scenario);
            let publisher_cap = test_scenario::take_from_sender(&scenario);

            let seal_key_id1 = article::seal_key_id(&article1);
            let seal_key_id2 = article::seal_key_id(&article2);

            // Both should succeed - same publication, same cap
            seal_policy::seal_approve_owner(
                seal_key_id1,
                &publisher_cap,
                &article1,
                &publication,
            );

            seal_policy::seal_approve_owner(
                seal_key_id2,
                &publisher_cap,
                &article2,
                &publication,
            );

            test_scenario::return_shared(article1);
            test_scenario::return_shared(article2);
            test_scenario::return_to_sender(&scenario, publication);
            test_scenario::return_to_sender(&scenario, publisher_cap);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }
}

