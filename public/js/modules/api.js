/**
 * api.js
 * Final, stable version with corrected ScryDex integration and error handling.
 * Handles all external API calls (Scryfall, ScryDex via Firebase) and Firestore interactions.
 * Supports multiple TCGs and user-selectable price regions.
 */

import { debounce } from './utils.js';

const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();

// ScryDex cloud function
const searchScryDexFunction = functions.httpsCallable('searchScryDex');

// --- CARD SEARCH APIS ---

/**
 * Main search router with improved error handling.
 * For MTG, it checks the user's preference for EU (Scryfall) or US (ScryDex) prices.
 * For all other games, it defaults to ScryDex.
 */
export async function searchCards(cardName, game) {
    console.log(`[API] Searching for "${cardName}" in game: ${game}`);

    if (!cardName || cardName.trim().length < 2) {
        throw new Error('Card name must be at least 2 characters long.');
    }

    const priceProvider = localStorage.getItem('priceProvider') || 'scryfall';

    try {
        if (game === 'mtg' && priceProvider === 'scryfall') {
            console.log('[API] Using Scryfall for MTG with EU prices');
            return await searchScryfall(cardName);
        }

        console.log(`[API] Using ScryDex for ${game}`);
        return await searchScryDex(cardName, game);
    } catch (error) {
        console.error(`[API] Search failed for "${cardName}" in ${game}:`, error);
        throw new Error(`Failed to search for cards: ${error.message}`);
    }
}

/**
 * Fetches card data directly from Scryfall for EU pricing with improved error handling.
 */
async function searchScryfall(cardName) {
    const encodedUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints`;

    try {
        console.log('[API] Making Scryfall request:', encodedUrl);
        await new Promise(resolve => setTimeout(resolve, 100)); // Respect rate limits
        const response = await fetch(encodedUrl);

        if (!response.ok) {
            if (response.status === 404) return []; // A 404 from Scryfall means no cards were found
            const errorData = await response.json().catch(() => ({ details: 'Unknown error' }));
            throw new Error(errorData.details || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.data || !Array.isArray(data.data)) {
            return [];
        }

        console.log(`[API] Scryfall returned ${data.data.length} results`);
        return data.data.map(card => cleanScryfallData(card));
    } catch (error) {
        console.error('[API] Scryfall API error:', error);
        throw error;
    }
}

/**
 * FIX: Fetches card data using the cloud function and correctly parses the nested response.
 */
async function searchScryDex(cardName, game) {
    try {
        console.log(`[API] Calling ScryDex function for ${game} with query: "${cardName}"`);
        const result = await searchScryDexFunction({ cardName, game });
        console.log('[API] ScryDex function raw result:', result);

        // **CRITICAL FIX IS HERE:** Restore the original robust response handling.
        // The result from a callable function has the data nested. The cloud function itself
        // also returns an object with a 'data' key, leading to result.data.data.
        let cardData;
        if (result && result.data && Array.isArray(result.data.data)) {
            cardData = result.data.data;
        } else if (result && Array.isArray(result.data)) {
            cardData = result.data;
        } else {
             console.warn('[API] Unexpected ScryDex response format:', result);
            cardData = [];
        }

        if (cardData.length === 0) {
            console.log('[API] ScryDex returned 0 results.');
            return [];
        }

        console.log(`[API] ScryDex returned ${cardData.length} results`);
        return cardData.map(card => cleanScryDexData(card, game));

    } catch (error) {
        console.error(`[API] ScryDex search function error for ${game}:`, error);
        if (error.code === 'functions/not-found') {
            throw new Error('ScryDex search service is currently unavailable.');
        } else if (error.code === 'functions/permission-denied' || error.code === 'functions/unauthenticated') {
            throw new Error('Authentication required. Please log in again.');
        }
        throw new Error(error.message || `Could not fetch ${game} cards from ScryDex.`);
    }
}

/**
 * A debounced version of the searchCards function to limit API calls while typing.
 */
export const debouncedSearchCards = debounce(searchCards, 300);


// --- DATA CLEANING ---

/**
 * Cleans data from a Scryfall API response.
 */
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

/**
 * REWRITTEN: Cleans data from a ScryDex API response based on official documentation.
 * This fixes all known issues with names, sets, images, and prices.
 */
function cleanScryDexData(card, game) {
    try {
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
            prices: card.variants?.reduce((acc, variant) => {
                if (variant.prices) {
                    variant.prices.forEach(price => {
                        // Create a unique key for each price type, e.g., "reverseHolofoil_NM"
                        const priceKey = `${variant.name}_${price.condition || price.type}`;
                        acc[priceKey] = price.market;
                    });
                }
                return acc;
            }, {}),
            collector_number: card.number || '',
            game: game
        };

        // Add game-specific details from the documentation
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
const getCollectionRef = (userId) => db.collection('users').doc(userId).collection('collection');
const getWishlistRef = (userId) => db.collection('users').doc(userId).collection('wishlist');

export async function getCollection(userId) {
    const snapshot = await getCollectionRef(userId).orderBy('addedAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function getWishlist(userId) {
    const snapshot = await getWishlistRef(userId).orderBy('addedAt', 'desc').get();
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
export async function uploadCustomImage(userId, cardId, file) {
    const filePath = `users/${userId}/collection_images/${cardId}/${file.name}`;
    const fileRef = storage.ref(filePath);
    const snapshot = await fileRef.put(file);
    return snapshot.ref.getDownloadURL();
}
export async function getUserProfile(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.exists ? userDoc.data() : null;
}