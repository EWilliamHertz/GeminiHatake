/**
 * collection.js
 * Manages the application's state for the TCG collection.
 * - FIX: Correctly identifies matching cards to prevent incorrect quantity updates.
 * - FIX: Improved state management for currentEditingCard to prevent cross-contamination.
 */
import * as API from './api.js';
import { getNormalizedPriceUSD } from './currency.js';


let state = {
    currentUser: null,
    fullCollection: [],
    fullWishlist: [],
    wishlist: [],
    filteredCollection: [],
    activeTab: 'collection',
    activeView: 'grid',
    filters: { name: '', set: [], rarity: [], colors: [], games: [], type: '' },
    bulkEdit: { isActive: false, selected: new Set() },
    currentEditingCard: null,
    pendingCards: [],
    showAdditionalInfo: false, // New state for showing details on card
};

export const getState = () => state;

export function setCurrentEditingCard(cardData) {
    // CRITICAL FIX: Properly handle null/undefined values and deep clone to prevent reference issues
    if (cardData === null || cardData === undefined) {
        state.currentEditingCard = null;
    } else {
        // Deep clone to prevent reference issues between different card additions
        state.currentEditingCard = JSON.parse(JSON.stringify(cardData));
    }
    
    if (cardData) {
        document.dispatchEvent(new CustomEvent('showEditCardModal', { detail: cardData }));
    }
}

export function getCurrentEditingCard() { 
    return state.currentEditingCard; 
}

export function addPendingCard(cardData) { 
    state.pendingCards.push(cardData); 
}

export function getPendingCards() { 
    return state.pendingCards; 
}

export function clearPendingCards() { 
    state.pendingCards = []; 
}

export function removePendingCard(index) {
    if (index > -1 && index < state.pendingCards.length) {
        state.pendingCards.splice(index, 1);
    }
}

function findMatchingCard(cardData) {
    return state.fullCollection.find(card =>
        card.api_id === cardData.api_id &&
        card.condition === cardData.condition &&
        card.language === cardData.language &&
        card.is_foil === cardData.is_foil &&
        card.is_signed === cardData.is_signed &&
        card.is_altered === cardData.is_altered &&
        card.is_graded === cardData.is_graded &&
        (!cardData.is_graded || (card.grading_company === cardData.grading_company && card.grade === cardData.grade)) && // <-- FIX: Added '&&'
        card.game === cardData.game    
    );
}

export function swapPendingCard(index) {
    if (!state.pendingCards[index]) return;
    const mainCardData = { ...state.currentEditingCard };
    const pendingCardData = { ...state.pendingCards[index] };
    
    state.currentEditingCard = pendingCardData;
    state.pendingCards[index] = mainCardData;
}

export function toggleBulkEditMode() {
    state.bulkEdit.isActive = !state.bulkEdit.isActive;
    if (!state.bulkEdit.isActive) {
        state.bulkEdit.selected.clear();
    }
    return state.bulkEdit.isActive;
}

export function toggleCardSelection(cardId) {
    if (state.bulkEdit.selected.has(cardId)) {
        state.bulkEdit.selected.delete(cardId);
    } else {
        state.bulkEdit.selected.add(cardId);
    }
    return state.bulkEdit.selected.has(cardId);
}

export function selectAllFiltered(cardIds) {
    cardIds.forEach(id => state.bulkEdit.selected.add(id));
}

export function deselectAllFiltered() {
    state.bulkEdit.selected.clear();
}

export function getSelectedCardIds() {
    return Array.from(state.bulkEdit.selected);
}

export async function loadCollection(userId) {
    state.currentUser = { uid: userId };
    try {
        state.fullCollection = await API.getCollection(userId);
        applyFilters();
    } catch (error) {
        console.error("Failed to load collection:", error);
        state.fullCollection = [];
        state.filteredCollection = [];
        throw error;
    }
}

export async function loadWishlist(userId) {
    try {
        state.fullWishlist = await API.getWishlist(userId);
        state.wishlist = [...state.fullWishlist];
    } catch (error) {
        console.error("Failed to load wishlist:", error);
        state.wishlist = [];
        state.fullWishlist = [];
    }
}

export function setView(view) { state.activeView = view; }
export function setTab(tab) { state.activeTab = tab; }
export function setFilters(newFilters) { 
    state.filters = { ...state.filters, ...newFilters }; 
    applyFilters(); 
}
export function toggleColorFilter(color) { 
    const index = state.filters.colors.indexOf(color); 
    if (index > -1) { 
        state.filters.colors.splice(index, 1); 
    } else { 
        state.filters.colors.push(color); 
    } 
    return state.filters.colors; 
}

export function toggleShowAdditionalInfo() {
    state.showAdditionalInfo = !state.showAdditionalInfo;
}

// In public/js/modules/collection.js

export async function addMultipleCards(cardVersions, customImageFile) {
    if (!state.currentUser) throw new Error("User not logged in.");
    
    for (const cardData of cardVersions) {
        if (!cardData.api_id || typeof cardData.api_id !== 'string') {
            console.error("Invalid api_id for card:", cardData);
            continue;
        }

        const cleanCardData = {
            api_id: cardData.api_id,
            condition: cardData.condition || 'NM',
            language: cardData.language || 'English',
            is_foil: cardData.is_foil || false,
            is_signed: cardData.is_signed || false,
            is_altered: cardData.is_altered || false,
            is_graded: cardData.is_graded || false,
            grading_company: cardData.grading_company || null,
            grade: cardData.grade || null,
            quantity: cardData.quantity || 1,
            prices: cardData.prices || {},
            priceLastUpdated: cardData.priceLastUpdated || new Date().toISOString(), // <-- FIX: Added comma
            game: cardData.game
        };

        const matchingCard = findMatchingCard(cleanCardData);
        if (matchingCard) {
            const newQuantity = (matchingCard.quantity || 1) + (cleanCardData.quantity || 1);
            await API.updateCardInCollection(state.currentUser.uid, matchingCard.id, { quantity: newQuantity });
            const cardIndex = state.fullCollection.findIndex(c => c.id === matchingCard.id);
            if(cardIndex !== -1) {
                state.fullCollection[cardIndex].quantity = newQuantity;
            }
        } else {
            const completeCardData = { ...cardData, ...cleanCardData };
             if (!completeCardData.game) {
                 console.warn("Card data missing game property, defaulting to unknown:", completeCardData);
                 completeCardData.game = 'unknown'; 
             }
            const cardId = await API.addCardToCollection(state.currentUser.uid, completeCardData);
            let finalCardData = { ...completeCardData, id: cardId };
            
            if (customImageFile) {
                const imageUrl = await API.uploadCustomImage(state.currentUser.uid, cardId, customImageFile);
                finalCardData.customImageUrl = imageUrl;
                await API.updateCardInCollection(state.currentUser.uid, cardId, { customImageUrl: imageUrl });
            }
            state.fullCollection.unshift(finalCardData);
        }
    }
    applyFilters();
}
export async function updateCard(cardId, updates, customImageFile) {
    if (!state.currentUser) throw new Error("User not logged in.");

    let finalUpdates = { ...updates };

    if (customImageFile) {
        finalUpdates.customImageUrl = await API.uploadCustomImage(state.currentUser.uid, cardId, customImageFile);
    }

    const originalCard = getCardById(cardId);
    if (originalCard && originalCard.api_id) {
        finalUpdates.api_id = originalCard.api_id;
    }

    await API.updateCardInCollection(state.currentUser.uid, cardId, finalUpdates);

    const index = state.fullCollection.findIndex(c => c.id === cardId);
    if (index !== -1) {
        state.fullCollection[index] = { ...state.fullCollection[index], ...finalUpdates };
    }
    applyFilters();
}


export async function batchUpdateSaleStatus(updates) {
    if (!state.currentUser) throw new Error("User not logged in.");
    await API.batchUpdateCards(state.currentUser.uid, updates);

    updates.forEach(update => {
        const index = state.fullCollection.findIndex(c => c.id === update.id);
        if (index !== -1) {
            state.fullCollection[index] = { ...state.fullCollection[index], ...update.data };
        }
    });

    applyFilters();
    toggleBulkEditMode();
}

export async function batchCreateMarketplaceListings(updates) {
    if (!state.currentUser) throw new Error("User not logged in.");
    
    console.log('[Collection] Creating marketplace listings for', updates.length, 'cards');
    const userProfile = await API.getUserProfile(state.currentUser.uid);
    const listings = [];
    
    for (const update of updates) {
        const card = state.fullCollection.find(c => c.id === update.id);
        if (card && update.data.for_sale) {
            console.log('[Collection] Processing card for marketplace:', card.name);
            
            const listing = {
                // Card information
                cardData: {
                    name: card.name || '',
                    game: card.game || 'mtg',
                    set: card.set || '',
                    set_name: card.set_name || '',
                    condition: card.condition || 'near_mint',
                    collector_number: card.collector_number || '',
                    rarity: card.rarity || '',
                    type_line: card.type_line || '',
                    mana_cost: card.mana_cost || null,
                    cmc: card.cmc || 0,
                    color_identity: card.color_identity || [],
                    image_uris: card.image_uris || {},
                    prices: card.prices || {},
                    language: card.language || 'en',
                    foil: card.is_foil || card.isFoil || false,
                    isGraded: card.is_graded || card.isGraded || false,
                    gradingCompany: card.grading_company || null,
                    grade: card.grade || null,
                    api_id: card.api_id || ''
                },
                // Seller information
                sellerData: {
                    uid: state.currentUser.uid,
                    displayName: userProfile?.displayName || 'Unknown Seller',
                    photoURL: userProfile?.photoURL || null,
                    country: userProfile?.address?.country || 'Unknown',
                    city: userProfile?.address?.city || '',
                    state: userProfile?.address?.state || ''
                },
                // Listing details
                sellerId: state.currentUser.uid,
                price: update.data.sale_price,
                currency: update.data.sale_currency || 'USD',
                quantity: card.quantity || 1,
                listedAt: firebase.firestore.FieldValue.serverTimestamp(),
                originalCollectionCardId: card.id,
                // Additional fields for marketplace functionality
                status: 'active',
                views: 0,
                watchers: []
            };
            listings.push(listing);
        }
    }
    
    if (listings.length > 0) {
        console.log('[Collection] Sending', listings.length, 'listings to API');
        await API.batchCreateMarketplaceListings(listings);
        console.log('[Collection] Successfully created marketplace listings');
        
        // Automatically refresh marketplace if it's loaded
        if (window.marketplaceManager && typeof window.marketplaceManager.refreshMarketplace === 'function') {
            console.log('[Collection] Refreshing marketplace after creating listings');
            setTimeout(() => {
                window.marketplaceManager.refreshMarketplace();
            }, 1000); // Small delay to ensure Firestore has processed the changes
        }
    } else {
        console.log('[Collection] No valid listings to create');
    }
}

export async function batchRemoveMarketplaceListings(collectionCardIds) {
    if (!state.currentUser) throw new Error("User not logged in.");
    await API.batchRemoveMarketplaceListings(state.currentUser.uid, collectionCardIds);
    
    // Automatically refresh marketplace if it's loaded
    if (window.marketplaceManager && typeof window.marketplaceManager.refreshMarketplace === 'function') {
        console.log('[Collection] Refreshing marketplace after removing listings');
        setTimeout(() => {
            window.marketplaceManager.refreshMarketplace();
        }, 1000); // Small delay to ensure Firestore has processed the changes
    }
}

export async function deleteCard(cardId) {
    if (!state.currentUser) throw new Error("User not logged in.");
    await API.deleteCardFromCollection(state.currentUser.uid, cardId);
    state.fullCollection = state.fullCollection.filter(c => c.id !== cardId);
    applyFilters();
}

export async function batchDelete(cardIds) {
    if (!state.currentUser) throw new Error("User not logged in.");
    await API.batchDeleteCards(state.currentUser.uid, cardIds);

    state.fullCollection = state.fullCollection.filter(c => !cardIds.includes(c.id));
    
    applyFilters();
    toggleBulkEditMode();
}

export const getCardById = (cardId) => state.fullCollection.find(c => c.id === cardId) || state.wishlist.find(c => c.id === cardId);

// PASTE THIS CORRECTED FUNCTION IN ITS PLACE

// REPLACE your applyFilters function with this DEBUG VERSION

export function applyFilters() {
    console.log('%c--- APPLYING FILTERS ---', 'color: blue; font-weight: bold;');
    const { fullCollection, filters } = state;
    console.log('Current Filters:', JSON.parse(JSON.stringify(filters)));

    if (!fullCollection || fullCollection.length === 0) {
        console.warn('Cannot apply filters, fullCollection is empty.');
        state.filteredCollection = [];
        return;
    }

    state.filteredCollection = fullCollection.filter((card, index) => {
        // --- LOGGING FOR EACH CARD ---
        if (index < 5) { // Only log the first 5 cards to avoid spamming the console
            console.log(`\nChecking Card #${index + 1}: ${card.name}`);
        }

        // 1. Name Filter
        const nameMatch = !filters.name || card.name.toLowerCase().includes(filters.name.toLowerCase());
        if (index < 5) console.log(`  Name Match: ${nameMatch}`);

        // 2. Game Filter
        const cardGame = card.game || 'mtg';
        const gameMatch = filters.games.length === 0 || filters.games.includes(cardGame);
        if (index < 5) console.log(`  Game Match: ${gameMatch} (Card is ${cardGame}, Filter is [${filters.games}])`);

        // 3. Set/Edition Filter
        const cardSetName = (card.set && card.set.name) ? card.set.name : card.set_name;
        const setMatch = filters.set.length === 0 || filters.set.includes(cardSetName);
        if (index < 5) console.log(`  Set Match: ${setMatch} (Card is '${cardSetName}', Filter is [${filters.set}])`);

        // 4. Rarity Filter
        const rarityMatch = filters.rarity.length === 0 || filters.rarity.includes(card.rarity);
        if (index < 5) console.log(`  Rarity Match: ${rarityMatch} (Card is '${card.rarity}', Filter is [${filters.rarity}])`);
        
        // Game-Specific Filters
        let gameSpecificMatch = true;
        if (gameMatch) {
            if (filters.games.includes('mtg') && cardGame === 'mtg') {
                const colorIdentity = card.color_identity || [];
                if (filters.colors.length > 0) {
                    gameSpecificMatch = filters.colors.every(c => colorIdentity.includes(c));
                }
            }
            if (filters.games.includes('pokemon') && cardGame === 'pokemon') {
                if (filters.type) {
                    gameSpecificMatch = card.types && card.types.includes(filters.type);
                }
            }
        }
        if (index < 5) console.log(`  Game-Specific Match: ${gameSpecificMatch}`);

        const shouldKeep = nameMatch && gameMatch && setMatch && rarityMatch && gameSpecificMatch;
        if (index < 5) console.log(`  ==> Should Keep Card? ${shouldKeep}`);
        
        return shouldKeep;
    });

    console.log(`%cResult: ${state.filteredCollection.length} of ${fullCollection.length} cards shown.`, 'color: green; font-weight: bold;');
}

export function calculateCollectionStats() {
    const collectionToCount = state.filteredCollection;
    const totalCards = collectionToCount.reduce((sum, card) => sum + (card.quantity || 1), 0);
    const uniqueCards = new Set(collectionToCount.map(card => card.api_id)).size;
    
    const totalValue = collectionToCount.reduce((sum, card) => {
        const priceUSD = getNormalizedPriceUSD(card.prices, card);
        return sum + (priceUSD * (card.quantity || 1));
    }, 0);

    return { totalCards, uniqueCards, totalValue };
}

export function calculateWishlistStats() {
    const totalCards = state.wishlist.length;
    const uniqueCards = state.wishlist.length;
    
    const totalValue = state.wishlist.reduce((sum, card) => {
        const priceUSD = getNormalizedPriceUSD(card.prices, card);
        return sum + priceUSD;
    }, 0);
    
    return { totalCards, uniqueCards, totalValue };
}

export function getFilters() {
    return state.filters;
}

export function getAvailableFilterOptions(games) {
    const sourceList = state.activeTab === 'collection' ? state.fullCollection : state.fullWishlist;
    const filteredList = sourceList.filter(c => games.length === 0 || games.includes(c.game || 'mtg'));

    const sets = [...new Set(filteredList.map(c => c.set_name))].sort();
    
    const rarities = {};
    filteredList.forEach(card => {
        const gameKey = card.game || 'mtg';
        if (!rarities[gameKey]) {
            rarities[gameKey] = new Set();
        }
        rarities[gameKey].add(card.rarity);
    });

    for (const gameKey in rarities) {
        rarities[gameKey] = [...rarities[gameKey]].sort();
    }

    let types = [];
    if (games.includes('pokemon')) {
        types = [...new Set(filteredList.flatMap(c => c.types || []))].sort();
    }
    
    return { sets, rarities, types };
}




export async function removeCardFromSale(cardId) {
    if (!state.currentUser) throw new Error("User not logged in.");
    
    const card = getCardById(cardId);
    if (!card || !card.for_sale) {
        throw new Error("Card is not currently for sale.");
    }
    
    // Update the card in collection
    await batchUpdateSaleStatus([{
        id: cardId,
        data: { for_sale: false, sale_price: null, sale_currency: null }
    }]);
    
    // Remove from marketplace listings
    await batchRemoveMarketplaceListings([cardId]);
}

export async function updateCardSalePrice(cardId, newPrice, currency) {
    if (!state.currentUser) throw new Error("User not logged in.");
    
    const card = getCardById(cardId);
    if (!card) {
        throw new Error("Card not found.");
    }
    
    // Update the card in collection
    await batchUpdateSaleStatus([{
        id: cardId,
        data: { 
            for_sale: true, 
            sale_price: newPrice, 
            sale_currency: currency 
        }
    }]);
    
    // Update marketplace listing
    await batchCreateMarketplaceListings([{
        id: cardId,
        data: { 
            for_sale: true, 
            sale_price: newPrice, 
            sale_currency: currency 
        }
    }]);
}
