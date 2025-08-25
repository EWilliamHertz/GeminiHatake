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
 * - Manages a secure escrow trading system with Stripe Connect.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
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
                isVerified: false
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


// =================================================================================================
// ESCROW TRADING SYSTEM FUNCTIONS
// =================================================================================================

exports.createStripeConnectedAccount = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to become a seller.');
    }
    try {
        const account = await stripe.accounts.create({
            type: 'express',
            email: context.auth.token.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
        });
        await db.collection('users').doc(context.auth.uid).update({ stripeAccountId: account.id });
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: 'https://hatakesocial-88b5e.web.app/trades.html?reauth=true',
            return_url: 'https://hatakesocial-88b5e.web.app/trades.html?stripe_success=true',
            type: 'account_onboarding',
        });
        return { url: accountLink.url };
    } catch (error) {
        console.error("Stripe account creation failed:", error);
        throw new functions.https.HttpsError('internal', 'Could not create a Stripe account link.');
    }
});

exports.createEscrowPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to make a payment.');
    }
    const { amount, sellerUid } = data; // amount is in cents
    if (!amount || !sellerUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing amount or seller UID.');
    }
    const sellerDoc = await db.collection('users').doc(sellerUid).get();
    const sellerStripeId = sellerDoc.data()?.stripeAccountId;
    if (!sellerStripeId) {
        throw new functions.https.HttpsError('not-found', 'This seller is not configured for payments.');
    }
    const applicationFee = Math.round(amount * 0.035);
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            capture_method: 'manual',
            application_fee_amount: applicationFee,
            transfer_data: {
                destination: sellerStripeId,
            },
        });
        // Note: The trade document should be created client-side before calling this
        // to ensure a trade ID exists. This function would then be passed the tradeId
        // to update the paymentIntentId onto the existing trade document.
        return { clientSecret: paymentIntent.client_secret };
    } catch (error) {
        console.error("Escrow payment intent creation failed:", error);
        throw new functions.https.HttpsError('internal', 'Could not initiate the trade payment.');
    }
});

exports.captureAndReleaseFunds = functions.https.onCall(async (data, context) => {
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
    if (tradeData.buyerUid !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the buyer can release the funds.');
    }
    if (tradeData.status !== 'shipped') {
         throw new functions.https.HttpsError('failed-precondition', `Trade is not in a releasable state. Current status: ${tradeData.status}`);
    }
    try {
        // Capture the charge. This finalizes the transaction.
        await stripe.paymentIntents.capture(tradeData.paymentIntentId);
        
        // Atomically transfer cards and update status
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

        return { success: true, message: 'Funds have been captured and released to the seller.' };
    } catch (error) {
        console.error("Failed to capture funds:", error);
        await tradeRef.update({ status: 'capture_failed' });
        throw new functions.https.HttpsError('internal', 'An error occurred while releasing the funds.');
    }
});
