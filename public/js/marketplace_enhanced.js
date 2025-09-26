/**
 * Enhanced Marketplace JavaScript
 * Supports multiple trading card games with advanced, dynamic filtering
 */

class EnhancedMarketplace {
    constructor() {
        this.db = firebase.firestore();
        this.currentUser = null;
        this.currentView = 'grid';
        this.currentPage = 0;
        this.pageSize = 20;
        this.lastVisible = null;
        this.isLoading = false;
        
        this.supportedGames = {
            'mtg': {
                name: 'Magic: The Gathering',
                icon: 'fas fa-magic',
                rarities: ['common', 'uncommon', 'rare', 'mythic', 'special'],
                colors: { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' }
            },
            'pokemon': {
                name: 'Pokémon',
                icon: 'fas fa-paw',
                rarities: ['common', 'uncommon', 'rare', 'rare holo', 'ultra rare', 'secret rare'],
                types: ['Colorless', 'Darkness', 'Dragon', 'Fairy', 'Fighting', 'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water']
            },
            'lorcana': {
                name: 'Lorcana',
                icon: 'fas fa-crown',
                rarities: ['common', 'uncommon', 'rare', 'super rare', 'legendary', 'enchanted'],
                colors: ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel']
            },
            'gundam': {
                name: 'Gundam',
                icon: 'fas fa-robot',
                rarities: ['common', 'uncommon', 'rare', 'double rare', 'secret rare'],
                colors: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'White', 'Black']
            }
        };

        this.activeFilters = {
            selectedGame: 'all',
            searchText: '',
            priceMin: null,
            priceMax: null,
            conditions: [],
            rarities: [],
            isGraded: false,
            isFoil: false,
            isSigned: false,
            gameSpecific: {}
        };

        this.init();
    }

    init() {
        firebase.auth().onAuthStateChanged(user => {
            this.currentUser = user;
            this.setupUI();
            this.addEventListeners();
            this.fetchListings(true);
        });
    }

    setupUI() {
        this.setupGameTabs();
        this.setupRarityFilters();
        this.setupGameSpecificFilters();
    }

    setupGameTabs() {
        const gameTabs = document.querySelectorAll('.game-tab');
        gameTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // Remove active class from all tabs
                gameTabs.forEach(t => t.classList.remove('active', 'bg-blue-600', 'text-white'));
                gameTabs.forEach(t => t.classList.add('bg-white', 'dark:bg-gray-800'));
                
                // Add active class to clicked tab
                e.target.classList.add('active', 'bg-blue-600', 'text-white');
                e.target.classList.remove('bg-white', 'dark:bg-gray-800');
                
                this.activeFilters.selectedGame = e.target.dataset.game;
                this.setupRarityFilters();
                this.setupGameSpecificFilters();
                this.fetchListings(true);
            });
        });
    }

    setupRarityFilters() {
        const container = document.getElementById('rarity-filter-container');
        container.innerHTML = '';

        let rarities = [];
        if (this.activeFilters.selectedGame === 'all') {
            // Combine all rarities from all games
            rarities = [...new Set(Object.values(this.supportedGames).flatMap(game => game.rarities))];
        } else if (this.supportedGames[this.activeFilters.selectedGame]) {
            rarities = this.supportedGames[this.activeFilters.selectedGame].rarities;
        }

        rarities.forEach(rarity => {
            container.innerHTML += `
                <label class="flex items-center space-x-2 text-sm cursor-pointer">
                    <input type="checkbox" class="rarity-filter rounded" value="${rarity}">
                    <span class="capitalize">${rarity}</span>
                </label>
            `;
        });
    }

    setupGameSpecificFilters() {
        const container = document.getElementById('game-specific-filters');
        container.innerHTML = '';
        this.activeFilters.gameSpecific = {};

        if (this.activeFilters.selectedGame === 'all') {
            return; // No game-specific filters for "all games"
        }

        const gameData = this.supportedGames[this.activeFilters.selectedGame];
        if (!gameData) return;

        // MTG Color Filters
        if (this.activeFilters.selectedGame === 'mtg' && gameData.colors) {
            let colorsHtml = `
                <div class="pt-4 border-t dark:border-gray-700">
                    <h3 class="font-semibold mb-2 flex items-center">
                        <i class="fas fa-palette mr-2"></i>Magic Colors
                    </h3>
                    <div class="grid grid-cols-2 gap-2">
            `;
            
            Object.entries(gameData.colors).forEach(([code, name]) => {
                colorsHtml += `
                    <label class="flex items-center space-x-2 text-sm cursor-pointer">
                        <input type="checkbox" class="mtg-color-filter rounded" value="${code}">
                        <span>${name}</span>
                    </label>
                `;
            });
            
            colorsHtml += '</div></div>';
            container.innerHTML += colorsHtml;
        }

        // Pokémon Type Filters
        if (this.activeFilters.selectedGame === 'pokemon' && gameData.types) {
            let typesHtml = `
                <div class="pt-4 border-t dark:border-gray-700">
                    <h3 class="font-semibold mb-2 flex items-center">
                        <i class="fas fa-bolt mr-2"></i>Pokémon Type
                    </h3>
                    <select id="pokemon-type-filter" class="w-full p-2 rounded bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">All Types</option>
            `;
            
            gameData.types.forEach(type => {
                typesHtml += `<option value="${type}">${type}</option>`;
            });
            
            typesHtml += '</select></div>';
            container.innerHTML += typesHtml;
        }

        // Lorcana Color Filters
        if (this.activeFilters.selectedGame === 'lorcana' && gameData.colors) {
            let colorsHtml = `
                <div class="pt-4 border-t dark:border-gray-700">
                    <h3 class="font-semibold mb-2 flex items-center">
                        <i class="fas fa-gem mr-2"></i>Lorcana Ink
                    </h3>
                    <div class="grid grid-cols-2 gap-2">
            `;
            
            gameData.colors.forEach(color => {
                colorsHtml += `
                    <label class="flex items-center space-x-2 text-sm cursor-pointer">
                        <input type="checkbox" class="lorcana-color-filter rounded" value="${color}">
                        <span>${color}</span>
                    </label>
                `;
            });
            
            colorsHtml += '</div></div>';
            container.innerHTML += colorsHtml;
        }

        // Gundam Color Filters
        if (this.activeFilters.selectedGame === 'gundam' && gameData.colors) {
            let colorsHtml = `
                <div class="pt-4 border-t dark:border-gray-700">
                    <h3 class="font-semibold mb-2 flex items-center">
                        <i class="fas fa-cog mr-2"></i>Gundam Color
                    </h3>
                    <div class="grid grid-cols-2 gap-2">
            `;
            
            gameData.colors.forEach(color => {
                colorsHtml += `
                    <label class="flex items-center space-x-2 text-sm cursor-pointer">
                        <input type="checkbox" class="gundam-color-filter rounded" value="${color}">
                        <span>${color}</span>
                    </label>
                `;
            });
            
            colorsHtml += '</div></div>';
            container.innerHTML += colorsHtml;
        }
    }

    addEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.activeFilters.searchText = e.target.value.toLowerCase().trim();
                this.fetchListings(true);
            }, 300);
        });

        // Price range filters
        document.getElementById('price-min').addEventListener('change', (e) => {
            this.activeFilters.priceMin = e.target.value ? parseFloat(e.target.value) : null;
            this.fetchListings(true);
        });

        document.getElementById('price-max').addEventListener('change', (e) => {
            this.activeFilters.priceMax = e.target.value ? parseFloat(e.target.value) : null;
            this.fetchListings(true);
        });

        // Condition filters
        document.getElementById('condition-filter-container').addEventListener('change', (e) => {
            if (e.target.classList.contains('condition-filter')) {
                this.activeFilters.conditions = Array.from(
                    document.querySelectorAll('.condition-filter:checked')
                ).map(el => el.value);
                this.fetchListings(true);
            }
        });

        // Special attribute filters
        document.getElementById('filter-graded').addEventListener('change', (e) => {
            this.activeFilters.isGraded = e.target.checked;
            this.fetchListings(true);
        });

        document.getElementById('filter-foil').addEventListener('change', (e) => {
            this.activeFilters.isFoil = e.target.checked;
            this.fetchListings(true);
        });

        document.getElementById('filter-signed').addEventListener('change', (e) => {
            this.activeFilters.isSigned = e.target.checked;
            this.fetchListings(true);
        });

        // Rarity filters
        document.getElementById('rarity-filter-container').addEventListener('change', (e) => {
            if (e.target.classList.contains('rarity-filter')) {
                this.activeFilters.rarities = Array.from(
                    document.querySelectorAll('.rarity-filter:checked')
                ).map(el => el.value);
                this.fetchListings(true);
            }
        });

        // Game-specific filters
        document.getElementById('game-specific-filters').addEventListener('change', (e) => {
            if (e.target.classList.contains('mtg-color-filter')) {
                this.activeFilters.gameSpecific.mtgColors = Array.from(
                    document.querySelectorAll('.mtg-color-filter:checked')
                ).map(el => el.value);
            } else if (e.target.id === 'pokemon-type-filter') {
                this.activeFilters.gameSpecific.pokemonType = e.target.value || null;
            } else if (e.target.classList.contains('lorcana-color-filter')) {
                this.activeFilters.gameSpecific.lorcanaColors = Array.from(
                    document.querySelectorAll('.lorcana-color-filter:checked')
                ).map(el => el.value);
            } else if (e.target.classList.contains('gundam-color-filter')) {
                this.activeFilters.gameSpecific.gundamColors = Array.from(
                    document.querySelectorAll('.gundam-color-filter:checked')
                ).map(el => el.value);
            }
            this.fetchListings(true);
        });

        // Sort order
        document.getElementById('sort-order').addEventListener('change', () => {
            this.fetchListings(true);
        });

        // View toggle
        document.getElementById('view-grid').addEventListener('click', () => {
            this.currentView = 'grid';
            this.updateViewButtons();
            this.renderListings();
        });

        document.getElementById('view-list').addEventListener('click', () => {
            this.currentView = 'list';
            this.updateViewButtons();
            this.renderListings();
        });

        // Clear filters
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Load more
        document.getElementById('load-more-btn').addEventListener('click', () => {
            this.fetchListings(false);
        });
    }

    updateViewButtons() {
        const gridBtn = document.getElementById('view-grid');
        const listBtn = document.getElementById('view-list');
        
        if (this.currentView === 'grid') {
            gridBtn.classList.add('bg-blue-600', 'text-white');
            gridBtn.classList.remove('bg-gray-300', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-300');
            listBtn.classList.remove('bg-blue-600', 'text-white');
            listBtn.classList.add('bg-gray-300', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-300');
        } else {
            listBtn.classList.add('bg-blue-600', 'text-white');
            listBtn.classList.remove('bg-gray-300', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-300');
            gridBtn.classList.remove('bg-blue-600', 'text-white');
            gridBtn.classList.add('bg-gray-300', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-300');
        }
    }

    clearAllFilters() {
        // Reset all filter inputs
        document.getElementById('search-input').value = '';
        document.getElementById('price-min').value = '';
        document.getElementById('price-max').value = '';
        
        document.querySelectorAll('.condition-filter').forEach(el => el.checked = false);
        document.querySelectorAll('.rarity-filter').forEach(el => el.checked = false);
        document.querySelectorAll('.mtg-color-filter').forEach(el => el.checked = false);
        document.querySelectorAll('.lorcana-color-filter').forEach(el => el.checked = false);
        document.querySelectorAll('.gundam-color-filter').forEach(el => el.checked = false);
        
        const pokemonTypeFilter = document.getElementById('pokemon-type-filter');
        if (pokemonTypeFilter) pokemonTypeFilter.value = '';
        
        document.getElementById('filter-graded').checked = false;
        document.getElementById('filter-foil').checked = false;
        document.getElementById('filter-signed').checked = false;

        // Reset active filters
        this.activeFilters = {
            selectedGame: this.activeFilters.selectedGame, // Keep current game selection
            searchText: '',
            priceMin: null,
            priceMax: null,
            conditions: [],
            rarities: [],
            isGraded: false,
            isFoil: false,
            isSigned: false,
            gameSpecific: {}
        };

        this.fetchListings(true);
    }

    async fetchListings(reset = false) {
        if (this.isLoading) return;
        
        this.isLoading = true;
        const loadingIndicator = document.getElementById('loading-indicator');
        const noResultsDiv = document.getElementById('no-results');
        const loadMoreContainer = document.getElementById('load-more-container');
        
        if (reset) {
            this.currentPage = 0;
            this.lastVisible = null;
            loadingIndicator.classList.remove('hidden');
            noResultsDiv.classList.add('hidden');
            loadMoreContainer.classList.add('hidden');
        }

        try {
            const listings = await this.queryListings();
            
            if (reset) {
                this.allListings = listings;
            } else {
                this.allListings = [...(this.allListings || []), ...listings];
            }

            this.renderListings();
            this.updateResultsCount();
            
            // Show load more button if we got a full page of results
            if (listings.length === this.pageSize) {
                loadMoreContainer.classList.remove('hidden');
            } else {
                loadMoreContainer.classList.add('hidden');
            }

        } catch (error) {
            console.error('Error fetching marketplace listings:', error);
            this.showError('Error loading listings. Please try again later.');
        } finally {
            this.isLoading = false;
            loadingIndicator.classList.add('hidden');
        }
    }

    async queryListings() {
        let query = this.db.collection('marketplace');

        // Game filter
        if (this.activeFilters.selectedGame !== 'all') {
            query = query.where('game', '==', this.activeFilters.selectedGame);
        }

        // Search filter
        if (this.activeFilters.searchText) {
            query = query.where('name_lowercase', '>=', this.activeFilters.searchText)
                        .where('name_lowercase', '<=', this.activeFilters.searchText + '\uf8ff');
        }

        // Price filters
        if (this.activeFilters.priceMin !== null) {
            query = query.where('price', '>=', this.activeFilters.priceMin);
        }
        if (this.activeFilters.priceMax !== null) {
            query = query.where('price', '<=', this.activeFilters.priceMax);
        }

        // Condition filter
        if (this.activeFilters.conditions.length > 0) {
            query = query.where('condition', 'in', this.activeFilters.conditions);
        }

        // Rarity filter
        if (this.activeFilters.rarities.length > 0) {
            query = query.where('rarity', 'in', this.activeFilters.rarities);
        }

        // Special attributes
        if (this.activeFilters.isGraded) {
            query = query.where('is_graded', '==', true);
        }
        if (this.activeFilters.isFoil) {
            query = query.where('is_foil', '==', true);
        }
        if (this.activeFilters.isSigned) {
            query = query.where('is_signed', '==', true);
        }

        // Game-specific filters
        const gameSpecific = this.activeFilters.gameSpecific;
        if (gameSpecific.mtgColors && gameSpecific.mtgColors.length > 0) {
            query = query.where('color_identity', 'array-contains-any', gameSpecific.mtgColors);
        }
        if (gameSpecific.pokemonType) {
            query = query.where('types', 'array-contains', gameSpecific.pokemonType);
        }
        if (gameSpecific.lorcanaColors && gameSpecific.lorcanaColors.length > 0) {
            query = query.where('color', 'in', gameSpecific.lorcanaColors);
        }
        if (gameSpecific.gundamColors && gameSpecific.gundamColors.length > 0) {
            query = query.where('color', 'in', gameSpecific.gundamColors);
        }

        // Sorting
        const sortOrder = document.getElementById('sort-order').value;
        switch (sortOrder) {
            case 'price-asc':
                query = query.orderBy('price', 'asc');
                break;
            case 'price-desc':
                query = query.orderBy('price', 'desc');
                break;
            case 'date-asc':
                query = query.orderBy('listedAt', 'asc');
                break;
            case 'date-desc':
                query = query.orderBy('listedAt', 'desc');
                break;
            case 'name-asc':
                query = query.orderBy('name', 'asc');
                break;
            case 'name-desc':
                query = query.orderBy('name', 'desc');
                break;
            default:
                query = query.orderBy('listedAt', 'desc');
        }

        // Pagination
        if (this.lastVisible) {
            query = query.startAfter(this.lastVisible);
        }
        query = query.limit(this.pageSize);

        const snapshot = await query.get();
        
        if (!snapshot.empty) {
            this.lastVisible = snapshot.docs[snapshot.docs.length - 1];
        }

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    renderListings() {
        const container = document.getElementById('listings-container');
        const noResultsDiv = document.getElementById('no-results');
        
        if (!this.allListings || this.allListings.length === 0) {
            container.innerHTML = '';
            noResultsDiv.classList.remove('hidden');
            return;
        }

        noResultsDiv.classList.add('hidden');
        
        if (this.currentView === 'grid') {
            this.renderGridView(container);
        } else {
            this.renderListView(container);
        }
    }

    renderGridView(container) {
        container.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4';
        container.innerHTML = this.allListings.map(listing => this.createGridCard(listing)).join('');
        this.addCardEventListeners();
    }

    renderListView(container) {
        container.className = 'space-y-4';
        container.innerHTML = this.allListings.map(listing => this.createListCard(listing)).join('');
        this.addCardEventListeners();
    }

    createGridCard(listing) {
        const imageUrl = listing.image_uris?.normal || listing.image_uris?.large || '/images/placeholder.png';
        const price = listing.price ? `$${Number(listing.price).toFixed(2)}` : 'N/A';
        const gameIcon = this.supportedGames[listing.game]?.icon || 'fas fa-question';
        
        const badges = this.createBadges(listing);
        const contactButton = this.createContactButton(listing);
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-all duration-300 cursor-pointer card-item" data-listing-id="${listing.id}">
                <div class="relative">
                    <img src="${imageUrl}" alt="${listing.name}" class="w-full h-48 object-cover">
                    <div class="absolute top-2 left-2">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            <i class="${gameIcon} mr-1"></i>
                            ${this.supportedGames[listing.game]?.name || listing.game}
                        </span>
                    </div>
                    ${badges}
                </div>
                <div class="p-4">
                    <h3 class="font-bold text-lg truncate mb-1">${listing.name}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 truncate mb-2">${listing.set_name || 'Unknown Set'}</p>
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-lg font-semibold text-green-600 dark:text-green-400">${price}</span>
                        <span class="text-sm text-gray-500 capitalize">${listing.condition || 'N/A'}</span>
                    </div>
                    <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mb-3">
                        <span>by ${listing.sellerName || 'Unknown'}</span>
                        <span>${this.formatDate(listing.listedAt)}</span>
                    </div>
                    ${contactButton}
                </div>
            </div>
        `;
    }

    createListCard(listing) {
        const imageUrl = listing.image_uris?.normal || listing.image_uris?.large || '/images/placeholder.png';
        const price = listing.price ? `$${Number(listing.price).toFixed(2)}` : 'N/A';
        const gameIcon = this.supportedGames[listing.game]?.icon || 'fas fa-question';
        
        const badges = this.createBadges(listing);
        const contactButton = this.createContactButton(listing);
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer card-item" data-listing-id="${listing.id}">
                <div class="flex">
                    <div class="relative flex-shrink-0">
                        <img src="${imageUrl}" alt="${listing.name}" class="w-24 h-32 object-cover">
                        ${badges}
                    </div>
                    <div class="flex-1 p-4">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex-1">
                                <h3 class="font-bold text-lg mb-1">${listing.name}</h3>
                                <div class="flex items-center gap-2 mb-2">
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        <i class="${gameIcon} mr-1"></i>
                                        ${this.supportedGames[listing.game]?.name || listing.game}
                                    </span>
                                    <span class="text-sm text-gray-600 dark:text-gray-400">${listing.set_name || 'Unknown Set'}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xl font-semibold text-green-600 dark:text-green-400 mb-1">${price}</div>
                                <div class="text-sm text-gray-500 capitalize">${listing.condition || 'N/A'}</div>
                            </div>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="text-sm text-gray-500 dark:text-gray-400">
                                <span>Seller: ${listing.sellerName || 'Unknown'}</span>
                                <span class="ml-4">Listed: ${this.formatDate(listing.listedAt)}</span>
                            </div>
                            ${contactButton}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createBadges(listing) {
        const badges = [];
        
        if (listing.is_graded) {
            badges.push(`<span class="inline-block px-2 py-1 bg-yellow-500 text-white text-xs rounded-full">Graded</span>`);
        }
        if (listing.is_foil) {
            badges.push(`<span class="inline-block px-2 py-1 bg-purple-500 text-white text-xs rounded-full">Foil</span>`);
        }
        if (listing.is_signed) {
            badges.push(`<span class="inline-block px-2 py-1 bg-red-500 text-white text-xs rounded-full">Signed</span>`);
        }
        
        if (badges.length === 0) return '';
        
        return `
            <div class="absolute top-2 right-2 flex flex-col gap-1">
                ${badges.join('')}
            </div>
        `;
    }

    createContactButton(listing) {
        if (!this.currentUser || this.currentUser.uid === listing.sellerId) {
            return '';
        }
        
        return `
            <button class="contact-seller-btn w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors text-sm font-medium" 
                    data-seller-id="${listing.sellerId}" 
                    data-card-name="${listing.name}">
                <i class="fas fa-envelope mr-2"></i>Contact Seller
            </button>
        `;
    }

    addCardEventListeners() {
        // Card click for details
        document.querySelectorAll('.card-item').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('contact-seller-btn')) {
                    const listingId = card.dataset.listingId;
                    this.showCardDetails(listingId);
                }
            });
        });

        // Contact seller buttons
        document.querySelectorAll('.contact-seller-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!this.currentUser) {
                    this.showToast('Please log in to contact sellers.', 'error');
                    return;
                }
                const sellerId = button.dataset.sellerId;
                const cardName = button.dataset.cardName;
                window.location.href = `/messages.html?recipient=${sellerId}&card=${encodeURIComponent(cardName)}`;
            });
        });
    }

    showCardDetails(listingId) {
        const listing = this.allListings.find(l => l.id === listingId);
        if (!listing) return;

        const modal = document.getElementById('cardDetailModal');
        const modalTitle = document.getElementById('modal-card-name');
        const modalContent = document.getElementById('card-detail-content');

        modalTitle.textContent = listing.name;
        
        const imageUrl = listing.image_uris?.normal || listing.image_uris?.large || '/images/placeholder.png';
        const price = listing.price ? `$${Number(listing.price).toFixed(2)}` : 'N/A';
        const gameIcon = this.supportedGames[listing.game]?.icon || 'fas fa-question';
        
        modalContent.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <img src="${imageUrl}" alt="${listing.name}" class="w-full rounded-lg shadow-md">
                </div>
                <div class="space-y-4">
                    <div class="flex items-center gap-2">
                        <i class="${gameIcon}"></i>
                        <span class="font-semibold">${this.supportedGames[listing.game]?.name || listing.game}</span>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Price</label>
                            <p class="text-2xl font-bold text-green-600 dark:text-green-400">${price}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Condition</label>
                            <p class="text-lg capitalize">${listing.condition || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Set</label>
                            <p>${listing.set_name || 'Unknown Set'}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Rarity</label>
                            <p class="capitalize">${listing.rarity || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Seller</label>
                            <p>${listing.sellerName || 'Unknown'}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Listed</label>
                            <p>${this.formatDate(listing.listedAt)}</p>
                        </div>
                    </div>
                    
                    ${this.createDetailsBadges(listing)}
                    
                    ${this.createContactButton(listing)}
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        // Add contact button event listener
        const contactBtn = modalContent.querySelector('.contact-seller-btn');
        if (contactBtn) {
            contactBtn.addEventListener('click', (e) => {
                if (!this.currentUser) {
                    this.showToast('Please log in to contact sellers.', 'error');
                    return;
                }
                const sellerId = contactBtn.dataset.sellerId;
                const cardName = contactBtn.dataset.cardName;
                window.location.href = `/messages.html?recipient=${sellerId}&card=${encodeURIComponent(cardName)}`;
            });
        }

        // Close modal event
        document.getElementById('closeCardDetailModal').addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
    }

    createDetailsBadges(listing) {
        const badges = [];
        
        if (listing.is_graded) {
            badges.push(`
                <div class="flex items-center gap-2">
                    <i class="fas fa-certificate text-yellow-500"></i>
                    <span>Graded by ${listing.grading_company || 'Unknown'}</span>
                    ${listing.grade ? `<span class="font-bold">(${listing.grade})</span>` : ''}
                </div>
            `);
        }
        if (listing.is_foil) {
            badges.push(`
                <div class="flex items-center gap-2">
                    <i class="fas fa-star text-purple-500"></i>
                    <span>Foil/Holographic</span>
                </div>
            `);
        }
        if (listing.is_signed) {
            badges.push(`
                <div class="flex items-center gap-2">
                    <i class="fas fa-signature text-red-500"></i>
                    <span>Signed</span>
                </div>
            `);
        }
        
        if (badges.length === 0) return '';
        
        return `
            <div class="space-y-2">
                <label class="text-sm font-medium text-gray-600 dark:text-gray-400">Special Attributes</label>
                <div class="space-y-1">
                    ${badges.join('')}
                </div>
            </div>
        `;
    }

    updateResultsCount() {
        const count = this.allListings ? this.allListings.length : 0;
        const resultsCount = document.getElementById('results-count');
        resultsCount.textContent = `${count} result${count !== 1 ? 's' : ''} found`;
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} mb-2 p-4 rounded-lg shadow-lg max-w-sm`;
        
        let bgColor = 'bg-blue-600';
        let icon = 'fa-info-circle';
        
        if (type === 'error') {
            bgColor = 'bg-red-600';
            icon = 'fa-exclamation-circle';
        } else if (type === 'success') {
            bgColor = 'bg-green-600';
            icon = 'fa-check-circle';
        }
        
        toast.className += ` ${bgColor} text-white`;
        toast.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${icon} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    showError(message) {
        const container = document.getElementById('listings-container');
        container.innerHTML = `
            <div class="col-span-full text-center py-10">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <p class="text-lg text-red-600 dark:text-red-400">${message}</p>
            </div>
        `;
    }
}

// Initialize the enhanced marketplace when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedMarketplace();
});
