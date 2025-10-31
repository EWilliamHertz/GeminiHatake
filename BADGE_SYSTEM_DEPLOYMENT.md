# Badge System Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the badge system to your HatakeSocial platform.

## Prerequisites

- Firebase CLI installed and configured
- Admin access to Firebase project
- Node.js 18+ installed
- Access to the Firebase Console

## Files Created

### Backend Files
1. **`functions/badgeService.js`** - Core badge logic and checking service
2. **`functions/badgeFunctions.js`** - Cloud Functions for badge triggers
3. **`badge_definitions.json`** - Badge definitions (needs to be copied to functions folder)

### Frontend Files
1. **`public/js/badgeSystem.js`** - Frontend JavaScript for badge display
2. **`public/badges.html`** - Badges page for users to view their achievements

### Documentation
1. **`BADGE_SYSTEM_ARCHITECTURE.md`** - System architecture documentation
2. **`BADGE_SYSTEM_DEPLOYMENT.md`** - This deployment guide

## Deployment Steps

### Step 1: Copy Badge Definitions

Copy the badge definitions file to the functions directory:

```bash
cp badge_definitions.json functions/badge_definitions.json
```

### Step 2: Update Firebase Functions

Add the badge functions to your `functions/index.js` file. You have two options:

#### Option A: Import and Export (Recommended)

Add these lines to the top of `functions/index.js`:

```javascript
const badgeFunctions = require('./badgeFunctions');
```

Then at the end of the file, export all badge functions:

```javascript
// Export badge functions
Object.assign(exports, badgeFunctions);
```

#### Option B: Copy Functions Directly

Copy the contents of `functions/badgeFunctions.js` directly into `functions/index.js`.

### Step 3: Update Existing Functions

Modify the existing `onUserCreate` function in `functions/index.js` to check for badges:

```javascript
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
    const { uid, email, displayName } = user;
    const userRef = db.collection('users').doc(uid);

    try {
        const userData = {
            email: email,
            displayName: displayName || email.split('@')[0],
            handle: (displayName || email.split('@')[0]).toLowerCase() + Math.floor(Math.random() * 1000),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            friends: [],
            followers: [],
            friendRequests: [],
            shopDiscountPercent: 0,
            referralCount: 0,
            postCount: 0,
            isVerified: false,
            dateFormat: 'dmy',
            // Badge-related fields
            tradesCompleted: 0,
            cardsSold: 0,
            positiveReviews: 0,
            positiveRatings: 0,
            marketplacePurchases: 0,
            cardsListed: 0,
            commentCount: 0,
            likesReceived: 0,
            gamesPlayed: 0,
            tournamentsEntered: 0,
            tournamentsWon: 0,
            purchasesMade: 0,
            totalSpent: 0
        };

        await userRef.set(userData);
        console.log(`Created user document for ${uid}`);

        // Check for badges (First Draw badge)
        const badgeService = require('./badgeService');
        await badgeService.checkAndAwardBadges(uid, 'user_created');

    } catch (error) {
        console.error(`Failed to create user document for ${uid}:`, error);
    }

    return null;
});
```

### Step 4: Update Firestore Security Rules

The badge security rules are already in your `firestore.rules` file (lines 53-56):

```javascript
match /users/{userId}/badges/{badgeId} {
  allow read: if true;
  allow write: if isUser(userId);
}
```

Add rules for badge definitions:

```javascript
match /badgeDefinitions/{badgeId} {
  allow read: if true;
  allow write: if request.auth.token.admin == true;
}

match /badgeAwardLogs/{logId} {
  allow read: if request.auth.token.admin == true;
  allow write: if false;
}
```

### Step 5: Update Firestore Indexes

Create the following indexes in Firebase Console or add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "badges",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "earnedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "read", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Step 6: Install Dependencies

Ensure all required dependencies are installed:

```bash
cd functions
npm install
cd ..
```

### Step 7: Deploy Firebase Functions

Deploy the updated functions:

```bash
firebase deploy --only functions
```

This will deploy all the new badge functions including:
- `initializeBadges`
- `awardBadgeManually`
- `getBadgeProgress`
- `checkBadgesOnUserCreate`
- `checkBadgesOnCollectionUpdate`
- `checkBadgesOnTradeComplete`
- `checkBadgesOnPostCreate`
- `checkBadgesOnDeckCreate`
- `checkBadgesOnPublicDeckCreate`
- `checkBadgesOnFollow`
- `checkBadgesOnArticlePublish`
- `checkBadgesOnGroupCreate`
- `checkBadgesOnProfileUpdate`
- `checkBadgesOnMarketplaceListing`
- `dailyBadgeCheck`
- `retroactivelyAwardBadges`

### Step 8: Deploy Frontend Files

Deploy the frontend files:

```bash
firebase deploy --only hosting
```

This will deploy:
- `public/js/badgeSystem.js`
- `public/badges.html`

### Step 9: Initialize Badge Definitions

After deployment, initialize the badge definitions in Firestore. You can do this via the Firebase Console or by calling the Cloud Function:

#### Option A: Using Firebase Console

1. Go to Firebase Console → Functions
2. Find the `initializeBadges` function
3. Test it with empty data `{}`

#### Option B: Using Firebase CLI

```bash
firebase functions:call initializeBadges --data '{}'
```

#### Option C: Using JavaScript in Browser Console

On any authenticated page of your site:

```javascript
const initBadges = firebase.functions().httpsCallable('initializeBadges');
initBadges().then(result => console.log(result));
```

### Step 10: Award Retroactive Badges

For existing users, run the retroactive badge award function:

```bash
firebase functions:call retroactivelyAwardBadges --data '{}'
```

**Note:** This may take a while depending on the number of users. Monitor the function logs in Firebase Console.

### Step 11: Add Badge Link to Navigation

Update the navigation in your existing pages to include a link to the badges page. Add this to the sidebar navigation:

```html
<a href="badges.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md">
    <i class="fas fa-award w-6 text-center"></i>
    <span class="ml-3">My Badges</span>
</a>
```

### Step 12: Initialize Badge System on Existing Pages

Add badge notification support to your existing pages by adding this script before the closing `</body>` tag:

```html
<script src="js/badgeSystem.js"></script>
<script>
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            BadgeSystem.initBadgeSystem(user.uid);
        }
    });
</script>
```

## Testing

### Test Badge Awarding

1. **Create a new account** - Should automatically award "First Draw" badge
2. **Add a card to collection** - Should award "Collector in Training" badge
3. **Create a deck** - Should award "Deck Builder" badge
4. **Make a post** - Should award "Welcome to the Arena" badge

### Test Badge Display

1. Navigate to `/badges.html`
2. Verify badges are displayed correctly
3. Check badge statistics
4. Verify progress tracking works

### Test Badge Notifications

1. Perform an action that earns a badge
2. Verify notification appears in top-right corner
3. Check that notification is marked as read

## Monitoring

### View Function Logs

Monitor badge awarding in Firebase Console:

```bash
firebase functions:log --only checkBadgesOnCollectionUpdate
```

### Check Badge Statistics

Query Firestore to see badge statistics:

```javascript
db.collection('users').doc(userId).collection('private').doc('badgeStats').get()
```

## Troubleshooting

### Badges Not Awarding

1. Check function logs for errors
2. Verify badge definitions are initialized
3. Check user activity counts in user document
4. Manually trigger badge check:

```javascript
const checkBadges = firebase.functions().httpsCallable('getBadgeProgress');
checkBadges().then(result => console.log(result));
```

### Badge Notifications Not Showing

1. Verify `badgeSystem.js` is loaded
2. Check browser console for errors
3. Verify Firebase Auth is working
4. Check notification permissions

### Performance Issues

1. Monitor function execution times in Firebase Console
2. Check Firestore read/write counts
3. Consider adjusting daily badge check schedule
4. Optimize badge checking logic if needed

## Maintenance

### Adding New Badges

1. Add badge definition to `badge_definitions.json`
2. Deploy functions: `firebase deploy --only functions`
3. Call `initializeBadges` function to update Firestore
4. Optionally run `retroactivelyAwardBadges` for existing users

### Manually Awarding Badges

Use the admin function to manually award badges:

```javascript
const awardBadge = firebase.functions().httpsCallable('awardBadgeManually');
awardBadge({ userId: 'USER_ID', badgeId: 'BADGE_ID' })
    .then(result => console.log(result));
```

### Updating Badge Criteria

1. Update criteria in `badge_definitions.json`
2. Update corresponding logic in `badgeService.js` if needed
3. Deploy functions
4. Re-initialize badge definitions

## Cost Considerations

### Firestore Operations

- Badge checks trigger on various user activities
- Daily badge check runs for all users
- Consider costs for large user bases

### Cloud Functions

- Multiple triggers per user action
- Daily scheduled function
- Monitor usage in Firebase Console

### Optimization Tips

1. Use caching for badge definitions
2. Batch badge checks when possible
3. Adjust daily check schedule based on usage
4. Consider disabling daily checks if not needed

## Security

### Admin-Only Functions

The following functions require admin privileges:
- `initializeBadges`
- `awardBadgeManually`
- `retroactivelyAwardBadges`

### User Data Protection

- Badge stats are stored in `users/{userId}/private/badgeStats`
- Only the user can read their private data
- Badges themselves are public

## Next Steps

1. **Customize Badge Icons**: Replace Font Awesome icons with custom images
2. **Add Badge Leaderboards**: Show top badge earners
3. **Implement Badge Showcasing**: Let users feature favorite badges on profile
4. **Add Social Sharing**: Share badge achievements on social media
5. **Create Badge Collections**: Group related badges
6. **Add Achievement Paths**: Show users how to earn specific badges

## Support

For issues or questions:
1. Check function logs in Firebase Console
2. Review Firestore security rules
3. Verify all files are deployed correctly
4. Check browser console for frontend errors

## Rollback

If you need to rollback the badge system:

1. Remove badge functions from `functions/index.js`
2. Deploy functions: `firebase deploy --only functions`
3. Remove badge navigation links from frontend
4. Badge data will remain in Firestore but won't be updated
