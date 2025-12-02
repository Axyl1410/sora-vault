# Testing Guide for Contract Enhancements

## Quick Test

Chạy tất cả tests:

```bash
cd move
sui move test
```

## Test Categories

### 1. Subscription Tests
**File:** `tests/subscription_tests.move`

**New tests:**
- `test_change_tier_upgrade` - Test upgrade từ Basic lên Premium với prorated payment
- `test_change_tier_downgrade` - Test downgrade từ Premium xuống Basic
- `test_calculate_remaining_value` - Verify remaining value calculation
- `test_update_listing_price` - Test update price trên Kiosk

**Run specific:**
```bash
sui move test subscription_tests
```

### 2. Comment Tests
**File:** `tests/comment_tests.move`

**Tests:**
- `test_create_comment` - Create comment với valid subscription
- `test_reply_to_comment` - Nested reply functionality
- `test_update_comment` - Update comment content
- `test_delete_comment` - Soft delete comment
- `test_comment_access_control` - Verify subscription access required (expected failure)
- `test_update_comment_unauthorized` - Unauthorized update attempt (expected failure)

**Run specific:**
```bash
sui move test comment_tests
```

### 3. Article Tests
**File:** `tests/article_tests.move`

**New tests:**
- `test_publish_article_with_images` - Publish với image metadata
- `test_update_article_images` - Update images

**Run specific:**
```bash
sui move test article_tests
```

## Expected Results

All tests should pass:

```
Running Move unit tests
[ PASS    ] private_publishing::subscription_tests::test_change_tier_upgrade
[ PASS    ] private_publishing::subscription_tests::test_change_tier_downgrade
[ PASS    ] private_publishing::subscription_tests::test_calculate_remaining_value
[ PASS    ] private_publishing::subscription_tests::test_update_listing_price
[ PASS    ] private_publishing::comment_tests::test_create_comment
[ PASS    ] private_publishing::comment_tests::test_reply_to_comment
[ PASS    ] private_publishing::comment_tests::test_update_comment
[ PASS    ] private_publishing::comment_tests::test_delete_comment
[ PASS    ] private_publishing::comment_tests::test_comment_access_control
[ PASS    ] private_publishing::comment_tests::test_update_comment_unauthorized
[ PASS    ] private_publishing::article_tests::test_publish_article_with_images
[ PASS    ] private_publishing::article_tests::test_update_article_images
...
Test result: OK. Total tests: XX; passed: XX; failed: 0
```

## Coverage

Run with coverage:

```bash
sui move test --coverage
```

## Troubleshooting

### If tests fail:

1. **Clean build:**
   ```bash
   rm -rf build/
   sui move build
   sui move test
   ```

2. **Check Sui CLI version:**
   ```bash
   sui --version
   # Should be 1.x.x or higher
   ```

3. **Update dependencies:**
   ```bash
   rm Move.lock
   sui move build
   ```

### Common Errors:

**"MISSING_DEPENDENCY"**
- Solution: Remove `[env.testnet]` section from Move.lock và rebuild

**"Segmentation fault"**
- Solution: Update Sui CLI hoặc thử build với clean state

## Next Steps After Tests Pass

1. Deploy to testnet:
   ```bash
   sui client publish --gas-budget 500000000
   ```

2. Extract package ID và treasury ID

3. Update frontend `networkConfig.ts`

4. Test frontend integration với new functions




