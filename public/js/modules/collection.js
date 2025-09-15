/**
 * collection.js
 * Manages the application's state for the TCG collection.
 */
import * as API from './api.js';

let state = {
    currentUser: null,
    fullCollection: [],
    wishlist: [],
    filteredCollection: [],
    activeTab: 'collection', // 'collection' or 'wishlist'
    activeView: 'grid', // 'grid' or 'list'
    filters: {
        name: '',
        set: '',
        rarity: '',
        colors: [], // For MTG: ['W', 'U', 'B', 'R', 'G', 'C']
    },
    bulkEdit: {
        isActive: false,
        selected: new Set(),
    },
    currentEditingCard: null, // Holds the original API data for the card being added/edited
};

export const getState = () => state;

export function setCurrentEditingCard(cardData) {
    state.currentEditingCard = cardData;
}
export function getCurrentEditingCard() {
    return state.currentEditingCard;
}

// --- DATA LOADING ---
export async function loadCollection(userId) {
    state.currentUser = { uid: userId };
    try {
        state.fullCollection = await API.getCollection(userId);
        applyFilters();
    } catch (error) {
        console.error("Failed to load collection:", error);
        state.fullCollection = [];
        state.filteredCollection = [];
    }
}

export async function loadWishlist(userId) {
    try {
        state.wishlist = await API.getWishlist(userId);
    } catch (error) {
        console.error("Failed to load wishlist:", error);
        state.wishlist = [];
    }
}

// --- STATE MODIFICATION ---
export function setView(view) {
    state.activeView = view;
}
export function setTab(tab) {
    state.activeTab = tab;
}
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

// --- CARD OPERATIONS ---
export async function addCard(cardData, customImageFile) {
    if (!state.currentUser) throw new Error("User not logged in.");
    
    let finalCardData = { ...cardData };

    // Add to Firestore first to get an ID
    const cardId = await API.addCardToCollection(state.currentUser.uid, finalCardData);
    finalCardData.id = cardId;

    // If there's a custom image, upload it and update the Firestore entry
    if (customImageFile) {
        const imageUrl = await API.uploadCustomImage(state.currentUser.uid, cardId, customImageFile);
        finalCardData.customImageUrl = imageUrl;
        await API.updateCardInCollection(state.currentUser.uid, cardId, { customImageUrl: imageUrl });
    }

    // Update local state
    state.fullCollection.unshift(finalCardData);
    applyFilters();
}

export async function updateCard(cardId, updates, customImageFile) {
     if (!state.currentUser) throw new Error("User not logged in.");

    let finalUpdates = { ...updates };
    
    if (customImageFile) {
        const imageUrl = await API.uploadCustomImage(state.currentUser.uid, cardId, customImageFile);
        finalUpdates.customImageUrl = imageUrl;
    }

    await API.updateCardInCollection(state.currentUser.uid, cardId, finalUpdates);

    // Update local state
    const index = state.fullCollection.findIndex(c => c.id === cardId);
    if (index !== -1) {
        state.fullCollection[index] = { ...state.fullCollection[index], ...finalUpdates };
    }
    applyFilters();
}

export async function deleteCard(cardId) {
    if (!state.currentUser) throw new Error("User not logged in.");
    await API.deleteCardFromCollection(state.currentUser.uid, cardId);
    
    // Update local state
    state.fullCollection = state.fullCollection.filter(c => c.id !== cardId);
    applyFilters();
}

export const getCardById = (cardId) => state.fullCollection.find(c => c.id === cardId);


// --- FILTERING & DATA DERIVATION ---
export function applyFilters() {
    const { name, set, rarity, colors } = state.filters;
    state.filteredCollection = state.fullCollection.filter(card => {
        const nameMatch = !name || card.name.toLowerCase().includes(name.toLowerCase());
        const setMatch = !set || card.set_name === set;
        const rarityMatch = !rarity || card.rarity === rarity;
        
        const colorMatch = colors.length === 0 || 
            (card.color_identity && colors.every(c => card.color_identity.includes(c)));

        return nameMatch && setMatch && rarityMatch && colorMatch;
    });
}

export function calculateStats() {
    const totalCards = state.fullCollection.reduce((sum, card) => sum + (card.quantity || 0), 0);
    const uniqueCards = new Set(state.fullCollection.map(card => card.name)).size;
    const totalValue = state.fullCollection.reduce((sum, card) => {
        const price = card.prices?.usd || 0;
        return sum + (price * (card.quantity || 0));
    }, 0);
    return { totalCards, uniqueCards, totalValue };
}

export function getAvailableFilterOptions() {
    const sets = [...new Set(state.fullCollection.map(c => c.set_name))].sort();
    const rarities = [...new Set(state.fullCollection.map(c => c.rarity))].sort();
    return { sets, rarities };
}