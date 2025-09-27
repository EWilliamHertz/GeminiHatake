// public/js/modules/api.js

/**
 * api.js
 * Final, stable version with corrected ScryDex integration and error handling.
 * Handles all external API calls (Scryfall, ScryDex via Firebase) and Firestore interactions.
 */

import { debounce } from './utils.js';

// --- Firebase Initialization ---
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();

// --- Callable Cloud Function ---
const searchScryDexFunction = functions.httpsCallable('searchScryDex');

// =================================================================================================
// PRIMARY EXPORTED FUNCTIONS
// =================================================================================================

/**
 * Main search router. Routes between Scryfall and ScryDex based on user preference and game.
 * @param {string} cardName - The name of the card to search for.
 * @param {string} game - The game to search within (e.g., 'mtg', 'pokemon').
 * @returns {Promise<Array>} A promise that resolves to an array of cleaned card objects.
 */
export async function searchCards(cardName, game) {
    console.log(`[API] Searching for "${cardName}" in game: ${game}`);
    if (!cardName || cardName.trim().length < 2) {
        throw new Error('Card name must be at least 2 characters long.');
    }

    try {
        const priceProvider = localStorage.getItem('priceProvider') || 'scryfall';
        if (game === 'mtg' && priceProvider === 'scryfall') {
            return await searchScryfall(cardName);
        }
        return await searchScryDex(cardName, game);
    } catch (error) {
        console.error(`[API] Search failed for "${cardName}" in ${game}:`, error);
        throw new Error(`Failed to search for cards: ${error.message}`);
    }
}

/**
 * Fetches the full details for a single card by its ID and game.
 * @param {string} cardId - The unique ID of the card.
 * @param {string} game - The game the card belongs to.
 * @returns {Promise<Object>} A promise that resolves to a single cleaned card object.
 */
export async function getCardDetails(cardId, game) {
    console.log(`[API] Fetching details for cardId "${cardId}" in game: ${game}`);
    try {
        const result = await searchScryDexFunction({ cardId, game });
        const cardData = result.data;
        if (!cardData) {
            throw new Error('Card data could not be fetched from the API.');
        }
        return cleanScryDexData(cardData, game);
    } catch (error) {
        console.error(`[API] Get details failed for "${cardId}":`, error);
        throw new Error(`Failed to get card details: ${error.message}`);
    }
}

/**
 * A debounced version of the searchCards function to limit API calls while typing.
 */
export const debouncedSearchCards = debounce(searchCards, 300);


// =================================================================================================
// INTERNAL API HANDLERS
// =================================================================================================

/**
 * Fetches card data directly from Scryfall.
 */
async function searchScryfall(cardName) {
    const encodedUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints`;
    try {
        await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
        const response = await fetch(encodedUrl);
        if (!response.ok) {
            if (response.status === 404) return [];
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.details || `HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        return (data.data || []).map(cleanScryfallData);
    } catch (error) {
        console.error('[API] Scryfall API error:', error);
        throw error;
    }
}

/**
 * Fetches card data using our ScryDex cloud function.
 */
async function searchScryDex(cardName, game) {
    try {
        const result = await searchScryDexFunction({ cardName, game });
        const cardData = result && Array.isArray(result.data) ? result.data : [];
        console.log(`[API] ScryDex returned ${cardData.length} results`);
        return cardData.map(card => cleanScryDexData(card, game));
    } catch (error) {
        console.error(`[API] ScryDex function error for ${game}:`, error);
        throw new Error(error.message || `Could not fetch ${game} cards.`);
    }
}


// =================================================================================================
// DATA CLEANING & NORMALIZATION
// =================================================================================================

/**
 * Cleans and standardizes data from a Scryfall API response.
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
        api_id: card.id, name: card.name, set: card.set, set_name: card.set_name, rarity: card.rarity,
        image_uris: image_uris, card_faces: card.card_faces || null, prices: prices, mana_cost: mana_cost,
        cmc: card.cmc, type_line: card.type_line, color_identity: card.color_identity,
        collector_number: card.collector_number, game: 'mtg', raw: card
    };
}

/**
 * Cleans and standardizes data from a ScryDex API response.
 */
function cleanScryDexData(card, game) {
    try {
        const cleaned = {
            api_id: card.id, name: card.Name || card.name || 'Unknown Card', set: card.expansion?.id || 'unknown',
            set_name: card.expansion?.name || 'Unknown Set', rarity: card.rarity || 'Common',
            image_uris: {
                small: card.images?.[0]?.small || null, normal: card.images?.[0]?.medium || null,
                large: card.images?.[0]?.large || null,
            },
            prices: card.variants?.reduce((acc, variant) => {
                if (variant.prices) {
                    variant.prices.forEach(price => { acc[`${variant.name.toLowerCase()}_${price.type}`] = price.market; });
                }
                return acc;
            }, {}),
            collector_number: card.number || '', game: game, raw: card
        };

        switch (game) {
            case 'mtg':
                Object.assign(cleaned, { mana_cost: card.mana_cost || '', cmc: card.cmc || 0, type_line: card.type_line || '', oracle_text: card.oracle_text || '', color_identity: card.color_identity || [] });
                break;
            case 'pokemon':
                Object.assign(cleaned, { types: card.types || [], hp: card.hp || null, supertype: card.supertype || '', subtypes: card.subtypes || [] });
                break;
            case 'lorcana':
                Object.assign(cleaned, { cost: card.Cost || 0, type: card.Type || '', color: card.Color || '', inkable: card.Inkable || false, strength: card.Strength || null, willpower: card.Willpower || null, lore: card.Lore || null });
                break;
            case 'gundam':
                Object.assign(cleaned, { code: card.code || '', cost: card.cost || 0, color: card.color || '', card_type: card.card_type || '' });
                break;
        }
        return cleaned;
    } catch (error) {
        console.error(`[API] Error cleaning ScryDex data for ${game}:`, error, card);
        return {
            api_id: `${game}_error_${Date.now()}`, name: card.name || 'Error Loading Card', set_name: 'Unknown Set',
            rarity: 'Common', image_uris: null, prices: { usd: null, usd_foil: null }, game: game
        };
    }
}


// =================================================================================================
// FIRESTORE DATABASE OPERATIONS
// =================================================================================================

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
    cardIds.forEach(id => { batch.delete(collectionRef.doc(id)); });
    await batch.commit();
}

export async function batchUpdateCards(userId, updates) {
    const batch = db.batch();
    const collectionRef = getCollectionRef(userId);
    updates.forEach(update => { batch.update(collectionRef.doc(update.id), update.data); });
    await batch.commit();
}

export async function uploadCustomImage(userId, cardId, file) {
    const filePath = `users/${userId}/collection_images/${cardId}/${file.name}`;
    const fileRef = storage.ref(filePath);
    const snapshot = await fileRef.put(file);
    return snapshot.ref.getDownloadURL();
}