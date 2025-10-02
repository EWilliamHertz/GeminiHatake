# Marketplace Listing Fix

## Issue Identified

The bulk marketplace listing functionality is failing because the `batchCreateMarketplaceListings` function was missing the `currency` field in the marketplace listing data structure. This causes listings to be created without proper currency information, which may cause them to be filtered out or not display correctly.

## Root Cause

In `public/js/modules/collection.js`, the `batchCreateMarketplaceListings` function was missing:
```javascript
currency: update.data.sale_currency || 'USD',
```

## Fix Applied

### 1. Added Missing Currency Field

**File**: `public/js/modules/collection.js` (line 289)

**Before**:
```javascript
price: update.data.sale_price,
quantity: card.quantity || 1,
```

**After**:
```javascript
price: update.data.sale_price,
currency: update.data.sale_currency || 'USD',
quantity: card.quantity || 1,
```

### 2. Verification

The bulk edit functionality in `collection-app.js` correctly sets:
```javascript
sale_currency: Currency.getUserCurrency()
```

And the individual marketplace functionality also correctly includes the currency field.

## Expected Result

After this fix:
1. Bulk marketplace listings will include the proper currency field
2. Cards listed for sale will appear in the marketplace immediately
3. Currency display will work correctly
4. No more missing listings after bulk operations

## Testing

To verify the fix works:
1. Mark cards for sale using bulk edit
2. Check that they appear in marketplace immediately
3. Verify currency is displayed correctly
4. Confirm individual marketplace actions also work

This fix addresses the core issue that was causing marketplace listings to fail silently.
