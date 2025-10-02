/**
 * Enhanced Profile System for HatakeSocial
 * Implements unified profile pages with collection, deck, and trade history showcase
 */

class EnhancedProfileManager {
    constructor(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
        this.profileUserId = null;
        this.profileData = null;
        this.isOwnProfile = false;
        this.init();
    }

    init() {
        this.setupTabSwitching();
        this.loadProfileData();
        this.setupEventListeners();
    }

    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.profile-tab-btn');
        const tabContents = document.querySelectorAll('.profile-tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => {
                    btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
                    btn.classList.add('border-transparent', 'text-gray-500');
                });
                tabContents.forEach(content => content.classList.add('hidden'));

                // Add active class to clicked button
                button.classList.add('active', 'border-blue-500', 'text-blue-600');
                button.classList.remove('border-transparent', 'text-gray-500');

                // Show corresponding content
                const tabId = button.dataset.tab;
                const content = document.getElementById(`tab-${tabId}`);
                if (content) {
                    content.classList.remove('hidden');
                    this.loadTabContent(tabId);
                }
            });
        });
    }

    async loadProfileData() {
        try {
            // Get user ID from URL params or use current user
            const urlParams = new URLSearchParams(window.location.search);
            this.profileUserId = urlParams.get('uid') || urlParams.get('user') || this.currentUser?.uid;
            
            if (!this.profileUserId) {
                // If no user specified and we have a current user, show their profile
                if (this.currentUser) {
                    this.profileUserId = this.currentUser.uid;
                } else {
                    this.showError('Please log in to view profiles');
                    return;
                }
            }

            this.isOwnProfile = this.profileUserId === this.currentUser?.uid;

            // Load user data
            const userDoc = await this.db.collection('users').doc(this.profileUserId).get();
            if (!userDoc.exists) {
                this.showError('User not found');
                return;
            }

            this.profileData = userDoc.data();
            this.displayProfileHeader();
            this.loadProfileStats();
            this.loadTabContent('overview'); // Load default tab

        } catch (error) {
            console.error('Error loading profile:', error);
            this.showError('Failed to load profile');
        }
    }

    displayProfileHeader() {
        if (!this.profileData) return;

        // Update profile header
        document.getElementById('profile-avatar').src = this.profileData.photoURL || 'https://i.imgur.com/B06rBhI.png';
        document.getElementById('profile-display-name').textContent = this.profileData.displayName || 'Unknown User';
        document.getElementById('profile-handle').textContent = `@${this.profileData.handle || 'unknown'}`;
        
        // Location
        const location = [this.profileData.city, this.profileData.country].filter(Boolean).join(', ') || 'Location not specified';
        document.getElementById('profile-location').textContent = location;
        
        // Joined date
        const joinedDate = this.profileData.createdAt ? 
            new Date(this.profileData.createdAt.toMillis()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) :
            'Unknown';
        document.getElementById('profile-joined').textContent = `Joined ${joinedDate}`;
        
        // Favorite TCG
        document.getElementById('profile-favorite-tcg').textContent = this.profileData.favoriteTcg || 'Not specified';
        
        // Bio
        document.getElementById('profile-bio').textContent = this.profileData.bio || 'No bio available.';

        // Display gaming accounts
        this.displayGamingAccounts();

        // Show appropriate action buttons
        this.setupActionButtons();
    }

    displayGamingAccounts() {
        const gamingAccountsContainer = document.getElementById('gaming-accounts');
        const gamingAccounts = this.profileData.gamingAccounts || {};
        const privacy = this.profileData.privacy || {};
        
        // Check if gaming accounts should be shown
        if (!privacy.showGamingAccounts && !this.isOwnProfile) {
            gamingAccountsContainer.classList.add('hidden');
            return;
        }

        const accountsHTML = [];
        
        // Platform configurations with icons and colors
        const platforms = {
            mtgArena: { name: 'Arena', icon: 'fas fa-magic', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
            mtgo: { name: 'MTGO', icon: 'fas fa-desktop', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
            untap: { name: 'Untap.in', icon: 'fas fa-globe', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
            ptcgo: { name: 'PTCGO', icon: 'fas fa-bolt', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
            ptcgLive: { name: 'TCG Live', icon: 'fas fa-mobile-alt', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
            masterDuel: { name: 'Master Duel', icon: 'fas fa-eye', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
            duelingBook: { name: 'Dueling Book', icon: 'fas fa-book', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' },
            tabletopSim: { name: 'Tabletop Sim', icon: 'fas fa-cube', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
            cockatrice: { name: 'Cockatrice', icon: 'fas fa-dragon', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
            discord: { name: 'Discord', icon: 'fab fa-discord', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' }
        };

        Object.entries(gamingAccounts).forEach(([platform, username]) => {
            if (username && platforms[platform]) {
                const config = platforms[platform];
                accountsHTML.push(`
                    <div class="flex items-center space-x-2 px-3 py-2 rounded-full ${config.color} text-sm">
                        <i class="${config.icon}"></i>
                        <span class="font-medium">${config.name}:</span>
                        <span class="font-mono">${username}</span>
                    </div>
                `);
            }
        });

        if (accountsHTML.length > 0) {
            gamingAccountsContainer.innerHTML = accountsHTML.join('');
            gamingAccountsContainer.classList.remove('hidden');
        } else {
            gamingAccountsContainer.classList.add('hidden');
        }
    }

    setupActionButtons() {
        const editBtn = document.getElementById('edit-profile-btn');
        const addFriendBtn = document.getElementById('add-friend-btn');
        const messageBtn = document.getElementById('message-user-btn');

        if (this.isOwnProfile) {
            editBtn.classList.remove('hidden');
            editBtn.addEventListener('click', () => this.openEditProfileModal());
        } else {
            addFriendBtn.classList.remove('hidden');
            messageBtn.classList.remove('hidden');
            
            addFriendBtn.addEventListener('click', () => this.sendFriendRequest());
            messageBtn.addEventListener('click', () => this.startConversation());
        }
    }

    async loadProfileStats() {
        try {
            // Load collection count from user's collection subcollection
            const collectionSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('collection')
                .get();
            document.getElementById('stat-collection-count').textContent = collectionSnapshot.size;

            // Load deck count from publicDecks collection
            const decksSnapshot = await this.db.collection('publicDecks')
                .where('userId', '==', this.profileUserId)
                .get();
            document.getElementById('stat-deck-count').textContent = decksSnapshot.size;

            // Load trade count from trades collection
            const tradesSnapshot = await this.db.collection('trades')
                .where('participants', 'array-contains', this.profileUserId)
                .get();
            document.getElementById('stat-trade-count').textContent = tradesSnapshot.size;

            // Load friend count from friends collection
            const friendsSnapshot = await this.db.collection('friends')
                .where('users', 'array-contains', this.profileUserId)
                .where('status', '==', 'accepted')
                .get();
            document.getElementById('stat-friend-count').textContent = friendsSnapshot.size;

        } catch (error) {
            console.error('Error loading profile stats:', error);
        }
    }

    async loadTabContent(tabId) {
        switch (tabId) {
            case 'overview':
                await this.loadOverviewContent();
                break;
            case 'collection':
                await this.loadCollectionContent();
                break;
            case 'decks':
                await this.loadDecksContent();
                break;
            case 'trades':
                await this.loadTradesContent();
                break;
            case 'activity':
                await this.loadActivityContent();
                break;
        }
    }

    async loadOverviewContent() {
        // Load collection highlights and recent activity
        await this.loadCollectionHighlights();
        await this.loadRecentActivity();
    }

    async loadRecentActivity() {
        try {
            const recentActivityContainer = document.getElementById('recent-activity-list');
            if (!recentActivityContainer) return;

            recentActivityContainer.innerHTML = '<div class="text-center py-4"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>';

            // Load recent activities (similar to full activity but limited)
            const activities = [];

            // Posts activities
            const postsSnapshot = await this.db.collection('posts')
                .where('userId', '==', this.profileUserId)
                .orderBy('createdAt', 'desc')
                .limit(3)
                .get();

            postsSnapshot.forEach(doc => {
                const post = doc.data();
                if (post.createdAt) {
                    activities.push({
                        type: 'post',
                        timestamp: post.createdAt,
                        description: `Created a post: "${post.content?.substring(0, 30) || 'New post'}${post.content?.length > 30 ? '...' : ''}"`,
                        details: post.type || 'Post'
                    });
                }
            });

            // Collection activities
            const collectionSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('collection')
                .orderBy('addedAt', 'desc')
                .limit(3)
                .get();

            collectionSnapshot.forEach(doc => {
                const card = doc.data();
                if (card.addedAt) {
                    activities.push({
                        type: 'collection',
                        timestamp: card.addedAt,
                        description: `Added ${this.getCardName(card)} to collection`,
                        details: this.getSetName(card)
                    });
                }
            });

            // Sort activities by timestamp
            activities.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

            if (activities.length === 0) {
                recentActivityContainer.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-clock text-2xl text-gray-400 mb-2"></i>
                        <p class="text-gray-500 dark:text-gray-400 text-sm">No recent activity</p>
                    </div>
                `;
                return;
            }

            const activityHTML = activities.slice(0, 3).map(activity => {
                const timeAgo = this.getTimeAgo(activity.timestamp.toMillis());
                const iconMap = {
                    'post': 'fas fa-comment',
                    'collection': 'fas fa-layer-group',
                    'deck': 'fas fa-book-open',
                    'trade': 'fas fa-exchange-alt'
                };
                return `
                    <div class="flex items-center space-x-3 py-2">
                        <i class="${iconMap[activity.type] || 'fas fa-circle'} text-blue-600"></i>
                        <div class="flex-1">
                            <p class="text-sm text-gray-800 dark:text-white">${activity.description}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${activity.details} • ${timeAgo}</p>
                        </div>
                    </div>
                `;
            }).join('');

            recentActivityContainer.innerHTML = activityHTML;

        } catch (error) {
            console.error('Error loading recent activity:', error);
            const recentActivityContainer = document.getElementById('recent-activity-list');
            if (recentActivityContainer) {
                recentActivityContainer.innerHTML = `
                    <div class="text-center py-4">
                        <p class="text-gray-500 dark:text-gray-400 text-sm">No recent activity available</p>
                    </div>
                `;
            }
        }
    }

    async loadCollectionHighlights() {
        try {
            const collectionSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('collection')
                .get();

            if (collectionSnapshot.empty) {
                document.getElementById('collection-highlights').innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-layer-group text-4xl text-gray-400 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">No collection data available</p>
                    </div>
                `;
                return;
            }

            // Calculate collection stats from actual data structure
            let totalValue = 0;
            let mostValuableCard = null;
            const setCounts = {};
            const gameCounts = {};

            collectionSnapshot.forEach(doc => {
                const card = doc.data();
                
                // Handle different value fields
                const cardValue = card.sale_price || card.purchase_price || card.value || 0;
                totalValue += parseFloat(cardValue) || 0;
                
                if (!mostValuableCard || (parseFloat(cardValue) || 0) > (parseFloat(mostValuableCard.value) || 0)) {
                    mostValuableCard = {
                        name: this.getCardName(card),
                        value: parseFloat(cardValue) || 0,
                        set: this.getSetName(card)
                    };
                }

                // Count sets
                const setName = this.getSetName(card);
                setCounts[setName] = (setCounts[setName] || 0) + (card.quantity || 1);

                // Count games
                const game = this.getGameName(card);
                gameCounts[game] = (gameCounts[game] || 0) + (card.quantity || 1);
            });

            // Find favorite set and game
            const favoriteSet = Object.entries(setCounts)
                .sort(([,a], [,b]) => b - a)[0];
            
            const favoriteGame = Object.entries(gameCounts)
                .sort(([,a], [,b]) => b - a)[0];

            // Update highlights
            const highlightsHTML = `
                <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                        <div class="font-medium">Most Valuable Card</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">${mostValuableCard?.name || 'No cards'}</div>
                        ${mostValuableCard?.set ? `<div class="text-xs text-gray-500">${mostValuableCard.set}</div>` : ''}
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-bold text-green-600">$${(mostValuableCard?.value || 0).toFixed(2)}</div>
                    </div>
                </div>
                <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                        <div class="font-medium">Favorite Set</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">${favoriteSet ? favoriteSet[0] : 'No sets'}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-bold text-blue-600">${favoriteSet ? favoriteSet[1] : 0} cards</div>
                    </div>
                </div>
                <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                        <div class="font-medium">Collection Value</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">Total estimated value</div>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-bold text-purple-600">$${totalValue.toFixed(2)}</div>
                    </div>
                </div>
                ${favoriteGame ? `
                <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                        <div class="font-medium">Favorite Game</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">${favoriteGame[0]}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-bold text-orange-600">${favoriteGame[1]} cards</div>
                    </div>
                </div>
                ` : ''}
            `;

            document.getElementById('collection-highlights').innerHTML = highlightsHTML;

        } catch (error) {
            console.error('Error loading collection highlights:', error);
            document.getElementById('collection-highlights').innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                    <p class="text-red-500">Failed to load collection highlights</p>
                </div>
            `;
        }
    }

    async loadCollectionContent() {
        try {
            const collectionGrid = document.getElementById('collection-grid');
            collectionGrid.innerHTML = '<div class="text-center py-8 col-span-full"><i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i><p class="text-gray-500 dark:text-gray-400">Loading collection...</p></div>';

            const collectionSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('collection')
                .get();

            if (collectionSnapshot.empty) {
                collectionGrid.innerHTML = `
                    <div class="text-center py-8 col-span-full">
                        <i class="fas fa-layer-group text-4xl text-gray-400 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">No cards in collection</p>
                    </div>
                `;
                return;
            }

            const cardsHTML = collectionSnapshot.docs.map(doc => {
                const card = doc.data();
                const cardName = this.getCardName(card);
                const setName = this.getSetName(card);
                const cardValue = card.sale_price || card.purchase_price || card.value || 0;
                const imageUrl = this.getCardImageUrl(card);
                const game = this.getGameName(card);
                
                return `
                    <div class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                        <div class="aspect-w-3 aspect-h-4" style="aspect-ratio: 3/4;">
                            ${imageUrl ? 
                                `<img src="${imageUrl}" alt="${cardName}" class="w-full h-48 object-cover">` :
                                `<div class="w-full h-48 bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                    <i class="fas fa-image text-4xl text-gray-400"></i>
                                </div>`
                            }
                        </div>
                        <div class="p-4">
                            <h4 class="font-semibold text-gray-800 dark:text-white mb-1 truncate" title="${cardName}">${cardName}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2 truncate" title="${setName}">${setName}</p>
                            <div class="flex justify-between items-center mb-2">
                                ${cardValue > 0 ? 
                                    `<span class="text-sm font-medium text-green-600">$${parseFloat(cardValue).toFixed(2)}</span>` :
                                    `<span class="text-sm text-gray-500">No price</span>`
                                }
                                <span class="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">${game}</span>
                            </div>
                            <div class="flex justify-between items-center text-xs">
                                ${card.quantity && card.quantity > 1 ? `<span class="text-blue-600">Qty: ${card.quantity}</span>` : '<span></span>'}
                                <div class="flex space-x-1">
                                    ${card.is_signed ? '<i class="fas fa-signature text-purple-600" title="Signed"></i>' : ''}
                                    ${card.is_altered ? '<i class="fas fa-paint-brush text-orange-600" title="Altered"></i>' : ''}
                                    ${card.grade ? `<span class="text-yellow-600" title="Grade">${card.grade}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            collectionGrid.innerHTML = cardsHTML;

        } catch (error) {
            console.error('Error loading collection:', error);
            document.getElementById('collection-grid').innerHTML = `
                <div class="text-center py-8 col-span-full">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                    <p class="text-red-500">Failed to load collection</p>
                </div>
            `;
        }
    }

    async loadDecksContent() {
        try {
            const decksGrid = document.getElementById('decks-grid');
            decksGrid.innerHTML = '<div class="text-center py-8 col-span-full"><i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i><p class="text-gray-500 dark:text-gray-400">Loading decks...</p></div>';

            const decksSnapshot = await this.db.collection('publicDecks')
                .where('userId', '==', this.profileUserId)
                .orderBy('createdAt', 'desc')
                .get();

            if (decksSnapshot.empty) {
                decksGrid.innerHTML = `
                    <div class="text-center py-8 col-span-full">
                        <i class="fas fa-book-open text-4xl text-gray-400 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">No decks created</p>
                    </div>
                `;
                return;
            }

            const decksHTML = decksSnapshot.docs.map(doc => {
                const deck = doc.data();
                const cardCount = deck.cards?.length || 0;
                const formatColors = {
                    'Commander': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
                    'Standard': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                    'Modern': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                    'Legacy': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                };

                return `
                    <div class="deck-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-all">
                        <div class="flex items-start justify-between mb-4">
                            <h4 class="font-bold text-lg text-gray-800 dark:text-white">${deck.name}</h4>
                            <span class="text-xs px-2 py-1 rounded-full ${formatColors[deck.format] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">
                                ${deck.format || 'Unknown'}
                            </span>
                        </div>
                        
                        <p class="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">${deck.description || 'No description'}</p>
                        
                        <div class="flex items-center justify-between text-sm">
                            <div class="flex items-center space-x-4">
                                <span class="text-gray-500 dark:text-gray-400">
                                    <i class="fas fa-layer-group mr-1"></i>${cardCount} cards
                                </span>
                                ${deck.colors ? `
                                    <div class="flex space-x-1">
                                        ${deck.colors.map(color => `<div class="w-3 h-3 rounded-full bg-${color.toLowerCase()}-500"></div>`).join('')}
                                    </div>
                                ` : ''}
                            </div>
                            <button class="text-blue-600 hover:text-blue-800 font-medium">View Deck</button>
                        </div>
                    </div>
                `;
            }).join('');

            decksGrid.innerHTML = decksHTML;

        } catch (error) {
            console.error('Error loading decks:', error);
            document.getElementById('decks-grid').innerHTML = `
                <div class="text-center py-8 col-span-full">
                    <i class="fas fa-book-open text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500 dark:text-gray-400">No decks available</p>
                    <p class="text-xs text-gray-400 mt-2">Decks will appear here when created</p>
                </div>
            `;
        }
    }

    async loadTradesContent() {
        try {
            const tradesList = document.getElementById('trades-list');
            tradesList.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i><p class="text-gray-500 dark:text-gray-400">Loading trades...</p></div>';

            const tradesSnapshot = await this.db.collection('trades')
                .where('participants', 'array-contains', this.profileUserId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            if (tradesSnapshot.empty) {
                tradesList.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-exchange-alt text-4xl text-gray-400 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">No trade history</p>
                    </div>
                `;
                return;
            }

            const tradesHTML = tradesSnapshot.docs.map(doc => {
                const trade = doc.data();
                const otherParticipant = trade.participants.find(p => p !== this.profileUserId);
                const statusColors = {
                    'completed': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                    'pending': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
                    'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                };

                return `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center space-x-3">
                                <i class="fas fa-exchange-alt text-blue-600"></i>
                                <div>
                                    <h4 class="font-semibold text-gray-800 dark:text-white">Trade with @${trade.otherUserHandle || 'unknown'}</h4>
                                    <p class="text-sm text-gray-600 dark:text-gray-400">
                                        ${trade.createdAt ? new Date(trade.createdAt.toMillis()).toLocaleDateString() : 'Unknown date'}
                                    </p>
                                </div>
                            </div>
                            <span class="px-3 py-1 rounded-full text-sm font-medium ${statusColors[trade.status] || statusColors.pending}">
                                ${trade.status || 'pending'}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <h5 class="font-medium text-gray-700 dark:text-gray-300 mb-2">Offered</h5>
                                <div class="space-y-1">
                                    ${(trade.userOffers?.[this.profileUserId] || []).slice(0, 3).map(card => 
                                        `<div class="text-gray-600 dark:text-gray-400">${card.name}</div>`
                                    ).join('')}
                                    ${(trade.userOffers?.[this.profileUserId]?.length || 0) > 3 ? 
                                        `<div class="text-gray-500">+${(trade.userOffers[this.profileUserId].length - 3)} more</div>` : ''}
                                </div>
                            </div>
                            <div>
                                <h5 class="font-medium text-gray-700 dark:text-gray-300 mb-2">Received</h5>
                                <div class="space-y-1">
                                    ${(trade.userOffers?.[otherParticipant] || []).slice(0, 3).map(card => 
                                        `<div class="text-gray-600 dark:text-gray-400">${card.name}</div>`
                                    ).join('')}
                                    ${(trade.userOffers?.[otherParticipant]?.length || 0) > 3 ? 
                                        `<div class="text-gray-500">+${(trade.userOffers[otherParticipant].length - 3)} more</div>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            tradesList.innerHTML = tradesHTML;

        } catch (error) {
            console.error('Error loading trades:', error);
            document.getElementById('trades-list').innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-exchange-alt text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500 dark:text-gray-400">No trade history available</p>
                    <p class="text-xs text-gray-400 mt-2">Trade history will appear here when trades are completed</p>
                </div>
            `;
        }
    }

    async loadActivityContent() {
        try {
            const activityList = document.getElementById('full-activity-list');
            activityList.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i><p class="text-gray-500 dark:text-gray-400">Loading activity...</p></div>';

            // Load various activity types
            const activities = [];

            // Posts activities
            const postsSnapshot = await this.db.collection('posts')
                .where('userId', '==', this.profileUserId)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            postsSnapshot.forEach(doc => {
                const post = doc.data();
                if (post.createdAt) {
                    activities.push({
                        type: 'post',
                        timestamp: post.createdAt,
                        description: `Created a post: "${post.content?.substring(0, 50) || 'New post'}${post.content?.length > 50 ? '...' : ''}"`,
                        details: post.type || 'Post'
                    });
                }
            });

            // Collection activities
            const collectionSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('collection')
                .orderBy('addedAt', 'desc')
                .limit(10)
                .get();

            collectionSnapshot.forEach(doc => {
                const card = doc.data();
                if (card.addedAt) {
                    activities.push({
                        type: 'collection',
                        timestamp: card.addedAt,
                        description: `Added ${this.getCardName(card)} to collection`,
                        details: this.getSetName(card)
                    });
                }
            });

            // Deck activities from publicDecks
            const decksSnapshot = await this.db.collection('publicDecks')
                .where('userId', '==', this.profileUserId)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            decksSnapshot.forEach(doc => {
                const deck = doc.data();
                if (deck.createdAt) {
                    activities.push({
                        type: 'deck',
                        timestamp: deck.createdAt,
                        description: `Created deck: "${deck.name}"`,
                        details: deck.format || 'Unknown format'
                    });
                }
            });

            // Trade activities
            const tradesSnapshot = await this.db.collection('trades')
                .where('participants', 'array-contains', this.profileUserId)
                .orderBy('createdAt', 'desc')
                .limit(5)
                .get();

            tradesSnapshot.forEach(doc => {
                const trade = doc.data();
                if (trade.createdAt) {
                    activities.push({
                        type: 'trade',
                        timestamp: trade.createdAt,
                        description: `${trade.status === 'completed' ? 'Completed' : 'Started'} a trade`,
                        details: `Status: ${trade.status || 'pending'}`
                    });
                }
            });

            // Sort activities by timestamp
            activities.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

            if (activities.length === 0) {
                activityList.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-clock text-4xl text-gray-400 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">No recent activity</p>
                    </div>
                `;
                return;
            }

            const activityHTML = activities.map(activity => {
                const timeAgo = this.getTimeAgo(activity.timestamp.toMillis());
                const iconMap = {
                    'post': 'fas fa-comment',
                    'collection': 'fas fa-layer-group',
                    'deck': 'fas fa-book-open',
                    'trade': 'fas fa-exchange-alt'
                };

                return `
                    <div class="activity-item">
                        <div class="flex items-start space-x-3">
                            <i class="${iconMap[activity.type] || 'fas fa-circle'} text-blue-600 mt-1"></i>
                            <div class="flex-1">
                                <div class="text-sm text-gray-500 dark:text-gray-400">${timeAgo}</div>
                                <div class="font-medium text-gray-800 dark:text-white">${activity.description}</div>
                                <div class="text-sm text-gray-600 dark:text-gray-400">${activity.details}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            activityList.innerHTML = activityHTML;

        } catch (error) {
            console.error('Error loading activity:', error);
            document.getElementById('full-activity-list').innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-clock text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500 dark:text-gray-400">No recent activity available</p>
                    <p class="text-xs text-gray-400 mt-2">Activity will appear here as you use the platform</p>
                </div>
            `;
        }
    }

    setupEventListeners() {
        // Collection filter
        const collectionFilter = document.getElementById('collection-filter');
        if (collectionFilter) {
            collectionFilter.addEventListener('change', () => {
                this.loadCollectionContent();
            });
        }

        // Trade filter
        const tradeFilter = document.getElementById('trade-filter');
        if (tradeFilter) {
            tradeFilter.addEventListener('change', () => {
                this.loadTradesContent();
            });
        }
    }

    async sendFriendRequest() {
        if (!this.currentUser) {
            alert('Please log in to send friend requests');
            return;
        }

        try {
            // Check if already friends or request exists
            const existingRequest = await this.db.collection('friendRequests')
                .where('senderId', '==', this.currentUser.uid)
                .where('receiverId', '==', this.profileUserId)
                .where('status', '==', 'pending')
                .get();

            if (!existingRequest.empty) {
                alert('Friend request already sent');
                return;
            }

            // Send friend request
            await this.db.collection('friendRequests').add({
                senderId: this.currentUser.uid,
                receiverId: this.profileUserId,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert('Friend request sent!');
            
        } catch (error) {
            console.error('Error sending friend request:', error);
            alert('Failed to send friend request');
        }
    }

    startConversation() {
        // Redirect to messages page with user parameter
        window.location.href = `messages.html?user=${this.profileUserId}`;
    }

    openEditProfileModal() {
        if (window.profileEditor) {
            window.profileEditor.openModal(this.profileData);
        } else {
            alert('Profile editor is loading...');
        }
    }

    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const minute = 60 * 1000;
        const hour = minute * 60;
        const day = hour * 24;
        const week = day * 7;
        const month = day * 30;
        const year = day * 365;

        if (diff < minute) return 'Just now';
        if (diff < hour) return `${Math.floor(diff / minute)} minutes ago`;
        if (diff < day) return `${Math.floor(diff / hour)} hours ago`;
        if (diff < week) return `${Math.floor(diff / day)} days ago`;
        if (diff < month) return `${Math.floor(diff / week)} weeks ago`;
        if (diff < year) return `${Math.floor(diff / month)} months ago`;
        return `${Math.floor(diff / year)} years ago`;
    }

    // Data cleaning helper methods (matching the logic from api.js)
    getCardName(card) {
        return card.name || card.card_name || card.Name || 'Unknown Card';
    }

    getSetName(card) {
        // Handle different TCG data structures
        if (card.set_name) return card.set_name;
        if (card.setName) return card.setName;
        if (card.expansion?.name) return card.expansion.name;
        if (card.set) return card.set;
        
        // Game-specific fallbacks
        switch (card.game) {
            case 'pokemon':
                return card.expansion?.name || 'Unknown Set';
            case 'lorcana':
                return card.expansion?.name || 'Unknown Set';
            case 'gundam':
                return card.expansion?.name || 'Unknown Set';
            case 'mtg':
            default:
                return 'Unknown Set';
        }
    }

    getGameName(card) {
        if (card.game) {
            // Normalize game names for display
            switch (card.game.toLowerCase()) {
                case 'mtg':
                    return 'Magic: The Gathering';
                case 'pokemon':
                    return 'Pokémon';
                case 'lorcana':
                    return 'Lorcana';
                case 'gundam':
                    return 'Gundam';
                default:
                    return card.game;
            }
        }
        return 'Unknown Game';
    }

    getCardImageUrl(card) {
        // Handle different image URL structures
        if (card.image_uris) {
            return card.image_uris.normal || card.image_uris.small || card.image_uris.large;
        }
        if (card.image_url) return card.image_url;
        if (card.images && card.images[0]) {
            return card.images[0].medium || card.images[0].small || card.images[0].large;
        }
        return null;
    }

    showError(message) {
        document.getElementById('enhanced-profile-container').innerHTML = `
            <div class="text-center py-16">
                <i class="fas fa-exclamation-triangle text-6xl text-red-400 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-2">Error</h2>
                <p class="text-gray-600 dark:text-gray-400">${message}</p>
                <button onclick="window.location.reload()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Initialize when DOM is loaded and user is authenticated
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            const db = firebase.firestore();
            const container = document.getElementById('enhanced-profile-container') || document.getElementById('profile-container');
            if (container) {
                window.enhancedProfileManager = new EnhancedProfileManager(db, user.uid);
            }
        }
    });
});
