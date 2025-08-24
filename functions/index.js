/**
 * HatakeSocial - Firebase Cloud Functions
 *
 * This file contains the backend logic for the application.
 * - Handles user registration with a referral code.
 * - Creates Stripe checkout sessions for the shop with coupon/referral support.
 * - Validates Stripe promotion codes.
 * - Automatically counts user posts.
 * - Handles following users and creating notifications.
 * - Automatically deletes product images from Storage when a product is deleted.
 * - Securely sets admin custom claims for user roles.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
// IMPORTANT: Make sure you have set your Stripe secret key in your Firebase environment configuration
// firebase functions:config:set stripe.secret="sk_test_..."
const stripe = require("stripe")(functions.config().stripe.secret);

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

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

            // Create the new user's document
            transaction.set(newUserRef, {
                email: email,
                displayName: newUserDisplayName,
                handle: newUserHandle,
                city: city || null,
                country: country || null,
                favoriteTcg: favoriteTcg || null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                friends: [],
                followers: [], // Initialize followers
                friendRequests: [],
                referredBy: referrerId,
                shopDiscountPercent: 0, // Starts at 0, increases with referrals
                referralCount: 0,
                postCount: 0, // Initialize post count
                isVerified: false
            });

            // Update the referrer's document
            transaction.update(referrerRef, {
                referralCount: admin.firestore.FieldValue.increment(1),
                shopDiscountPercent: admin.firestore.FieldValue.increment(1)
            });

            // Log the referral for tracking
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
    // Check for authentication
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
        allow_promotion_codes: true, // Allows users to enter codes on Stripe's page as a fallback
        customer_email: context.auth.token.email,
        client_reference_id: context.auth.uid
    };

    if (couponId) {
        // If a valid coupon from your Stripe dashboard is passed
        sessionData.discounts = [{ coupon: couponId }];

    } else if (referralDiscountPercent > 0) {
        // Create a coupon on the fly for the referral discount
        const userRef = db.collection('users').doc(context.auth.uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data();
        
        // Security check: ensure the requested discount is not more than allowed
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

        if (!authorId) {
            console.log("Post has no authorId, cannot update count.");
            return null;
        }

        const userRef = db.collection('users').doc(authorId);

        try {
            await userRef.update({
                postCount: admin.firestore.FieldValue.increment(1)
            });
            console.log(`Successfully incremented post count for user ${authorId}`);
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

    const targetUid = data.uid;
    const currentUid = context.auth.uid;

    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing target user UID.');
    }
    if (targetUid === currentUid) {
        throw new functions.https.HttpsError('invalid-argument', 'You cannot follow yourself.');
    }

    const currentUserRef = db.collection('users').doc(currentUid);
    const targetUserRef = db.collection('users').doc(targetUid);

    try {
        const currentUserDoc = await currentUserRef.get();
        const currentUserData = currentUserDoc.data();
        const friends = currentUserData.friends || [];

        const isFollowing = friends.includes(targetUid);
        const batch = db.batch();

        if (isFollowing) {
            // Unfollow
            batch.update(currentUserRef, { friends: admin.firestore.FieldValue.arrayRemove(targetUid) });
            batch.update(targetUserRef, { followers: admin.firestore.FieldValue.arrayRemove(currentUid) });
        } else {
            // Follow
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
        const beforeData = change.before.data();
        const afterData = change.after.data();
        
        const beforeFollowers = beforeData.followers || [];
        const afterFollowers = afterData.followers || [];

        // Check if a new follower was added
        if (afterFollowers.length > beforeFollowers.length) {
            const newFollowerId = afterFollowers.find(uid => !beforeFollowers.includes(uid));
            if (newFollowerId) {
                const followedUserId = context.params.userId;
                
                // Get the new follower's display name
                const followerDoc = await db.collection('users').doc(newFollowerId).get();
                const followerName = followerDoc.data()?.displayName || 'Someone';
                
                // Create the notification
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
        const productId = context.params.productId;
        const bucket = storage.bucket();
        const directory = `products/${productId}/`;

        console.log(`Deleting all images in directory: ${directory}`);

        try {
            await bucket.deleteFiles({
                prefix: directory,
            });
            console.log(`Successfully deleted all images for product ${productId}.`);
            return null;
        } catch (error) {
            console.error(`Failed to delete images for product ${productId}.`, error);
            return null;
        }
    });

/**
 * A callable Cloud Function to set the admin custom claim on a user.
 * The caller of this function must already be an admin.
 */
exports.setUserAdminClaim = functions.https.onCall(async (data, context) => {
    // 1. Check if the user calling the function is an admin.
    if (context.auth.token.admin !== true) {
        throw new functions.https.HttpsError(
            'permission-denied', 
            'Only admins can set user roles.'
        );
    }

    const { targetUid, isAdmin } = data;

    // 2. Validate the incoming data.
    if (typeof targetUid !== 'string' || typeof isAdmin !== 'boolean') {
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'The function must be called with a "targetUid" string and an "isAdmin" boolean.'
        );
    }

    try {
        // 3. Set the custom claim on the target user's auth token.
        await admin.auth().setCustomUserClaims(targetUid, { admin: isAdmin });
        
        // 4. Also update the Firestore document to keep everything in sync.
        await db.collection('users').doc(targetUid).update({ isAdmin: isAdmin });

        console.log(`Successfully set admin claim for ${targetUid} to ${isAdmin}`);
        return { success: true, message: `User role for ${targetUid} updated.` };

    } catch (error) {
        console.error("Error setting custom claim:", error);
        throw new functions.https.HttpsError('internal', 'An internal error occurred while setting the user role.');
    }
});
