/**
 * api_fixed.js
 * Fixed version of the API module with improved ScryDex integration and error handling.
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
    
    if (!cardName || cardName.trim().length < 3) {
        throw new Error('Card name must be at least 3 characters long.');
    }

    // Read the user's choice from localStorage. Default to 'scryfall' for EU prices.
    const priceProvider = localStorage.getItem('priceProvider') || 'scryfall';

    try {
        // If the game is MTG AND the user wants EU prices, use the direct Scryfall function.
        if (game === 'mtg' && priceProvider === 'scryfall') {
            console.log('[API] Using Scryfall for MTG with EU prices');
            return await searchScryfall(cardName);
        }

        // For ALL other games (Pokemon, Lorcana, Gundam) OR if the user chose US prices for MTG,
        // use the ScryDex cloud function.
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
        
        // Respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const response = await fetch(encodedUrl);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ details: 'Unknown error' }));
            throw new Error(errorData.details || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('Invalid response format from Scryfall API');
        }
        
        console.log(`[API] Scryfall returned ${data.data.length} results`);
        return data.data.map(card => cleanScryfallData(card));
        
    } catch (error) {
        console.error('[API] Scryfall API error:', error);
        if (error.message.includes('not found')) {
            throw new Error('No cards found matching your search.');
        }
        throw error;
    }
}

/**
 * Fetches card data from our secure ScryDex cloud function with improved error handling.
 * This handles MTG (US prices), Pokemon, Lorcana, and Gundam.
 */
async function searchScryDex(cardName, game) {
    try {
        console.log(`[API] Calling ScryDex function for ${game} with query: "${cardName}"`);
        
        // Call the callable function with the game parameter
        const result = await searchScryDexFunction({ cardName, game });
        
        console.log('[API] ScryDex function result:', result);
        
        // Check if we have a valid response
        if (!result || !result.data) {
            throw new Error('Invalid response from ScryDex API');
        }
        
        // Handle different response formats
        let cardData;
        if (Array.isArray(result.data)) {
            cardData = result.data;
        } else if (result.data.data && Array.isArray(result.data.data)) {
            cardData = result.data.data;
        } else {
            console.warn('[API] Unexpected ScryDex response format:', result.data);
            cardData = [];
        }
        
        if (cardData.length === 0) {
            throw new Error('No cards found matching your search.');
        }
        
        console.log(`[API] ScryDex returned ${cardData.length} results`);
        return cardData.map(card => cleanScryDexData(card, game));
        
    } catch (error) {
        console.error(`[API] ScryDex search function error for ${game}:`, error);
        
        // Handle specific Firebase function errors
        if (error.code === 'functions/not-found') {
            throw new Error('ScryDex search service is currently unavailable. Please try again later.');
        } else if (error.code === 'functions/permission-denied') {
            throw new Error('You need to be logged in to search for cards.');
        } else if (error.code === 'functions/unauthenticated') {
            throw new Error('Authentication required. Please log in and try again.');
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
 * Now includes EUR prices and better error handling.
 */
function cleanScryfallData(card) {
    try {
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
    } catch (error) {
        console.error('[API] Error cleaning Scryfall data:', error, card);
        throw new Error('Failed to process card data from Scryfall');
    }
}

/**
 * Cleans data from a ScryDex API response for any game with improved error handling.
 */
function cleanScryDexData(card, game) {
    try {
        const cleaned = {
            api_id: card.id || card.uuid || `${game}_${Date.now()}_${Math.random()}`,
            name: card.name || card.Name || 'Unknown Card',
            set: card.set?.id || card.Set_ID || card.set_code || 'unknown',
            set_name: card.set?.name || card.Set_Name || card.set_name || 'Unknown Set',
            rarity: card.rarity || 'Common',
            image_uris: card.image_uris || card.images || (card.Image ? { normal: card.Image } : null),
            prices: {
                usd: parseFloat(card.prices?.low || card.prices?.market || card.price || 0) || null,
                usd_foil: parseFloat(card.prices?.foil_low || card.prices?.foil_market || card.foil_price || 0) || null,
            },
            game: game
        };

        // Add game-specific details
        switch (game) {
            case 'mtg':
                cleaned.mana_cost = card.mana_cost || card.manaCost || '';
                cleaned.cmc = card.cmc || card.convertedManaCost || 0;
                cleaned.type_line = card.type_line || card.typeLine || card.type || '';
                cleaned.oracle_text = card.oracle_text || card.text || '';
                cleaned.rulings = card.rulings || [];
                cleaned.color_identity = card.color_identity || card.colorIdentity || [];
                cleaned.collector_number = card.collector_number || card.collectorNumber || '';
                break;
                
            case 'pokemon':
                cleaned.types = card.types || [];
                cleaned.hp = card.hp || null;
                cleaned.supertype = card.supertype || '';
                cleaned.subtypes = card.subtypes || [];
                cleaned.abilities = card.abilities || [];
                cleaned.attacks = card.attacks || [];
                cleaned.weaknesses = card.weaknesses || [];
                cleaned.resistances = card.resistances || [];
                cleaned.retreat_cost = card.retreatCost || card.retreat_cost || [];
                cleaned.artist = card.artist || '';
                cleaned.flavor_text = card.flavorText || card.flavor_text || '';
                break;
                
            case 'lorcana':
                // Override name for Lorcana since it uses capital Name
                cleaned.name = card.Name || card.name || 'Unknown Card';
                cleaned.cost = card.Cost || card.cost || 0;
                cleaned.type = card.Type || card.type || '';
                cleaned.color = card.Color || card.color || '';
                cleaned.inkable = card.Inkable || card.inkable || false;
                cleaned.body_text = card.Body_Text || card.body_text || '';
                cleaned.flavor_text = card.Flavor_Text || card.flavor_text || '';
                cleaned.artist = card.Artist || card.artist || '';
                cleaned.classifications = card.Classifications || card.classifications || [];
                cleaned.strength = card.Strength || card.strength || null;
                cleaned.willpower = card.Willpower || card.willpower || null;
                cleaned.lore = card.Lore || card.lore || null;
                break;
                
            case 'gundam':
                cleaned.code = card.code || '';
                cleaned.level = card.level || 0;
                cleaned.cost = card.cost || 0;
                cleaned.color = card.color || '';
                cleaned.card_type = card.cardType || card.card_type || '';
                cleaned.effect = card.effect || '';
                cleaned.zone = card.zone || '';
                cleaned.trait = card.trait || '';
                cleaned.link = card.link || '';
                cleaned.ap = card.ap || null;
                cleaned.hp = card.hp || null;
                cleaned.source_title = card.sourceTitle || card.source_title || '';
                break;
        }

        return cleaned;
    } catch (error) {
        console.error(`[API] Error cleaning ScryDex data for ${game}:`, error, card);
        // Return a minimal valid card object instead of throwing
        return {
            api_id: `${game}_error_${Date.now()}`,
            name: card.name || card.Name || 'Error Loading Card',
            set: 'unknown',
            set_name: 'Unknown Set',
            rarity: 'Common',
            image_uris: null,
            prices: { usd: null, usd_foil: null },
            game: game
        };
    }
}

// --- FIRESTORE DATABASE OPERATIONS ---

export async function saveCard(userId, cardData, customImageFile = null) {
    try {
        let imageUrl = null;
        if (customImageFile) {
            const storageRef = storage.ref(`users/${userId}/cards/${Date.now()}_${customImageFile.name}`);
            const snapshot = await storageRef.put(customImageFile);
            imageUrl = await snapshot.ref.getDownloadURL();
        }

        const docRef = await db.collection('users').doc(userId).collection('cards').add({
            ...cardData,
            customImageUrl: imageUrl,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return docRef.id;
    } catch (error) {
        console.error('[API] Error saving card:', error);
        throw new Error('Failed to save card to database');
    }
}

export async function updateCard(userId, cardId, cardData, customImageFile = null) {
    try {
        let imageUrl = null;
        if (customImageFile) {
            const storageRef = storage.ref(`users/${userId}/cards/${Date.now()}_${customImageFile.name}`);
            const snapshot = await storageRef.put(customImageFile);
            imageUrl = await snapshot.ref.getDownloadURL();
        }

        const updateData = {
            ...cardData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (imageUrl) {
            updateData.customImageUrl = imageUrl;
        }

        await db.collection('users').doc(userId).collection('cards').doc(cardId).update(updateData);
        return cardId;
    } catch (error) {
        console.error('[API] Error updating card:', error);
        throw new Error('Failed to update card in database');
    }
}

export async function deleteCard(userId, cardId) {
    try {
        await db.collection('users').doc(userId).collection('cards').doc(cardId).delete();
    } catch (error) {
        console.error('[API] Error deleting card:', error);
        throw new Error('Failed to delete card from database');
    }
}

export async function loadUserCards(userId) {
    try {
        const snapshot = await db.collection('users').doc(userId).collection('cards').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('[API] Error loading user cards:', error);
        throw new Error('Failed to load cards from database');
    }
}

export async function loadUserWishlist(userId) {
    try {
        const snapshot = await db.collection('users').doc(userId).collection('wishlist').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('[API] Error loading user wishlist:', error);
        throw new Error('Failed to load wishlist from database');
    }
}
