/**
 * collection.js
 * Manages the application's state for the TCG collection.
 */
import * as API from './api.js';

let state = {
    currentUser: null,
    fullCollection: [],
    fullWishlist: [],
    wishlist: [],
    filteredCollection: [],
    activeTab: 'collection',
    activeView: 'grid',
    filters: { name: '', set: '', rarity: '', colors: [], game: 'all' },
    bulkEdit: { isActive: false, selected: new Set() },
    currentEditingCard: null,
    pendingCards: [],
};

export const getState = () => state;
export function setCurrentEditingCard(cardData) { state.currentEditingCard = cardData; }
export function getCurrentEditingCard() { return state.currentEditingCard; }
export function addPendingCard(cardData) { state.pendingCards.push(cardData); }
export function getPendingCards() { return state.pendingCards; }
export function clearPendingCards() { state.pendingCards = []; }

// **FIX**: Added function to remove a specific pending card by its index
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
        card.is_altered === cardData.is_altered
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
export function setFilters(newFilters) { state.filters = { ...state.filters, ...newFilters }; applyFilters(); }
export function toggleColorFilter(color) { const index = state.filters.colors.indexOf(color); if (index > -1) { state.filters.colors.splice(index, 1); } else { state.filters.colors.push(color); } return state.filters.colors; }

export async function addMultipleCards(cardVersions) {
    if (!state.currentUser) throw new Error("User not logged in.");
    
    for (const cardData of cardVersions) {
        const matchingCard = findMatchingCard(cardData);
        if (matchingCard) {
            const newQuantity = (matchingCard.quantity || 1) + (cardData.quantity || 1);
            await API.updateCardInCollection(state.currentUser.uid, matchingCard.id, { quantity: newQuantity });
            matchingCard.quantity = newQuantity;
        } else {
            const cardId = await API.addCardToCollection(state.currentUser.uid, cardData);
            const finalCardData = { ...cardData, id: cardId };
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

export function applyFilters() {
    const { name, set, rarity, colors, game } = state.filters;
    
    if (state.activeTab === 'collection') {
        state.filteredCollection = state.fullCollection.filter(card => {
            const nameMatch = !name || card.name.toLowerCase().includes(name.toLowerCase());
            const setMatch = !set || card.set_name === set;
            const rarityMatch = !rarity || card.rarity === rarity;
            const colorMatch = colors.length === 0 || (card.color_identity && colors.every(c => card.color_identity.includes(c)));
            const gameMatch = game === 'all' || (card.game || 'mtg') === game;
            return nameMatch && setMatch && rarityMatch && colorMatch && gameMatch;
        });
    } else {
        state.wishlist = state.fullWishlist.filter(card => {
            const nameMatch = !name || card.name.toLowerCase().includes(name.toLowerCase());
            const setMatch = !set || card.set_name === set;
            const rarityMatch = !rarity || card.rarity === rarity;
            const gameMatch = game === 'all' || (card.game || 'mtg') === game;
            return nameMatch && setMatch && rarityMatch && gameMatch;
        });
    }
}

export function calculateCollectionStats() {
    const collectionToCount = state.filteredCollection;
    const totalCards = collectionToCount.reduce((sum, card) => sum + (card.quantity || 1), 0);
    const uniqueCards = new Set(collectionToCount.map(card => card.name)).size;
    const totalValue = collectionToCount.reduce((sum, card) => {
        const price = card.prices?.usd || 0;
        return sum + (price * (card.quantity || 1));
    }, 0);
    return { totalCards, uniqueCards, totalValue };
}

export function calculateWishlistStats() {
    const totalCards = state.wishlist.length;
    const uniqueCards = state.wishlist.length;
    const totalValue = state.wishlist.reduce((sum, card) => {
        const price = card.prices?.usd || 0;
        return sum + price;
    }, 0);
    return { totalCards, uniqueCards, totalValue };
}

export function getAvailableFilterOptions() {
    const sourceList = state.activeTab === 'collection' ? state.fullCollection : state.wishlist;
    const sets = [...new Set(sourceList.map(c => c.set_name))].sort();
    const rarities = [...new Set(sourceList.map(c => c.rarity))].sort();
    return { sets, rarities };
}