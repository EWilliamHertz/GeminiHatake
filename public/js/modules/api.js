// public/js/modules/api.js

/**
 * api.js
 * Handles all external API calls (Scryfall, Pokémon TCG via Firebase) and Firestore interactions.
 */

import { debounce } from './utils.js';

const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();
const searchPokemonCloudFunction = functions.httpsCallable('searchPokemon');

// --- CARD SEARCH APIS ---
export async function searchCards(cardName, game) {
    if (game === 'mtg') {
        return searchScryfall(cardName);
    } else if (game === 'pokemon') {
        return searchPokemon(cardName);
    }
    return [];
}

async function searchScryfall(cardName) {
    // Correctly encode the URL to handle special characters
    const encodedUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints`;
    try {
        // Added a 100ms delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
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

async function searchPokemon(cardName) {
    try {
        const result = await searchPokemonCloudFunction({ cardName });
        if (!result.data) {
            throw new Error("Invalid response from Pokémon search function.");
        }
        return result.data.map(card => cleanPokemonData(card));
    } catch (error) {
        console.error("Pokémon search function error:", error);
        throw new Error(error.message || 'Could not fetch Pokémon cards.');
    }
}

/**
 * A debounced version of the searchCards function to limit API calls while typing.
 */
export const debouncedSearchCards = debounce(searchCards, 300);


// --- DATA CLEANING ---
function cleanScryfallData(card) {
    const prices = card.prices ? {
        usd: card.prices.usd ? parseFloat(card.prices.usd) : null,
        usd_foil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : null,
    } : {
        usd: null,
        usd_foil: null
    };

    // Handle double-faced cards by taking the first face's image URIs and mana cost
    const image_uris = card.image_uris || (card.card_faces && card.card_faces[0].image_uris) || null;
    const mana_cost = card.mana_cost || (card.card_faces && card.card_faces[0].mana_cost) || null;

    return {
        api_id: card.id,
        name: card.name,
        set: card.set,
        set_name: card.set_name,
        rarity: card.rarity,
        image_uris: image_uris,
        card_faces: card.card_faces || null, // Ensure card_faces is not undefined
        prices: prices,
        mana_cost: mana_cost,
        cmc: card.cmc,
        type_line: card.type_line,
        color_identity: card.color_identity,
        collector_number: card.collector_number,
        game: 'mtg'
    };
}

function cleanPokemonData(card) {
    return {
        api_id: card.id,
        name: card.name,
        set: card.set.id,
        set_name: card.set.name,
        rarity: card.rarity || 'Common',
        image_uris: card.images,
        prices: {
            usd: card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market || null,
            usd_foil: card.tcgplayer?.prices?.holofoil?.market || null,
        },
        types: card.types,
        hp: card.hp,
        game: 'pokemon'
    };
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