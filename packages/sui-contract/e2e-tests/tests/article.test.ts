/**
 * E2E tests for article module
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { setupTestEnvironment } from '../utils/setup.js';
import { createFundedKeypair, waitForObject } from '../utils/wallets.js';
import { deployPackage, getFunctionName } from '../utils/deploy.js';
import {
  BASIC_PRICE,
  PREMIUM_PRICE,
  TEST_PUBLICATION,
  TEST_ARTICLE,
  Tier,
} from '../utils/constants.js';

describe('Article Module', () => {
  let client: SuiClient;
  let packageId: string;
  let creator: Ed25519Keypair;
  let treasuryId: string;

  beforeAll(async () => {
    // Setup test environment
    client = await setupTestEnvironment();

    // Create and fund test wallets
    creator = await createFundedKeypair(client);

    // Deploy the contract
    const deployed = await deployPackage(client, creator);
    packageId = deployed.packageId;

    // Create treasury (needed for article creation)
    const treasuryTx = new Transaction();
    const [treasury] = treasuryTx.moveCall({
      target: getFunctionName(packageId, 'treasury', 'create'),
      arguments: [],
    });
    treasuryTx.transferObjects([treasury], creator.toSuiAddress());

    const treasuryResult = await client.signAndExecuteTransaction({
      signer: creator,
      transaction: treasuryTx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const treasuryObject = treasuryResult.objectChanges?.find(
      (change) => change.type === 'created' && 'objectId' in change
    );
    treasuryId = (treasuryObject as any)?.objectId;

    console.log('Test setup complete');
    console.log('Package ID:', packageId);
    console.log('Treasury ID:', treasuryId);
  }, 120000);

  it('should publish an article successfully', async () => {
    // First create a publication
    const pubTx = new Transaction();
    const [publication, publisherCap] = pubTx.moveCall({
      target: getFunctionName(packageId, 'publication', 'create_publication'),
      arguments: [
        pubTx.pure.string(TEST_PUBLICATION.name),
        pubTx.pure.string(TEST_PUBLICATION.description),
        pubTx.pure.u64(BASIC_PRICE),
        pubTx.pure.u64(PREMIUM_PRICE),
        pubTx.pure.bool(true),
      ],
    });
    pubTx.transferObjects([publication, publisherCap], creator.toSuiAddress());

    const pubResult = await client.signAndExecuteTransaction({
      signer: creator,
      transaction: pubTx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const pubObject = pubResult.objectChanges?.find(
      (change) => change.type === 'created' && 'objectId' in change
    );
    const publicationId = (pubObject as any)?.objectId;
    const capObject = pubResult.objectChanges?.find(
      (change, idx) => idx > 0 && change.type === 'created' && 'objectId' in change
    );
    const publisherCapId = (capObject as any)?.objectId;

    await waitForObject(client, publicationId);
    await waitForObject(client, publisherCapId);

    // Create treasury if not exists
    if (!treasuryId) {
      const treasuryTx = new Transaction();
      const [treasury] = treasuryTx.moveCall({
        target: getFunctionName(packageId, 'treasury', 'create'),
        arguments: [],
      });
      treasuryTx.transferObjects([treasury], creator.toSuiAddress());

      const treasuryResult = await client.signAndExecuteTransaction({
        signer: creator,
        transaction: treasuryTx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      const treasuryObject = treasuryResult.objectChanges?.find(
        (change) => change.type === 'created' && 'objectId' in change
      );
      treasuryId = (treasuryObject as any)?.objectId;
    }

    await waitForObject(client, treasuryId);

    // Calculate deposit (1% of premium price)
    const depositAmount = PREMIUM_PRICE / 100n;
    const currentTime = Math.floor(Date.now() / 1000);

    // Publish article
    const articleTx = new Transaction();
    const basicTier = articleTx.moveCall({
      target: getFunctionName(packageId, 'subscription', 'create_tier_basic'),
      arguments: [],
    });
    const [deposit] = articleTx.splitCoins(articleTx.gas, [articleTx.pure.u64(depositAmount)]);
    
    articleTx.moveCall({
      target: getFunctionName(packageId, 'article', 'publish_article'),
      arguments: [
        articleTx.object(publicationId),
        articleTx.object(treasuryId),
        articleTx.object(publisherCapId),
        articleTx.pure.string(TEST_ARTICLE.title),
        articleTx.pure.string(TEST_ARTICLE.excerpt),
        articleTx.pure.string(TEST_ARTICLE.walrusBlobId),
        articleTx.pure.vector('u8', Array.from(Buffer.from(TEST_ARTICLE.sealKeyId))),
        basicTier,
        articleTx.pure.u64(currentTime),
        articleTx.pure.string('{}'), // image_metadata
        deposit,
      ],
    });

    const result = await client.signAndExecuteTransaction({
      signer: creator,
      transaction: articleTx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showEvents: true,
      },
    });

    expect(result.effects?.status.status).toBe('success');

    // Verify event was emitted
    const articlePublishedEvent = result.events?.find((event) =>
      event.type.includes('ArticlePublished')
    );
    expect(articlePublishedEvent).toBeDefined();
  });

  it('should extend article epochs successfully', async () => {
    // Create publication and article first
    const pubTx = new Transaction();
    const [publication, publisherCap] = pubTx.moveCall({
      target: getFunctionName(packageId, 'publication', 'create_publication'),
      arguments: [
        pubTx.pure.string('Epoch Test Publication'),
        pubTx.pure.string('Testing epoch extension'),
        pubTx.pure.u64(BASIC_PRICE),
        pubTx.pure.u64(PREMIUM_PRICE),
        pubTx.pure.bool(true),
      ],
    });
    pubTx.transferObjects([publication, publisherCap], creator.toSuiAddress());

    const pubResult = await client.signAndExecuteTransaction({
      signer: creator,
      transaction: pubTx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const pubObject = pubResult.objectChanges?.find(
      (change) => change.type === 'created' && 'objectId' in change
    );
    const publicationId = (pubObject as any)?.objectId;
    const capObject = pubResult.objectChanges?.find(
      (change, idx) => idx > 0 && change.type === 'created' && 'objectId' in change
    );
    const publisherCapId = (capObject as any)?.objectId;

    await waitForObject(client, publicationId);
    await waitForObject(client, publisherCapId);

    // Create treasury if not exists
    if (!treasuryId) {
      const treasuryTx = new Transaction();
      const [treasury] = treasuryTx.moveCall({
        target: getFunctionName(packageId, 'treasury', 'create'),
        arguments: [],
      });
      treasuryTx.transferObjects([treasury], creator.toSuiAddress());

      const treasuryResult = await client.signAndExecuteTransaction({
        signer: creator,
        transaction: treasuryTx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      const treasuryObject = treasuryResult.objectChanges?.find(
        (change) => change.type === 'created' && 'objectId' in change
      );
      treasuryId = (treasuryObject as any)?.objectId;
    }

    await waitForObject(client, treasuryId);

    // Create basic tier enum
    const depositAmount = PREMIUM_PRICE / 100n;
    const currentTime = Math.floor(Date.now() / 1000);

    const articleTx = new Transaction();
    const basicTier = articleTx.moveCall({
      target: getFunctionName(packageId, 'subscription', 'create_tier_basic'),
      arguments: [],
    });
    const [deposit] = articleTx.splitCoins(articleTx.gas, [articleTx.pure.u64(depositAmount)]);
    
    articleTx.moveCall({
      target: getFunctionName(packageId, 'article', 'publish_article'),
      arguments: [
        articleTx.object(publicationId),
        articleTx.object(treasuryId),
        articleTx.object(publisherCapId),
        articleTx.pure.string('Epoch Test Article'),
        articleTx.pure.string('Testing epoch extension'),
        articleTx.pure.string('test-blob-id'),
        articleTx.pure.vector('u8', Array.from(Buffer.from('test-seal-key'))),
        basicTier,
        articleTx.pure.u64(currentTime),
        articleTx.pure.string('{}'),
        deposit,
      ],
    });

    const articleResult = await client.signAndExecuteTransaction({
      signer: creator,
      transaction: articleTx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const articleObject = articleResult.objectChanges?.find(
      (change) => change.type === 'created' && 'objectId' in change
    );
    const articleId = (articleObject as any)?.objectId;

    await waitForObject(client, articleId);

    // Now extend epochs (anyone can do this)
    const extender = await createFundedKeypair(client);
    const extendTx = new Transaction();

    extendTx.moveCall({
      target: getFunctionName(packageId, 'article', 'extend_article_epochs'),
      arguments: [
        extendTx.object(articleId),
        extendTx.pure.u64(5), // 5 additional epochs
        extendTx.object('0x6'), // Clock
      ],
    });

    const extendResult = await client.signAndExecuteTransaction({
      signer: extender,
      transaction: extendTx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    expect(extendResult.effects?.status.status).toBe('success');

    // Verify ArticleEpochExtended event was emitted
    const epochExtendedEvent = extendResult.events?.find((event) =>
      event.type.includes('ArticleEpochExtended')
    );
    expect(epochExtendedEvent).toBeDefined();

    // Verify event data
    if (epochExtendedEvent?.parsedJson) {
      const eventData = epochExtendedEvent.parsedJson as any;
      expect(eventData.article_id).toBe(articleId);
      expect(eventData.extender).toBe(extender.toSuiAddress());
      expect(eventData.additional_epochs).toBe('5');
      expect(eventData.timestamp).toBeDefined();
    }
  });

  it('should allow multiple users to extend the same article', async () => {
    // Create publication and article
    const pubTx = new Transaction();
    const [publication, publisherCap] = pubTx.moveCall({
      target: getFunctionName(packageId, 'publication', 'create_publication'),
      arguments: [
        pubTx.pure.string('Multi Extend Publication'),
        pubTx.pure.string('Testing multiple extenders'),
        pubTx.pure.u64(BASIC_PRICE),
        pubTx.pure.u64(PREMIUM_PRICE),
        pubTx.pure.bool(true),
      ],
    });
    pubTx.transferObjects([publication, publisherCap], creator.toSuiAddress());

    const pubResult = await client.signAndExecuteTransaction({
      signer: creator,
      transaction: pubTx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const pubObject = pubResult.objectChanges?.find(
      (change) => change.type === 'created' && 'objectId' in change
    );
    const publicationId = (pubObject as any)?.objectId;
    const capObject = pubResult.objectChanges?.find(
      (change, idx) => idx > 0 && change.type === 'created' && 'objectId' in change
    );
    const publisherCapId = (capObject as any)?.objectId;

    await waitForObject(client, publicationId);
    await waitForObject(client, publisherCapId);

    // Create treasury if not exists
    if (!treasuryId) {
      const treasuryTx = new Transaction();
      const [treasury] = treasuryTx.moveCall({
        target: getFunctionName(packageId, 'treasury', 'create'),
        arguments: [],
      });
      treasuryTx.transferObjects([treasury], creator.toSuiAddress());

      const treasuryResult = await client.signAndExecuteTransaction({
        signer: creator,
        transaction: treasuryTx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      const treasuryObject = treasuryResult.objectChanges?.find(
        (change) => change.type === 'created' && 'objectId' in change
      );
      treasuryId = (treasuryObject as any)?.objectId;
    }

    await waitForObject(client, treasuryId);

    // Create basic tier enum
    const depositAmount = PREMIUM_PRICE / 100n;
    const currentTime = Math.floor(Date.now() / 1000);

    const articleTx = new Transaction();
    const basicTier = articleTx.moveCall({
      target: getFunctionName(packageId, 'subscription', 'create_tier_basic'),
      arguments: [],
    });
    const [deposit] = articleTx.splitCoins(articleTx.gas, [articleTx.pure.u64(depositAmount)]);
    
    articleTx.moveCall({
      target: getFunctionName(packageId, 'article', 'publish_article'),
      arguments: [
        articleTx.object(publicationId),
        articleTx.object(treasuryId),
        articleTx.object(publisherCapId),
        articleTx.pure.string('Multi Extend Article'),
        articleTx.pure.string('Testing multiple extenders'),
        articleTx.pure.string('test-blob-id'),
        articleTx.pure.vector('u8', Array.from(Buffer.from('test-seal-key'))),
        basicTier,
        articleTx.pure.u64(currentTime),
        articleTx.pure.string('{}'),
        deposit,
      ],
    });

    const articleResult = await client.signAndExecuteTransaction({
      signer: creator,
      transaction: articleTx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    const articleObject = articleResult.objectChanges?.find(
      (change) => change.type === 'created' && 'objectId' in change
    );
    const articleId = (articleObject as any)?.objectId;

    await waitForObject(client, articleId);

    // Create multiple extenders
    const extender1 = await createFundedKeypair(client);
    const extender2 = await createFundedKeypair(client);
    const extender3 = await createFundedKeypair(client);

    // First extender extends by 3 epochs
    const extend1Tx = new Transaction();
    extend1Tx.moveCall({
      target: getFunctionName(packageId, 'article', 'extend_article_epochs'),
      arguments: [
        extend1Tx.object(articleId),
        extend1Tx.pure.u64(3),
        extend1Tx.object('0x6'),
      ],
    });

    const extend1Result = await client.signAndExecuteTransaction({
      signer: extender1,
      transaction: extend1Tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    expect(extend1Result.effects?.status.status).toBe('success');
    const event1 = extend1Result.events?.find((event) =>
      event.type.includes('ArticleEpochExtended')
    );
    expect(event1).toBeDefined();
    if (event1?.parsedJson) {
      expect((event1.parsedJson as any).extender).toBe(extender1.toSuiAddress());
      expect((event1.parsedJson as any).additional_epochs).toBe('3');
    }

    // Second extender extends by 5 epochs
    const extend2Tx = new Transaction();
    extend2Tx.moveCall({
      target: getFunctionName(packageId, 'article', 'extend_article_epochs'),
      arguments: [
        extend2Tx.object(articleId),
        extend2Tx.pure.u64(5),
        extend2Tx.object('0x6'),
      ],
    });

    const extend2Result = await client.signAndExecuteTransaction({
      signer: extender2,
      transaction: extend2Tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    expect(extend2Result.effects?.status.status).toBe('success');
    const event2 = extend2Result.events?.find((event) =>
      event.type.includes('ArticleEpochExtended')
    );
    expect(event2).toBeDefined();
    if (event2?.parsedJson) {
      expect((event2.parsedJson as any).extender).toBe(extender2.toSuiAddress());
      expect((event2.parsedJson as any).additional_epochs).toBe('5');
    }

    // Third extender extends by 2 epochs
    const extend3Tx = new Transaction();
    extend3Tx.moveCall({
      target: getFunctionName(packageId, 'article', 'extend_article_epochs'),
      arguments: [
        extend3Tx.object(articleId),
        extend3Tx.pure.u64(2),
        extend3Tx.object('0x6'),
      ],
    });

    const extend3Result = await client.signAndExecuteTransaction({
      signer: extender3,
      transaction: extend3Tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    expect(extend3Result.effects?.status.status).toBe('success');
    const event3 = extend3Result.events?.find((event) =>
      event.type.includes('ArticleEpochExtended')
    );
    expect(event3).toBeDefined();
    if (event3?.parsedJson) {
      expect((event3.parsedJson as any).extender).toBe(extender3.toSuiAddress());
      expect((event3.parsedJson as any).additional_epochs).toBe('2');
    }
  });
});

