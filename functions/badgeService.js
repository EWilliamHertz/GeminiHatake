/**
 * Badge Service
 * 
 * Centralized service for managing badge awards and checking criteria
 */

const admin = require("firebase-admin");
const db = admin.firestore();

// Badge definitions cache
let badgeDefinitionsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Get all badge definitions from Firestore with caching
 */
async function getBadgeDefinitions() {
    const now = Date.now();
    
    if (badgeDefinitionsCache && (now - cacheTimestamp) < CACHE_DURATION) {
        return badgeDefinitionsCache;
    }
    
    const badgesSnapshot = await db.collection('badgeDefinitions').get();
    badgeDefinitionsCache = {};
    
    badgesSnapshot.forEach(doc => {
        badgeDefinitionsCache[doc.id] = doc.data();
    });
    
    cacheTimestamp = now;
    return badgeDefinitionsCache;
}

/**
 * Check if user already has a specific badge
 */
async function userHasBadge(userId, badgeId) {
    const badgeDoc = await db.collection('users').doc(userId)
        .collection('badges').doc(badgeId).get();
    return badgeDoc.exists;
}

/**
 * Get user's badge statistics
 */
async function getUserBadgeStats(userId) {
    const statsDoc = await db.collection('users').doc(userId)
        .collection('private').doc('badgeStats').get();
    
    if (statsDoc.exists) {
        return statsDoc.data();
    }
    
    return {
        totalBadges: 0,
        totalPoints: 0,
        categoryCounts: {},
        lastBadgeEarned: null,
        lastBadgeId: null
    };
}

/**
 * Get user activity counts for badge checking
 */
async function getUserActivityCounts(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};
    
    // Get collection count
    const collectionSnapshot = await db.collection('users').doc(userId)
        .collection('collection').get();
    const totalCards = collectionSnapshot.size;
    
    // Get deck count
    const decksSnapshot = await db.collection('users').doc(userId)
        .collection('decks').get();
    const totalDecks = decksSnapshot.size;
    
    // Get public decks count
    const publicDecksSnapshot = await db.collection('publicDecks')
        .where('authorId', '==', userId).get();
    const totalPublicDecks = publicDecksSnapshot.size;
    
    // Get friends count (followers)
    const followersSnapshot = await db.collection('users').doc(userId)
        .collection('followers').get();
    const friendsCount = followersSnapshot.size;
    
    // Get articles count
    const articlesSnapshot = await db.collection('articles')
        .where('authorId', '==', userId)
        .where('status', '==', 'published').get();
    const articlesPublished = articlesSnapshot.size;
    
    // Get groups created count
    const groupsSnapshot = await db.collection('groups')
        .where('creatorId', '==', userId).get();
    const groupsCreated = groupsSnapshot.size;
    
    // Get event participation count
    const eventsSnapshot = await db.collection('events')
        .where('participants', 'array-contains', userId).get();
    const eventsParticipated = eventsSnapshot.size;
    
    // Calculate rare cards count
    let rareCards = 0;
    let ultraRareCards = 0;
    collectionSnapshot.forEach(doc => {
        const card = doc.data();
        if (card.rarity && ['rare', 'mythic', 'legendary'].includes(card.rarity.toLowerCase())) {
            rareCards++;
        }
        if (card.rarity && ['mythic', 'legendary'].includes(card.rarity.toLowerCase())) {
            ultraRareCards++;
        }
    });
    
    return {
        totalCards,
        totalDecks,
        totalPublicDecks,
        friendsCount,
        articlesPublished,
        groupsCreated,
        eventsParticipated,
        rareCards,
        ultraRareCards,
        tradesCompleted: userData.tradesCompleted || 0,
        cardsSold: userData.cardsSold || 0,
        positiveReviews: userData.positiveReviews || 0,
        positiveRatings: userData.positiveRatings || 0,
        totalTransactions: (userData.tradesCompleted || 0) + (userData.cardsSold || 0),
        marketplacePurchases: userData.marketplacePurchases || 0,
        cardsListed: userData.cardsListed || 0,
        commentsPosted: userData.commentCount || 0,
        likesReceived: userData.likesReceived || 0,
        postCount: userData.postCount || 0,
        gamesPlayed: userData.gamesPlayed || 0,
        tournamentsEntered: userData.tournamentsEntered || 0,
        tournamentsWon: userData.tournamentsWon || 0,
        purchasesMade: userData.purchasesMade || 0,
        totalSpent: userData.totalSpent || 0,
        hasPremium: userData.isPremium || false,
        hasProfilePicture: !!userData.photoURL,
        hasBio: !!userData.bio,
        accountCreatedAt: userData.createdAt || null
    };
}

/**
 * Check if criteria is met for a specific badge
 */
function checkCriteria(criteria, activityCounts) {
    switch (criteria.type) {
        case 'account_created':
            return true; // Always true if checking
            
        case 'cards_added':
        case 'total_cards':
            return activityCounts.totalCards >= criteria.threshold;
            
        case 'trades_completed':
            return activityCounts.tradesCompleted >= criteria.threshold;
            
        case 'cards_sold':
            return activityCounts.cardsSold >= criteria.threshold;
            
        case 'positive_reviews':
        case 'positive_ratings':
            return (activityCounts.positiveReviews + activityCounts.positiveRatings) >= criteria.threshold;
            
        case 'total_transactions':
        case 'trades_or_sales':
            return activityCounts.totalTransactions >= criteria.threshold;
            
        case 'marketplace_purchases':
            return activityCounts.marketplacePurchases >= criteria.threshold;
            
        case 'cards_listed':
            return activityCounts.cardsListed >= criteria.threshold;
            
        case 'rare_cards':
            return activityCounts.rareCards >= criteria.threshold;
            
        case 'ultra_rare_cards':
            return activityCounts.ultraRareCards >= criteria.threshold;
            
        case 'complete_sets':
            // TODO: Implement set completion detection
            return false;
            
        case 'decks_created':
            return activityCounts.totalDecks >= criteria.threshold;
            
        case 'public_decks':
            return activityCounts.totalPublicDecks >= criteria.threshold;
            
        case 'friends_count':
            return activityCounts.friendsCount >= criteria.threshold;
            
        case 'comments_posted':
            return activityCounts.commentsPosted >= criteria.threshold;
            
        case 'likes_received':
            return activityCounts.likesReceived >= criteria.threshold;
            
        case 'groups_created':
            return activityCounts.groupsCreated >= criteria.threshold;
            
        case 'profile_completed':
            return activityCounts.hasProfilePicture && activityCounts.hasBio;
            
        case 'articles_published':
            return activityCounts.articlesPublished >= criteria.threshold;
            
        case 'events_participated':
            return activityCounts.eventsParticipated >= criteria.threshold;
            
        case 'games_played':
            return activityCounts.gamesPlayed >= criteria.threshold;
            
        case 'tournaments_entered':
            return activityCounts.tournamentsEntered >= criteria.threshold;
            
        case 'tournaments_won':
            return activityCounts.tournamentsWon >= criteria.threshold;
            
        case 'purchases_made':
            return activityCounts.purchasesMade >= criteria.threshold;
            
        case 'total_spent':
            return activityCounts.totalSpent >= criteria.threshold;
            
        case 'premium_subscription':
            return activityCounts.hasPremium;
            
        case 'early_adopter':
        case 'beta_user':
            // Check if account was created before a certain date
            if (activityCounts.accountCreatedAt && criteria.cutoff_date) {
                const createdDate = activityCounts.accountCreatedAt.toDate ? 
                    activityCounts.accountCreatedAt.toDate() : 
                    new Date(activityCounts.accountCreatedAt);
                const cutoffDate = new Date(criteria.cutoff_date);
                return createdDate <= cutoffDate;
            }
            return false;
            
        case 'posts_or_comments':
            return (activityCounts.postCount + activityCounts.commentsPosted) >= criteria.threshold;
            
        default:
            console.warn(`Unknown criteria type: ${criteria.type}`);
            return false;
    }
}

/**
 * Award a badge to a user
 */
async function awardBadge(userId, badgeId, badgeData) {
    const batch = db.batch();
    
    // Add badge to user's badges collection
    const badgeRef = db.collection('users').doc(userId)
        .collection('badges').doc(badgeId);
    
    batch.set(badgeRef, {
        badgeId: badgeId,
        earnedAt: admin.firestore.FieldValue.serverTimestamp(),
        notified: false
    });
    
    // Update badge stats
    const statsRef = db.collection('users').doc(userId)
        .collection('private').doc('badgeStats');
    
    const categoryKey = `categoryCounts.${badgeData.category}`;
    batch.set(statsRef, {
        totalBadges: admin.firestore.FieldValue.increment(1),
        totalPoints: admin.firestore.FieldValue.increment(badgeData.points || 0),
        [categoryKey]: admin.firestore.FieldValue.increment(1),
        lastBadgeEarned: admin.firestore.FieldValue.serverTimestamp(),
        lastBadgeId: badgeId
    }, { merge: true });
    
    // Create notification
    const notificationRef = db.collection('users').doc(userId)
        .collection('notifications').doc();
    
    batch.set(notificationRef, {
        type: 'badge_earned',
        badgeId: badgeId,
        badgeName: badgeData.name,
        badgeDescription: badgeData.description,
        badgeIcon: badgeData.icon,
        badgeRarity: badgeData.rarity,
        points: badgeData.points || 0,
        read: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();
    
    console.log(`Badge "${badgeData.name}" awarded to user ${userId}`);
    return true;
}

/**
 * Check and award badges for a user based on activity type
 */
async function checkAndAwardBadges(userId, activityType = null) {
    try {
        // Get badge definitions
        const badgeDefinitions = await getBadgeDefinitions();
        
        // Get user's activity counts
        const activityCounts = await getUserActivityCounts(userId);
        
        // Get user's current badges
        const userBadgesSnapshot = await db.collection('users').doc(userId)
            .collection('badges').get();
        const userBadgeIds = new Set();
        userBadgesSnapshot.forEach(doc => {
            userBadgeIds.add(doc.id);
        });
        
        // Check each badge definition
        const badgesAwarded = [];
        
        for (const [badgeId, badgeData] of Object.entries(badgeDefinitions)) {
            // Skip if user already has this badge
            if (userBadgeIds.has(badgeId)) {
                continue;
            }
            
            // Skip special badges that require manual awarding
            if (['legendary_status', 'limited_edition', 'easter_egg_hunter', 'holiday_spirit'].includes(badgeId)) {
                continue;
            }
            
            // Check if criteria is met
            if (checkCriteria(badgeData.criteria, activityCounts)) {
                await awardBadge(userId, badgeId, badgeData);
                badgesAwarded.push(badgeId);
            }
        }
        
        // Check for "Legendary Status" badge (all other badges earned)
        if (badgesAwarded.length > 0 && !userBadgeIds.has('legendary_status')) {
            const totalPossibleBadges = Object.keys(badgeDefinitions).length - 1; // Exclude legendary_status itself
            const totalUserBadges = userBadgeIds.size + badgesAwarded.length;
            
            if (totalUserBadges >= totalPossibleBadges) {
                const legendaryBadge = badgeDefinitions['legendary_status'];
                if (legendaryBadge) {
                    await awardBadge(userId, 'legendary_status', legendaryBadge);
                    badgesAwarded.push('legendary_status');
                }
            }
        }
        
        return badgesAwarded;
    } catch (error) {
        console.error('Error checking badges:', error);
        throw error;
    }
}

/**
 * Initialize badge definitions in Firestore
 */
async function initializeBadgeDefinitions(badgeDefinitionsJson) {
    const batch = db.batch();
    
    for (const badge of badgeDefinitionsJson.badges) {
        const badgeRef = db.collection('badgeDefinitions').doc(badge.id);
        batch.set(badgeRef, badge);
    }
    
    await batch.commit();
    console.log(`Initialized ${badgeDefinitionsJson.badges.length} badge definitions`);
}

/**
 * Award a badge manually (admin function)
 */
async function awardBadgeManually(userId, badgeId, adminId) {
    // Verify badge exists
    const badgeDoc = await db.collection('badgeDefinitions').doc(badgeId).get();
    if (!badgeDoc.exists) {
        throw new Error('Badge not found');
    }
    
    // Check if user already has badge
    if (await userHasBadge(userId, badgeId)) {
        throw new Error('User already has this badge');
    }
    
    const badgeData = badgeDoc.data();
    await awardBadge(userId, badgeId, badgeData);
    
    // Log manual award
    await db.collection('badgeAwardLogs').add({
        userId: userId,
        badgeId: badgeId,
        awardedBy: adminId,
        awardedAt: admin.firestore.FieldValue.serverTimestamp(),
        type: 'manual'
    });
    
    return true;
}

/**
 * Get badge progress for a user
 */
async function getBadgeProgress(userId) {
    const badgeDefinitions = await getBadgeDefinitions();
    const activityCounts = await getUserActivityCounts(userId);
    const userBadgesSnapshot = await db.collection('users').doc(userId)
        .collection('badges').get();
    
    const userBadgeIds = new Set();
    userBadgesSnapshot.forEach(doc => {
        userBadgeIds.add(doc.id);
    });
    
    const progress = [];
    
    for (const [badgeId, badgeData] of Object.entries(badgeDefinitions)) {
        const earned = userBadgeIds.has(badgeId);
        let currentProgress = 0;
        let maxProgress = badgeData.criteria.threshold || 1;
        
        if (!earned) {
            // Calculate progress
            switch (badgeData.criteria.type) {
                case 'total_cards':
                    currentProgress = activityCounts.totalCards;
                    break;
                case 'trades_completed':
                    currentProgress = activityCounts.tradesCompleted;
                    break;
                case 'cards_sold':
                    currentProgress = activityCounts.cardsSold;
                    break;
                case 'decks_created':
                    currentProgress = activityCounts.totalDecks;
                    break;
                case 'friends_count':
                    currentProgress = activityCounts.friendsCount;
                    break;
                case 'comments_posted':
                    currentProgress = activityCounts.commentsPosted;
                    break;
                case 'likes_received':
                    currentProgress = activityCounts.likesReceived;
                    break;
                case 'events_participated':
                    currentProgress = activityCounts.eventsParticipated;
                    break;
                default:
                    currentProgress = 0;
            }
        }
        
        progress.push({
            badgeId: badgeId,
            name: badgeData.name,
            description: badgeData.description,
            category: badgeData.category,
            icon: badgeData.icon,
            rarity: badgeData.rarity,
            points: badgeData.points,
            earned: earned,
            progress: currentProgress,
            maxProgress: maxProgress,
            percentage: Math.min(100, Math.round((currentProgress / maxProgress) * 100))
        });
    }
    
    return progress;
}

module.exports = {
    getBadgeDefinitions,
    userHasBadge,
    getUserBadgeStats,
    getUserActivityCounts,
    checkCriteria,
    awardBadge,
    checkAndAwardBadges,
    initializeBadgeDefinitions,
    awardBadgeManually,
    getBadgeProgress
};
