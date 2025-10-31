# Badge System Architecture for HatakeSocial

## Overview

The badge system for HatakeSocial is designed to automatically detect user activities and award badges based on predefined criteria. The system integrates seamlessly with the existing Firebase infrastructure and provides real-time badge awarding with notifications.

## System Components

### 1. Badge Definitions

Badge definitions are stored in a centralized JSON file (`badge_definitions.json`) and synchronized to Firestore. Each badge contains the following properties:

- **id**: Unique identifier for the badge
- **name**: Display name shown to users
- **description**: What the badge represents
- **category**: Badge category (getting_started, trading, collecting, community, etc.)
- **icon**: Font Awesome icon class for visual representation
- **rarity**: Badge rarity level (common, uncommon, rare, epic, legendary)
- **points**: Point value awarded when badge is earned
- **criteria**: Object defining the achievement requirements

### 2. Database Schema

The badge system uses the following Firestore structure:

```
/badgeDefinitions/{badgeId}
  - id: string
  - name: string
  - description: string
  - category: string
  - icon: string
  - rarity: string
  - points: number
  - criteria: object

/users/{userId}/badges/{badgeId}
  - badgeId: string
  - earnedAt: timestamp
  - progress: number (optional)
  - notified: boolean

/users/{userId}/badgeStats
  - totalBadges: number
  - totalPoints: number
  - categoryCounts: object
  - lastBadgeEarned: timestamp
  - lastBadgeId: string
```

### 3. Badge Categories

The system supports the following badge categories:

1. **Getting Started**: Onboarding achievements (first card, first trade, first post)
2. **Trading & Marketplace**: Trading and selling achievements
3. **Collecting**: Card collection milestones
4. **Deck Building**: Deck creation achievements
5. **Community & Social**: Social interaction achievements
6. **Events & Gameplay**: Event participation and tournament achievements
7. **Special & Seasonal**: Time-limited and special badges
8. **Loyalty & Store**: Purchase and subscription achievements

### 4. Badge Criteria Types

The system supports various criteria types for automatic detection:

- **account_created**: Triggered on user creation
- **cards_added**: Based on total cards in collection
- **total_cards**: Current card count threshold
- **trades_completed**: Number of successful trades
- **cards_sold**: Number of marketplace sales
- **positive_reviews**: Number of positive trade ratings
- **total_transactions**: Combined trades and sales
- **marketplace_purchases**: Number of purchases made
- **cards_listed**: Number of cards listed for sale
- **rare_cards**: Number of rare or higher cards owned
- **ultra_rare_cards**: Number of ultra-rare cards owned
- **complete_sets**: Number of complete sets owned
- **decks_created**: Number of decks created
- **public_decks**: Number of public decks shared
- **friends_count**: Number of friends added
- **comments_posted**: Number of comments made
- **likes_received**: Total likes on user's posts
- **groups_created**: Number of groups created
- **profile_completed**: Profile has picture and bio
- **articles_published**: Number of published articles
- **events_participated**: Number of events attended
- **games_played**: Number of games played
- **tournaments_entered**: Number of tournaments entered
- **tournaments_won**: Number of tournaments won
- **purchases_made**: Number of purchases
- **total_spent**: Total amount spent
- **premium_subscription**: Has active premium subscription

## Automatic Detection System

### Cloud Functions Triggers

The badge system uses Firebase Cloud Functions to automatically detect achievements:

#### 1. User Creation Trigger
```javascript
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  // Award "First Draw" badge
});
```

#### 2. Collection Update Trigger
```javascript
exports.onCollectionUpdate = functions.firestore
  .document('users/{userId}/collection/{cardId}')
  .onCreate(async (snap, context) => {
    // Check collection-based badges
  });
```

#### 3. Trade Completion Trigger
```javascript
exports.onTradeComplete = functions.firestore
  .document('trades/{tradeId}')
  .onUpdate(async (change, context) => {
    // Check trading badges
  });
```

#### 4. Post/Comment Trigger
```javascript
exports.onPostCreate = functions.firestore
  .document('posts/{postId}')
  .onCreate(async (snap, context) => {
    // Check social badges
  });
```

#### 5. Deck Creation Trigger
```javascript
exports.onDeckCreate = functions.firestore
  .document('users/{userId}/decks/{deckId}')
  .onCreate(async (snap, context) => {
    // Check deck building badges
  });
```

### Badge Checker Service

A centralized badge checking service evaluates user progress against all badge criteria:

```javascript
async function checkBadges(userId, activityType, activityData) {
  // 1. Get all badge definitions
  // 2. Filter badges by activity type
  // 3. Check if user already has badge
  // 4. Evaluate criteria against user stats
  // 5. Award badge if criteria met
  // 6. Send notification
}
```

### Badge Awarding Process

When a badge is earned:

1. **Verification**: Check if user already has the badge
2. **Award**: Add badge to user's badges subcollection
3. **Update Stats**: Increment total badges and points
4. **Notification**: Create notification for the user
5. **Activity Log**: Log the badge earning event

## User Interface Components

### 1. Badge Display Widget

A reusable component to display badges on user profiles:

```html
<div class="badge-container">
  <div class="badge" data-rarity="legendary">
    <i class="fas fa-trophy"></i>
    <span class="badge-name">Collector Gold</span>
  </div>
</div>
```

### 2. Badge Progress Tracker

Shows users their progress toward earning badges:

```html
<div class="badge-progress">
  <div class="badge-info">
    <span>Collector Silver</span>
    <span>750 / 1,000 cards</span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill" style="width: 75%"></div>
  </div>
</div>
```

### 3. Badge Notification

Real-time notification when a badge is earned:

```html
<div class="badge-notification">
  <i class="fas fa-award"></i>
  <div>
    <strong>Badge Earned!</strong>
    <p>You've earned the "Trader" badge</p>
  </div>
</div>
```

## Performance Considerations

### 1. Caching

- Badge definitions are cached in memory to reduce Firestore reads
- User badge stats are updated incrementally rather than recalculated

### 2. Batch Operations

- Multiple badge checks are batched together
- Badge awards use Firestore batch writes

### 3. Debouncing

- Rapid activity triggers are debounced to prevent excessive function calls
- Badge checks are queued and processed in batches

### 4. Indexing

Required Firestore indexes:

```
users/{userId}/badges
  - earnedAt (descending)
  - badgeId (ascending)

badgeDefinitions
  - category (ascending)
  - rarity (ascending)
```

## Admin Features

### 1. Badge Management Dashboard

Admins can:
- View all badge definitions
- Create custom badges
- Award badges manually
- View badge statistics
- Export badge data

### 2. Manual Badge Awarding

Cloud function for manual badge awarding:

```javascript
exports.awardBadgeManually = functions.https.onCall(async (data, context) => {
  // Verify admin privileges
  // Award badge to specified user
  // Log manual award
});
```

## Security Rules

Firestore security rules for badges:

```javascript
match /users/{userId}/badges/{badgeId} {
  allow read: if true;  // Badges are public
  allow write: if false;  // Only Cloud Functions can write
}

match /badgeDefinitions/{badgeId} {
  allow read: if true;
  allow write: if request.auth.token.admin == true;
}
```

## Testing Strategy

### 1. Unit Tests

- Test individual badge criteria evaluation
- Test badge awarding logic
- Test notification creation

### 2. Integration Tests

- Test end-to-end badge earning flows
- Test multiple badges earned simultaneously
- Test edge cases (duplicate awards, race conditions)

### 3. Performance Tests

- Test system under high load
- Measure function execution times
- Monitor Firestore read/write costs

## Future Enhancements

1. **Badge Leaderboards**: Show top badge earners
2. **Badge Showcasing**: Allow users to feature favorite badges
3. **Badge Trading**: Allow users to trade special badges
4. **Achievement Paths**: Show recommended paths to earn badges
5. **Seasonal Badges**: Rotate special badges based on seasons/events
6. **Badge Tiers**: Multi-level badges with progressive rewards
7. **Social Sharing**: Share badge achievements on social media
8. **Badge Collections**: Group related badges into collections

## Migration Plan

### Phase 1: Setup
1. Deploy badge definitions to Firestore
2. Create badge checking functions
3. Add badge display UI components

### Phase 2: Integration
1. Add triggers to existing functions
2. Implement notification system
3. Test with small user group

### Phase 3: Rollout
1. Award retroactive badges to existing users
2. Enable badge system for all users
3. Monitor performance and adjust

### Phase 4: Enhancement
1. Add admin dashboard
2. Implement progress tracking
3. Add advanced features
