/**
 * HatakeSocial - Firebase Cloud Functions (Corrected Version)
 * Includes currency exchange rate functionality
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe")(functions.config().stripe.secret);
const axios = require("axios");
const fetch = require("node-fetch");

// --- CORS CONFIGURATION ---
const allowedOrigins = [
    'https://hatake.eu',
    'https://hatakesocial-88b5e.web.app',
    'http://localhost:5000'
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

// =================================================================================================
// CURRENCY EXCHANGE RATE FUNCTIONS
// =================================================================================================

const exchangeRateCache = new Map();
const EXCHANGE_RATE_CACHE_DURATION_MS = 1000 * 60 * 60 * 6; // Cache for 6 hours

exports.getExchangeRates = functions.https.onCall(async (data, context) => {
    const baseCurrency = data.base || 'USD';

    // Check cache first
    if (exchangeRateCache.has(baseCurrency)) {
        const cachedItem = exchangeRateCache.get(baseCurrency);
        if (Date.now() - cachedItem.timestamp < EXCHANGE_RATE_CACHE_DURATION_MS) {
            console.log(`Serving exchange rates for '${baseCurrency}' from cache.`);
            return cachedItem.data;
        }
    }

    // Get API key from Firebase config
    const API_KEY = functions.config().currencyapi.key;
    if (!API_KEY) {
        throw new functions.https.HttpsError('internal', 'Currency API key is not configured.');
    }

    const apiUrl = `https://api.freecurrencyapi.com/v1/latest?apikey=${API_KEY}&base_currency=${baseCurrency}`;

    try {
        console.log(`Fetching exchange rates for '${baseCurrency}' from external API.`);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new functions.https.HttpsError('internal', 'Failed to fetch from currency API.');
        }
        const result = await response.json();
        
        // Store in cache
        exchangeRateCache.set(baseCurrency, {
            timestamp: Date.now(),
            data: result.data
        });

        return result.data;

    } catch (error) {
        console.error("Error fetching exchange rates:", error);
        throw new functions.https.HttpsError("internal", "An unexpected error occurred while fetching exchange rates.");
    }
});

// =================================================================================================
// SECURE CARD SEARCH FUNCTIONS
// =================================================================================================

// Create a simple in-memory cache for Pokémon searches
const pokemonCache = new Map();
const CACHE_DURATION_MS = 1000 * 60 * 60; // Cache results for 1 hour

/**
 * A callable function that acts as a secure proxy to the Pokémon TCG API.
 * This prevents the API key from being exposed on the client-side.
 * It's configured to have a minimum of 1 instance running to prevent "cold starts".
 */
exports.searchPokemon = functions.runWith({ minInstances: 1 }).https.onCall(async (data, context) => {
    const cardName = data.cardName;
    if (!cardName) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with a 'cardName' argument."
        );
    }

    // Check cache first
    if (pokemonCache.has(cardName)) {
        const cachedItem = pokemonCache.get(cardName);
        if (Date.now() - cachedItem.timestamp < CACHE_DURATION_MS) {
            console.log(`Serving '${cardName}' from cache.`);
            return cachedItem.data;
        }
    }

    // Securely get the API key from Firebase environment configuration
    const POKEMON_API_KEY = functions.config().pokemon.apikey;
    if (!POKEMON_API_KEY) {
        throw new functions.https.HttpsError('internal', 'Pokémon API key is not configured.');
    }

    const searchUrl = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}*"&pageSize=40&orderBy=-set.releaseDate`;

    try {
        console.log(`Searching for '${cardName}' via API.`);
        const response = await fetch(searchUrl, {
            headers: { "X-Api-Key": POKEMON_API_KEY },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Pokemon API Error:", response.status, errorBody);
            throw new functions.https.HttpsError("internal", `Failed to fetch from Pokémon TCG API. Status: ${response.status}`);
        }

        const result = await response.json();
        const responseData = result.data;

        // Store successful result in cache
        pokemonCache.set(cardName, {
            timestamp: Date.now(),
            data: responseData,
        });

        return responseData; // Return the array of cards
    } catch (error) {
        console.error("Error fetching Pokémon cards in cloud function:", error);
        throw new functions.https.HttpsError("internal", "An unexpected error occurred while fetching Pokémon cards.");
    }
});

// =================================================================================================
// ADMIN USER & PLATFORM MANAGEMENT FUNCTIONS
// =================================================================================================

/**
 * Helper function to verify that the caller is an administrator.
 * @param {object} context - The context object from the callable function.
 */
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

