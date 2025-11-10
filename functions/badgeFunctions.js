/**
 * Badge System Cloud Functions
 * 
 * Exported to index.js via require('./badgeFunctions')
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const badgeService = require("./badgeService");

// CORS configuration for callable functions
const cors = require('cors')({
    origin: [
        'https://hatake.eu',
        'https://hatakesocial-88b5e.web.app',
        'https://hatakesocial-88b5e.firebaseapp.com',
        'http://localhost:5000',
        'http://localhost:8000'
    ]
});

// =================================================================================================
// BADGE SYSTEM FUNCTIONS
// =================================================================================================

/**
 * Initialize badge definitions from JSON file
 * This is a one-time callable function to set up the badge system
 */
exports.initializeBadges = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .https.onRequest((req, res) => {
        cors(req, res, async () => {
            try {
                const badgeDefinitions = require('./badge_definitions.json');
                await badgeService.initializeBadgeDefinitions(badgeDefinitions);
                console.log(`Successfully initialized ${badgeDefinitions.badges.length} badges`);
                res.status(200).send({ 
                    data: { 
                        success: true, 
                        message: `Initialized ${badgeDefinitions.badges.length} badges` 
                    } 
                });
            } catch (error) {
                console.error('Error initializing badges:', error);
                res.status(500).send({ 
                    data: { 
                        success: false, 
                        error: 'Failed to initialize badges' 
                    } 
                });
            }
        });
    });

/**
 * Manually award a badge to a user (admin only)
 */
exports.awardBadgeManually = functions.https.onCall(async (data, context) => {
    // Verify admin privileges
    if (!context.auth || !context.auth.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can award badges manually');
    }
    
    const { userId, badgeId } = data;
    
    if (!userId || !badgeId) {
        throw new functions.https.HttpsError('invalid-argument', 'userId and badgeId are required');
    }
    
    try {
        await badgeService.awardBadgeManually(userId, badgeId, context.auth.uid);
        return { success: true, message: 'Badge awarded successfully' };
    } catch (error) {
        console.error('Error awarding badge:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

/**
 * Get badge progress for the current user
 */
exports.getBadgeProgress = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    try {
        const progress = await badgeService.getBadgeProgress(context.auth.uid);
        return { success: true, progress };
    } catch (error) {
        console.error('Error getting badge progress:', error);
        throw new functions.https.HttpsError('internal', 'Failed to get badge progress');
    }
});

/**
 * Trigger badge check when user is created
 */
exports.checkBadgesOnUserCreate = functions.auth.user().onCreate(async (user) => {
    try {
        const badgesAwarded = await badgeService.checkAndAwardBadges(user.uid, 'user_created');
        console.log(`User ${user.uid} created. Badges awarded: ${badgesAwarded.join(', ')}`);
    } catch (error) {
        console.error('Error checking badges on user create:', error);
    }
    return null;
});

/**
 * Trigger badge check when a card is added to collection
 */
exports.checkBadgesOnCollectionUpdate = functions.firestore
    .document('users/{userId}/collection/{cardId}')
    .onCreate(async (snap, context) => {
        const userId = context.params.userId;
        
        try {
            const badgesAwarded = await badgeService.checkAndAwardBadges(userId, 'collection_updated');
            if (badgesAwarded.length > 0) {
                console.log(`User ${userId} earned badges: ${badgesAwarded.join(', ')}`);
            }
        } catch (error) {
            console.error('Error checking badges on collection update:', error);
        }
        
        return null;
    });

/**
 * Trigger badge check when a trade is completed
 */
exports.checkBadgesOnTradeComplete = functions.firestore
    .document('trades/{tradeId}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();
        
        // Check if trade status changed to completed
        if (beforeData.status !== 'completed' && afterData.status === 'completed') {
            try {
                // Check badges for both participants
                const participants = afterData.participants || [];
                
                for (const userId of participants) {
                    // Update trade count
                    const userRef = admin.firestore().collection('users').doc(userId);
                    await userRef.update({
                        tradesCompleted: admin.firestore.FieldValue.increment(1)
                    });
                    
                    // Check for badges
                    const badgesAwarded = await badgeService.checkAndAwardBadges(userId, 'trade_completed');
                    if (badgesAwarded.length > 0) {
                        console.log(`User ${userId} earned badges: ${badgesAwarded.join(', ')}`);
                    }
                }
            } catch (error) {
                console.error('Error checking badges on trade complete:', error);
            }
        }
        
        return null;
    });

/**
 * Trigger badge check when a post is created
 */
exports.checkBadgesOnPostCreate = functions.firestore
    .document('posts/{postId}')
    .onCreate(async (snap, context) => {
        const postData = snap.data();
        const authorId = postData.authorId;
        
        if (!authorId) return null;
        
        try {
            const badgesAwarded = await badgeService.checkAndAwardBadges(authorId, 'post_created');
            if (badgesAwarded.length > 0) {
                console.log(`User ${authorId} earned badges: ${badgesAwarded.join(', ')}`);
            }
        } catch (error) {
            console.error('Error checking badges on post create:', error);
        }
        
        return null;
    });

/**
 * Trigger badge check when a deck is created
 */
exports.checkBadgesOnDeckCreate = functions.firestore
    .document('users/{userId}/decks/{deckId}')
    .onCreate(async (snap, context) => {
        const userId = context.params.userId;
        
        try {
            const badgesAwarded = await badgeService.checkAndAwardBadges(userId, 'deck_created');
            if (badgesAwarded.length > 0) {
                console.log(`User ${userId} earned badges: ${badgesAwarded.join(', ')}`);
            }
        } catch (error) {
            console.error('Error checking badges on deck create:', error);
        }
        
        return null;
    });

/**
 * Trigger badge check when a public deck is created
 */
exports.checkBadgesOnPublicDeckCreate = functions.firestore
    .document('publicDecks/{deckId}')
    .onCreate(async (snap, context) => {
        const deckData = snap.data();
        const authorId = deckData.authorId;
        
        if (!authorId) return null;
        
        try {
            const badgesAwarded = await badgeService.checkAndAwardBadges(authorId, 'public_deck_created');
            if (badgesAwarded.length > 0) {
                console.log(`User ${authorId} earned badges: ${badgesAwarded.join(', ')}`);
            }
        } catch (error) {
            console.error('Error checking badges on public deck create:', error);
        }
        
        return null;
    });

/**
 * Trigger badge check when a user follows someone
 */
exports.checkBadgesOnFollow = functions.firestore
    .document('users/{userId}/followers/{followerId}')
    .onCreate(async (snap, context) => {
        const userId = context.params.followerId; // The person who followed
        
        try {
            const badgesAwarded = await badgeService.checkAndAwardBadges(userId, 'followed_user');
            if (badgesAwarded.length > 0) {
                console.log(`User ${userId} earned badges: ${badgesAwarded.join(', ')}`);
            }
        } catch (error) {
            console.error('Error checking badges on follow:', error);
        }
        
        return null;
    });

/**
 * Trigger badge check when an article is published
 */
exports.checkBadgesOnArticlePublish = functions.firestore
    .document('articles/{articleId}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();
        
        // Check if article status changed to published
        if (beforeData.status !== 'published' && afterData.status === 'published') {
            const authorId = afterData.authorId;
            
            if (!authorId) return null;
            
            try {
                const badgesAwarded = await badgeService.checkAndAwardBadges(authorId, 'article_published');
                if (badgesAwarded.length > 0) {
                    console.log(`User ${authorId} earned badges: ${badgesAwarded.join(', ')}`);
                }
            } catch (error) {
                console.error('Error checking badges on article publish:', error);
            }
        }
        
        return null;
    });

/**
 * Trigger badge check when a group is created
 */
exports.checkBadgesOnGroupCreate = functions.firestore
    .document('groups/{groupId}')
    .onCreate(async (snap, context) => {
        const groupData = snap.data();
        const creatorId = groupData.creatorId;
        
        if (!creatorId) return null;
        
        try {
            const badgesAwarded = await badgeService.checkAndAwardBadges(creatorId, 'group_created');
            if (badgesAwarded.length > 0) {
                console.log(`User ${creatorId} earned badges: ${badgesAwarded.join(', ')}`);
            }
        } catch (error) {
            console.error('Error checking badges on group create:', error);
        }
        
        return null;
    });

/**
 * Trigger badge check when user profile is updated
 */
exports.checkBadgesOnProfileUpdate = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();
        const userId = context.params.userId;
        
        // Check if profile picture or bio was added
        const addedPhoto = !beforeData.photoURL && afterData.photoURL;
        const addedBio = !beforeData.bio && afterData.bio;
        
        if (addedPhoto || addedBio) {
            try {
                const badgesAwarded = await badgeService.checkAndAwardBadges(userId, 'profile_updated');
                if (badgesAwarded.length > 0) {
                    console.log(`User ${userId} earned badges: ${badgesAwarded.join(', ')}`);
                }
            } catch (error) {
                console.error('Error checking badges on profile update:', error);
            }
        }
        
        return null;
    });

/**
 * Trigger badge check when a marketplace listing is created
 */
exports.checkBadgesOnMarketplaceListing = functions.firestore
    .document('marketplace/{listingId}')
    .onCreate(async (snap, context) => {
        const listingData = snap.data();
        const sellerId = listingData.sellerId;
        
        if (!sellerId) return null;
        
        try {
            // Update cards listed count
            const userRef = admin.firestore().collection('users').doc(sellerId);
            await userRef.update({
                cardsListed: admin.firestore.FieldValue.increment(1)
            });
            
            const badgesAwarded = await badgeService.checkAndAwardBadges(sellerId, 'listing_created');
            if (badgesAwarded.length > 0) {
                console.log(`User ${sellerId} earned badges: ${badgesAwarded.join(', ')}`);
            }
        } catch (error) {
            console.error('Error checking badges on marketplace listing:', error);
        }
        
        return null;
    });

/**
 * Scheduled function to check badges for all users (runs daily)
 * This catches any badges that might have been missed by triggers
 */
exports.dailyBadgeCheck = functions.pubsub
    .schedule('0 2 * * *') // Run at 2 AM daily
    .timeZone('UTC')
    .onRun(async (context) => {
        console.log('Starting daily badge check...');
        
        try {
            const usersSnapshot = await admin.firestore().collection('users').get();
            let totalBadgesAwarded = 0;
            
            for (const userDoc of usersSnapshot.docs) {
                try {
                    const badgesAwarded = await badgeService.checkAndAwardBadges(userDoc.id, 'daily_check');
                    totalBadgesAwarded += badgesAwarded.length;
                    
                    if (badgesAwarded.length > 0) {
                        console.log(`Daily check: User ${userDoc.id} earned ${badgesAwarded.length} badges`);
                    }
                } catch (error) {
                    console.error(`Error checking badges for user ${userDoc.id}:`, error);
                }
            }
            
            console.log(`Daily badge check complete. Total badges awarded: ${totalBadgesAwarded}`);
        } catch (error) {
            console.error('Error in daily badge check:', error);
        }
        
        return null;
    });

/**
 * Retroactively award badges to existing users
 * This is a one-time callable function to award badges to users who joined before the badge system
 * Extended timeout to handle large user bases
 */
exports.retroactivelyAwardBadges = functions
    .runWith({ timeoutSeconds: 540, memory: '2GB' })
    .https.onRequest((req, res) => {
        cors(req, res, async () => {
            try {
                console.log('Starting retroactive badge awards process...');
                const usersSnapshot = await admin.firestore().collection('users').get();
                let totalBadgesAwarded = 0;
                let usersProcessed = 0;
                
                // Send immediate response to prevent timeout on client side
                res.status(200).send({ 
                    data: { 
                        success: true, 
                        message: `Processing ${usersSnapshot.size} users. This may take several minutes. Check logs for progress.` 
                    } 
                });
                
                // Process users in background
                for (const userDoc of usersSnapshot.docs) {
                    try {
                        const badgesAwarded = await badgeService.checkAndAwardBadges(userDoc.id, 'retroactive');
                        totalBadgesAwarded += badgesAwarded.length;
                        usersProcessed++;
                        
                        if (badgesAwarded.length > 0) {
                            console.log(`Retroactive: User ${userDoc.id} earned ${badgesAwarded.length} badges`);
                        }
                        
                        // Log progress every 10 users
                        if (usersProcessed % 10 === 0) {
                            console.log(`Progress: ${usersProcessed}/${usersSnapshot.size} users processed, ${totalBadgesAwarded} badges awarded`);
                        }
                    } catch (error) {
                        console.error(`Error checking badges for user ${userDoc.id}:`, error);
                    }
                }
                
                console.log(`Retroactive badge awards complete: Processed ${usersProcessed} users, awarded ${totalBadgesAwarded} total badges`);
            } catch (error) {
                console.error('Error in retroactive badge awards:', error);
                // Only send error response if we haven't sent a response yet
                if (!res.headersSent) {
                    res.status(500).send({ 
                        data: { 
                            success: false, 
                            error: 'Failed to award retroactive badges' 
                        } 
                    });
                }
            }
        });
    });
