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
    const encodedUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints`;
    try {
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
    const functionUrl = 'https://us-central1-hatakesocial-88b5e.cloudfunctions.net/searchPokemon';
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: { cardName: cardName } })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch Pokémon cards.');
        }

        const result = await response.json();
        return result.data.map(card => cleanPokemonData(card));

    } catch (error) {
        console.error("Pokémon search function error:", error);
        throw new Error(error.message || 'Could not fetch Pokémon cards.');
    }
}

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
    const image_uris = card.image_uris || (card.card_faces && card.card_faces[0].image_uris) || null;
    const mana_cost = card.mana_cost || (card.card_faces && card.card_faces[0].mana_cost) || null;

    return {
        api_id: card.id, name: card.name, set: card.set, set_name: card.set_name, rarity: card.rarity,
        image_uris: image_uris, card_faces: card.card_faces || null, prices: prices, mana_cost: mana_cost,
        cmc: card.cmc, type_line: card.type_line, color_identity: card.color_identity,
        collector_number: card.collector_number, game: 'mtg'
    };
}

function cleanPokemonData(card) {
    return {
        api_id: card.id, name: card.name, set: card.set.id, set_name: card.set.name,
        rarity: card.rarity || 'Common', image_uris: card.images,
        prices: {
            usd: card.tcgplayer?.prices?.holofoil?.market || card.tcgplayer?.prices?.normal?.market || null,
            usd_foil: card.tcgplayer?.prices?.holofoil?.market || null,
        },
        types: card.types, hp: card.hp, game: 'pokemon'
    };
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
    const cardRef = getCollectionRef(userId).doc(cardId);
    const userProfileDoc = await db.collection('users').doc(userId).get();
    const userProfile = userProfileDoc.exists ? userProfileDoc.data() : {};

    if (updates.forSale === true) {
        const cardDoc = await cardRef.get();
        if (cardDoc.exists) {
            const cardData = cardDoc.data();
            const listingData = {
                cardData: { ...cardData, ...updates },
                sellerData: {
                    uid: userId,
                    displayName: userProfile.displayName || 'Anonymous',
                    photoURL: userProfile.photoURL || '/images/default-avatar.png',
                    country: userProfile.country || 'Unknown'
                },
                price: updates.price,
                condition: updates.condition || cardData.condition,
                isFoil: cardData.is_foil,
                listedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const forSaleRef = db.collection('users').doc(userId).collection('forSale').doc(cardId);
            await forSaleRef.set(listingData);
        }
    } else if (updates.forSale === false) {
        const forSaleRef = db.collection('users').doc(userId).collection('forSale').doc(cardId);
        await forSaleRef.delete().catch(err => console.warn("Listing already removed or not found."));
    }
    await cardRef.update(updates);
}

export async function deleteCardFromCollection(userId, cardId) {
    const forSaleRef = db.collection('users').doc(userId).collection('forSale').doc(cardId);
    await forSaleRef.delete().catch(err => console.log("No matching marketplace listing to delete."));
    await getCollectionRef(userId).doc(cardId).delete();
}

export async function batchDeleteCards(userId, cardIds) {
    const batch = db.batch();
    const collectionRef = getCollectionRef(userId);
    const forSaleCollectionRef = db.collection('users').doc(userId).collection('forSale');
    cardIds.forEach(id => {
        batch.delete(collectionRef.doc(id));
        batch.delete(forSaleCollectionRef.doc(id));
    });
    await batch.commit();
}

// --- MODIFICATION START ---
// This function no longer reads from the database. It expects all data to be pre-packaged.
export async function batchUpdateCards(userId, cardUpdates) {
    const batch = db.batch();
    const collectionRef = getCollectionRef(userId);
    const forSaleCollectionRef = db.collection('users').doc(userId).collection('forSale');
    const userProfileDoc = await db.collection('users').doc(userId).get();
    const userProfile = userProfileDoc.exists ? userProfileDoc.data() : {};

    for (const update of cardUpdates) {
        const cardRef = collectionRef.doc(update.id);
        const forSaleRef = forSaleCollectionRef.doc(update.id);

        batch.update(cardRef, update.data); // Update the card in the main collection

        if (update.data.forSale === true) {
            // Create the listing data from the provided full card object
            const listingData = {
                cardData: { ...update.fullCardData, ...update.data }, // Combine original data with new updates
                sellerData: {
                    uid: userId,
                    displayName: userProfile.displayName || 'Anonymous',
                    photoURL: userProfile.photoURL || '/images/default-avatar.png',
                    country: userProfile.country || 'Unknown'
                },
                price: update.data.price,
                condition: update.data.condition || update.fullCardData.condition,
                isFoil: update.fullCardData.is_foil,
                listedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            batch.set(forSaleRef, listingData);
        } else if (update.data.forSale === false) {
            batch.delete(forSaleRef);
        }
    }
    await batch.commit();
}
// --- MODIFICATION END ---

export async function uploadCustomImage(userId, cardId, file) {
    const filePath = `users/${userId}/collection_images/${cardId}/${file.name}`;
    const fileRef = storage.ref(filePath);
    const snapshot = await fileRef.put(file);
    return snapshot.ref.getDownloadURL();
}