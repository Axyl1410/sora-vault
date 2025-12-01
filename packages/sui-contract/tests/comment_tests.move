#[test_only]
module private_publishing::comment_tests {
    use private_publishing::comment::{Self, Comment};
    use private_publishing::article;
    use private_publishing::publication;
    use private_publishing::subscription;
    use private_publishing::treasury::{Self, Treasury};
    use sui::test_scenario;
    use sui::clock;
    use sui::coin;
    use sui::sui::SUI;

    const BASIC_PRICE: u64 = 5_000_000_000; // 5 SUI

    #[test]
    fun test_create_comment() {
        let creator = @0xCAFE;
        let commenter = @0xBEEF;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        test_scenario::next_tx(&mut scenario, creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            
            // Create publication (this shares it automatically)
            let publisher_cap = publication::create_publication(
                b"Test Publication".to_string(),
                b"Test Description".to_string(),
                5_000_000_000,  // basic price
                15_000_000_000, // premium price
                true,           // free tier enabled
                ctx
            );

            transfer::public_transfer(publisher_cap, creator);
        };

        // Publish article
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let publisher_cap = test_scenario::take_from_sender<publication::PublisherCap>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let deposit = coin::mint_for_testing<SUI>(150_000_000, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Test Article".to_string(),
                b"Test excerpt".to_string(),
                b"test_blob_id".to_string(),
                b"test_seal_key",
                subscription::create_tier_basic(),
                0,
                b"{}".to_string(),
                deposit,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            test_scenario::return_to_sender(&scenario, publisher_cap);
        };

        // Commenter subscribes
        test_scenario::next_tx(&mut scenario, commenter);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            transfer::public_transfer(subscription, commenter);
        };

        // Create comment
        test_scenario::next_tx(&mut scenario, commenter);
        {
            let article = test_scenario::take_shared<article::Article>(&scenario);
            let subscription = test_scenario::take_from_sender<subscription::SubscriptionNFT>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let comment = comment::create_comment(
                &article,
                &subscription,
                b"Great article!".to_string(),
                &clock,
                ctx
            );

            // Verify comment
            assert!(comment::article_id(&comment) == article::id(&article));
            assert!(comment::author(&comment) == commenter);
            assert!(!comment::is_deleted(&comment));

            test_scenario::return_shared(article);
            transfer::public_transfer(subscription, commenter);
            transfer::public_share_object(comment);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_reply_to_comment() {
        let creator = @0xCAFE;
        let commenter1 = @0xBEEF;
        let commenter2 = @0xDEAD;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        // Create publication
        test_scenario::next_tx(&mut scenario, creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            
            let publisher_cap = publication::create_publication(
                b"Test Publication".to_string(),
                b"Test Description".to_string(),
                5_000_000_000,
                15_000_000_000,
                true,
                ctx
            );

            transfer::public_transfer(publisher_cap, creator);
        };

        // Publish article
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let publisher_cap = test_scenario::take_from_sender<publication::PublisherCap>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let deposit = coin::mint_for_testing<SUI>(150_000_000, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Test Article".to_string(),
                b"Test excerpt".to_string(),
                b"test_blob_id".to_string(),
                b"test_seal_key",
                subscription::create_tier_basic(),
                0,
                b"{}".to_string(),
                deposit,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            test_scenario::return_to_sender(&scenario, publisher_cap);
        };

        // Commenter1 subscribes
        test_scenario::next_tx(&mut scenario, commenter1);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            transfer::public_transfer(subscription, commenter1);
        };

        // Commenter2 subscribes
        test_scenario::next_tx(&mut scenario, commenter2);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            transfer::public_transfer(subscription, commenter2);
        };

        // Commenter1 creates parent comment
        test_scenario::next_tx(&mut scenario, commenter1);
        {
            let article = test_scenario::take_shared<article::Article>(&scenario);
            let subscription = test_scenario::take_from_sender<subscription::SubscriptionNFT>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let comment = comment::create_comment(
                &article,
                &subscription,
                b"Great article!".to_string(),
                &clock,
                ctx
            );

            test_scenario::return_shared(article);
            transfer::public_transfer(subscription, commenter1);
            transfer::public_share_object(comment);
        };

        // Commenter2 replies to the comment
        test_scenario::next_tx(&mut scenario, commenter2);
        {
            let article = test_scenario::take_shared<article::Article>(&scenario);
            let parent_comment = test_scenario::take_shared<Comment>(&scenario);
            let subscription = test_scenario::take_from_sender<subscription::SubscriptionNFT>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let reply = comment::reply_to_comment(
                &article,
                &parent_comment,
                &subscription,
                b"Thanks for sharing!".to_string(),
                &clock,
                ctx
            );

            // Verify reply
            assert!(comment::article_id(&reply) == article::id(&article));
            assert!(comment::author(&reply) == commenter2);
            assert!(std::option::is_some(&comment::parent_comment_id(&reply)));

            test_scenario::return_shared(article);
            test_scenario::return_shared(parent_comment);
            transfer::public_transfer(subscription, commenter2);
            transfer::public_share_object(reply);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_update_comment() {
        let creator = @0xCAFE;
        let commenter = @0xBEEF;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        // Create publication
        test_scenario::next_tx(&mut scenario, creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            
            let publisher_cap = publication::create_publication(
                b"Test Publication".to_string(),
                b"Test Description".to_string(),
                5_000_000_000,
                15_000_000_000,
                true,
                ctx
            );

            transfer::public_transfer(publisher_cap, creator);
        };

        // Publish article
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let publisher_cap = test_scenario::take_from_sender<publication::PublisherCap>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let deposit = coin::mint_for_testing<SUI>(150_000_000, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Test Article".to_string(),
                b"Test excerpt".to_string(),
                b"test_blob_id".to_string(),
                b"test_seal_key",
                subscription::create_tier_basic(),
                0,
                b"{}".to_string(),
                deposit,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            test_scenario::return_to_sender(&scenario, publisher_cap);
        };

        // Subscribe
        test_scenario::next_tx(&mut scenario, commenter);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            transfer::public_transfer(subscription, commenter);
        };
        
        // Create and update comment
        test_scenario::next_tx(&mut scenario, commenter);
        {
            let article = test_scenario::take_shared<article::Article>(&scenario);
            let subscription = test_scenario::take_from_sender<subscription::SubscriptionNFT>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let mut comment = comment::create_comment(
                &article,
                &subscription,
                b"Original content".to_string(),
                &clock,
                ctx
            );

            let initial_content = comment::content(&comment);
            assert!(initial_content == b"Original content".to_string());

            // Update comment
            comment::update_comment(
                &mut comment,
                b"Updated content".to_string(),
                &clock,
                ctx
            );

            let updated_content = comment::content(&comment);
            assert!(updated_content == b"Updated content".to_string());

            test_scenario::return_shared(article);
            transfer::public_transfer(subscription, commenter);
            transfer::public_share_object(comment);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_delete_comment() {
        let creator = @0xCAFE;
        let commenter = @0xBEEF;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        // Create publication
        test_scenario::next_tx(&mut scenario, creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            
            let publisher_cap = publication::create_publication(
                b"Test Publication".to_string(),
                b"Test Description".to_string(),
                5_000_000_000,
                15_000_000_000,
                true,
                ctx
            );

            transfer::public_transfer(publisher_cap, creator);
        };

        // Publish article
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let publisher_cap = test_scenario::take_from_sender<publication::PublisherCap>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let deposit = coin::mint_for_testing<SUI>(150_000_000, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Test Article".to_string(),
                b"Test excerpt".to_string(),
                b"test_blob_id".to_string(),
                b"test_seal_key",
                subscription::create_tier_basic(),
                0,
                b"{}".to_string(),
                deposit,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            test_scenario::return_to_sender(&scenario, publisher_cap);
        };

        // Subscribe
        test_scenario::next_tx(&mut scenario, commenter);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            transfer::public_transfer(subscription, commenter);
        };
        
        // Create and delete comment
        test_scenario::next_tx(&mut scenario, commenter);
        {
            let article = test_scenario::take_shared<article::Article>(&scenario);
            let subscription = test_scenario::take_from_sender<subscription::SubscriptionNFT>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let mut comment = comment::create_comment(
                &article,
                &subscription,
                b"This will be deleted".to_string(),
                &clock,
                ctx
            );

            assert!(!comment::is_deleted(&comment));

            // Delete comment
            comment::delete_comment(&mut comment, &clock, ctx);

            assert!(comment::is_deleted(&comment));

            test_scenario::return_shared(article);
            transfer::public_transfer(subscription, commenter);
            transfer::public_share_object(comment);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = comment::EInsufficientAccess)]
    fun test_comment_access_control() {
        let creator = @0xCAFE;
        let non_subscriber = @0xBEEF;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        // Create publication
        test_scenario::next_tx(&mut scenario, creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            
            let publisher_cap = publication::create_publication(
                b"Test Publication".to_string(),
                b"Test Description".to_string(),
                5_000_000_000,
                15_000_000_000,
                true,
                ctx
            );

            transfer::public_transfer(publisher_cap, creator);
        };

        // Publish Premium tier article
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let publisher_cap = test_scenario::take_from_sender<publication::PublisherCap>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let deposit = coin::mint_for_testing<SUI>(150_000_000, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Premium Article".to_string(),
                b"Test excerpt".to_string(),
                b"test_blob_id".to_string(),
                b"test_seal_key",
                subscription::create_tier_premium(), // Premium tier required
                0,
                b"{}".to_string(),
                deposit,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            test_scenario::return_to_sender(&scenario, publisher_cap);
        };

        // Subscribe with Basic tier
        test_scenario::next_tx(&mut scenario, non_subscriber);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            transfer::public_transfer(subscription, non_subscriber);
        };
        
        // Try to comment (should fail - Basic tier doesn't have access to Premium article)
        test_scenario::next_tx(&mut scenario, non_subscriber);
        {
            let article = test_scenario::take_shared<article::Article>(&scenario);
            let subscription = test_scenario::take_from_sender<subscription::SubscriptionNFT>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            // This should fail because Basic tier doesn't have access to Premium article
            let comment = comment::create_comment(
                &article,
                &subscription,
                b"Should fail".to_string(),
                &clock,
                ctx
            );

            test_scenario::return_shared(article);
            transfer::public_transfer(subscription, non_subscriber);
            transfer::public_share_object(comment);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = comment::EUnauthorized)]
    fun test_update_comment_unauthorized() {
        let creator = @0xCAFE;
        let commenter = @0xBEEF;
        let other_user = @0xDEAD;
        let mut scenario = test_scenario::begin(creator);

        let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));

        // Initialize treasury
        test_scenario::next_tx(&mut scenario, creator);
        {
            treasury::init_for_testing(test_scenario::ctx(&mut scenario));
        };

        // Create publication
        test_scenario::next_tx(&mut scenario, creator);
        {
            let ctx = test_scenario::ctx(&mut scenario);
            
            let publisher_cap = publication::create_publication(
                b"Test Publication".to_string(),
                b"Test Description".to_string(),
                5_000_000_000,
                15_000_000_000,
                true,
                ctx
            );

            transfer::public_transfer(publisher_cap, creator);
        };

        // Publish article
        test_scenario::next_tx(&mut scenario, creator);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let publisher_cap = test_scenario::take_from_sender<publication::PublisherCap>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let deposit = coin::mint_for_testing<SUI>(150_000_000, ctx);
            article::publish_article(
                &mut publication,
                &mut treasury,
                &publisher_cap,
                b"Test Article".to_string(),
                b"Test excerpt".to_string(),
                b"test_blob_id".to_string(),
                b"test_seal_key",
                subscription::create_tier_basic(),
                0,
                b"{}".to_string(),
                deposit,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            test_scenario::return_to_sender(&scenario, publisher_cap);
        };

        // Commenter subscribes
        test_scenario::next_tx(&mut scenario, commenter);
        {
            let mut treasury = test_scenario::take_shared<Treasury>(&scenario);
            let mut publication = test_scenario::take_shared<publication::Publication>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let payment = coin::mint_for_testing<SUI>(BASIC_PRICE, ctx);
            let subscription = subscription::subscribe(
                &mut publication,
                &mut treasury,
                subscription::create_tier_basic(),
                payment,
                &clock,
                ctx
            );

            test_scenario::return_shared(treasury);
            test_scenario::return_shared(publication);
            transfer::public_transfer(subscription, commenter);
        };
        
        // Create comment
        test_scenario::next_tx(&mut scenario, commenter);
        {
            let article = test_scenario::take_shared<article::Article>(&scenario);
            let subscription = test_scenario::take_from_sender<subscription::SubscriptionNFT>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            let comment = comment::create_comment(
                &article,
                &subscription,
                b"Original comment".to_string(),
                &clock,
                ctx
            );

            test_scenario::return_shared(article);
            transfer::public_transfer(subscription, commenter);
            transfer::public_share_object(comment);
        };
        
        // Other user tries to update comment (should fail)
        test_scenario::next_tx(&mut scenario, other_user);
        {
            let mut comment = test_scenario::take_shared<Comment>(&scenario);
            let ctx = test_scenario::ctx(&mut scenario);

            // This should fail because other_user is not the author
            comment::update_comment(
                &mut comment,
                b"Hacked!".to_string(),
                &clock,
                ctx
            );

            test_scenario::return_shared(comment);
        };

        clock::destroy_for_testing(clock);
        test_scenario::end(scenario);
    }
}

