/**
 * marketplace.js
 * Connects to Firebase to power a real-time Trading Card Marketplace.
 * Features: Firestore data fetching, authentication checks, real-time search, filtering, and pagination.
 * FIX: Now fetches from the top-level 'marketplaceListings' collection.
 * FIX: Correctly imports 'getCollection' from 'api.js' to load user's collection for listing.
 */
import { getCollection } from './modules/api.js';
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
                console.log("No user logged in. Marketplace is in read-only mode.");
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
        document.getElementById('searchInput')?.addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('searchBtn')?.addEventListener('click', () => this.handleSearch(document.getElementById('searchInput').value));
        
        ['gameFilter', 'conditionFilter', 'sortFilter', 'minPrice', 'maxPrice'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this.applyFilters());
        });
        
        document.getElementById('add-from-collection-btn')?.addEventListener('click', () => this.openAddFromCollectionModal());
        
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
        if(loadingIndicator) loadingIndicator.style.display = 'block';

        try {
            const snapshot = await this.db.collection('marketplaceListings').where('status', '==', 'available').orderBy('datePosted', 'desc').get();
            this.allCards = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    datePosted: data.datePosted?.toDate() // Safely convert Timestamp
                };
            });
            this.filteredCards = [...this.allCards];
            this.updateStats();
            this.applyFilters();
        } catch (error) {
            console.error("Error loading marketplace listings:", error);
            this.showNotification("Failed to load marketplace data.", "error");
        } finally {
            if(loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.applyFilters(query);
        }, 300);
    }
    
    applyFilters(searchQuery = document.getElementById('searchInput').value) {
        let filtered = [...this.allCards];
        const searchTerm = searchQuery.toLowerCase().trim();
        if (searchTerm) {
            filtered = filtered.filter(card =>
                card.name.toLowerCase().includes(searchTerm) ||
                (card.set && card.set.toLowerCase().includes(searchTerm)) ||
                (card.seller?.handle && card.seller.handle.toLowerCase().includes(searchTerm))
            );
        }

        const gameFilter = document.getElementById('gameFilter').value;
        if (gameFilter) filtered = filtered.filter(card => card.game === gameFilter);

        const conditionFilter = document.getElementById('conditionFilter').value;
        if (conditionFilter) filtered = filtered.filter(card => card.condition === conditionFilter);

        const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
        const maxPrice = parseFloat(document.getElementById('maxPrice').value) || Infinity;
        filtered = filtered.filter(card => card.price >= minPrice && card.price <= maxPrice);
        
        this.sortCards(filtered, document.getElementById('sortFilter').value);
        
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
        if (!container || !noResults) return;

        noResults.style.display = 'none';
        
        if (this.filteredCards.length === 0) {
            noResults.style.display = 'block';
            container.innerHTML = '';
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const cardsToShow = this.filteredCards.slice(startIndex, startIndex + this.itemsPerPage);
        
        container.innerHTML = cardsToShow.map(card => this.createCardHTML(card)).join('');
        
        container.querySelectorAll('.card-item').forEach(cardElement => {
            cardElement.addEventListener('click', (e) => {
                if (!e.target.closest('.card-actions')) {
                    this.openCardModal(cardElement.dataset.cardId);
                }
            });
        });

        container.querySelectorAll('.message-seller-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sellerId = btn.dataset.sellerId;
                if (window.messenger && typeof window.messenger.startConversation === 'function') {
                    window.messenger.startConversation(sellerId);
                } else {
                    alert("Messaging feature is currently unavailable.");
                }
            });
        });
    }

    createCardHTML(card) {
        const gameNames = { pokemon: 'Pokémon', mtg: 'Magic: TG', lorcana: 'Lorcana', gundam: 'Gundam' };
        const conditionNames = { 'mint': 'Mint', 'near-mint': 'Near Mint', 'lightly-played': 'Lightly Played', 'moderately-played': 'Mod Played', 'heavily-played': 'Heavily Played', 'damaged': 'Damaged' };

        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col card-item" data-card-id="${card.id}">
                <div class="h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <img src="${card.image || getCardImageUrl(card)}" alt="${card.name}" class="w-full h-full object-contain" onerror="this.style.display='none'">
                </div>
                <div class="p-4 flex flex-col flex-grow">
                    <h3 class="font-bold text-md mb-2 truncate">${card.name}</h3>
                    <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span>${gameNames[card.game] || card.game}</span>
                        <span>${conditionNames[card.condition] || card.condition}</span>
                    </div>
                    <p class="text-lg font-bold text-blue-600 dark:text-blue-400 mb-2">$${card.price.toFixed(2)}</p>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-auto">
                        <i class="fas fa-user"></i> ${card.seller?.handle || 'N/A'}
                        <i class="fas fa-map-marker-alt ml-2"></i> ${card.seller?.location || 'N/A'}
                    </div>
                     <div class="card-actions mt-2">
                        <button class="w-full bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 message-seller-btn" data-seller-id="${card.seller?.uid}">
                           <i class="fas fa-comments"></i> Message
                        </button>
                    </div>
                </div>
            </div>`;
    }

    renderPagination() {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;
        const totalPages = Math.ceil(this.filteredCards.length / this.itemsPerPage);
        
        pagination.style.display = totalPages <= 1 ? 'none' : 'flex';
        if (totalPages <= 1) return;

        let paginationHTML = '';
        if (this.currentPage > 1) {
            paginationHTML += `<button class="page-btn" data-page="${this.currentPage - 1}"><i class="fas fa-chevron-left"></i></button>`;
        }
        for (let i = 1; i <= totalPages; i++) {
             paginationHTML += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (this.currentPage < totalPages) {
            paginationHTML += `<button class="page-btn" data-page="${this.currentPage + 1}"><i class="fas fa-chevron-right"></i></button>`;
        }
        
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
        document.getElementById('modalBody').innerHTML = `
            <p><strong>Game:</strong> ${card.game}</p>
            <p><strong>Set:</strong> ${card.set}</p>
            <p><strong>Condition:</strong> ${card.condition}</p>
            <p><strong>Price:</strong> $${card.price.toFixed(2)}</p>
            <p><strong>Description:</strong> ${card.description || 'N/A'}</p>
            <hr class="my-4">
            <h4>Seller Information</h4>
            <p><strong>User:</strong> ${card.seller.handle}</p>
            <p><strong>Location:</strong> ${card.seller.location}</p>
            <div class="card-actions mt-4">
                <button class="btn btn-primary message-seller-btn" data-seller-id="${card.seller.uid}">Message Seller</button>
            </div>
        `;
        
        modal.querySelector('.message-seller-btn').addEventListener('click', (e) => {
            const sellerId = e.currentTarget.dataset.sellerId;
            if (window.messenger && typeof window.messenger.startConversation === 'function') {
                window.messenger.startConversation(sellerId);
            } else {
                alert("Messaging feature is currently unavailable.");
            }
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
            this.userCollection = await getCollection(this.currentUser.uid);
            
            if (this.userCollection.length === 0) {
                container.innerHTML = `<p class="text-center text-gray-500">You have no cards in your collection to list.</p>`;
                return;
            }

            const cardsHtml = this.userCollection.map(card => `
                <div class="collection-item p-2 border dark:border-gray-600 rounded-md flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" data-card-id="${card.id}">
                    <img src="${getCardImageUrl(card)}" class="w-12 h-auto rounded-md mr-4">
                    <div>
                        <p class="font-semibold">${card.name}</p>
                        <p class="text-sm text-gray-500">${card.set_name}</p>
                    </div>
                </div>
            `).join('');

            container.innerHTML = `<div class="space-y-2">${cardsHtml}</div>`;
            
            container.querySelectorAll('.collection-item').forEach(item => {
                item.addEventListener('click', () => {
                    const cardId = item.dataset.cardId;
                    this.handleCollectionCardSelection(cardId);
                });
            });
        } catch (error) {
            console.error("Error fetching collection for modal:", error);
            container.innerHTML = `<p class="text-center text-red-500">Could not load your collection.</p>`;
        }
    }

    handleCollectionCardSelection(cardId) {
        const card = this.userCollection.find(c => c.id === cardId);
        if(!card) return;

        const price = prompt(`Enter a price for "${card.name}":`, card.prices?.usd || "1.00");
        if(price === null || isNaN(parseFloat(price))) {
            this.showNotification("Invalid price. Listing cancelled.", "error");
            return;
        }

        this.listCardFromCollection(card, parseFloat(price));
    }

    async listCardFromCollection(card, price) {
        if (!this.currentUser || !this.userProfile) {
            this.showNotification("You must be logged in to list an item.", "error");
            return;
        }

        const newListing = {
            name: card.name,
            game: card.game,
            set: card.set_name,
            condition: card.condition,
            price: price,
            image: getCardImageUrl(card),
            description: card.notes || '',
            status: 'available',
            datePosted: firebase.firestore.FieldValue.serverTimestamp(),
            seller: {
                uid: this.currentUser.uid,
                handle: this.userProfile.handle,
                location: `${this.userProfile.city || ''}, ${this.userProfile.country || ''}`.replace(/^, |, $/g, ''),
            },
            collectionCardId: card.id
        };

        try {
            await this.db.collection('marketplaceListings').add(newListing);
            this.showNotification("Card listed successfully!", "success");
            this.closeModal('add-from-collection-modal');
            this.loadFirebaseData(); // Refresh data
        } catch (error) {
            console.error("Error adding document: ", error);
            this.showNotification("Failed to list card. Please try again.", "error");
        }
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId)
        if(modal) {
            modal.style.display = 'flex';
            modal.classList.add('items-center', 'justify-center');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if(modal) modal.style.display = 'none';
    }

    updateStats() {
        const totalListings = this.allCards.length;
        const activeTraders = new Set(this.allCards.map(card => card.seller?.uid)).size;
        const totalValue = this.allCards.reduce((sum, card) => sum + (card.price || 0), 0);

        document.getElementById('totalListings').textContent = totalListings.toLocaleString();
        document.getElementById('activeTraders').textContent = activeTraders.toLocaleString();
        document.getElementById('totalValue').textContent = `$${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        document.getElementById('completedTrades').textContent = 'N/A';
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('toast-container') || document.body;
        const toast = document.createElement('div');
        const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
        toast.className = `fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white z-[1001] ${colors[type]}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.marketplaceApp = new MarketplaceApp();
});

