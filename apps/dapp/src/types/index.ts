/**
 * TypeScript types matching Move structs from the Private Publishing platform
 */

// Tier enum matching Move's Tier enum
export enum Tier {
	Free = 0,
	Basic = 1,
	Premium = 2,
}

export type TierString = "Free" | "Basic" | "Premium";

// Publication struct
export interface Publication {
	id: string;
	name: string;
	description: string;
	creator: string;
	free_tier_enabled: boolean;
	basic_price: string; // u64 as string
	premium_price: string;
	article_count: string;
	image_url?: string; // Optional - for themed components
	subscriber_count?: number; // Optional - for themed components
}

// PublisherCap - ownership proof for publications
export interface PublisherCap {
	id: string;
	publication_id: string;
}

// SubscriptionNFT - subscription as an NFT
export interface SubscriptionNFT {
	id: string;
	publication_id: string;
	tier: Tier;
	subscribed_at: string; // u64 timestamp in seconds
	expires_at: string;
	subscriber: string;
}

// Article struct
export interface Article {
	id: string;
	publication_id: string;
	title: string;
	excerpt: string;
	walrus_blob_id: string;
	seal_key_id: number[]; // vector<u8>
	tier: Tier;
	published_at: string;
	is_archived: boolean;
	image_metadata: string; // JSON string with image blob IDs
	// Reading progress fields (from local storage)
	read_progress?: number; // 0-100, from local storage
	is_read?: boolean; // Derived from read_progress >= 90
	estimated_read_time?: number; // In minutes, calculated from content length
	last_read_at?: number; // Unix timestamp in milliseconds
}

// ReadToken - temporary access for pay-per-article
export interface ReadToken {
	id: string;
	article_id: string;
	reader: string;
	created_at: string;
	expires_at: string;
}

// Comment - on-chain comments
export interface Comment {
	id: string;
	article_id: string;
	author: string;
	parent_comment_id: string | null;
	content: string;
	created_at: string;
	updated_at: string;
	is_deleted: boolean;
}

// PublicationStats - private analytics
export interface PublicationStats {
	id: string;
	publication_id: string;
	total_subscribers: string;
	free_tier: string;
	basic_tier: string;
	premium_tier: string;
	total_revenue: string;
	total_views: string;
}

// Event types emitted by the contract

export interface PublicationCreatedEvent {
	publication_id: string;
	creator: string;
	name: string;
	basic_price: string;
	premium_price: string;
}

export interface SubscriptionCreatedEvent {
	subscription_id: string;
	publication_id: string;
	subscriber: string;
	tier: number;
	expires_at: string;
}

export interface SubscriptionRenewedEvent {
	subscription_id: string;
	new_expiry: string;
}

export interface SubscriptionTierChangedEvent {
	old_subscription_id: string;
	new_subscription_id: string;
	publication_id: string;
	subscriber: string;
	old_tier: number;
	new_tier: number;
	new_expires_at: string;
}

export interface ArticlePublishedEvent {
	article_id: string;
	publication_id: string;
	title: string;
	tier: number;
	published_at: string;
}

export interface ArticleUpdatedEvent {
	article_id: string;
	title: string;
	excerpt: string;
}

export interface ArticleArchivedEvent {
	article_id: string;
	archived_at: string;
}

export interface PricingUpdatedEvent {
	publication_id: string;
	new_basic_price: string;
	new_premium_price: string;
}

export interface FreeTierToggledEvent {
	publication_id: string;
	enabled: boolean;
}

export interface ReadTokenGeneratedEvent {
	token_id: string;
	article_id: string;
	reader: string;
	expires_at: string;
}

export interface CommentCreatedEvent {
	comment_id: string;
	article_id: string;
	author: string;
	parent_comment_id: string | null;
	created_at: string;
}

export interface CommentUpdatedEvent {
	comment_id: string;
	author: string;
	updated_at: string;
}

export interface CommentDeletedEvent {
	comment_id: string;
	author: string;
	deleted_at: string;
}

// UI-specific types

export interface PublicationWithStats extends Publication {
	stats?: PublicationStats;
}

export interface SubscriptionWithPublication extends SubscriptionNFT {
	publication?: Publication;
}

export interface ArticleWithAccess extends Article {
	hasAccess: boolean;
	accessMethod?: "subscription" | "token" | "none";
}

// Feed-specific types

export interface FeedArticle extends Article {
	publication_name: string;
	publication_id: string;
	publication_image_url?: string;
}

export interface ReadingSession {
	articleId: string;
	progress: number; // 0-100
	startedAt: number; // Unix timestamp
	lastUpdatedAt: number; // Unix timestamp
	completed: boolean;
}

export interface ReadingStats {
	totalArticlesRead: number;
	totalReadingTime: number; // In minutes
	averageReadingTime: number;
	articlesInProgress: number;
	currentStreak: number; // Days
	longestStreak: number;
}

// Image metadata for articles
export interface ImageMetadata {
	blob_id: string;
	width: number;
	height: number;
	alt: string;
	position: number;
}

// Comment thread with nested replies
export interface CommentThread extends Comment {
	replies: CommentThread[];
}
