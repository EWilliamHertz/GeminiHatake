# Manus Session Prompt: Fix HatakeSocial Marketplace Functionality

## Repository Information
- **GitHub Repository**: https://github.com/EWilliamHertz/GeminiHatake
- **GitHub Token**: [User will provide GitHub token for repository access]

## Critical Issue Summary

The HatakeSocial marketplace functionality is completely broken. Users cannot list cards for sale either individually or in bulk, and cards marked for sale in collections do not appear in the marketplace.

## Current Broken State

**Marketplace Display**: Shows "Total Listings: 0" and "No listings found" despite cards being marked for sale in user collections.

**Individual Card Actions**: The "List for Sale" and "Remove from Sale" buttons on individual cards do not function. The individual sale modal does not work, making individual marketplace management impossible.

**Bulk Operations**: While bulk edit can mark cards as `for_sale: true` in the collection (showing green sale price badges like £14.00, £1.45, £300.00, £11.54), these cards never appear in the marketplace. The bulk marketplace listing creation fails silently.

## What Was Working Yesterday

Users could bulk list cards for sale and they would immediately appear in the marketplace. The marketplace showed all listed cards with proper pricing and currency conversion. Both individual and bulk operations functioned correctly.

## Technical Context

The key files involved are `/public/js/marketplace.js` for marketplace loading and display, `/public/js/modules/collection-app.js` for collection UI and bulk operations, `/public/js/modules/collection.js` for collection data management, `/public/js/modules/api.js` for Firestore API operations, and `/public/my_collection.html` for the collection page HTML.

The database structure includes user collections at `users/{uid}/collection/{cardId}` and marketplace listings at `marketplaceListings/{listingId}`. Cards have `for_sale`, `sale_price`, and `sale_currency` fields.

## Current Issues Identified

Several issues have been identified including a missing currency field in marketplace listing creation, individual marketplace actions not properly implemented, Firestore query issues with marketplace loading, event handlers for individual actions not working, and silent failures in bulk marketplace operations.

## Required Fixes

**Restore Bulk Marketplace Functionality**: Fix the `batchCreateMarketplaceListings` function to ensure cards marked for sale appear in marketplace immediately. Fix currency handling in marketplace listings and restore the working bulk edit to marketplace flow.

**Implement Working Individual Actions**: Add functional "List for Sale" and "Remove from Sale" buttons on each card. Create a working individual sale modal with pricing options and ensure individual actions update the marketplace in real-time.

**Fix Marketplace Display**: Ensure the marketplace loads and displays all listings correctly. Fix currency conversion and display, restore proper filtering and search functionality, and resolve the "Total Listings: 0" issue.

**Ensure Data Consistency**: Cards marked `for_sale: true` in collection must appear in marketplace. Removing cards from collection must remove marketplace listings. Price updates must sync between collection and marketplace, and currency handling must be consistent throughout.

## Success Criteria

After fixes, bulk edit should work where marking cards for sale makes them appear in marketplace immediately. Individual actions should work where clicking "List for Sale" opens a modal and successfully lists the card. The marketplace should display correctly showing all listings with proper counts and pricing. Currency should work with prices displaying in the user's currency (SEK in this case). Remove actions should work for both individual cards and bulk removal from marketplace. Real-time updates should reflect changes immediately without page refresh.

## Testing Instructions

Test bulk operations by using bulk edit to mark 4 cards for sale and verify they appear in marketplace. Test individual actions by hovering over cards, clicking "List for Sale", and verifying the modal works and listing is created. Test marketplace display by verifying it shows correct count, pricing, and currency. Test removal by removing cards individually and in bulk, verifying they disappear from marketplace. Test currency by verifying all prices display in user's selected currency (SEK).

## Priority

This is **CRITICAL** functionality. The marketplace is core to the platform and was working yesterday but is now completely broken. Users cannot sell cards at all. Please fix this comprehensively and ensure all marketplace functionality works as it did before the recent changes.
