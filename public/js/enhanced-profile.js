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
            this.profileUserId = urlParams.get('uid') || this.currentUser?.uid;
            
            if (!this.profileUserId) {
                this.showError('No user specified');
                return;
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

        // Show appropriate action buttons
        this.setupActionButtons();
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
            // Load collection count
            const collectionSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('collection')
                .get();
            document.getElementById('stat-collection-count').textContent = collectionSnapshot.size;

            // Load deck count
            const decksSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('decks')
                .get();
            document.getElementById('stat-deck-count').textContent = decksSnapshot.size;

            // Load trade count
            const tradesSnapshot = await this.db.collection('trades')
                .where('participants', 'array-contains', this.profileUserId)
                .where('status', '==', 'completed')
                .get();
            document.getElementById('stat-trade-count').textContent = tradesSnapshot.size;

            // Load friend count
            const friendCount = this.profileData.friends?.length || 0;
            document.getElementById('stat-friend-count').textContent = friendCount;

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
        // Recent activity is already loaded in the template
        // Load collection highlights
        await this.loadCollectionHighlights();
    }

    async loadCollectionHighlights() {
        try {
            const collectionSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('collection')
                .orderBy('value', 'desc')
                .limit(10)
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

            // Calculate collection stats
            let totalValue = 0;
            let mostValuableCard = null;
            const setCounts = {};

            collectionSnapshot.forEach(doc => {
                const card = doc.data();
                totalValue += card.value || 0;
                
                if (!mostValuableCard || (card.value || 0) > (mostValuableCard.value || 0)) {
                    mostValuableCard = card;
                }

                const setName = card.setName || 'Unknown Set';
                setCounts[setName] = (setCounts[setName] || 0) + 1;
            });

            // Find favorite set
            const favoriteSet = Object.entries(setCounts)
                .sort(([,a], [,b]) => b - a)[0];

            // Update highlights
            const highlightsHTML = `
                <div class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                        <div class="font-medium">Most Valuable Card</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">${mostValuableCard?.name || 'No cards'}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-lg font-bold text-green-600">$${(mostValuableCard?.value || 0).toLocaleString()}</div>
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
                        <div class="text-lg font-bold text-purple-600">$${totalValue.toLocaleString()}</div>
                    </div>
                </div>
            `;

            document.getElementById('collection-highlights').innerHTML = highlightsHTML;

        } catch (error) {
            console.error('Error loading collection highlights:', error);
        }
    }

    async loadCollectionContent() {
        try {
            const collectionGrid = document.getElementById('collection-grid');
            collectionGrid.innerHTML = '<div class="text-center py-8 col-span-full"><i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i><p class="text-gray-500 dark:text-gray-400">Loading collection...</p></div>';

            const collectionSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('collection')
                .orderBy('name')
                .limit(50)
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
                return `
                    <div class="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                        <div class="aspect-w-3 aspect-h-4">
                            <img src="${card.imageUrl || 'https://via.placeholder.com/200x280?text=No+Image'}" 
                                 alt="${card.name}" 
                                 class="w-full h-48 object-cover">
                        </div>
                        <div class="p-4">
                            <h4 class="font-semibold text-gray-800 dark:text-white mb-1 truncate">${card.name}</h4>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">${card.setName || 'Unknown Set'}</p>
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium text-green-600">$${(card.value || 0).toFixed(2)}</span>
                                <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded">${card.condition || 'NM'}</span>
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

            const decksSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('decks')
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
                    <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                    <p class="text-red-500">Failed to load decks</p>
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
                    <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                    <p class="text-red-500">Failed to load trade history</p>
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
                        description: `Added ${card.name} to collection`,
                        details: card.setName || 'Unknown Set'
                    });
                }
            });

            // Deck activities
            const decksSnapshot = await this.db.collection('users')
                .doc(this.profileUserId)
                .collection('decks')
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
                    <i class="fas fa-exclamation-triangle text-4xl text-red-400 mb-4"></i>
                    <p class="text-red-500">Failed to load activity</p>
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
        // This would open a modal for editing profile
        alert('Edit profile functionality would be implemented here');
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
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const db = firebase.firestore();
    
    if (document.getElementById('enhanced-profile-container')) {
        window.enhancedProfileManager = new EnhancedProfileManager(db, currentUser);
    }
});
