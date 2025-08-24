/**
 * HatakeSocial - Firebase Cloud Functions
 *
 * This file contains the backend logic for the application.
 * - Handles new user registration with a referral code.
 * - Creates Stripe checkout sessions for the shop.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
// SECURE: Initialize Stripe using a Firebase environment variable
const stripe = require("stripe")(functions.config().stripe.secret);

admin.initializeApp();
const db = admin.firestore();

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
                friendRequests: [],
                referredBy: referrerId,
                shopDiscountPercent: 0,
                referralCount: 0,
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
 * A callable Cloud Function to create a Stripe Checkout session.
 */
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    // Check for authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to make a purchase.');
    }

    const { cartItems, referralCode } = data;

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
        // IMPORTANT: Replace these with your actual website URLs
        success_url: `https://your-website.com/success.html`,
        cancel_url: `https://your-website.com/shop.html`,
        allow_promotion_codes: true, // This allows the MTGFB code to be used
        customer_email: context.auth.token.email,
        client_reference_id: context.auth.uid
    };

    // This section is for applying the user's personal referral discount.
    // It checks the user's profile for a discount percentage.
    const userRef = db.collection('users').doc(context.auth.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (userData && userData.shopDiscountPercent > 0) {
        // Create a coupon on the fly for the user's specific discount
        const coupon = await stripe.coupons.create({
            percent_off: userData.shopDiscountPercent,
            duration: 'once',
            name: `Referral discount for ${context.auth.token.email}`
        });
        sessionData.discounts = [{ coupon: coupon.id }];
    }


    try {
        const session = await stripe.checkout.sessions.create(sessionData);
        return { id: session.id };
    } catch (error) {
        console.error("Stripe session creation failed:", error);
        throw new functions.https.HttpsError('internal', 'Unable to create Stripe checkout session.');
    }
});
