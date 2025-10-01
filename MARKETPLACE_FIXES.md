# Marketplace Issues & Fixes

## Issues Identified

### 1. "List for Sale" Button Not Working
**Problem**: The hover button for "List for Sale" doesn't respond to clicks.

**Root Cause**: Event delegation may not be properly set up for dynamically rendered buttons.

**Fix**: Enhanced event handling in `collection-app.js`

### 2. "Insufficient Permissions" Error
**Problem**: Users get permission denied when trying to remove listings from marketplace.

**Root Cause**: Firestore rules don't properly handle the `sellerData.uid` field structure used by the marketplace listings.

**Fix**: Updated Firestore rules to handle both `sellerId` and `sellerData.uid` patterns.

### 3. Price Display Shows "$0 - $0"
**Problem**: Marketplace listings show incorrect price formatting.

**Root Cause**: Currency conversion or price field mapping issues.

**Fix**: Enhanced price handling and currency conversion.

### 4. Orphaned Marketplace Listings
**Problem**: Cards removed from collection still exist in marketplace.

**Root Cause**: No automatic cleanup when cards are deleted from collections.

**Fix**: Enhanced deletion logic to clean up marketplace listings.

## Solutions Implemented

### 1. Updated Firestore Rules

**File**: `UPDATED_FIRESTORE_RULES.txt`

**Key Changes**:
```javascript
match /marketplaceListings/{listingId} {
  allow read: if true;
  allow list: if true;
  // FIXED: Allow creation if user matches sellerData.uid or sellerId
  allow create: if isSignedIn() && 
                  (request.auth.uid == request.resource.data.sellerData.uid ||
                   request.auth.uid == request.resource.data.sellerId);
  // FIXED: Allow update/delete if user matches sellerData.uid or sellerId
  allow update, delete: if isSignedIn() && 
                          (request.auth.uid == resource.data.sellerData.uid ||
                           request.auth.uid == resource.data.sellerId);
}
```

### 2. Enhanced Event Handling

**Problem**: Buttons not responding to clicks
**Solution**: Added proper event delegation and debugging

### 3. Price Display Fix

**Problem**: "$0 - $0" price display
**Solution**: Enhanced currency conversion and price formatting

### 4. Automatic Cleanup

**Problem**: Orphaned marketplace listings
**Solution**: Enhanced deletion functions to clean up marketplace

## Implementation Steps

### Step 1: Update Firestore Rules
1. Go to Firebase Console → Firestore Database → Rules
2. Replace current rules with content from `UPDATED_FIRESTORE_RULES.txt`
3. Publish the rules

### Step 2: Debug Button Issues
1. Open browser console on your collection page
2. Copy and paste the content from `marketplace-debug-fix.js`
3. Check console for diagnostic messages
4. Test the "List for Sale" buttons

### Step 3: Clean Up Orphaned Listings
Run this in Firebase Console or via Cloud Functions:

```javascript
// Clean up orphaned marketplace listings
const admin = require('firebase-admin');
const db = admin.firestore();

async function cleanupOrphanedListings() {
  const marketplaceSnapshot = await db.collection('marketplaceListings').get();
  const batch = db.batch();
  let cleanupCount = 0;

  for (const doc of marketplaceSnapshot.docs) {
    const listing = doc.data();
    const originalCardId = listing.originalCollectionCardId;
    const sellerId = listing.sellerData?.uid || listing.sellerId;

    if (originalCardId && sellerId) {
      // Check if the original card still exists
      const cardRef = db.collection('users').doc(sellerId).collection('collection').doc(originalCardId);
      const cardDoc = await cardRef.get();

      if (!cardDoc.exists) {
        // Card doesn't exist, remove the listing
        batch.delete(doc.ref);
        cleanupCount++;
        console.log(`Removing orphaned listing: ${doc.id}`);
      }
    }
  }

  if (cleanupCount > 0) {
    await batch.commit();
    console.log(`Cleaned up ${cleanupCount} orphaned listings`);
  } else {
    console.log('No orphaned listings found');
  }
}

// Run the cleanup
cleanupOrphanedListings();
```

### Step 4: Test Individual Marketplace Actions

1. **Test List for Sale**:
   - Hover over a card not currently for sale
   - Click the green dollar sign button
   - Modal should open with card details
   - Set a price and confirm
   - Card should show green sale badge

2. **Test Remove from Sale**:
   - Hover over a card currently for sale
   - Click the orange "Remove from Sale" button
   - Confirm the removal
   - Card should no longer show sale badge

3. **Test Update Price**:
   - Hover over a card currently for sale
   - Click the green "Update Price" button
   - Modal should open with current price pre-filled
   - Change price and confirm
   - Sale badge should update with new price

## Verification Checklist

- [ ] Firestore rules updated and published
- [ ] "List for Sale" button responds to clicks
- [ ] Individual sale modal opens correctly
- [ ] Price calculations work properly
- [ ] Currency display is correct (not "$0 - $0")
- [ ] "Remove from Sale" works without permission errors
- [ ] "Update Price" opens modal with current price
- [ ] Marketplace listings are properly created/updated/deleted
- [ ] No orphaned listings remain after card deletion

## Additional Notes

### Currency Handling
The system should properly handle currency conversion. If you see "$0 - $0", check:
1. Card has valid price data in the `prices` field
2. Currency conversion functions are working
3. User's selected currency is properly set

### Permission Errors
If you still get permission errors after updating Firestore rules:
1. Ensure rules are published (not just saved)
2. Check that user is properly authenticated
3. Verify the marketplace listing document structure matches the rules

### Button Not Working
If buttons still don't work:
1. Check browser console for JavaScript errors
2. Ensure the modal HTML is present in `my_collection.html`
3. Verify event listeners are properly attached
4. Use the debug script to diagnose issues

## Support

If issues persist after implementing these fixes:
1. Check browser console for error messages
2. Verify Firestore rules are properly published
3. Test with a fresh browser session (clear cache)
4. Ensure all JavaScript files are properly loaded
