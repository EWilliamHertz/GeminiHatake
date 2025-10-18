/**
 * api.js
 * Final, stable version with corrected ScryDex integration and error handling.
 * Handles all external API calls (Scryfall, ScryDex via Firebase) and Firestore interactions.
 * Supports multiple TCGs and user-selectable price regions.
 * NEW: Includes function for fetching graded card prices.
 */

import { debounce } from './utils.js';

const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();

// ScryDex cloud function
const searchScryDexFunction = functions.httpsCallable('searchScryDex');
const searchOptcgFunction = functions.httpsCallable('searchOPTCG');
const getScryDexHistoryFunction = functions.httpsCallable('getScryDexHistory');
const getGradedPriceFunction = functions.httpsCallable('getGradedPrice'); // New function for graded prices
// --- CARD SEARCH APIS ---

/**
 * Main search router with improved error handling.
 * For MTG, it checks the user's preference for EU (Scryfall) or US (ScryDex) prices.
 * For all other games, it defaults to ScryDex.
 */
// In public/js/modules/api.js


const scrydexSearchProxy = firebase.functions().httpsCallable('searchScryDex');

/**
 * FIX: Fetches card data using the cloud function and correctly parses the nested response.
 */
/**
 * Searches for cards by calling the backend proxy function, now with pagination.
 * @param {string} query The card name or search query.
 * @param {string} game The TCG to search (e.g., 'pokemon', 'mtg').
 * @param {number} page The page number for pagination.
 * @param {number} limit The number of results per page.
 * @returns {Promise<Array>} A promise that resolves to an array of card objects.
 */
// This is the NEW, CORRECTED code for api.js
// In api.js, REPLACE the entire searchCards function with this:

// In api.js, REPLACE the entire searchCards function with this ORIGINAL, working version:

// In api.js, REPLACE the entire searchCards function with this corrected version:

// In api.js, REPLACE the entire searchCards function with this:

// --- REPLACE the entire searchCards function with this ---
export async function searchCards(rawQuery, game = 'mtg', page = 1, limit = 100) {
    let finalQuery = rawQuery.trim().replace(/[\W_]+$/, '');

    // Exact match wrapping (optional, keep if you like it)
    const hasSpecialChars = /[,'":&]/.test(finalQuery);
    const hasAdvancedSyntax = /[:=]/.test(finalQuery);
    const alreadyWrapped = finalQuery.startsWith('!"') || finalQuery.startsWith('!');
    if ((finalQuery.includes(' ') || hasSpecialChars) && !hasAdvancedSyntax && !alreadyWrapped && game !== 'optcg') { // Don't wrap for OPTCG yet
        const escapedName = finalQuery.replace(/"/g, '\\"');
        finalQuery = `!"${escapedName}"`;
        console.log(`[API] Wrapped query for exact match: ${finalQuery}`);
    }

    try {
        let result;
        if (game === 'optcg') {
            console.log(`[API] Calling searchOPTCG for: "${finalQuery}", page: ${page}`);
            result = await searchOptcgFunction({ query: finalQuery, page: page, limit: limit });
        } else {
            console.log(`[API] Calling searchScryDex for: "${finalQuery}", game: ${game}, page: ${page}`);
            result = await searchScryDexFunction({ query: finalQuery, game: game, page: page, limit: limit });
        }

        console.log(`[API] Raw result for "${finalQuery}" (${game}):`, result); // Log the raw result

        if (result.data && result.data.success) {
            const rawData = result.data.data || [];
            console.log(`[API] Received ${rawData.length} raw results for ${game}. Has more: ${result.data.has_more}`);
            const has_more = result.data.has_more === true;

            // --- USE cleanData function ---
            return {
                cards: rawData.map(card => cleanData(card, game)), // Use the generic cleaner
                has_more: has_more
            };
        } else {
            console.error(`[API] Cloud function returned error for query "${finalQuery}" (${game}):`, result.data?.error);
            return { cards: [], has_more: false };
        }

    } catch (error) {
        console.error(`[API] Error calling the cloud function for query "${finalQuery}" (${game}):`, error);
        return { cards: [], has_more: false };
    }
}

/**
 * A debounced version of the searchCards function to limit API calls while typing.
 */
export const debouncedSearchCards = debounce(searchCards, 300);


/**
 * NEW: Fetches price history by calling the new cloud function.
 */
export async function getScryDexHistory(card) {
    try {
        const result = await getScryDexHistoryFunction({ cardId: card.api_id, game: card.game });
        if (result && result.data && Array.isArray(result.data)) {
            return result.data.map(entry => ({
                date: entry[0],
                price: parseFloat(entry[1])
            }));
        }
        return [];
    } catch (error) {
        console.error(`[API] ScryDex history function error for ${card.name}:`, error);
        return [];
    }
}

/**
 * NEW: Fetches prices for graded cards (Lorcana and Pokemon)
 */
export async function getGradedCardPrice(card, gradingCompany, grade) {
    if (card.game !== 'lorcana' && card.game !== 'pokemon') {
        console.warn(`[API] Graded price lookup not supported for ${card.game}`);
        return null;
    }
    try {
        console.log(`[API] Fetching graded price for ${card.name} (${card.game}), Grade: ${gradingCompany} ${grade}`);
        const result = await getGradedPriceFunction({
            cardId: card.api_id,
            game: card.game,
            grade: `${gradingCompany} ${grade}`
        });

        if (result && result.data && result.data.marketPrice) {
            return {
                price: result.data.marketPrice,
                last_updated: new Date().toISOString()
            };
        }
        return null;
    } catch (error) {
        console.error(`[API] Graded price function error for ${card.name}:`, error);
        return null;
    }
}


// --- DATA CLEANING ---

function cleanScryfallData(card) {
    const prices = card.prices ? {
        usd: card.prices.usd ? parseFloat(card.prices.usd) : null,
        usd_foil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : null,
        eur: card.prices.eur ? parseFloat(card.prices.eur) : null,
        eur_foil: card.prices.eur_foil ? parseFloat(card.prices.eur_foil) : null,
    } : { usd: null, usd_foil: null, eur: null, eur_foil: null };

    const image_uris = card.image_uris || (card.card_faces && card.card_faces[0].image_uris) || null;
    const mana_cost = card.mana_cost || (card.card_faces && card.card_faces[0].mana_cost) || null;

    return {
        api_id: card.id,
        name: card.name,
        set: card.set,
        set_name: card.set_name,
        rarity: card.rarity,
        image_uris: image_uris,
        card_faces: card.card_faces || null,
        prices: prices,
        mana_cost: mana_cost,
        cmc: card.cmc,
        type_line: card.type_line,
        color_identity: card.color_identity,
        collector_number: card.collector_number,
        game: 'mtg'
    };
}

// In api.js, REPLACE the entire cleanScryDexData function with this:

// --- RENAME cleanScryDexData to cleanData AND MODIFY ---
// This function now handles cleaning for BOTH ScryDex and OPTCG
function cleanData(card, game) {
    try {
        // --- Shared fields ---
        let cleaned = {
            api_id: card.id || card.api_id, // Use 'id' from backend as primary
            name: card.name || card.Name || 'Unknown Card',
            set: card.expansion?.id || card.set || 'unknown', // Handle both structures
            set_name: card.expansion?.name || card.set_name || 'Unknown Set', // Handle both structures
            rarity: card.rarity || 'Common',
            image_uris: card.image_uris || { // Prefer image_uris if present
                small: card.images?.[0]?.small || null,
                normal: card.images?.[0]?.medium || null,
                large: card.images?.[0]?.large || null,
            },
            collector_number: card.number || card.collector_number || '', // Handle both
            game: game,
            prices: { usd: null, usd_foil: null, eur: null, eur_foil: null } // Initialize prices
        };

        // --- Price Logic ---
        if (game === 'optcg') {
            // Use prices directly from the formatted OPTCG data
            cleaned.prices = card.prices || { usd: null, usd_foil: null, eur: null, eur_foil: null };
            // Copy OPTCG specific details
            cleaned.optcg_details = card.optcg_details || {};

        } else { // ScryDex or other games
            // ScryDex variant price logic
             if (card.variants && Array.isArray(card.variants)) {
                 card.variants.forEach(variant => {
                     const priceData = variant.prices && variant.prices[0]; // Assuming first price is market
                     if (priceData?.market) {
                         const price = parseFloat(priceData.market);
                         if (variant.name.toLowerCase().includes('foil')) {
                             cleaned.prices.usd_foil = price;
                         } else { // Assume non-foil otherwise
                             cleaned.prices.usd = price;
                         }
                     }
                 });
             }
             // Fallback using root prices if variants didn't work
             if (cleaned.prices.usd === null && card.prices?.usd) cleaned.prices.usd = parseFloat(card.prices.usd);
             if (cleaned.prices.usd_foil === null && card.prices?.usd_foil) cleaned.prices.usd_foil = parseFloat(card.prices.usd_foil);
        }

        // Ensure image_uris has fallbacks if needed
        if (!cleaned.image_uris.small && cleaned.images?.[0]?.small) {
             cleaned.image_uris = {
                 small: cleaned.images[0].small,
                 normal: cleaned.images[0].medium,
                 large: cleaned.images[0].large
             };
        }


        // --- Game-Specific Fields (from ScryDex raw data if not OPTCG) ---
        if (game !== 'optcg') {
            switch (game) {
                case 'mtg':
                    cleaned.mana_cost = card.mana_cost || '';
                    cleaned.cmc = card.cmc || 0;
                    cleaned.type_line = card.type_line || '';
                    cleaned.oracle_text = card.oracle_text || '';
                    cleaned.color_identity = card.color_identity || [];
                    break;
                case 'pokemon':
                    cleaned.types = card.types || [];
                    cleaned.hp = card.hp || null;
                    cleaned.supertype = card.supertype || '';
                    cleaned.subtypes = card.subtypes || [];
                    break;
                case 'lorcana':
                    cleaned.cost = card.Cost || 0;
                    cleaned.type = card.Type || '';
                    cleaned.color = card.Color || '';
                    cleaned.inkable = card.Inkable || false;
                    cleaned.strength = card.Strength || null;
                    cleaned.willpower = card.Willpower || null;
                    cleaned.lore = card.Lore || null;
                    break;
                case 'gundam':
                    cleaned.code = card.code || '';
                    cleaned.cost = card.cost || 0;
                    cleaned.color = card.color || '';
                    cleaned.card_type = card.card_type || '';
                    break;
                // Add other ScryDex games if needed
            }
        }

        return cleaned;

    } catch (error) {
        console.error(`[API] Error cleaning data for ${game}:`, error, card);
        return { // Return a consistent error structure
            api_id: `${game}_error_${Date.now()}`,
            name: card?.name || 'Error Loading Card',
            set_name: 'Unknown Set',
            rarity: 'Common',
            image_uris: null,
            prices: { usd: null, usd_foil: null },
            game: game
        };
    }
}
// --- FIRESTORE DATABASE OPERATIONS ---
const getCollectionRef = (userId, collectionName = 'collection') => {
    if (!userId || typeof userId !== 'string') {
        throw new Error("Invalid or missing User ID provided for Firestore operation.");
    }
    return db.collection('users').doc(userId).collection(collectionName);
};

export async function getCollection(userId) {
    if (!userId) {
        console.error("No user ID provided to getCollection.");
        return [];
    }
    try {
        const collectionRef = firebase.firestore().collection('users').doc(userId).collection('collection');
        const snapshot = await collectionRef.get();
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching collection from Firestore:", error);
        throw new Error("Could not fetch user collection.");
    }
}
export async function getWishlist(userId) {
    if (!userId) return [];
    const snapshot = await getCollectionRef(userId, 'wishlist').orderBy('addedAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function addCardToCollection(userId, cardData) {
    const docRef = await getCollectionRef(userId).add(cardData);
    return docRef.id;
}
export async function updateCardInCollection(userId, cardId, updates) {
    await getCollectionRef(userId).doc(cardId).update(updates);
}
export async function deleteCardFromCollection(userId, cardId) {
    await getCollectionRef(userId).doc(cardId).delete();
}
export async function batchDeleteCards(userId, cardIds) {
    const batch = db.batch();
    const collectionRef = getCollectionRef(userId);
    cardIds.forEach(id => {
        batch.delete(collectionRef.doc(id));
    });
    await batch.commit();
}
export async function batchUpdateCards(userId, updates) {
    const batch = db.batch();
    const collectionRef = getCollectionRef(userId);
    updates.forEach(update => {
        batch.update(collectionRef.doc(update.id), update.data);
    });
    await batch.commit();
}

export async function batchCreateMarketplaceListings(listings) {
    if (!listings || listings.length === 0) {
        console.log('[API] No listings to create');
        return;
    }

    console.log('[API] Creating', listings.length, 'marketplace listings');
    const batch = db.batch();
    const marketplaceRef = db.collection('marketplaceListings');
    
    listings.forEach(listing => {
        const docRef = marketplaceRef.doc(); // Auto-generate ID
        console.log('[API] Adding listing to batch:', listing.cardData?.name);
        batch.set(docRef, {
            ...listing,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    });
    
    await batch.commit();
    console.log('[API] Successfully created', listings.length, 'marketplace listings');
}

export async function batchRemoveMarketplaceListings(userId, collectionCardIds) {
    // Query marketplace listings by originalCollectionCardId and seller
    const marketplaceRef = db.collection('marketplaceListings');
    const batch = db.batch();
    
    for (const cardId of collectionCardIds) {
        const querySnapshot = await marketplaceRef
            .where('originalCollectionCardId', '==', cardId)
            .where('sellerData.uid', '==', userId)
            .get();
        
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
    }
    
    await batch.commit();
}
export async function uploadCustomImage(userId, cardId, file) {
    const filePath = `users/${userId}/collection_images/${cardId}/${file.name}`;
    const fileRef = storage.ref(filePath);
    const snapshot = await fileRef.put(file);
    return snapshot.ref.getDownloadURL();
}
export async function getUserProfile(userId) {
    if (!userId) return null;
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists ? userDoc.data() : null;
}