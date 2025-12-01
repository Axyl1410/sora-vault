/// Module: comment
/// Manages onchain comments for articles with nested reply support
module private_publishing::comment {
    use std::string::String;
    use std::option::Option;
    use sui::event;
    use sui::clock::{Self, Clock};
    use private_publishing::article::{Self, Article};
    use private_publishing::subscription::{Self, SubscriptionNFT};

    // Error codes
    const EInsufficientAccess: u64 = 1;
    const EUnauthorized: u64 = 2;
    const EInvalidSubscription: u64 = 3;

    // Events
    public struct CommentCreated has copy, drop {
        comment_id: ID,
        article_id: ID,
        author: address,
        parent_comment_id: Option<ID>,
        created_at: u64,
    }

    public struct CommentUpdated has copy, drop {
        comment_id: ID,
        updated_at: u64,
    }

    public struct CommentDeleted has copy, drop {
        comment_id: ID,
        deleted_at: u64,
    }

    /// Represents an onchain comment
    public struct Comment has key, store {
        id: UID,
        article_id: ID,
        author: address,
        content: String,
        created_at: u64,
        updated_at: u64,
        parent_comment_id: Option<ID>,     // For nested replies
        is_deleted: bool,
    }

    /// Creates a comment on an article
    /// Requires valid subscription with access to the article's tier
    public fun create_comment(
        article: &Article,
        subscription: &SubscriptionNFT,
        content: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): Comment {
        // Verify subscription belongs to same publication as article
        assert!(
            subscription::publication_id(subscription) == article::publication_id(article),
            EInvalidSubscription
        );

        // Verify subscription has tier access to article
        assert!(
            subscription::has_tier_access(subscription, article::tier(article), clock),
            EInsufficientAccess
        );

        let comment_uid = object::new(ctx);
        let comment_id = object::uid_to_inner(&comment_uid);
        let current_time = clock::timestamp_ms(clock) / 1000;

        event::emit(CommentCreated {
            comment_id,
            article_id: article::id(article),
            author: ctx.sender(),
            parent_comment_id: std::option::none(),
            created_at: current_time,
        });

        Comment {
            id: comment_uid,
            article_id: article::id(article),
            author: ctx.sender(),
            content,
            created_at: current_time,
            updated_at: current_time,
            parent_comment_id: std::option::none(),
            is_deleted: false,
        }
    }

    /// Creates a reply to an existing comment (nested comment)
    /// Requires valid subscription with access to the article's tier
    public fun reply_to_comment(
        article: &Article,
        parent_comment: &Comment,
        subscription: &SubscriptionNFT,
        content: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): Comment {
        // Verify parent comment belongs to the same article
        assert!(parent_comment.article_id == article::id(article), EInvalidSubscription);

        // Verify subscription belongs to same publication as article
        assert!(
            subscription::publication_id(subscription) == article::publication_id(article),
            EInvalidSubscription
        );

        // Verify subscription has tier access to article
        assert!(
            subscription::has_tier_access(subscription, article::tier(article), clock),
            EInsufficientAccess
        );

        let comment_uid = object::new(ctx);
        let comment_id = object::uid_to_inner(&comment_uid);
        let current_time = clock::timestamp_ms(clock) / 1000;
        let parent_id = object::id(parent_comment);

        event::emit(CommentCreated {
            comment_id,
            article_id: article::id(article),
            author: ctx.sender(),
            parent_comment_id: std::option::some(parent_id),
            created_at: current_time,
        });

        Comment {
            id: comment_uid,
            article_id: article::id(article),
            author: ctx.sender(),
            content,
            created_at: current_time,
            updated_at: current_time,
            parent_comment_id: std::option::some(parent_id),
            is_deleted: false,
        }
    }

    /// Updates a comment's content
    /// Only the comment author can update
    public fun update_comment(
        comment: &mut Comment,
        new_content: String,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify caller is the comment author
        assert!(comment.author == ctx.sender(), EUnauthorized);

        let current_time = clock::timestamp_ms(clock) / 1000;
        comment.content = new_content;
        comment.updated_at = current_time;

        event::emit(CommentUpdated {
            comment_id: object::id(comment),
            updated_at: current_time,
        });
    }

    /// Soft deletes a comment
    /// Only the comment author can delete
    public fun delete_comment(
        comment: &mut Comment,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Verify caller is the comment author
        assert!(comment.author == ctx.sender(), EUnauthorized);

        let current_time = clock::timestamp_ms(clock) / 1000;
        comment.is_deleted = true;

        event::emit(CommentDeleted {
            comment_id: object::id(comment),
            deleted_at: current_time,
        });
    }

    // === Accessor Functions ===

    public fun id(comment: &Comment): ID {
        object::id(comment)
    }

    public fun article_id(comment: &Comment): ID {
        comment.article_id
    }

    public fun author(comment: &Comment): address {
        comment.author
    }

    public fun content(comment: &Comment): String {
        comment.content
    }

    public fun created_at(comment: &Comment): u64 {
        comment.created_at
    }

    public fun updated_at(comment: &Comment): u64 {
        comment.updated_at
    }

    public fun parent_comment_id(comment: &Comment): Option<ID> {
        comment.parent_comment_id
    }

    public fun is_deleted(comment: &Comment): bool {
        comment.is_deleted
    }

    // === Test-only functions ===

    #[test_only]
    public fun create_for_testing(
        article_id: ID,
        author: address,
        content: String,
        ctx: &mut TxContext
    ): Comment {
        Comment {
            id: object::new(ctx),
            article_id,
            author,
            content,
            created_at: 0,
            updated_at: 0,
            parent_comment_id: std::option::none(),
            is_deleted: false,
        }
    }
}

