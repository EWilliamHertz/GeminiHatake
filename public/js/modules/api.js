/**
 * api.js
 * Handles all external API calls (Scryfall, Pokémon TCG via Firebase) and Firestore interactions.
 */

const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();
const searchPokemonCloudFunction = functions.httpsCallable('searchPokemon');

// --- CARD SEARCH APIS ---
export async function searchCards(cardName, game) {
    if (game === 'mtg') { return searchScryfall(cardName); }
    else if (game === 'pokemon') { return searchPokemon(cardName); }
    return [];
}

async function searchScryfall(cardName) {
    try {
        // FIX: Re-added '&unique=prints' to ensure all printings of a card are fetched.
        const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints`);
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.details || 'Card not found.'); }
        const data = await response.json();
        return data.data.map(card => cleanScryfallData(card));
    } catch (error) { console.error("Scryfall API error:", error); throw error; }
}

async function searchPokemon(cardName) {
    try {
        const result = await searchPokemonCloudFunction({ cardName });
        if (!result.data) { throw new Error("Invalid response from Pokémon search function."); }
        return result.data.map(card => cleanPokemonData(card));
    } catch (error) { console.error("Pokémon search function error:", error); throw new Error(error.message || 'Could not fetch Pokémon cards.'); }
}

// --- DATA CLEANING ---
function cleanScryfallData(card) {
    return {
        api_id: card.id,
        name: card.name,
        set: card.set,
        set_name: card.set_name,
        rarity: card.rarity,
        image_uris: card.image_uris,
        card_faces: card.card_faces,
        prices: card.prices,
        mana_cost: card.mana_cost,
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
        // FIX: Changed 'images' property to 'image_uris' to match the Firestore data structure
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

export async function getCollection(userId) { const snapshot = await getCollectionRef(userId).orderBy('addedAt', 'desc').get(); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
export async function getWishlist(userId) { const snapshot = await getWishlistRef(userId).orderBy('addedAt', 'desc').get(); return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
export async function addCardToCollection(userId, cardData) { const docRef = await getCollectionRef(userId).add(cardData); return docRef.id; }
export async function updateCardInCollection(userId, cardId, updates) { await getCollectionRef(userId).doc(cardId).update(updates); }
export async function deleteCardFromCollection(userId, cardId) { await getCollectionRef(userId).doc(cardId).delete(); }
export async function batchDeleteCards(userId, cardIds) { const batch = db.batch(); const collectionRef = getCollectionRef(userId); cardIds.forEach(id => { batch.delete(collectionRef.doc(id)); }); await batch.commit(); }
export async function batchUpdateCards(userId, updates) { const batch = db.batch(); const collectionRef = getCollectionRef(userId); updates.forEach(update => { batch.update(collectionRef.doc(update.id), update.data); }); await batch.commit(); }
export async function uploadCustomImage(userId, cardId, file) { const filePath = `users/${userId}/collection_images/${cardId}/${file.name}`; const fileRef = storage.ref(filePath); const snapshot = await fileRef.put(file); return snapshot.ref.getDownloadURL(); }