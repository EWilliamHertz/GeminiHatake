/**
 * api.js
 * Handles all external API calls (Scryfall, Pokémon TCG via Firebase) and Firestore interactions.
 */

// Firebase must be initialized in auth.js
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();
const searchPokemonCloudFunction = functions.httpsCallable('searchPokemon');

// --- CARD SEARCH APIS ---

/**
 * Searches for cards from either MTG or Pokémon API.
 * @param {string} cardName - The name of the card to search for.
 * @param {string} game - 'mtg' or 'pokemon'.
 * @returns {Promise<Array>} A promise that resolves to an array of cleaned card data.
 */
export async function searchCards(cardName, game) {
    if (game === 'mtg') {
        return searchScryfall(cardName);
    } else if (game === 'pokemon') {
        return searchPokemon(cardName);
    }
    return [];
}

/**
 * Searches the Scryfall API for Magic: The Gathering cards.
 * @param {string} cardName - The card name.
 * @returns {Promise<Array>} Array of cleaned Scryfall card objects.
 */
async function searchScryfall(cardName) {
    try {
        const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints`);
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
 * Calls the secure Firebase Cloud Function to search the Pokémon TCG API.
 * @param {string} cardName - The card name.
 * @returns {Promise<Array>} Array of cleaned Pokémon card objects.
 */
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


// --- DATA CLEANING ---

/**
 * Standardizes Scryfall API data into a consistent format.
 * @param {object} card - Raw card object from Scryfall.
 * @returns {object} A cleaned card object.
 */
function cleanScryfallData(card) {
    return {
        api_id: card.id,
        name: card.name,
        set: card.set,
        set_name: card.set_name,
        rarity: card.rarity,
        image_uris: card.image_uris,
        card_faces: card.card_faces, // For multi-faced cards
        prices: card.prices,
        mana_cost: card.mana_cost,
        cmc: card.cmc,
        type_line: card.type_line,
        color_identity: card.color_identity,
        game: 'mtg'
    };
}

/**
 * Standardizes Pokémon TCG API data into a consistent format.
 * @param {object} card - Raw card object from Pokémon TCG API.
 * @returns {object} A cleaned card object.
 */
function cleanPokemonData(card) {
    return {
        api_id: card.id,
        name: card.name,
        set: card.set.id,
        set_name: card.set.name,
        rarity: card.rarity || 'Common',
        images: card.images,
        prices: {
            // Mapping Pokémon TCGPlayer prices to a Scryfall-like structure
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

/**
 * Fetches the user's entire card collection from Firestore.
 * @param {string} userId - The user's UID.
 * @returns {Promise<Array>} An array of card objects from the collection.
 */
export async function getCollection(userId) {
    const snapshot = await getCollectionRef(userId).orderBy('addedAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Fetches the user's wishlist from Firestore.
 * @param {string} userId - The user's UID.
 * @returns {Promise<Array>} An array of card objects from the wishlist.
 */
export async function getWishlist(userId) {
    const snapshot = await getWishlistRef(userId).orderBy('addedAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Adds a new card entry to the user's collection in Firestore.
 * @param {string} userId - The user's UID.
 * @param {object} cardData - The complete card object to add.
 * @returns {Promise<string>} The ID of the newly created document.
 */
export async function addCardToCollection(userId, cardData) {
    const docRef = await getCollectionRef(userId).add(cardData);
    return docRef.id;
}

/**
 * Updates an existing card in the user's collection.
 * @param {string} userId - The user's UID.
 * @param {string} cardId - The Firestore document ID of the card.
 * @param {object} updates - An object with the fields to update.
 */
export async function updateCardInCollection(userId, cardId, updates) {
    await getCollectionRef(userId).doc(cardId).update(updates);
}

/**
 * Deletes a card from the user's collection.
 * @param {string} userId - The user's UID.
 * @param {string} cardId - The Firestore document ID of the card.
 */
export async function deleteCardFromCollection(userId, cardId) {
    await getCollectionRef(userId).doc(cardId).delete();
}

/**
 * Performs a batch delete operation.
 * @param {string} userId
 * @param {Array<string>} cardIds
 */
export async function batchDeleteCards(userId, cardIds) {
    const batch = db.batch();
    const collectionRef = getCollectionRef(userId);
    cardIds.forEach(id => {
        batch.delete(collectionRef.doc(id));
    });
    await batch.commit();
}

/**
 * Performs a batch update operation.
 * @param {string} userId
 * @param {Array<object>} updates - Array of {id, data} objects.
 */
export async function batchUpdateCards(userId, updates) {
    const batch = db.batch();
    const collectionRef = getCollectionRef(userId);
    updates.forEach(update => {
        batch.update(collectionRef.doc(update.id), update.data);
    });
    await batch.commit();
}


// --- FIREBASE STORAGE OPERATIONS ---

/**
 * Uploads a custom image for a card to Firebase Storage.
 * @param {string} userId - The user's UID.
 * @param {string} cardId - The Firestore document ID of the card.
 * @param {File} file - The image file to upload.
 * @returns {Promise<string>} The download URL of the uploaded image.
 */
export async function uploadCustomImage(userId, cardId, file) {
    const filePath = `users/${userId}/collection_images/${cardId}/${file.name}`;
    const fileRef = storage.ref(filePath);
    const snapshot = await fileRef.put(file);
    return snapshot.ref.getDownloadURL();
}