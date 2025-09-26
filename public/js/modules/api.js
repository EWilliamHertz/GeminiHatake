// public/js/modules/api.js

/**
 * api.js
 * Handles all external API calls (Scryfall, ScryDex via Firebase) and Firestore interactions.
 * Supports multiple TCGs and user-selectable price regions.
 */

import { debounce } from './utils.js';

const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();
// New, all-purpose cloud function
const searchScryDexFunction = functions.httpsCallable('searchScryDex');

// --- CARD SEARCH APIS ---

/**
 * Main search router.
 * For MTG, it checks the user's preference for EU (Scryfall) or US (ScryDex) prices.
 * For all other games, it defaults to ScryDex.
 */
export async function searchCards(cardName, game) {
    // Read the user's choice from localStorage. Default to 'scryfall' for EU prices.
    const priceProvider = localStorage.getItem('priceProvider') || 'scryfall';

    // If the game is MTG AND the user wants EU prices, use the direct Scryfall function.
    if (game === 'mtg' && priceProvider === 'scryfall') {
        return searchScryfall(cardName);
    }

    // For ALL other games (Pokemon, Lorcana, Gundam) OR if the user chose US prices for MTG,
    // use the new, secure ScryDex cloud function.
    return searchScryDex(cardName, game);
}

/**
 * Fetches card data directly from Scryfall for EU pricing.
 */
async function searchScryfall(cardName) {
    const encodedUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints`;
    try {
        await new Promise(resolve => setTimeout(resolve, 100)); // Respect rate limits
        const response = await fetch(encodedUrl);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || 'Card not found.');
        }
        const data = await response.json();
        return data.data.map(card => cleanScryfallData(card));
    } catch (error) {
        console.error("Scryfall API error:", error);
        throw error;
    }
}

/**
 * Fetches card data from our secure ScryDex cloud function.
 * This handles MTG (US prices), Pokemon, Lorcana, and Gundam.
 */
async function searchScryDex(cardName, game) {
    try {
        // Call the new callable function with the game parameter
        const result = await searchScryDexFunction({ cardName, game });
        // The actual card data is now at result.data.data
        if (result.data && Array.isArray(result.data)) {
            return result.data.map(card => cleanScryDexData(card, game));
        }
        return []; // Return empty array if data is not in the expected format
    } catch (error) {
        console.error(`ScryDex search function error for ${game}:`, error);
        throw new Error(error.message || `Could not fetch ${game} cards.`);
    }
}

/**
 * A debounced version of the searchCards function to limit API calls while typing.
 */
export const debouncedSearchCards = debounce(searchCards, 300);


// --- DATA CLEANING ---

/**
 * Cleans data from a Scryfall API response.
 * Now includes EUR prices.
 */
function cleanScryfallData(card) {
    const prices = card.prices ? {
        usd: card.prices.usd ? parseFloat(card.prices.usd) : null,
        usd_foil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : null,
        eur: card.prices.eur ? parseFloat(card.prices.eur) : null,
        eur_foil: card.prices.eur_foil ? parseFloat(card.prices.eur_foil) : null,
    } : {
        usd: null,
        usd_foil: null,
        eur: null,
        eur_foil: null
    };

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
 * Cleans data from a ScryDex API response for any game.
 */
function cleanScryDexData(card, game) {
    const cleaned = {
        api_id: card.id,
        name: card.name,
        set: card.set?.id || card.Set_ID,
        set_name: card.set?.name || card.Set_Name,
        rarity: card.rarity || 'N/A',
        image_uris: card.image_uris || card.images || (card.Image ? { normal: card.Image } : null),
        prices: {
            usd: card.prices?.low || card.prices?.market || null,
            usd_foil: card.prices?.foil_low || card.prices?.foil_market || null,
        },
        game: game
    };

    // Add game-specific details
    switch (game) {
        case 'mtg':
            cleaned.mana_cost = card.mana_cost;
            cleaned.cmc = card.cmc;
            cleaned.type_line = card.type_line;
            cleaned.oracle_text = card.oracle_text;
            cleaned.rulings = card.rulings;
            cleaned.color_identity = card.color_identity;
            cleaned.collector_number = card.collector_number;
            break;
        case 'pokemon':
            cleaned.types = card.types;
            cleaned.hp = card.hp;
            cleaned.supertype = card.supertype;
            cleaned.subtypes = card.subtypes;
            cleaned.abilities = card.abilities;
            cleaned.attacks = card.attacks;
            cleaned.weaknesses = card.weaknesses;
            cleaned.resistances = card.resistances;
            cleaned.retreat_cost = card.retreatCost;
            cleaned.artist = card.artist;
            cleaned.flavor_text = card.flavorText;
            break;
        case 'lorcana':
            // Override name for Lorcana since it uses capital Name
            cleaned.name = card.Name || card.name;
            cleaned.cost = card.Cost;
            cleaned.type = card.Type;
            cleaned.color = card.Color;
            cleaned.inkable = card.Inkable;
            cleaned.body_text = card.Body_Text;
            cleaned.flavor_text = card.Flavor_Text;
            cleaned.artist = card.Artist;
            cleaned.classifications = card.Classifications;
            cleaned.strength = card.Strength;
            cleaned.willpower = card.Willpower;
            cleaned.lore = card.Lore;
            break;
        case 'gundam':
            cleaned.code = card.code;
            cleaned.level = card.level;
            cleaned.cost = card.cost;
            cleaned.color = card.color;
            cleaned.card_type = card.cardType;
            cleaned.effect = card.effect;
            cleaned.zone = card.zone;
            cleaned.trait = card.trait;
            cleaned.link = card.link;
            cleaned.ap = card.ap;
            cleaned.hp = card.hp;
            cleaned.source_title = card.sourceTitle;
            break;
    }

    return cleaned;
}


// --- FIRESTORE DATABASE OPERATIONS ---
const getCollectionRef = (userId) => db.collection('users').doc(userId).collection('collection');
const getWishlistRef = (userId) => db.collection('users').doc(userId).collection('wishlist');

export async function getCollection(userId) {
    const snapshot = await getCollectionRef(userId).orderBy('addedAt', 'desc').get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}
export async function getWishlist(userId) {
    const snapshot = await getWishlistRef(userId).orderBy('addedAt', 'desc').get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
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