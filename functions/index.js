/**
* HatakeSocial - Firebase Cloud Functions
*
* This file contains the backend logic for the application.
* - ADMIN FUNCTIONS for user management and platform control.
* - MESSAGING FUNCTIONS for real-time user-to-user chat.
* - CARD & MARKETPLACE FUNCTIONS for collection syncing and secure API searches.
* - Handles user registration with a referral code.
* - Creates Stripe checkout sessions for the shop with coupon/referral support.
* - Validates Stripe promotion codes.
* - Automatically counts user posts.
* - Handles following users and creating notifications.
* - Automatically deletes product images from Storage when a product is deleted.
* - Securely sets admin and content creator custom claims for user roles.
* - Manages a secure escrow trading system with Escrow.com.
* - Wishlist and Trade Matching functionality.
* - Marketplace syncing function.
* - SECURE POKEMON API SEARCH PROXY to protect the API key.
*/

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe")(functions.config().stripe.secret);
const axios = require("axios");
const fetch = require("node-fetch"); // <-- ADDED for the new Pokémon function

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

// --- Escrow.com API Configuration ---
const ESCROW_API_KEY = functions.config().escrow.key;
const ESCROW_API_USER = functions.config().escrow.user;
const ESCROW_API_URL = "https://api.escrow.com/2017-09-01/"; // Use the production URL

const escrowApi = axios.create({
    baseURL: ESCROW_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${ESCROW_API_USER}:${ESCROW_API_KEY}`).toString('base64')}`
    }
});

// =================================================================================================
// SECURE CARD SEARCH FUNCTIONS (NEW)
// =================================================================================================

/**
 * A callable function that acts as a secure proxy to the Pokémon TCG API.
 * This prevents the API key from being exposed on the client-side.
 */
exports.searchPokemon = functions.https.onCall(async (data, context) => {
    const cardName = data.cardName;
    if (!cardName) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with a 'cardName' argument."
        );
    }

    // Securely get the API key from Firebase environment configuration
    const POKEMON_API_KEY = functions.config().pokemon.apikey;
    if (!POKEMON_API_KEY) {
        throw new functions.https.HttpsError('internal', 'Pokémon API key is not configured.');
    }

    const searchUrl = `https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(cardName)}*"&pageSize=40&orderBy=-set.releaseDate`;

    try {
        const response = await fetch(searchUrl, {
            headers: { "X-Api-Key": POKEMON_API_KEY },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Pokemon API Error:", response.status, errorBody);
            throw new functions.https.HttpsError("internal", `Failed to fetch from Pokémon TCG API. Status: ${response.status}`);
        }

        const result = await response.json();
        return result.data; // Return the array of cards
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
 * Sends a message from one user to another. (MERGED FUNCTION)
 * This is the single, definitive function for sending messages.
 * It is kept "warm" with minInstances to prevent cold start delays.
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
 * Ensures a conversation document exists between two users. Creates one if it doesn't.
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

// =================================================================================================
// --- NEW MARKETPLACE FUNCTION ---
// =================================================================================================
/**
 * This function triggers whenever a card in a user's collection is created, updated, or deleted.
 * It keeps a public `marketplaceListings` collection in sync.
 */
exports.syncCardToMarketplace = functions.firestore
    .document('users/{userId}/collection/{cardId}')
    .onWrite(async (change, context) => {
        const { userId, cardId } = context.params;
        const listingRef = db.collection('marketplaceListings').doc(cardId);

        // Card was deleted or is no longer for sale
        if (!change.after.exists || !change.after.data().forSale) {
            try {
                await listingRef.delete();
                console.log(`Removed listing ${cardId} from the marketplace.`);
            } catch (error) {
                console.error(`Failed to remove listing ${cardId} from marketplace:`, error);
            }
            return null;
        }

        // Card was added or updated to be for sale
        const cardData = change.after.data();
        
        // Ensure we only proceed if forSale is explicitly true
        if (cardData.forSale !== true) {
            return null;
        }

        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) {
                console.error(`User document for seller ${userId} not found.`);
                return null;
            }
            
            const sellerData = userDoc.data();

            // Create a clean seller object to avoid storing sensitive info
            const sellerInfo = {
                uid: userId,
                displayName: sellerData.displayName || "Unknown Seller",
                photoURL: sellerData.photoURL || null,
                city: sellerData.city || null,
                country: sellerData.country || null,
                primaryCurrency: sellerData.primaryCurrency || 'SEK',
                rating: sellerData.rating || 0,
                ratingCount: sellerData.ratingCount || 0
            };

            const listingData = {
                ...cardData,
                sellerData: sellerInfo,
                originalCardId: cardId, // Keep track of original ID
                sellerId: userId,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            };

            await listingRef.set(listingData, { merge: true });
            console.log(`Synced card ${cardId} to marketplace for user ${userId}.`);
            return null;
        } catch (error) {
            console.error(`Error syncing card ${cardId} to marketplace:`, error);
            return null;
        }
    });

// =================================================================================================
// ORIGINAL APPLICATION FUNCTIONS
// =================================================================================================

/**
 * Handles the creation of a new user account.
 * This function triggers when a new user is created in Firebase Authentication.
 * It automatically creates a corresponding user document in Firestore.
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user;
  
  const defaultDisplayName = displayName || email.split('@')[0];
  const handle = defaultDisplayName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const defaultPhotoURL = photoURL || `https://ui-avatars.com/api/?name=${defaultDisplayName.charAt(0)}&background=random&color=fff`;

  const newUser = {
    displayName: defaultDisplayName,
    displayName_lower: defaultDisplayName.toLowerCase(),
    email: email,
    photoURL: defaultPhotoURL,
    handle: handle,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    bio: "New HatakeSocial user!",
    favoriteTcg: "Not set",
    city: "",
    country: "",
    referrer: "",
    isAdmin: false,
    primaryCurrency: 'SEK'
  };

  try {
    await db.collection('users').doc(uid).set(newUser);
    console.log(`Successfully created profile for user: ${uid}`);
    return null;
  } catch (error) {
    console.error(`Error creating profile for user: ${uid}`, error);
    return null;
  }
});


/**
* A callable Cloud Function to handle new user registration with a referral code.
*/
exports.registerUserWithReferral = functions.https.onCall(async (data, context) => {
    const { email, password, city, country, favoriteTcg, referrerId } = data;

    if (!email || !password || !referrerId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required data for registration.');
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

/**
* A Firestore trigger that cleans up a product's images from Cloud Storage when it's deleted.
*/
exports.onProductDelete = functions.firestore
    .document('products/{productId}')
    .onDelete(async (snap, context) => {
        const { productId } = context.params;
        const bucket = storage.bucket();
        const directory = `products/${productId}/`;
        try {
            await bucket.deleteFiles({ prefix: directory });
            console.log(`Successfully deleted all images for product ${productId}.`);
        } catch (error) {
            console.error(`Failed to delete images for product ${productId}.`, error);
        }
        return null;
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
// ESCROW.COM TRADING SYSTEM FUNCTIONS
// =================================================================================================

exports.createEscrowTransaction = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to create a trade.');
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

        return { success: true, message: 'Funds have been released to the seller via Escrow.com.' };

    } catch (error) {
        console.error("Failed to release funds via Escrow.com:", error.response ? error.response.data : error.message);
        await tradeRef.update({ status: 'release_failed' });
        throw new functions.https.HttpsError('internal', 'An error occurred while releasing the funds.');
    }
});


// =================================================================================================
// WISHLIST AND TRADE MATCHING FUNCTIONS
// =================================================================================================

/**
 * Manages a user's wishlist. Adds or removes a card.
 */
exports.manageWishlist = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to manage your wishlist.');
    }

    const { cardId, action } = data; // action can be 'add' or 'remove'
    if (!cardId || !action) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing cardId or action.');
    }

    const wishlistRef = db.collection('users').doc(context.auth.uid).collection('wishlist').doc(cardId);

    if (action === 'add') {
        await wishlistRef.set({
            ...data.cardData,
            addedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, message: 'Card added to wishlist.' };
    } else if (action === 'remove') {
        await wishlistRef.delete();
        return { success: true, message: 'Card removed from wishlist.' };
    } else {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid action specified.');
    }
});

/**
 * Firestore trigger to check for wishlist matches when a new card is added to a user's collection for trade.
 */
exports.onCardForTradeCreate = functions.firestore
    .document('users/{userId}/collection/{cardId}')
    .onCreate(async (snap, context) => {
        const cardData = snap.data();
        const { userId, cardId } = context.params;

        if (!cardData.forSale) {
            return null;
        }

        const querySnapshot = await db.collectionGroup('wishlist').where('name', '==', cardData.name).get();

        if (querySnapshot.empty) {
            return null;
        }

        const sellerDoc = await db.collection('users').doc(userId).get();
        const sellerName = sellerDoc.data()?.displayName || 'A user';

        const notifications = [];
        querySnapshot.forEach(doc => {
            const wishingUser = doc.ref.parent.parent.id;
            if (wishingUser === userId) {
                return;
            }

            const notification = {
                type: 'wishlist_match',
                fromId: userId,
                fromName: sellerName,
                fromAvatar: sellerDoc.data()?.photoURL || null,
                message: `${sellerName} has listed a card from your wishlist: ${cardData.name}.`,
                link: `card-view.html?id=${cardId}`,
                isRead: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            };
            notifications.push(db.collection('users').doc(wishingUser).collection('notifications').add(notification));
        });

        await Promise.all(notifications);
        return null;
    });

// =================================================================================================
// IMPERSONATION FUNCTION
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

