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
export async function searchCards(query, game = 'mtg', page = 1, limit = 100) {
    try {
        console.log(`[API] Proxying search for: "${query}", game: ${game}, page: ${page}`);
        
        // This object is securely sent to your Firebase Function.
        const result = await scrydexSearchProxy({
            query: query,
            game: game,
            page: page,
            limit: limit
        });

      if (result.data && result.data.success) {
    const rawData = result.data.data || [];
    // Return an object instead of just the array
    return {
        cards: rawData.map(card => cleanScryDexData(card, game)),
        has_more: result.data.has_more 
    };
}else {
            // If the backend returned a specific error message, show it.
            throw new Error(result.data.error || 'The API proxy returned an unspecified error.');
        }

    } catch (error) {
        console.error(`[API] Error calling the 'scrydexSearch' proxy function:`, error);
        // Rethrow the error so the UI can display a helpful message.
        throw error;
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

function cleanScryDexData(card, game) {
    try {
        console.log('[API] Raw ScryDex card data:', card);
        
        // Process prices with better fallback handling
        let prices = {};
        
        // Try to extract prices from variants structure
        if (card.variants && Array.isArray(card.variants)) {
            card.variants.forEach(variant => {
                if (variant.prices && Array.isArray(variant.prices)) {
                    variant.prices.forEach(price => {
                        if (price.market && price.market > 0) {
                            const priceKey = `${variant.name || 'normal'}_${price.condition || price.type || 'market'}`;
                            prices[priceKey] = price.market;
                            
                            // Also set standard USD price for compatibility
                            if (!prices.usd || price.market > prices.usd) {
                                prices.usd = price.market;
                            }
                        }
                    });
                }
            });
        }
        
        // Fallback: try direct price fields
        if (Object.keys(prices).length === 0) {
            if (card.market_price && card.market_price > 0) {
                prices.usd = card.market_price;
            } else if (card.price && card.price > 0) {
                prices.usd = card.price;
            } else if (card.marketPrice && card.marketPrice > 0) {
                prices.usd = card.marketPrice;
            }
        }
        
        console.log('[API] Processed prices for', card.Name || card.name, ':', prices);
        
        const cleaned = {
            api_id: card.id,
            name: card.Name || card.name || 'Unknown Card',
            set: card.expansion?.id || 'unknown',
            set_name: card.expansion?.name || 'Unknown Set',
            rarity: card.rarity || 'Common',
            image_uris: {
                small: card.images?.[0]?.small || null,
                normal: card.images?.[0]?.medium || null,
                large: card.images?.[0]?.large || null,
            },
            prices: prices,
            collector_number: card.number || '',
            game: game
        };

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
        }
        return cleaned;
    } catch (error) {
        console.error(`[API] Error cleaning ScryDex data for ${game}:`, error, card);
        return {
            api_id: `${game}_error_${Date.now()}`,
            name: card.name || 'Error Loading Card',
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
