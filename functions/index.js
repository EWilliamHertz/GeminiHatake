/**
* HatakeSocial - Firebase Cloud Functions
*
* This file contains the backend logic for the application.
* - ADMIN FUNCTIONS for user management and platform control.
* - MESSAGING FUNCTIONS for real-time user-to-user chat.
* - CARD & MARKETPLACE FUNCTIONS for collection syncing and secure API searches.
* - CURRENCY EXCHANGE FUNCTIONS for real-time currency conversion.
* - SECURE MULTI-GAME API SEARCH PROXY to protect API keys.
*/

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe")(functions.config().stripe.secret);
const axios = require("axios");
const fetch = require("node-fetch");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const secretClient = new SecretManagerServiceClient();

// --- CORS CONFIGURATION ---
const allowedOrigins = [
    'https://hatake.eu',
    'https://hatakesocial-88b5e.web.app',
    'http://localhost:5000',
    'http://hatakesocial-88b5e.firebaseapp.com',
    'http://localhost:8000'
];

const cors = require('cors')({
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
});

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// --- Escrow.com API Configuration ---
// Ensure you have configured these in your Firebase environment
// firebase functions:config:set escrow.key="YOUR_KEY" escrow.user="YOUR_USER"
const ESCROW_API_KEY = functions.config().escrow.key;
const ESCROW_API_USER = functions.config().escrow.user;
const ESCROW_API_URL = "https://api.escrow.com/2017-09-01/";

const escrowApi = axios.create({
    baseURL: ESCROW_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${ESCROW_API_USER}:${ESCROW_API_KEY}`).toString('base64')}`
    }
});

// =================================================================================================
// CURRENCY EXCHANGE RATE FUNCTIONS (ROBUST VERSION)
// =================================================================================================

const exchangeRateCache = new Map();
const EXCHANGE_RATE_CACHE_DURATION_MS = 1000 * 60 * 60 * 6; // Cache for 6 hours

exports.getExchangeRates = functions.https.onCall(async (data, context) => {
    const baseCurrency = data.base || 'USD';

    if (exchangeRateCache.has(baseCurrency)) {
        const cachedItem = exchangeRateCache.get(baseCurrency);
        if (Date.now() - cachedItem.timestamp < EXCHANGE_RATE_CACHE_DURATION_MS) {
            console.log(`Serving exchange rates for '${baseCurrency}' from cache.`);
            return { rates: cachedItem.data };
        }
    }
    
    // FIX: Check for the API key and provide a clear error message if it's missing.
    const API_KEY = functions.config().currencyapi?.key;
    if (!API_KEY) {
        console.error('FATAL: Currency API key is not configured. Run "firebase functions:config:set currencyapi.key=\'YOUR_KEY\'"');
        // Return a default object to prevent the client from crashing.
        return { rates: { USD: 1.0 } };
    }

    const apiUrl = `https://api.freecurrencyapi.com/v1/latest?apikey=${API_KEY}&base_currency=${baseCurrency}`;
    try {
        console.log(`Fetching exchange rates for '${baseCurrency}' from external API.`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API call failed with status: ${response.status} - ${errorBody}`);
        }
        const result = await response.json();
        if (result && result.data) {
             exchangeRateCache.set(baseCurrency, { timestamp: Date.now(), data: result.data });
            return { rates: result.data };
        } else {
            throw new Error("Invalid data structure from currency API.");
        }
    } catch (error) {
        console.error("Error fetching exchange rates:", error);
        // FIX: Return a default object on any error to ensure the client remains functional.
        return { rates: { USD: 1.0 } };
    }
});

// =================================================================================================
// SECURE CARD SEARCH FUNCTIONS
// =================================================================================================

const scrydexCache = new Map();
const SCRYDEX_CACHE_DURATION_MS = 1000 * 60 * 60; // Cache for 1 hour

async function accessSecret(secretName) {
    const [version] = await secretClient.accessSecretVersion({
        name: `projects/hatakesocial-88b5e/secrets/${secretName}/versions/latest`,
    });
    return version.payload.data.toString();
}

/**
 * Performs a card search using the ScryDex API.
 */
exports.searchScryDex = functions.https.onCall(async (data, context) => {
    console.log("--- ScryDex search function invoked ---");

    const { cardName, game } = data;
    if (!cardName || !game) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with "cardName" and "game" arguments.');
    }

    const cacheKey = `${game.toLowerCase()}_${cardName.toLowerCase().trim()}`;

    if (scrydexCache.has(cacheKey)) {
        const cachedItem = scrydexCache.get(cacheKey);
        if (Date.now() - cachedItem.timestamp < SCRYDEX_CACHE_DURATION_MS) {
            console.log(`Serving '${cardName}' for game '${game}' from cache.`);
            return { data: cachedItem.data };
        }
    }

    let apiKey, teamId;
    try {
        apiKey = await accessSecret('scrydex-api-key');
        teamId = await accessSecret('scrydex-team-id');
    } catch (secretError) {
        console.error("FATAL: Could not access secrets.", secretError);
        throw new functions.https.HttpsError('internal', 'Server configuration error: could not access API credentials.');
    }

    const gameEndpoints = {
        'mtg': 'magicthegathering/v1',
        'pokemon': 'pokemon/v1',
        'lorcana': 'lorcana/v1',
        'gundam': 'gundam/v1'
    };
    const apiPath = gameEndpoints[game];
    if (!apiPath) {
        throw new functions.https.HttpsError('not-found', `The game '${game}' is not supported.`);
    }

    const url = `https://api.scrydex.com/${apiPath}/cards?q=${encodeURIComponent(cardName)}&include=prices`;

    const options = {
        method: 'GET',
        headers: {
            'X-Api-Key': apiKey,
            'X-Team-ID': teamId,
            'Content-Type': 'application/json'
        }
    };

    try {
        console.log(`Searching ScryDex with URL: ${url}`);
        const response = await fetch(url, options);

        if (!response.ok) {
            let errorBody = 'Could not read error body from ScryDex.';
            try {
                errorBody = await response.text();
            } catch (e) { /* ignore */ }
            console.error(`ScryDex API Error: Status ${response.status}. Body: ${errorBody}`);
            throw new functions.https.HttpsError('internal', `Failed to fetch from ScryDex API. Status: ${response.status}`);
        }

        const responseData = await response.json();
        const cardData = responseData.data || [];

        scrydexCache.set(cacheKey, {
            timestamp: Date.now(),
            data: cardData
        });

        console.log(`Successfully found ${cardData.length} cards for '${cardName}'.`);
        return { data: cardData };

    } catch (error) {
        console.error("Cloud Function fetch/processing error:", error);
        const message = error.message || 'An unexpected error occurred.';
        throw new functions.https.HttpsError('unknown', message);
    }
});

/**
 * Fetches a single card by its ID from the ScryDex API.
 */
exports.getScryDexCard = functions.https.onCall(async (data, context) => {
    console.log("--- ScryDex getCard function invoked ---");
    const { cardId, game } = data;
    if (!cardId || !game) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with "cardId" and "game" arguments.');
    }

    let apiKey, teamId;
    try {
        apiKey = await accessSecret('scrydex-api-key');
        teamId = await accessSecret('scrydex-team-id');
    } catch (secretError) {
        console.error("FATAL: Could not access secrets.", secretError);
        throw new functions.https.HttpsError('internal', 'Server configuration error.');
    }

    const gameEndpoints = {
        'mtg': 'magicthegathering/v1',
        'pokemon': 'pokemon/v1',
        'lorcana': 'lorcana/v1',
        'gundam': 'gundam/v1'
    };
    const apiPath = gameEndpoints[game];
    if (!apiPath) {
        throw new functions.https.HttpsError('not-found', `The game '${game}' is not supported.`);
    }

    const url = `https://api.scrydex.com/${apiPath}/cards/${cardId}?include=prices`;

    const options = {
        method: 'GET',
        headers: {
            'X-Api-Key': apiKey,
            'X-Team-ID': teamId,
            'Content-Type': 'application/json'
        }
    };

    try {
        console.log(`Fetching card from ScryDex with URL: ${url}`);
        const response = await fetch(url, options);

        if (!response.ok) {
            let errorBody = 'Could not read error body.';
            try {
                errorBody = await response.text();
            } catch (e) { /* ignore */ }
            console.error(`ScryDex API Error: Status ${response.status}. Body: ${errorBody}`);
            throw new functions.https.HttpsError('internal', `Failed to fetch from ScryDex. Status: ${response.status}`);
        }

        const responseData = await response.json();
        return { data: responseData.data };

    } catch (error) {
        console.error("Cloud Function fetch/processing error:", error);
        throw new functions.https.HttpsError('unknown', error.message || 'An unexpected error occurred.');
    }
});

/**
 * Fetches and stores daily price snapshots for a card from ScryDex API.
 * This replaces the non-functional history endpoint approach.
 */
exports.collectCardPriceSnapshot = functions.https.onCall(async (data, context) => {
    console.log("--- ScryDex collectCardPriceSnapshot function invoked ---");
    const { cardId, game } = data;
    if (!cardId || !game) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with "cardId" and "game" arguments.');
    }

    try {
        // Get current card data with prices from ScryDex
        const getScryDexCardFunction = exports.getScryDexCard;
        const cardResult = await getScryDexCardFunction({ cardId, game }, context);
        
        if (!cardResult || !cardResult.data) {
            throw new functions.https.HttpsError('not-found', 'Card data not found.');
        }

        const cardData = cardResult.data;
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        // Extract price data from variants
        const priceSnapshots = [];
        if (cardData.variants && Array.isArray(cardData.variants)) {
            cardData.variants.forEach(variant => {
                if (variant.prices && Array.isArray(variant.prices)) {
                    variant.prices.forEach(priceData => {
                        priceSnapshots.push({
                            date: today,
                            variant: variant.name || 'default',
                            condition: priceData.condition || 'NM',
                            type: priceData.type || 'raw',
                            low: priceData.low || null,
                            market: priceData.market || null,
                            currency: priceData.currency || 'USD',
                            trends: priceData.trends || {},
                            timestamp: admin.firestore.FieldValue.serverTimestamp()
                        });
                    });
                }
            });
        }

        if (priceSnapshots.length === 0) {
            console.warn(`No price data found for card ${cardId}`);
            return { success: true, message: 'No price data to store', snapshots: 0 };
        }

        // Store in Firestore
        const batch = db.batch();
        priceSnapshots.forEach(snapshot => {
            const docRef = db.collection('priceHistory')
                .doc(cardId)
                .collection('daily')
                .doc(today + '_' + snapshot.variant + '_' + snapshot.condition);
            batch.set(docRef, snapshot, { merge: true });
        });

        await batch.commit();

        console.log(`Stored ${priceSnapshots.length} price snapshots for card ${cardId}`);
        return { 
            success: true, 
            message: `Stored ${priceSnapshots.length} price snapshots`, 
            snapshots: priceSnapshots.length,
            date: today
        };

    } catch (error) {
        console.error("Error collecting price snapshot:", error);
        throw new functions.https.HttpsError('unknown', error.message || 'An unexpected error occurred while collecting price data.');
    }
});

/**
 * Retrieves historical price data for a card from Firestore.
 */
exports.getCardPriceHistory = functions.https.onCall(async (data, context) => {
    console.log("--- getCardPriceHistory function invoked ---");
    const { cardId, days = 30, variant = 'default', condition = 'NM' } = data;
    
    if (!cardId) {
        throw new functions.https.HttpsError('invalid-argument', 'cardId is required.');
    }

    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Query price history from Firestore
        const historyRef = db.collection('priceHistory')
            .doc(cardId)
            .collection('daily')
            .where('date', '>=', startDateStr)
            .where('date', '<=', endDateStr)
            .orderBy('date', 'asc');

        const snapshot = await historyRef.get();
        const priceHistory = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Filter by variant and condition if specified
            if (data.variant === variant && data.condition === condition) {
                priceHistory.push({
                    date: data.date,
                    market: data.market,
                    low: data.low,
                    currency: data.currency,
                    trends: data.trends
                });
            }
        });

        // If no historical data, try to get current price trends from ScryDex
        if (priceHistory.length === 0) {
            console.log(`No historical data found for ${cardId}, fetching current trends`);
            const cardResult = await exports.getScryDexCard({ cardId, game: data.game || 'pokemon' }, context);
            
            if (cardResult && cardResult.data && cardResult.data.variants) {
                const targetVariant = cardResult.data.variants.find(v => v.name === variant);
                if (targetVariant && targetVariant.prices) {
                    const targetPrice = targetVariant.prices.find(p => p.condition === condition);
                    if (targetPrice && targetPrice.trends) {
                        // Convert trends to historical data points
                        const currentDate = new Date();
                        const trendsData = targetPrice.trends;
                        
                        Object.keys(trendsData).forEach(period => {
                            const days = parseInt(period.replace('days_', ''));
                            const pastDate = new Date(currentDate);
                            pastDate.setDate(pastDate.getDate() - days);
                            
                            const pastPrice = targetPrice.market - trendsData[period].price_change;
                            priceHistory.push({
                                date: pastDate.toISOString().split('T')[0],
                                market: pastPrice,
                                currency: targetPrice.currency,
                                estimated: true
                            });
                        });
                        
                        // Add current price
                        priceHistory.push({
                            date: currentDate.toISOString().split('T')[0],
                            market: targetPrice.market,
                            currency: targetPrice.currency,
                            estimated: false
                        });
                        
                        // Sort by date
                        priceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
                    }
                }
            }
        }

        return { 
            success: true, 
            data: priceHistory,
            cardId: cardId,
            period: `${days} days`,
            variant: variant,
            condition: condition
        };

    } catch (error) {
        console.error("Error retrieving price history:", error);
        throw new functions.https.HttpsError('unknown', error.message || 'An unexpected error occurred while retrieving price history.');
    }
});


// =================================================================================================
// ADMIN USER & PLATFORM MANAGEMENT FUNCTIONS
// =================================================================================================

const ensureIsAdmin = (context) => {
    if (!context.auth || context.auth.token.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'You must be an admin to perform this action.');
    }
};

/**
 * Bans a user. Disables them in Firebase Auth and sets a flag in Firestore.
 */
exports.banUser = functions.https.onCall(async (data, context) => {
    ensureIsAdmin(context);
    const { uid } = data;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'UID is required.');
    }
    try {
        await admin.auth().updateUser(uid, { disabled: true });
        await db.collection('users').doc(uid).update({ isBanned: true, suspendedUntil: null });
        return { success: true, message: `User ${uid} has been banned.` };
    } catch (error) {
        console.error(`Failed to ban user ${uid}`, error);
        throw new functions.https.HttpsError('internal', 'An error occurred while banning the user.');
    }
});

/**
 * Un-bans a user. Enables them in Firebase Auth and removes the flag in Firestore.
 */
exports.unBanUser = functions.https.onCall(async (data, context) => {
    ensureIsAdmin(context);
    const { uid } = data;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'UID is required.');
    }
    try {
        await admin.auth().updateUser(uid, { disabled: false });
        await db.collection('users').doc(uid).update({ isBanned: false });
        return { success: true, message: `User ${uid} has been unbanned.` };
    } catch (error) {
        console.error(`Failed to unban user ${uid}`, error);
        throw new functions.https.HttpsError('internal', 'An error occurred while unbanning the user.');
    }
});

/**
 * Suspends a user for a specific duration by setting a timestamp in Firestore.
 */
exports.suspendUser = functions.https.onCall(async (data, context) => {
    ensureIsAdmin(context);
    const { uid, suspendedUntil } = data; // suspendedUntil should be an ISO string
    if (!uid || !suspendedUntil) {
        throw new functions.https.HttpsError('invalid-argument', 'UID and suspension date are required.');
    }
    try {
        const suspensionDate = new Date(suspendedUntil);
        await db.collection('users').doc(uid).update({
            suspendedUntil: admin.firestore.Timestamp.fromDate(suspensionDate)
        });
        return { success: true, message: `User ${uid} suspended until ${suspensionDate.toLocaleString()}.` };
    } catch (error) {
        console.error(`Failed to suspend user ${uid}`, error);
        throw new functions.https.HttpsError('internal', 'An error occurred while suspending the user.');
    }
});

/**
 * Sends a notification message to all users on the platform.
 */
exports.broadcastMessage = functions.https.onCall(async (data, context) => {
    ensureIsAdmin(context);
    const { message } = data;
    if (!message) {
        throw new functions.https.HttpsError('invalid-argument', 'A message is required for the broadcast.');
    }

    try {
        const usersSnapshot = await db.collection('users').get();
        if (usersSnapshot.empty) {
            return { success: true, message: "No users to notify." };
        }

        const batch = db.batch();
        usersSnapshot.forEach(userDoc => {
            const notificationRef = userDoc.ref.collection('notifications').doc();
            batch.set(notificationRef, {
                type: 'broadcast',
                fromId: 'system',
                fromName: 'HatakeSocial Admin',
                message: message,
                link: '#',
                isRead: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        return { success: true, message: `Broadcast sent to ${usersSnapshot.size} users.` };

    } catch (error) {
        console.error('Broadcast failed:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send broadcast.');
    }
});

// =================================================================================================
// MESSAGING FUNCTIONS
// =================================================================================================

/**
 * Sends a message from one user to another.
 */
exports.sendMessage = functions.runWith({ minInstances: 1 }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to send messages.');
    }
    const { recipientId, messageText } = data;
    const senderId = context.auth.uid;

    if (!recipientId || !messageText) throw new functions.https.HttpsError('invalid-argument', 'Missing recipientId or messageText.');
    if (senderId === recipientId) throw new functions.https.HttpsError('invalid-argument', 'You cannot send a message to yourself.');

    try {
        const conversationId = [senderId, recipientId].sort().join('_');
        const conversationRef = db.collection('conversations').doc(conversationId);
        const message = {
            senderId: senderId,
            text: messageText,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        const conversationUpdateData = {
            lastMessage: messageText,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        const batch = db.batch();
        const newMessageRef = conversationRef.collection('messages').doc();
        batch.set(newMessageRef, message);
        batch.set(conversationRef, conversationUpdateData, { merge: true });
        await batch.commit();
        return { success: true, conversationId: conversationId };
    } catch (error) {
        console.error("Error sending message:", error);
        throw new functions.https.HttpsError('internal', 'An error occurred while sending the message.');
    }
});

/**
 * Ensures a conversation document exists between two users.
 */
exports.ensureConversationExists = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    const { otherUserId } = data;
    const currentUserId = context.auth.uid;
    if (!otherUserId) throw new functions.https.HttpsError('invalid-argument', 'Missing the other user\'s ID.');
    if (otherUserId === currentUserId) throw new functions.https.HttpsError('invalid-argument', 'You cannot create a conversation with yourself.');
    const conversationId = [currentUserId, otherUserId].sort().join('_');
    const convoRef = db.collection('conversations').doc(conversationId);
    const doc = await convoRef.get();
    if (doc.exists) {
        return { success: true, conversationId: conversationId };
    }
    try {
        const [currentUserDoc, otherUserDoc] = await Promise.all([
            db.collection('users').doc(currentUserId).get(),
            db.collection('users').doc(otherUserId).get()
        ]);
        if (!currentUserDoc.exists || !otherUserDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'One of the users could not be found.');
        }
        const currentUserData = currentUserDoc.data();
        const otherUserData = otherUserDoc.data();
        const convoData = {
            participants: [currentUserId, otherUserId],
            participantInfo: {
                [currentUserId]: {
                    displayName: currentUserData.displayName || "User",
                    photoURL: currentUserData.photoURL || "",
                    handle: currentUserData.handle || ""
                },
                [otherUserId]: {
                    displayName: otherUserData.displayName || "User",
                    photoURL: otherUserData.photoURL || "",
                    handle: otherUserData.handle || ""
                }
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
            lastMessage: ''
        };
        await convoRef.set(convoData);
        return { success: true, conversationId: conversationId };
    } catch (error) {
        console.error("Error in ensureConversationExists:", error);
        throw new functions.https.HttpsError('internal', 'An unexpected error occurred.');
    }
});

/**
 * Firestore trigger that creates a notification when a new message is created.
 */
exports.onMessageCreate = functions.firestore
    .document('conversations/{conversationId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        const messageData = snap.data();
        const { conversationId } = context.params;
        const senderId = messageData.senderId;

        try {
            const conversationDoc = await db.collection('conversations').doc(conversationId).get();
            if (!conversationDoc.exists) return null;

            const participants = conversationDoc.data().participants;
            const recipientId = participants.find(uid => uid !== senderId);

            if (!recipientId) return null;

            const senderDoc = await db.collection('users').doc(senderId).get();
            const senderName = senderDoc.data()?.displayName || 'Someone';

            const notification = {
                type: 'message',
                fromId: senderId,
                fromName: senderName,
                fromAvatar: senderDoc.data()?.photoURL || null,
                message: `${senderName} sent you a message: "${messageData.text.substring(0, 50)}${messageData.text.length > 50 ? '...' : ''}"`,
                link: `messages.html?conversation=${conversationId}`,
                isRead: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(recipientId).collection('notifications').add(notification);

        } catch (error) {
            console.error('Error creating message notification:', error);
        }

        return null;
    });

/**
 * Alternative message notification trigger (onNewMessage)
 */
exports.onNewMessage = functions.firestore
    .document('conversations/{conversationId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        const messageData = snap.data();
        const { conversationId } = context.params;
        const { senderId, text } = messageData;
        const conversationDoc = await db.collection('conversations').doc(conversationId).get();
        if (!conversationDoc.exists) return null;
        const conversationData = conversationDoc.data();
        const recipientId = conversationData.participants.find(uid => uid !== senderId);
        if (!recipientId) return null;
        const senderName = conversationData.participantInfo[senderId]?.displayName || 'Someone';
        const notification = {
            type: 'message',
            fromId: senderId,
            fromName: senderName,
            message: `Sent you a message: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
            link: `messages.html`,
            isRead: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('users').doc(recipientId).collection('notifications').add(notification);
        return null;
    });

// =================================================================================================
// MARKETPLACE SYNC FUNCTION
// =================================================================================================
/**
 * This function triggers whenever a card in a user's collection is created or updated.
 * It keeps a public `marketplaceListings` collection in sync.
 */
exports.syncCardToMarketplace = functions.firestore
    .document('users/{userId}/collection/{cardId}')
    .onWrite(async (change, context) => {
        const { userId, cardId } = context.params;
        const listingRef = db.collection('marketplaceListings').doc(cardId);

        const cardDataAfter = change.after.data();

        // Condition 1: Card was deleted OR is no longer for sale.
        if (!change.after.exists || cardDataAfter.forSale !== true) {
            try {
                // Check if a listing exists before trying to delete
                const listingDoc = await listingRef.get();
                if (listingDoc.exists) {
                    await listingRef.delete();
                    console.log(`Removed listing ${cardId} from the marketplace because it's no longer for sale or was deleted.`);
                }
            } catch (error) {
                console.error(`Failed to remove listing ${cardId} from marketplace:`, error);
            }
            return null;
        }

        // Condition 2: Card is marked for sale.
        try {
            const salePrice = parseFloat(cardDataAfter.salePrice);
            if (isNaN(salePrice) || salePrice <= 0) {
                console.warn(`Card ${cardId} has invalid sale price: ${cardDataAfter.salePrice}`);
                return null;
            }

            // Get seller information
            const sellerDoc = await db.collection('users').doc(userId).get();
            if (!sellerDoc.exists) {
                console.error(`Seller ${userId} not found for card ${cardId}`);
                return null;
            }

            const sellerData = sellerDoc.data();
            const listingData = {
                cardData: cardDataAfter,
                sellerId: userId,
                sellerData: {
                    uid: userId,
                    displayName: sellerData.displayName || 'Unknown',
                    photoURL: sellerData.photoURL || '',
                    handle: sellerData.handle || '',
                    country: sellerData.address?.country || 'Unknown'
                },
                price: salePrice,
                condition: cardDataAfter.condition || 'Near Mint',
                isFoil: cardDataAfter.is_foil || false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            };

            await listingRef.set(listingData);
            console.log(`Added/updated listing ${cardId} in the marketplace.`);

        } catch (error) {
            console.error(`Failed to sync card ${cardId} to marketplace:`, error);
        }

        return null;
    });

// =================================================================================================
// PRODUCT MANAGEMENT FUNCTIONS
// =================================================================================================

/**
 * Firestore trigger that deletes product images from Storage when a product is deleted.
 */
exports.onProductDelete = functions.firestore
    .document('products/{productId}')
    .onDelete(async (snap, context) => {
        const productData = snap.data();
        const imageUrls = productData.images || [];

        if (imageUrls.length === 0) return null;

        const bucket = storage.bucket();
        const deletePromises = imageUrls.map(async (imageUrl) => {
            try {
                const filePath = imageUrl.split('/o/')[1].split('?')[0];
                const decodedPath = decodeURIComponent(filePath);
                const file = bucket.file(decodedPath);
                await file.delete();
                console.log(`Deleted image: ${decodedPath}`);
            } catch (error) {
                console.error(`Failed to delete image ${imageUrl}:`, error);
            }
        });

        await Promise.all(deletePromises);
        console.log(`Cleaned up ${imageUrls.length} images for deleted product ${context.params.productId}`);
        return null;
    });

// =================================================================================================
// WISHLIST & TRADE MATCHING FUNCTIONS
// =================================================================================================

/**
 * Manages user wishlists and automatically matches trades.
 */
exports.manageWishlist = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to manage your wishlist.');
    }

    const { action, cardData } = data;
    const userId = context.auth.uid;

    if (!action || !cardData) {
        throw new functions.https.HttpsError('invalid-argument', 'Action and card data are required.');
    }

    const wishlistRef = db.collection('users').doc(userId).collection('wishlist');

    try {
        if (action === 'add') {
            const cardRef = wishlistRef.doc(cardData.api_id);
            await cardRef.set({
                ...cardData,
                addedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Check for potential trades
            await checkForTrades(userId, cardData);

            return { success: true, message: 'Card added to wishlist and trade matching initiated.' };

        } else if (action === 'remove') {
            const cardRef = wishlistRef.doc(cardData.api_id);
            await cardRef.delete();
            return { success: true, message: 'Card removed from wishlist.' };

        } else {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid action. Use "add" or "remove".');
        }

    } catch (error) {
        console.error('Error managing wishlist:', error);
        throw new functions.https.HttpsError('internal', 'An error occurred while managing your wishlist.');
    }
});

/**
 * Helper function to check for potential trades when a card is added to a wishlist.
 */
async function checkForTrades(wishlistUserId, wishlistCard) {
    try {
        // Find users who have this card in their collection and marked for trade
        const collectionQuery = await db.collectionGroup('collection')
            .where('api_id', '==', wishlistCard.api_id)
            .where('forTrade', '==', true)
            .get();

        if (collectionQuery.empty) {
            console.log(`No tradeable cards found for ${wishlistCard.name}`);
            return;
        }

        // Create trade proposals for each potential match
        const batch = db.batch();
        collectionQuery.forEach(doc => {
            const cardData = doc.data();
            const cardOwnerId = doc.ref.parent.parent.id;

            // Don't create trades with yourself
            if (cardOwnerId === wishlistUserId) return;

            const tradeRef = db.collection('trades').doc();
            const tradeData = {
                proposerId: wishlistUserId,
                receiverId: cardOwnerId,
                proposerCards: [], // Wishlist user offers nothing initially
                receiverCards: [{ ...cardData, id: doc.id }],
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                type: 'wishlist_match'
            };

            batch.set(tradeRef, tradeData);

            // Create notification for the card owner
            const notificationRef = db.collection('users').doc(cardOwnerId).collection('notifications').doc();
            batch.set(notificationRef, {
                type: 'trade_proposal',
                fromId: wishlistUserId,
                fromName: 'Trade Matcher',
                message: `Someone wants to trade for your ${cardData.name}!`,
                link: `trades.html?id=${tradeRef.id}`,
                isRead: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        console.log(`Created ${collectionQuery.size} trade proposals for ${wishlistCard.name}`);

    } catch (error) {
        console.error('Error checking for trades:', error);
    }
}

/**
 * Firestore trigger that creates notifications when a new trade is proposed.
 */
exports.onCardForTradeCreate = functions.firestore
    .document('trades/{tradeId}')
    .onCreate(async (snap, context) => {
        const tradeData = snap.data();
        const { tradeId } = context.params;

        // Skip if this is an auto-generated wishlist match (already has notification)
        if (tradeData.type === 'wishlist_match') return null;

        try {
            const proposerDoc = await db.collection('users').doc(tradeData.proposerId).get();
            const proposerName = proposerDoc.data()?.displayName || 'Someone';

            const notification = {
                type: 'trade_proposal',
                fromId: tradeData.proposerId,
                fromName: proposerName,
                message: `${proposerName} proposed a trade with you!`,
                link: `trades.html?id=${tradeId}`,
                isRead: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(tradeData.receiverId).collection('notifications').add(notification);
            console.log(`Created trade notification for user ${tradeData.receiverId}`);

        } catch (error) {
            console.error('Error creating trade notification:', error);
        }

        return null;
    });

// =================================================================================================
// USER REGISTRATION & REFERRAL SYSTEM
// =================================================================================================

/**
 * Firestore trigger that sets up a new user's document when they register.
 */
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
            dateFormat: 'dmy'
        };

        await userRef.set(userData);
        console.log(`Created user document for ${uid}`);

    } catch (error) {
        console.error(`Failed to create user document for ${uid}:`, error);
    }

    return null;
});

/**
 * Registers a new user with a referral code and gives both users benefits.
 */
exports.registerUserWithReferral = functions.https.onCall(async (data, context) => {
    const { email, password, referrerId, city, country, favoriteTcg } = data;

    if (!email || !password || !referrerId) {
        throw new functions.https.HttpsError('invalid-argument', 'Email, password, and referrer ID are required.');
    }

    const auth = admin.auth();
    let newUserRecord = null;

    try {
        newUserRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: email.split('@')[0],
        });

        const newUserId = newUserRecord.uid;
        const referrerRef = db.collection('users').doc(referrerId);
        const newUserRef = db.collection('users').doc(newUserId);
        const newReferralLogRef = referrerRef.collection('referrals').doc(newUserId);

        await db.runTransaction(async (transaction) => {
            const referrerDoc = await transaction.get(referrerRef);
            if (!referrerDoc.exists) {
                throw new Error("Referrer not found.");
            }

            const newUserDisplayName = email.split('@')[0];
            const newUserHandle = newUserDisplayName.toLowerCase() + Math.floor(Math.random() * 1000);

            transaction.set(newUserRef, {
                email: email,
                displayName: newUserDisplayName,
                handle: newUserHandle,
                city: city || null,
                country: country || null,
                favoriteTcg: favoriteTcg || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                friends: [],
                followers: [],
                friendRequests: [],
                referredBy: referrerId,
                shopDiscountPercent: 0,
                referralCount: 0,
                postCount: 0,
                isVerified: false,
                dateFormat: 'dmy'
            });

            transaction.update(referrerRef, {
                referralCount: admin.firestore.FieldValue.increment(1),
                shopDiscountPercent: admin.firestore.FieldValue.increment(1)
            });

            transaction.set(newReferralLogRef, {
                userId: newUserId,
                displayName: newUserDisplayName,
                handle: newUserHandle,
                referredAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending_verification'
            });
        });

        console.log(`Successfully registered user ${newUserId} referred by ${referrerId}`);
        return { success: true, uid: newUserId };

    } catch (error) {
        console.error("Referral registration failed:", error);
        if (newUserRecord) {
            await auth.deleteUser(newUserRecord.uid).catch(err => console.error("Cleanup failed: Could not delete auth user.", err));
        }
        throw new functions.https.HttpsError('internal', error.message || 'An unknown error occurred.');
    }
});

/**
* A callable Cloud Function to validate a Stripe promotion code.
*/
exports.validateCoupon = functions.https.onCall(async (data, context) => {
    const { code } = data;
    if (!code) {
        return { success: false, message: 'No coupon code provided.' };
    }

    try {
        const promotionCodes = await stripe.promotionCodes.list({
            code: code.toUpperCase(),
            active: true,
            limit: 1,
        });

        if (promotionCodes.data.length > 0) {
            const promoCode = promotionCodes.data[0];
            const coupon = promoCode.coupon;
            if (coupon.valid) {
                return { success: true, coupon: { id: coupon.id, percent_off: coupon.percent_off } };
            } else {
                return { success: false, message: 'This coupon has expired.' };
            }
        } else {
            return { success: false, message: 'Invalid coupon code.' };
        }
    } catch (error) {
        console.error("Error validating coupon:", error);
        return { success: false, message: 'Could not validate coupon.' };
    }
});

/**
* A callable Cloud Function to create a Stripe Checkout session.
*/
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to make a purchase.');
    }

    const { cartItems, couponId, referralDiscountPercent } = data;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "cartItems" array.');
    }

    const line_items = cartItems.map(item => ({
        price: item.priceId,
        quantity: item.quantity,
    }));

    const sessionData = {
        payment_method_types: ['card'],
        line_items: line_items,
        mode: 'payment',
        success_url: `https://hatakesocial-88b5e.web.app/shop.html?success=true`,
        cancel_url: `https://hatakesocial-88b5e.web.app/shop.html?canceled=true`,
        allow_promotion_codes: true,
        customer_email: context.auth.token.email,
        client_reference_id: context.auth.uid
    };

    if (couponId) {
        sessionData.discounts = [{ coupon: couponId }];
    } else if (referralDiscountPercent > 0) {
        const userRef = db.collection('users').doc(context.auth.uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data();

        if (userData && referralDiscountPercent <= userData.shopDiscountPercent) {
            const coupon = await stripe.coupons.create({
                percent_off: referralDiscountPercent,
                duration: 'once',
                name: `Referral discount for ${context.auth.token.email}`
            });
            sessionData.discounts = [{ coupon: coupon.id }];
        } else {
            console.warn(`User ${context.auth.uid} tried to use referral discount of ${referralDiscountPercent}% but is only allowed ${userData.shopDiscountPercent}%.`);
        }
    }

    try {
        const session = await stripe.checkout.sessions.create(sessionData);
        return { id: session.id };
    } catch (error) {
        console.error("Stripe session creation failed:", error);
        throw new functions.https.HttpsError('internal', 'Unable to create Stripe checkout session.');
    }
});

/**
* A Firestore trigger to update a user's post count when they create a new post.
*/
exports.onPostCreate = functions.firestore
    .document('posts/{postId}')
    .onCreate(async (snap, context) => {
        const postData = snap.data();
        const authorId = postData.authorId;
        if (!authorId) return null;
        const userRef = db.collection('users').doc(authorId);
        try {
            await userRef.update({ postCount: admin.firestore.FieldValue.increment(1) });
        } catch (error) {
            console.error(`Failed to increment post count for user ${authorId}`, error);
        }
        return null;
    });

/**
* A callable function to follow or unfollow a user.
*/
exports.toggleFollowUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to follow users.');
    }
    const { uid: targetUid } = data;
    const { uid: currentUid } = context.auth;
    if (!targetUid || targetUid === currentUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid target user UID.');
    }

    const currentUserRef = db.collection('users').doc(currentUid);
    const targetUserRef = db.collection('users').doc(targetUid);

    try {
        const currentUserDoc = await currentUserRef.get();
        const isFollowing = (currentUserDoc.data().friends || []).includes(targetUid);
        const batch = db.batch();

        if (isFollowing) {
            batch.update(currentUserRef, { friends: admin.firestore.FieldValue.arrayRemove(targetUid) });
            batch.update(targetUserRef, { followers: admin.firestore.FieldValue.arrayRemove(currentUid) });
        } else {
            batch.update(currentUserRef, { friends: admin.firestore.FieldValue.arrayUnion(targetUid) });
            batch.update(targetUserRef, { followers: admin.firestore.FieldValue.arrayUnion(currentUid) });
        }
        await batch.commit();
        return { success: true, nowFollowing: !isFollowing };
    } catch (error) {
        console.error("Error toggling follow:", error);
        throw new functions.https.HttpsError('internal', 'An error occurred while trying to follow the user.');
    }
});

/**
* A Firestore trigger that creates a notification when a user is followed.
*/
exports.onFollow = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const beforeFollowers = change.before.data().followers || [];
        const afterFollowers = change.after.data().followers || [];

        if (afterFollowers.length > beforeFollowers.length) {
            const newFollowerId = afterFollowers.find(uid => !beforeFollowers.includes(uid));
            if (newFollowerId) {
                const followedUserId = context.params.userId;
                const followerDoc = await db.collection('users').doc(newFollowerId).get();
                const followerName = followerDoc.data()?.displayName || 'Someone';

                const notification = {
                    type: 'follow',
                    fromId: newFollowerId,
                    fromName: followerName,
                    fromAvatar: followerDoc.data()?.photoURL || null,
                    message: `${followerName} started following you.`,
                    link: `profile.html?uid=${newFollowerId}`,
                    isRead: false,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('users').doc(followedUserId).collection('notifications').add(notification);
            }
        }

        return null;
    });

// =================================================================================================
// MARKETPLACE SYNCING FUNCTION
// =================================================================================================

/**
 * Syncs a user's collection to the marketplace.
 */
exports.syncToMarketplace = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to sync to the marketplace.');
    }

    const userId = context.auth.uid;
    const { cardIds } = data; // Array of card document IDs to sync

    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'You must provide an array of card IDs to sync.');
    }

    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }

        const userData = userDoc.data();
        const batch = db.batch();

        // Get the cards from the user's collection
        const cardPromises = cardIds.map(cardId => 
            db.collection('users').doc(userId).collection('collection').doc(cardId).get()
        );
        const cardDocs = await Promise.all(cardPromises);

        cardDocs.forEach((cardDoc, index) => {
            if (!cardDoc.exists) {
                console.warn(`Card ${cardIds[index]} not found in user's collection`);
                return;
            }

            const cardData = cardDoc.data();
            
            // Only sync cards that are marked for sale
            if (!cardData.forSale || cardData.salePrice === undefined || cardData.salePrice === null) {
                console.warn(`Card ${cardIds[index]} is not marked for sale or has no salePrice`);
                return;
            }

            // Create marketplace listing
            const marketplaceRef = db.collection('marketplace').doc();
            const marketplaceData = {
                ...cardData,
                sellerId: userId,
                sellerName: userData.displayName || 'Unknown Seller',
                sellerHandle: userData.handle || '',
                sellerPhotoURL: userData.photoURL || '',
                originalCardId: cardDoc.id,
                price: cardData.salePrice,
                listedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            };

            batch.set(marketplaceRef, marketplaceData);

            // Update the original card to reference the marketplace listing
            const originalCardRef = db.collection('users').doc(userId).collection('collection').doc(cardDoc.id);
            batch.update(originalCardRef, {
                marketplaceId: marketplaceRef.id,
                syncedToMarketplace: true
            });
        });

        await batch.commit();

        return { 
            success: true, 
            message: `Successfully synced ${cardDocs.filter(doc => doc.exists).length} cards to the marketplace.` 
        };

    } catch (error) {
        console.error('Error syncing to marketplace:', error);
        throw new functions.https.HttpsError('internal', 'An error occurred while syncing to the marketplace.');
    }
});

/**
* A callable Cloud Function to set the admin custom claim on a user.
*/
exports.setUserAdminClaim = functions.https.onCall(async (data, context) => {
    if (context.auth.token.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can set user roles.');
    }
    const { targetUid, isAdmin } = data;
    if (typeof targetUid !== 'string' || typeof isAdmin !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid arguments provided.');
    }
    try {
        await admin.auth().setCustomUserClaims(targetUid, { admin: isAdmin });
        await db.collection('users').doc(targetUid).update({ isAdmin: isAdmin });
        return { success: true, message: `User role for ${targetUid} updated.` };
    } catch (error) {
        console.error("Error setting custom claim:", error);
        throw new functions.https.HttpsError('internal', 'An internal error occurred.');
    }
});

/**
* A callable Cloud Function to set the content creator custom claim on a user.
*/
exports.setContentCreatorClaim = functions.https.onCall(async (data, context) => {
    if (context.auth.token.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can set user roles.');
    }
    const { targetUid, isContentCreator } = data;
    if (typeof targetUid !== 'string' || typeof isContentCreator !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid arguments provided.');
    }
    try {
        await admin.auth().setCustomUserClaims(targetUid, { contentCreator: isContentCreator });
        await db.collection('users').doc(targetUid).update({ isContentCreator: isContentCreator });
        return { success: true, message: `User role for ${targetUid} updated.` };
    } catch (error) {
        console.error("Error setting custom claim:", error);
        throw new functions.https.HttpsError('internal', 'An internal error occurred.');
    }
});

// =================================================================================================
// ESCROW TRADING SYSTEM
// =================================================================================================

exports.createEscrowTransaction = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }

    const { tradeId, buyerUid, sellerUid, amount, description } = data;
    if (!tradeId || !buyerUid || !sellerUid || !amount || !description) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required trade data.');
    }

    const buyerDoc = await db.collection('users').doc(buyerUid).get();
    const sellerDoc = await db.collection('users').doc(sellerUid).get();
    if (!buyerDoc.exists || !sellerDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Buyer or Seller not found.');
    }
    const buyerEmail = buyerDoc.data().email;
    const sellerEmail = sellerDoc.data().email;

    const transactionData = {
        parties: [
            { role: 'buyer', customer: buyerEmail },
            { role: 'seller', customer: sellerEmail }
        ],
        items: [{
            title: 'HatakeSocial Trade',
            description: description,
            quantity: 1,
            price: amount.toFixed(2), // amount should be in SEK
            type: 'general_merchandise'
        }],
        currency: 'sek',
        description: `Trade ID: ${tradeId} on HatakeSocial.`,
        inspection_period: 3,
    };

    try {
        const response = await escrowApi.post('transaction', transactionData);
        const escrowTransactionId = response.data.id;

        await db.collection('trades').doc(tradeId).update({
            escrowTransactionId: escrowTransactionId,
            status: 'awaiting_payment'
        });

        const paymentUrl = `https://www.escrow.com/checkout?transactionId=${escrowTransactionId}`;

        return { success: true, paymentUrl: paymentUrl };

    } catch (error) {
        console.error("Escrow.com transaction creation failed:", error.response ? error.response.data : error.message);
        throw new functions.https.HttpsError('internal', 'Could not create the Escrow.com transaction.');
    }
});

exports.releaseEscrowFunds = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }
    const { tradeId } = data;
    if (!tradeId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing trade ID.');
    }
    const tradeRef = db.collection('trades').doc(tradeId);
    const tradeDoc = await tradeRef.get();
    if (!tradeDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Trade not found.');
    }

    const tradeData = tradeDoc.data();
    const escrowTransactionId = tradeData.escrowTransactionId;

    if (!escrowTransactionId) {
       throw new functions.https.HttpsError('failed-precondition', 'This trade does not have an active escrow transaction.');
    }
    if (tradeData.buyerUid !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the buyer can release the funds.');
    }
    if (tradeData.status !== 'shipped') {
       throw new functions.https.HttpsError('failed-precondition', `Trade must be marked as shipped before funds can be released. Current status: ${tradeData.status}`);
    }

    try {
        await escrowApi.post(`transaction/${escrowTransactionId}/accept`);

        const batch = db.batch();
        tradeData.receiverCards.forEach(card => {
            const newCardRef = db.collection('users').doc(tradeData.proposerId).collection('collection').doc();
            const newCardData = { ...card, forSale: false, addedAt: admin.firestore.FieldValue.serverTimestamp() };
            delete newCardData.id;
            batch.set(newCardRef, newCardData);
        });
        tradeData.proposerCards.forEach(card => {
            const newCardRef = db.collection('users').doc(tradeData.receiverId).collection('collection').doc();
            const newCardData = { ...card, forSale: false, addedAt: admin.firestore.FieldValue.serverTimestamp() };
            delete newCardData.id;
            batch.set(newCardRef, newCardData);
        });
        batch.update(tradeRef, { status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });
        await batch.commit();

        return { success: true, message: 'Funds released and trade completed successfully.' };

    } catch (error) {
        console.error("Error releasing escrow funds:", error.response ? error.response.data : error.message);
        throw new functions.https.HttpsError('internal', 'Could not release the escrow funds.');
    }
});

// =================================================================================================
// ADMIN IMPERSONATION FUNCTION
// =================================================================================================

exports.generateImpersonationToken = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You must be an admin to perform this action."
    );
  }

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with a 'uid'."
    );
  }

  try {
    const customToken = await admin.auth().createCustomToken(uid);
    return { token: customToken };
  } catch (error) {
    console.error("Failed to create impersonation token:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Could not create an impersonation token."
    );
  }
});

// =================================================================================================
// DRAFT, DECK, & GAME FUNCTIONS (FINAL VERSION)
// =================================================================================================

const mtgApi = axios.create({ baseURL: "https://api.magicthegathering.io/v1" });

/**
 * Creates a new draft lobby. Anyone who is logged in can create a draft.
 */
exports.createDraft = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a draft.');
    }
    const { setName, setCode } = data;
    if (!setName || !setCode) {
        throw new functions.https.HttpsError('invalid-argument', 'Set name and code are required.');
    }

    const uid = context.auth.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    const displayName = userDoc.data()?.displayName || 'Unknown Player';

    const draftRef = db.collection('drafts').doc();
    
    // Associate the draft with the event by storing the draft ID on the event document
    const eventData = {
        name: `Draft Event: ${setName}`,
        eventType: 'tournament',
        format: 'swiss', // Drafts will use Swiss pairings
        game: 'Magic: The Gathering',
        date: admin.firestore.FieldValue.serverTimestamp(),
        organizerId: uid,
        organizerName: displayName,
        status: 'upcoming',
        participants: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        draftId: draftRef.id, // Link to the draft document
        isDraftEvent: true
    };
    
    const eventRef = await db.collection('events').add(eventData);

    await draftRef.set({
        hostId: uid,
        hostName: displayName,
        set: setCode,
        setName: setName,
        status: 'lobby',
        players: [{ uid, displayName, photoURL: userDoc.data()?.photoURL || '' }],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        eventId: eventRef.id // Link back to the event document
    });

    return { draftId: draftRef.id };
});

/**
 * Allows a user to join an existing draft lobby.
 */
exports.joinDraft = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    
    const { draftId } = data;
    const uid = context.auth.uid;
    
    const draftRef = db.collection('drafts').doc(draftId);
    const userDoc = await db.collection('users').doc(uid).get();
    const displayName = userDoc.data()?.displayName || 'Unknown Player';
    const photoURL = userDoc.data()?.photoURL || '';

    return db.runTransaction(async (transaction) => {
        const draftDoc = await transaction.get(draftRef);
        if (!draftDoc.exists) throw new functions.https.HttpsError('not-found', 'Draft not found.');
        
        const draftData = draftDoc.data();
        if (draftData.status !== 'lobby') throw new functions.https.HttpsError('failed-precondition', 'Draft has already started.');
        if (draftData.players.length >= 8) throw new functions.https.HttpsError('failed-precondition', 'Draft is full.');
        if (draftData.players.some(p => p.uid === uid)) return { draftId };

        transaction.update(draftRef, {
            players: admin.firestore.FieldValue.arrayUnion({ uid, displayName, photoURL })
        });
        return { draftId };
    });
});


/**
 * Starts the draft by generating and distributing booster packs.
 */
exports.startDraft = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    
    const { draftId } = data;
    const uid = context.auth.uid;
    const draftRef = db.collection('drafts').doc(draftId);
    const draftDoc = await draftRef.get();

    if (!draftDoc.exists || draftDoc.data().hostId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the host can start the draft.');
    }

    const players = draftDoc.data().players;
    if (players.length < 2) { 
        throw new functions.https.HttpsError('failed-precondition', 'At least 2 players are needed to start.');
    }

    const packPromises = players.map(() => mtgApi.get(`/sets/${draftDoc.data().set}/booster`));
    const packResponses = await Promise.all(packPromises);

    const batch = db.batch();
    packResponses.forEach((response, index) => {
        const player = players[index];
        const playerStateRef = draftRef.collection('playerState').doc(player.uid);
        batch.set(playerStateRef, {
            pickedCards: [],
            sideboard: [],
            mainDeck: [],
            currentPack: (response.data.cards || []).map(c => ({...c, id: c.id || admin.firestore.FieldValue.serverTimestamp().toMillis().toString()}))
        });
    });

    batch.update(draftRef, { status: 'drafting', currentPackNumber: 1, currentPickNumber: 1 });
    await batch.commit();
    return { success: true };
});

/**
 * Creates a new game instance from a tournament match.
 */
exports.createGameFromMatch = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');

    const { eventId, roundIndex, matchIndex, draftId } = data;
    const uid = context.auth.uid;

    const eventRef = db.collection('events').doc(eventId);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) throw new functions.https.HttpsError('not-found', 'Event not found.');

    const eventData = eventDoc.data();
    const match = eventData.rounds[roundIndex].matches[matchIndex];
    
    if (uid !== match.player1.id && uid !== match.player2.id) {
        throw new functions.https.HttpsError('permission-denied', 'You are not part of this match.');
    }

    const p1StateDoc = await db.collection('drafts').doc(draftId).collection('playerState').doc(match.player1.id).get();
    const p2StateDoc = await db.collection('drafts').doc(draftId).collection('playerState').doc(match.player2.id).get();

    if (!p1StateDoc.exists || !p2StateDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'One or both player decklists could not be found.');
    }

    const shuffle = (deck) => deck.sort(() => Math.random() - 0.5);

    const p1Deck = shuffle(p1StateDoc.data().mainDeck);
    const p2Deck = shuffle(p2StateDoc.data().mainDeck);

    const gameRef = db.collection('games').doc();
    const initialGameState = {
        players: {
            player1: { uid: match.player1.id, displayName: match.player1.displayName, life: 20 },
            player2: { uid: match.player2.id, displayName: match.player2.displayName, life: 20 }
        },
        library: { [match.player1.id]: p1Deck.slice(7), [match.player2.id]: p2Deck.slice(7) },
        hand: { [match.player1.id]: p1Deck.slice(0, 7), [match.player2.id]: p2Deck.slice(0, 7) },
        battlefield: { [match.player1.id]: [], [match.player2.id]: [] },
        graveyard: { [match.player1.id]: [], [match.player2.id]: [] },
        turn: Math.random() < 0.5 ? match.player1.id : match.player2.id,
        phase: 'Untap',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await gameRef.set(initialGameState);
    
    return { gameId: gameRef.id };
});


/**
 * Sets custom user claims for role management (admin or content_creator).
 * Only admins can call this function.
 */
exports.setUserRole = functions.https.onCall(async (data, context) => {
    // Ensure the user calling the function is an admin
    if (!context.auth || context.auth.token.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can set user roles.');
    }

    const { uid, role, value } = data;
    
    if (!uid || !role || typeof value !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'UID, role, and value (boolean) are required.');
    }

    // Validate role
    if (role !== 'admin' && role !== 'content_creator') {
        throw new functions.https.HttpsError('invalid-argument', 'Role must be either "admin" or "content_creator".');
    }

    try {
        // Get current custom claims
        const user = await admin.auth().getUser(uid);
        const currentClaims = user.customClaims || {};
        
        // Update the specific role
        const newClaims = { ...currentClaims, [role]: value };
        
        // Set the custom claim for the user
        await admin.auth().setCustomUserClaims(uid, newClaims);
        
        // Also update the user document in Firestore for easier querying
        const userRef = db.collection('users').doc(uid);
        const updateData = {};
        
        if (role === 'admin') {
            updateData.isAdmin = value;
        } else if (role === 'content_creator') {
            updateData.isContentCreator = value;
        }
        
        await userRef.update(updateData);
        
        return { success: `User ${uid} has been updated with ${role}: ${value}.` };
    } catch (error) {
        console.error('Error setting user role:', error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});
/**
 * Scheduled function to collect daily price snapshots for all tracked cards.
 * This should be triggered daily via Cloud Scheduler.
 */
exports.dailyPriceCollection = functions.pubsub.schedule('0 6 * * *') // Run daily at 6 AM UTC
    .timeZone('UTC')
    .onRun(async (context) => {
        console.log('--- Daily price collection started ---');
        
        try {
            // Get list of cards to track from Firestore
            const trackedCardsRef = db.collection('trackedCards');
            const trackedCardsSnapshot = await trackedCardsRef.get();
            
            if (trackedCardsSnapshot.empty) {
                console.log('No tracked cards found. Skipping daily collection.');
                return null;
            }
            
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            // Process cards in batches to avoid overwhelming the API
            const batchSize = 10;
            const cards = [];
            trackedCardsSnapshot.forEach(doc => {
                cards.push({ id: doc.id, ...doc.data() });
            });
            
            for (let i = 0; i < cards.length; i += batchSize) {
                const batch = cards.slice(i, i + batchSize);
                const promises = batch.map(async (card) => {
                    try {
                        await exports.collectCardPriceSnapshot({ 
                            cardId: card.id, 
                            game: card.game || 'pokemon' 
                        }, context);
                        successCount++;
                    } catch (error) {
                        console.error(`Error collecting price for card ${card.id}:`, error);
                        errorCount++;
                        errors.push({ cardId: card.id, error: error.message });
                    }
                });
                
                await Promise.all(promises);
                
                // Add delay between batches to respect rate limits
                if (i + batchSize < cards.length) {
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                }
            }
            
            console.log(`Daily price collection completed. Success: ${successCount}, Errors: ${errorCount}`);
            
            // Store collection summary
            await db.collection('priceCollectionLogs').add({
                date: new Date().toISOString().split('T')[0],
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                totalCards: cards.length,
                successCount: successCount,
                errorCount: errorCount,
                errors: errors
            });
            
            return null;
            
        } catch (error) {
            console.error('Error in daily price collection:', error);
            throw error;
        }
    });

/**
 * Adds a card to the tracked cards list for daily price collection.
 */
exports.addCardToTracking = functions.https.onCall(async (data, context) => {
    const { cardId, game, cardName } = data;
    
    if (!cardId || !game) {
        throw new functions.https.HttpsError('invalid-argument', 'cardId and game are required.');
    }
    
    try {
        const cardRef = db.collection('trackedCards').doc(cardId);
        await cardRef.set({
            cardId: cardId,
            game: game,
            cardName: cardName || 'Unknown Card',
            addedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastCollected: null
        }, { merge: true });
        
        console.log(`Added card ${cardId} to tracking list`);
        return { success: true, message: 'Card added to price tracking' };
        
    } catch (error) {
        console.error('Error adding card to tracking:', error);
        throw new functions.https.HttpsError('unknown', error.message);
    }
});

/**
 * Removes a card from the tracked cards list.
 */
exports.removeCardFromTracking = functions.https.onCall(async (data, context) => {
    const { cardId } = data;
    
    if (!cardId) {
        throw new functions.https.HttpsError('invalid-argument', 'cardId is required.');
    }
    
    try {
        await db.collection('trackedCards').doc(cardId).delete();
        console.log(`Removed card ${cardId} from tracking list`);
        return { success: true, message: 'Card removed from price tracking' };
        
    } catch (error) {
        console.error('Error removing card from tracking:', error);
        throw new functions.https.HttpsError('unknown', error.message);
    }
});

/**
 * Gets price analytics for a user's collection.
 */
exports.getCollectionPriceAnalytics = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    
    const userId = context.auth.uid;
    const { days = 30 } = data;
    
    try {
        // Get user's collection
        const collectionRef = db.collection('users').doc(userId).collection('collection');
        const collectionSnapshot = await collectionRef.get();
        
        if (collectionSnapshot.empty) {
            return { 
                success: true, 
                totalValue: 0, 
                valueChange: 0, 
                percentChange: 0,
                topGainers: [],
                topLosers: [],
                cards: []
            };
        }
        
        const analytics = {
            totalValue: 0,
            totalPreviousValue: 0,
            cards: [],
            topGainers: [],
            topLosers: []
        };
        
        // Process each card in the collection
        for (const doc of collectionSnapshot.docs) {
            const cardData = doc.data();
            const cardId = cardData.api_id || cardData.cardId || cardData.id;
            
            if (!cardId) continue;
            
            try {
                // Get price history for this card
                const priceHistoryResult = await exports.getCardPriceHistory({
                    cardId: cardId,
                    days: days,
                    game: cardData.tcg || cardData.game || 'pokemon'
                }, context);
                
                if (priceHistoryResult.success && priceHistoryResult.data.length > 0) {
                    const priceHistory = priceHistoryResult.data;
                    const currentPrice = priceHistory[priceHistory.length - 1].market || 0;
                    const previousPrice = priceHistory.length > 1 ? priceHistory[0].market : currentPrice;
                    const priceChange = currentPrice - previousPrice;
                    const percentChange = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;
                    
                    const cardAnalytics = {
                        cardId: cardId,
                        name: cardData.name || cardData.cardName,
                        currentPrice: currentPrice,
                        previousPrice: previousPrice,
                        priceChange: priceChange,
                        percentChange: percentChange,
                        currency: priceHistory[priceHistory.length - 1].currency || 'USD',
                        imageUrl: cardData.imageUrl
                    };
                    
                    analytics.cards.push(cardAnalytics);
                    analytics.totalValue += currentPrice;
                    analytics.totalPreviousValue += previousPrice;
                    
                    // Track top gainers and losers
                    if (priceChange > 0) {
                        analytics.topGainers.push(cardAnalytics);
                    } else if (priceChange < 0) {
                        analytics.topLosers.push(cardAnalytics);
                    }
                }
            } catch (cardError) {
                console.warn(`Error getting price data for card ${cardId}:`, cardError.message);
            }
        }
        
        // Calculate overall portfolio metrics
        const totalValueChange = analytics.totalValue - analytics.totalPreviousValue;
        const totalPercentChange = analytics.totalPreviousValue > 0 ? 
            (totalValueChange / analytics.totalPreviousValue) * 100 : 0;
        
        // Sort top gainers and losers
        analytics.topGainers.sort((a, b) => b.percentChange - a.percentChange);
        analytics.topLosers.sort((a, b) => a.percentChange - b.percentChange);
        
        // Limit to top 5
        analytics.topGainers = analytics.topGainers.slice(0, 5);
        analytics.topLosers = analytics.topLosers.slice(0, 5);
        
        return {
            success: true,
            totalValue: analytics.totalValue,
            valueChange: totalValueChange,
            percentChange: totalPercentChange,
            topGainers: analytics.topGainers,
            topLosers: analytics.topLosers,
            cards: analytics.cards,
            period: `${days} days`
        };
        
    } catch (error) {
        console.error('Error getting collection analytics:', error);
        throw new functions.https.HttpsError('unknown', error.message);
    }
});
