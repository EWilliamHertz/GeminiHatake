/**
 * collection.js
 * Data management and state logic for the user's collection and wishlist.
 * This version is designed to work with collection-app.js, uses global Firebase,
 * and fixes the critical syntax error.
 */
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js";

// Use the globally initialized Firebase services from auth.js
const db = window.db; 
const storage = window.storage;

let state = {
    collection: [],
    wishlist: [],
    filteredCollection: [],
    filteredWishlist: [],
    activeTab: 'collection',
    activeView: 'grid',
    bulkEdit: {
        isActive: false,
        selected: new Set(),
    },
    filters: {
        game: 'all',
        name: '',
        set: [],
        rarity: [],
        colors: [],
        type: '',
    },
    pendingCards: [],
};

// --- STATE MANAGEMENT ---
export const getState = () => state;
export const getCardById = (id) => state.collection.find(c => c.id === id);
export const getSelectedCardIds = () => Array.from(state.bulkEdit.selected);

// --- DATA LOADING ---
export async function loadCollection(userId) {
    if (!db) throw new Error("Firestore not initialized. Ensure auth.js runs first.");
    const snapshot = await db.collection('users').doc(userId).collection('collection').orderBy('addedAt', 'desc').get();
    state.collection = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    applyFilters();
}

export async function loadWishlist(userId) {
    state.wishlist = []; // Placeholder for now
}

// --- CARD OPERATIONS ---
export async function addMultipleCards(userId, cardVersions, customImageFile) {
    const batch = db.batch();
    const userRef = db.collection('users').doc(userId);
    let imageUrl = null;

    if (customImageFile) {
        const imagePath = `user_uploads/${userId}/${Date.now()}_${customImageFile.name}`;
        const imageRef = ref(storage, imagePath);
        const snapshot = await uploadBytes(imageRef, customImageFile);
        imageUrl = await getDownloadURL(snapshot.ref);
    }

    for (const cardData of cardVersions) {
        const docRef = userRef.collection('collection').doc();
        const dataToAdd = {
            ...cardData.apiData,
            ...cardData.details,
            addedAt: firebase.firestore.FieldValue.serverTimestamp(),
            customImageUrl: imageUrl || null,
        };
        
        batch.set(docRef, dataToAdd);

        if (cardData.details.forSale && cardData.details.salePrice > 0) {
            const forSaleRef = userRef.collection('forSale').doc(docRef.id);
            batch.set(forSaleRef, { ...dataToAdd, listedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }
    await batch.commit();
    state.pendingCards = [];
}

export async function updateCard(userId, cardId, data, customImageFile) {
    const cardRef = db.collection('users').doc(userId).collection('collection').doc(cardId);
    const forSaleRef = db.collection('users').doc(userId).collection('forSale').doc(cardId);
    const fullCardData = { ...getCardById(cardId), ...data };

    if (customImageFile) {
        const imagePath = `user_uploads/${userId}/${Date.now()}_${customImageFile.name}`;
        const imageRef = ref(storage, imagePath);
        const snapshot = await uploadBytes(imageRef, customImageFile);
        data.customImageUrl = await getDownloadURL(snapshot.ref);
        fullCardData.customImageUrl = data.customImageUrl;
    }
    
    await cardRef.update(data);
    
    if (data.forSale && data.salePrice > 0) {
         await forSaleRef.set({ ...fullCardData, listedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } else {
        await forSaleRef.delete().catch(() => {}); // Gracefully handle if it doesn't exist
    }
}

export async function deleteCard(userId, cardId) {
    const batch = db.batch();
    batch.delete(db.collection('users').doc(userId).collection('collection').doc(cardId));
    batch.delete(db.collection('users').doc(userId).collection('forSale').doc(cardId));
    await batch.commit();
}

// --- BULK OPERATIONS ---
export function toggleBulkEditMode() {
    state.bulkEdit.isActive = !state.bulkEdit.isActive;
    if (!state.bulkEdit.isActive) state.bulkEdit.selected.clear();
    return state.bulkEdit.isActive;
}

export function toggleCardSelection(cardId) {
    if (state.bulkEdit.selected.has(cardId)) {
        state.bulkEdit.selected.delete(cardId);
    } else {
        state.bulkEdit.selected.add(cardId);
    }
}

export function selectCards(cardIds, shouldSelect) {
    cardIds.forEach(id => {
        if (shouldSelect) state.bulkEdit.selected.add(id);
        else state.bulkEdit.selected.delete(id);
    });
}

export async function batchDelete(userId, cardIds) {
    const batch = db.batch();
    const collectionRef = db.collection('users').doc(userId).collection('collection');
    const forSaleRef = db.collection('users').doc(userId).collection('forSale');
    cardIds.forEach(id => {
        batch.delete(collectionRef.doc(id));
        batch.delete(forSaleRef.doc(id));
    });
    await batch.commit();
    state.bulkEdit.selected.clear();
    toggleBulkEditMode();
}

export async function batchUpdateSaleStatus(userId, updates) {
    const batch = db.batch();
    const collectionRef = db.collection('users').doc(userId).collection('collection');
    const forSaleRef = db.collection('users').doc(userId).collection('forSale');

    for (const update of updates) {
        const { id, data } = update;
        const mainDocRef = collectionRef.doc(id);
        const saleDocRef = forSaleRef.doc(id);
        
        batch.update(mainDocRef, data);
        
        const originalCard = getCardById(id);
        const listingData = { ...originalCard, ...data, listedAt: firebase.firestore.FieldValue.serverTimestamp() };
        batch.set(saleDocRef, listingData);
    }

    await batch.commit();
    state.bulkEdit.selected.clear();
    toggleBulkEditMode();
}

// --- FILTERS & STATE ---
function applyFilters() {
    const { game, name, set, rarity, colors, type } = state.filters;
    state.filteredCollection = state.collection.filter(card => {
        if (game !== 'all' && card.game !== game) return false;
        if (name && !card.name.toLowerCase().includes(name.toLowerCase())) return false;
        if (set.length > 0 && !set.includes(card.set_name)) return false;
        if (rarity.length > 0 && !rarity.includes(card.rarity)) return false;
        if (type && card.type_line && !card.type_line.toLowerCase().includes(type.toLowerCase())) return false;
        if (colors.length > 0 && (!card.colors || !colors.every(c => card.colors.includes(c)))) return false;
        return true;
    });
}

export function setFilters(newFilters) {
    state.filters = { ...state.filters, ...newFilters };
    applyFilters();
}

export function setTab(tab) { state.activeTab = tab; }
export function setView(view) { state.activeView = view; }

export function getAvailableFilterOptions(game) {
    const source = state.activeTab === 'collection' ? state.collection : state.wishlist;
    const gameCards = game === 'all' ? source : source.filter(c => c.game === game);
    return {
        sets: [...new Set(gameCards.map(c => c.set_name))].sort(),
        rarities: [...new Set(gameCards.map(c => c.rarity))].sort(),
        types: [...new Set(gameCards.flatMap(c => c.type_line ? c.type_line.split(' // ')[0].split(' ') : []))].sort(),
    };
}

export function toggleColorFilter(color) {
    const index = state.filters.colors.indexOf(color);
    if (index > -1) state.filters.colors.splice(index, 1);
    else state.filters.colors.push(color);
    return state.filters.colors;
}

// --- STATS CALCULATION ---
export function calculateCollectionStats() {
    const totalCards = state.collection.reduce((sum, card) => sum + (card.quantity || 1), 0);
    const uniqueCards = new Set(state.collection.map(c => c.name)).size;
    const totalValue = state.collection.reduce((sum, card) => {
        // Correctly and safely access nested price property
        const price = (card && card.prices && card.prices.usd) ? parseFloat(card.prices.usd) : 0;
        return sum + (price * (card.quantity || 1));
    }, 0);
    return { totalCards, uniqueCards, totalValue };
}

export function calculateWishlistStats() {
    return { totalCards: 0, uniqueCards: 0, totalValue: 0 }; // Placeholder
}

// --- PENDING CARDS for multi-version add ---
export const getPendingCards = () => state.pendingCards;
export const addPendingCard = (cardData) => state.pendingCards.push(cardData);
export const removePendingCard = (index) => state.pendingCards.splice(index, 1);