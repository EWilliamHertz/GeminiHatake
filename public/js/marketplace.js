/**
 * marketplace.js
 * FIX: Merges original marketplace logic with new collection-listing functionality.
 * FIX: Corrects module import from collection.js to resolve loading error.
 */
import * as Collection from './modules/collection.js';
import { getCardImageUrl } from './modules/utils.js';

class MarketplaceApp {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 12;
        this.allCards = [];
        this.filteredCards = [];
        this.searchTimeout = null;
        this.currentUser = null;
        this.userProfile = null;
        this.userCollection = [];
        
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        
        this.auth.onAuthStateChanged(user => {
            this.currentUser = user;
            if (user) {
                this.fetchUserProfile(user.uid).then(() => this.init());
            } else {
                this.init();
            }
        });
    }

    async fetchUserProfile(uid) {
        try {
            const userDoc = await this.db.collection('users').doc(uid).get();
            this.userProfile = userDoc.exists ? userDoc.data() : { handle: "Anonymous", location: "Unknown" };
        } catch (error) {
            console.error("Error fetching user profile:", error);
            this.userProfile = { handle: "Anonymous", location: "Unknown" };
        }
    }

    init() {
        this.bindEvents();
        this.loadFirebaseData();
    }

    bindEvents() {
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('searchBtn').addEventListener('click', () => this.handleSearch(document.getElementById('searchInput').value));
        
        const filters = ['gameFilter', 'conditionFilter', 'sortFilter', 'minPrice', 'maxPrice'];
        filters.forEach(id => document.getElementById(id).addEventListener('input', () => this.applyFilters()));
        
        document.getElementById('add-from-collection-btn').addEventListener('click', () => this.openAddFromCollectionModal());
        
        document.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modal = document.getElementById(btn.dataset.modalClose);
                if(modal) this.closeModal(modal.id);
            });
        });
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) this.closeModal(e.target.id);
        });
    }

    async loadFirebaseData() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        loadingIndicator.style.display = 'block';
        try {
            const snapshot = await this.db.collection('marketplaceListings').where('status', '==', 'available').orderBy('datePosted', 'desc').get();
            this.allCards = snapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data, datePosted: data.datePosted.toDate() };
            });
            this.filteredCards = [...this.allCards];
            this.updateStats();
            this.applyFilters();
        } catch (error) {
            console.error("Error loading marketplace listings:", error);
            this.showNotification("Failed to load marketplace data.", "error");
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.applyFilters(query), 300);
    }
    
    applyFilters(searchQuery = document.getElementById('searchInput').value) {
        let filtered = [...this.allCards];
        const searchTerm = searchQuery.toLowerCase().trim();
        if (searchTerm) {
            filtered = filtered.filter(card =>
                card.name.toLowerCase().includes(searchTerm) ||
                (card.set && card.set.toLowerCase().includes(searchTerm)) ||
                (card.seller.handle && card.seller.handle.toLowerCase().includes(searchTerm))
            );
        }
        const gameFilter = document.getElementById('gameFilter').value;
        if (gameFilter) filtered = filtered.filter(card => card.game === gameFilter);
        const conditionFilter = document.getElementById('conditionFilter').value;
        if (conditionFilter) filtered = filtered.filter(card => card.condition === conditionFilter);
        const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
        const maxPrice = parseFloat(document.getElementById('maxPrice').value) || Infinity;
        filtered = filtered.filter(card => card.price >= minPrice && card.price <= maxPrice);
        
        const sortBy = document.getElementById('sortFilter').value;
        this.sortCards(filtered, sortBy);
        
        this.filteredCards = filtered;
        this.currentPage = 1;
        this.renderCards();
        this.renderPagination();
    }

    sortCards(cards, sortBy) {
        switch (sortBy) {
            case 'newest': cards.sort((a, b) => b.datePosted - a.datePosted); break;
            case 'oldest': cards.sort((a, b) => a.datePosted - b.datePosted); break;
            case 'price-low': cards.sort((a, b) => a.price - b.price); break;
            case 'price-high': cards.sort((a, b) => b.price - a.price); break;
            case 'name': cards.sort((a, b) => a.name.localeCompare(b.name)); break;
        }
    }

    renderCards() {
        const container = document.getElementById('marketplaceGrid');
        const noResults = document.getElementById('noResults');
        container.style.display = 'none';
        noResults.style.display = 'none';
        if (this.filteredCards.length === 0) {
            noResults.style.display = 'block';
            return;
        }
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const cardsToShow = this.filteredCards.slice(startIndex, endIndex);
        container.innerHTML = cardsToShow.map(card => this.createCardHTML(card)).join('');
        container.style.display = 'grid';
        container.querySelectorAll('.card-item').forEach(cardElement => {
            cardElement.addEventListener('click', (e) => {
                if (!e.target.closest('.card-actions')) this.openCardModal(cardElement.dataset.cardId);
            });
        });
        container.querySelectorAll('.message-seller-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.messenger?.startConversation) window.messenger.startConversation(btn.dataset.sellerId);
            });
        });
    }

    createCardHTML(card) {
        const gameNames = { pokemon: 'Pokémon', magic: 'Magic: TG', yugioh: 'Yu-Gi-Oh!', lorcana: 'Lorcana', gundam: 'Gundam' };
        const conditionNames = { 'mint': 'Mint', 'near-mint': 'Near Mint', 'lightly-played': 'Lightly Played', 'moderately-played': 'Mod Played', 'heavily-played': 'Heavily Played', 'damaged': 'Damaged' };
        return `
            <div class="card-item" data-card-id="${card.id}">
                <div class="card-image">${card.image ? `<img src="${card.image}" alt="${card.name}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i class="fas fa-image"></i>`}</div>
                <div class="card-info">
                    <div class="card-name">${card.name}</div>
                    <div class="card-details"><span class="card-game">${gameNames[card.game] || card.game}</span><span class="card-condition">${conditionNames[card.condition] || card.condition}</span></div>
                    <div class="card-price">$${card.price.toFixed(2)}</div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 15px;"><i class="fas fa-user"></i> ${card.seller.handle || 'Unknown'} • <i class="fas fa-map-marker-alt"></i> ${card.seller.location || 'Unknown'}</div>
                    <div class="card-actions"><button class="btn btn-primary message-seller-btn" data-seller-id="${card.seller.uid}"><i class="fas fa-comments"></i> Message</button></div>
                </div>
            </div>`;
    }

    renderPagination() {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredCards.length / this.itemsPerPage);
        if (totalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }
        pagination.style.display = 'flex';
        let paginationHTML = '';
        if (this.currentPage > 1) paginationHTML += `<button class="page-btn" data-page="${this.currentPage - 1}"><i class="fas fa-chevron-left"></i></button>`;
        for (let i = 1; i <= totalPages; i++) paginationHTML += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        if (this.currentPage < totalPages) paginationHTML += `<button class="page-btn" data-page="${this.currentPage + 1}"><i class="fas fa-chevron-right"></i></button>`;
        pagination.innerHTML = paginationHTML;
        pagination.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentPage = parseInt(btn.dataset.page);
                this.renderCards();
                this.renderPagination();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    openCardModal(cardId) {
        const card = this.allCards.find(c => c.id === cardId);
        if (!card) return;
        const modal = document.getElementById('cardModal');
        document.getElementById('modalTitle').textContent = card.name;
        document.getElementById('modalBody').innerHTML = `<p><strong>Game:</strong> ${card.game}</p><p><strong>Set:</strong> ${card.set}</p><p><strong>Condition:</strong> ${card.condition}</p><p><strong>Price:</strong> $${card.price.toFixed(2)}</p><p><strong>Description:</strong> ${card.description || 'N/A'}</p><hr class="my-4"><h4>Seller Information</h4><p><strong>User:</strong> ${card.seller.handle}</p><p><strong>Location:</strong> ${card.seller.location}</p><div class="card-actions mt-4"><button class="btn btn-primary message-seller-btn" data-seller-id="${card.seller.uid}">Message Seller</button></div>`;
        modal.querySelector('.message-seller-btn').addEventListener('click', (e) => {
            if (window.messenger?.startConversation) window.messenger.startConversation(e.currentTarget.dataset.sellerId);
        });
        this.openModal('cardModal');
    }

    async openAddFromCollectionModal() {
        if (!this.currentUser) {
            this.showNotification("Please log in to list a card.", "error");
            return;
        }
        this.openModal('add-from-collection-modal');
        const container = document.getElementById('collection-selection-container');
        container.innerHTML = `<p class="text-center text-gray-500">Loading your collection...</p>`;
        try {
            this.userCollection = await Collection.loadCollection(this.currentUser.uid);
            if (this.userCollection.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">You have no cards in your collection to list.</p>`;
                return;
            }
            const cardsHtml = this.userCollection.map(card => `
                <div class="collection-item p-2 border dark:border-gray-600 rounded-md flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" data-card-id="${card.id}">
                    <img src="${getCardImageUrl(card)}" class="w-12 h-auto rounded-md mr-4">
                    <div><p class="font-semibold">${card.name}</p><p class="text-sm text-gray-500">${card.set_name} (${card.quantity || 1} available)</p></div>
                </div>`).join('');
            container.innerHTML = `<div class="space-y-2">${cardsHtml}</div>`;
            container.querySelectorAll('.collection-item').forEach(item => {
                item.addEventListener('click', () => this.handleCollectionCardSelection(item.dataset.cardId));
            });
        } catch (error) {
            container.innerHTML = `<p class="text-center text-red-500">Error loading collection: ${error.message}</p>`;
        }
    }

    handleCollectionCardSelection(cardId) {
        const card = this.userCollection.find(c => c.id === cardId);
        if(!card) return;
        const defaultPrice = card.prices?.usd || card.prices?.usd_foil || "1.00";
        const price = prompt(`Enter a sale price for "${card.name}":`, defaultPrice);
        if (price === null || isNaN(parseFloat(price))) {
            this.showNotification("Invalid price. Listing cancelled.", "error");
            return;
        }
        this.listCardFromCollection(card, parseFloat(price));
    }

    async listCardFromCollection(card, price) {
        if (!this.currentUser || !this.userProfile) return;
        const newListing = {
            name: card.name, game: card.game, set: card.set_name, condition: card.condition, price: price,
            image: getCardImageUrl(card), description: card.notes || '', status: 'available',
            datePosted: firebase.firestore.FieldValue.serverTimestamp(),
            seller: { uid: this.currentUser.uid, handle: this.userProfile.handle, location: `${this.userProfile.city || ''}, ${this.userProfile.country || ''}`.replace(/^, |, $/g, '') },
            collectionCardId: card.id,
        };
        try {
            await this.db.collection('marketplaceListings').add(newListing);
            this.showNotification("Card listed successfully!", "success");
            this.closeModal('add-from-collection-modal');
            this.loadFirebaseData();
        } catch (error) {
            console.error("Error listing card:", error);
            this.showNotification("Failed to list card.", "error");
        }
    }
    
    openModal(modalId) { const modal = document.getElementById(modalId); if(modal) { modal.style.display = 'flex'; modal.classList.add('items-center', 'justify-center'); } }
    closeModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'none'; }
    updateStats() {
        document.getElementById('totalListings').textContent = this.allCards.length.toLocaleString();
        document.getElementById('activeTraders').textContent = new Set(this.allCards.map(c => c.seller.uid)).size.toLocaleString();
        document.getElementById('totalValue').textContent = `$${this.allCards.reduce((s, c) => s + c.price, 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById('completedTrades').textContent = 'N/A';
    }
    showNotification(message, type = 'info') {
        const n = document.createElement('div');
        n.className = `fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-[1001] ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.marketplaceApp = new MarketplaceApp(); });