/**
 * HatakeSocial - Profile Page Script (v21 - Layout Fix)
 *
 * This script handles all logic for the user profile page.
 * - FIX: Corrects the profile header layout to ensure the banner image is behind the avatar and action buttons.
 * - Uses a single relative container with absolute positioning for overlapping elements.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

    /**
     * Generates a direct link to the Firebase console to create a missing composite index.
     * @param {string} collection - The name of the collection needing the index.
     * @param {Array<object>} fields - An array of field objects, e.g., [{ name: 'fieldName', order: 'asc' }]
     * @returns {string} The generated URL.
     */
    const generateIndexCreationLink = (collection, fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };
    
    /**
     * Displays a standardized error message for missing Firestore indexes.
     * @param {HTMLElement} container - The DOM element to display the error in.
     * @param {string} link - The pre-generated link to create the index.
     */
    const displayIndexError = (container, link) => {
        const errorMessage = `
            <div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
                <p class="font-bold text-red-700 dark:text-red-300">Database Error</p>
                <p class="text-red-600 dark:text-red-400 mt-2">A required database index is missing for this query.</p>
                <a href="${link}" target="_blank" rel="noopener noreferrer" 
                   class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">
                   Click Here to Create the Index
                </a>
                <p class="text-xs text-gray-500 mt-2">This will open the Firebase console. Click "Save" to create the index. It may take a few minutes to build.</p>
            </div>
         `;
        container.innerHTML = errorMessage;
    };

    // Definitions for all achievable badges and the logic to check for them.
    const badgeDefinitions = {
        pioneer: { name: 'Pioneer', description: 'One of the first 100 users to join HatakeSocial!', icon: 'fa-rocket', color: 'text-purple-500', async check(userData, userId) { const pioneerDate = new Date('2025-07-01'); return userData.createdAt.toDate() < pioneerDate; } },
        collector: { name: 'Collector', description: 'Has over 100 cards in their collection.', icon: 'fa-box-open', color: 'text-blue-500', async check(userData, userId) { const snapshot = await db.collection('users').doc(userId).collection('collection').limit(101).get(); return snapshot.size > 100; } },
        deck_brewer: { name: 'Deck Brewer', description: 'Has created at least 5 decks.', icon: 'fa-layer-group', color: 'text-green-500', async check(userData, userId) { const snapshot = await db.collection('users').doc(userId).collection('decks').limit(5).get(); return snapshot.size >= 5; } },
        socialite: { name: 'Socialite', description: 'Has more than 10 friends.', icon: 'fa-users', color: 'text-pink-500', async check(userData, userId) { return userData.friends && userData.friends.length > 10; } },
        trusted_trader: { name: 'Trusted Trader', description: 'Completed 10 trades with positive feedback.', icon: 'fa-handshake', color: 'text-yellow-500', async check(userData, userId) { const avgRating = ((userData.averageAccuracy || 0) + (userData.averagePackaging || 0)) / 2; return (userData.ratingCount || 0) >= 10 && avgRating >= 4.5; } },
        first_trade: { name: 'First Trade', description: 'Completed your first trade successfully!', icon: 'fa-medal', color: 'text-red-500', async check(userData, userId) { const tradeQuery = await db.collection('trades').where('participants', 'array-contains', userId).where('status', '==', 'completed').limit(1).get(); return !tradeQuery.empty; } },
        top_reviewer: { name: 'Top Reviewer', description: 'Provided helpful feedback on at least 5 trades.', icon: 'fa-star', color: 'text-blue-400', async check(userData, userId) { const feedbackQuery = await db.collection('feedback').where('fromUserId', '==', userId).limit(5).get(); return feedbackQuery.size >= 5; } },
        guild_founder: { name: 'Guild Founder', description: 'Founded your first Trading Guild.', icon: 'fa-shield-alt', color: 'text-indigo-500', async check(userData, userId) { const groupQuery = await db.collection('groups').where('creatorId', '==', userId).where('groupType', '==', 'trading_guild').limit(1).get(); return !groupQuery.empty; } }
    };

    /**
     * Main function to set up the entire profile page.
     * It now includes robust error handling to prevent the page from getting stuck.
     */
    const setupProfilePage = async () => {
        profileContainer.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i><p class="mt-4">Loading Profile...</p></div>';

        try {
            // Determine which user's profile to load
            const params = new URLSearchParams(window.location.search);
            let userDoc;
            const username = params.get('user');
            const userIdParam = params.get('uid');

            if (username) {
                const userQuery = await db.collection('users').where('handle', '==', username).limit(1).get();
                if (!userQuery.empty) userDoc = userQuery.docs[0];
            } else if (userIdParam) {
                userDoc = await db.collection('users').doc(userIdParam).get();
            } else if (currentUser) {
                userDoc = await db.collection('users').doc(currentUser.uid).get();
            } else {
                // No user specified and no one logged in
                profileContainer.innerHTML = `<div class="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md"><h1 class="text-2xl font-bold text-gray-800 dark:text-white">No Profile to Display</h1><p class="mt-2 text-gray-600 dark:text-gray-400">Please log in to see your profile or specify a user in the URL.</p></div>`;
                return;
            }

            if (!userDoc || !userDoc.exists) {
                throw new Error("User not found.");
            }

            const profileUserId = userDoc.id;
            const profileUserData = userDoc.data();
            const isOwnProfile = currentUser && currentUser.uid === profileUserId;

            // Determine friend status between current user and profile owner
            let friendStatus = 'none';
            if (currentUser && !isOwnProfile) {
                if (profileUserData.friends && profileUserData.friends.includes(currentUser.uid)) {
                    friendStatus = 'friends';
                } else {
                    const requestQuery1 = await db.collection('friendRequests').where('senderId', '==', currentUser.uid).where('receiverId', '==', profileUserId).get();
                    const requestQuery2 = await db.collection('friendRequests').where('senderId', '==', profileUserId).where('receiverId', '==', currentUser.uid).get();
                    if (!requestQuery1.empty) friendStatus = 'request_sent';
                    else if (!requestQuery2.empty) friendStatus = 'request_received';
                }
            }

            // Generate action buttons based on friend status
            let actionButtonHTML = '';
            if (!isOwnProfile && currentUser) {
                actionButtonHTML += `<button id="start-trade-btn" class="px-4 py-2 bg-green-600 text-white rounded-full text-sm" data-uid="${profileUserId}">Start Trade</button>`;
                actionButtonHTML += `<button id="message-btn" class="px-4 py-2 bg-gray-500 text-white rounded-full text-sm" data-uid="${profileUserId}">Message</button>`;
                switch (friendStatus) {
                    case 'none': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-blue-500 text-white rounded-full text-sm">Add Friend</button>`; break;
                    case 'request_sent': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-gray-400 text-white rounded-full text-sm" disabled>Request Sent</button>`; break;
                    case 'friends': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-green-500 text-white rounded-full text-sm" disabled><i class="fas fa-check mr-2"></i>Friends</button>`; break;
                    case 'request_received': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-yellow-500 text-white rounded-full text-sm">Respond to Request</button>`; break;
                }
            }

            // Generate reputation/rating stars
            const ratingCount = profileUserData.ratingCount || 0;
            const avgAccuracy = profileUserData.averageAccuracy || 0;
            const avgPackaging = profileUserData.averagePackaging || 0;
            const overallAvg = ratingCount > 0 ? (avgAccuracy + avgPackaging) / 2 : 0;
            let starsHTML = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= overallAvg) starsHTML += '<i class="fas fa-star text-yellow-400"></i>';
                else if (i - 0.5 <= overallAvg) starsHTML += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
                else starsHTML += '<i class="far fa-star text-gray-300"></i>';
            }
            const reputationHTML = `
                <div class="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mt-1"> 
                    <span class="flex">${starsHTML}</span> 
                    <span class="font-semibold">${overallAvg.toFixed(1)}</span> 
                    <span>(${ratingCount} ratings)</span> 
                </div>
                <div class="text-xs space-x-3 mt-1">
                    <span>Accuracy: <strong class="dark:text-gray-200">${avgAccuracy.toFixed(1)}</strong></span>
                    <span>Packaging: <strong class="dark:text-gray-200">${avgPackaging.toFixed(1)}</strong></span>
                </div>
            `;

            // *** NEW HTML STRUCTURE FOR PROFILE HEADER ***
            profileContainer.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                    <div class="relative">
                        <img id="profile-banner" class="w-full h-48 object-cover" src="${profileUserData.bannerURL || 'https://placehold.co/1200x300/cccccc/969696?text=Banner'}" alt="Profile banner">
                        
                        <div class="absolute top-4 right-4">
                            ${isOwnProfile ? `<a href="settings.html" class="px-4 py-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 text-sm font-semibold">Edit Profile</a>` : ''}
                        </div>
                        
                        <div class="absolute bottom-0 left-6 transform translate-y-1/2 flex items-center space-x-4">
                            <img id="profile-avatar" class="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 object-cover" src="${profileUserData.photoURL || 'https://placehold.co/128x128'}" alt="User avatar">
                        </div>
                    </div>
            
                    <div class="pt-20 px-6 pb-6">
                         <div class="flex justify-between items-center">
                            <div>
                                <h1 id="profile-displayName" class="text-3xl font-bold text-gray-800 dark:text-white">${profileUserData.displayName || 'No Name'}</h1>
                                <p id="profile-handle" class="text-gray-600 dark:text-gray-400">@${profileUserData.handle || 'no-handle'}</p>
                                ${reputationHTML}
                            </div>
                            <div id="profile-action-buttons" class="flex space-x-2">
                                ${actionButtonHTML}
                            </div>
                        </div>

                        <div class="mt-6 border-t dark:border-gray-700 pt-4">
                            <p id="profile-bio" class="text-gray-700 dark:text-gray-300 mt-2">${profileUserData.bio || 'No bio yet.'}</p>
                            <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                <strong>Favorite TCG:</strong> <span id="profile-fav-tcg">${profileUserData.favoriteTcg || 'Not set'}</span>
                            </div>
                            <div id="mutual-connections-section" class="mt-4 text-sm text-gray-500 dark:text-gray-400"></div>
                            <div id="featured-items-section" class="mt-6"></div>
                            <div id="profile-badges-container" class="mt-4">
                                <h3 class="font-bold text-lg mb-2 dark:text-white">Achievements</h3>
                                <div id="badges-list" class="flex flex-wrap gap-4"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-6">
                    <div class="border-b border-gray-200 dark:border-gray-700">
                        <nav id="profile-tabs" class="flex space-x-8" aria-label="Tabs">
                             <button data-tab="feed" class="profile-tab-button active">Feed</button>
                            <button data-tab="decks" class="profile-tab-button">Decks</button>
                            <button data-tab="trade-binder" class="profile-tab-button">Trade Binder</button>
                            <button data-tab="collection" class="profile-tab-button">Collection</button>
                            <button data-tab="friends" class="profile-tab-button">Friends</button>
                            <button data-tab="wishlist" class="profile-tab-button">Wishlist</button>
                            <button data-tab="trade-history" class="profile-tab-button">Trade History</button>
                            <button data-tab="feedback" class="profile-tab-button">Feedback</button>
                        </nav>
                    </div>
                    <div class="mt-6">
                        <div id="tab-content-feed" class="profile-tab-content space-y-6"></div>
                        <div id="tab-content-decks" class="profile-tab-content hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
                        <div id="tab-content-trade-binder" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div>
                        <div id="tab-content-collection" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div>
                        <div id="tab-content-friends" class="profile-tab-content hidden"></div>
                        <div id="tab-content-wishlist" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div>
                        <div id="tab-content-trade-history" class="profile-tab-content hidden space-y-4"></div>
                        <div id="tab-content-feedback" class="profile-tab-content hidden space-y-4"></div>
                    </div>
                </div>
            `;
            
            // Add event listeners to the newly created buttons
            document.getElementById('start-trade-btn')?.addEventListener('click', (e) => { window.location.href = `trades.html?with=${e.currentTarget.dataset.uid}`; });
            document.getElementById('message-btn')?.addEventListener('click', (e) => { window.location.href = `messages.html?with=${e.currentTarget.dataset.uid}`; });
            const addFriendBtn = document.getElementById('add-friend-btn');
            if(addFriendBtn) {
                addFriendBtn.addEventListener('click', async () => {
                    if (friendStatus === 'none') {
                        addFriendBtn.disabled = true;
                        addFriendBtn.textContent = 'Sending...';
                        await db.collection('friendRequests').add({ senderId: currentUser.uid, receiverId: profileUserId, status: 'pending', createdAt: new Date() });
                        const notificationData = { message: `${currentUser.displayName} sent you a friend request.`, link: `/profile.html?uid=${currentUser.uid}#friends`, isRead: false, timestamp: new Date() };
                        await db.collection('users').doc(profileUserId).collection('notifications').add(notificationData);
                        addFriendBtn.textContent = 'Request Sent';
                    } else if (friendStatus === 'request_received') { 
                        window.location.href = '/friends.html'; 
                    }
                });
            }

            // Set up tab switching
            document.querySelectorAll('.profile-tab-button').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.profile-tab-button').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.add('hidden'));
                    document.getElementById(`tab-content-${tab.dataset.tab}`).classList.remove('hidden');
                    if(tab.dataset.tab === 'friends') loadProfileFriends(profileUserId);
                });
            });

            // Handle hash links for tabs
            if(window.location.hash) {
                const targetTab = document.querySelector(`.profile-tab-button[data-tab="${window.location.hash.substring(1)}"]`);
                if(targetTab) targetTab.click();
            }

            // Asynchronously load all the dynamic content for the profile
            if (currentUser && !isOwnProfile) {
                loadMutualConnections(profileUserId, profileUserData);
            }
            loadFeaturedItems(profileUserId, profileUserData);
            loadProfileFeed(profileUserId);
            loadProfileDecks(profileUserId, isOwnProfile);
            loadProfileCollection(profileUserId, 'collection', isOwnProfile);
            loadProfileCollection(profileUserId, 'wishlist');
            loadTradeBinder(profileUserId, profileUserData);
            loadProfileTradeHistory(profileUserId);
            loadProfileFeedback(profileUserId);
            if (window.location.hash === '#friends') loadProfileFriends(profileUserId);
            
            if (isOwnProfile) {
                await evaluateAndAwardBadges(profileUserId, profileUserData);
            }
            await loadAndDisplayBadges(profileUserId);

        } catch (error) {
            console.error("Error loading profile:", error);
            profileContainer.innerHTML = `<div class="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md"><h1 class="text-2xl font-bold text-red-600">Error</h1><p class="mt-2 text-gray-600 dark:text-gray-400">${error.message}</p></div>`;
        }
    };
    
    // ... (The rest of the profile.js functions remain the same) ...

    const evaluateAndAwardBadges = async (userId, userData) => {
        const userBadgesRef = db.collection('users').doc(userId).collection('badges');
        const existingBadgesSnapshot = await userBadgesRef.get();
        const existingBadgeIds = existingBadgesSnapshot.docs.map(doc => doc.id);

        for (const badgeId in badgeDefinitions) {
            if (!existingBadgeIds.includes(badgeId)) {
                const definition = badgeDefinitions[badgeId];
                try {
                    const hasBadge = await definition.check(userData, userId);
                    if (hasBadge) {
                        await userBadgesRef.doc(badgeId).set({
                            awardedAt: new Date(),
                            name: definition.name,
                            description: definition.description,
                            icon: definition.icon,
                            color: definition.color
                        });
                    }
                } catch (error) {
                    console.warn(`Could not check for badge "${badgeId}":`, error.message);
                }
            }
        }
    };

    const loadAndDisplayBadges = async (userId) => {
        const badgesListContainer = document.getElementById('badges-list');
        badgesListContainer.innerHTML = '';
        try {
            const snapshot = await db.collection('users').doc(userId).collection('badges').get();

            if (snapshot.empty) {
                badgesListContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No achievements yet.</p>';
                return;
            }

            snapshot.forEach(doc => {
                const badge = doc.data();
                const badgeEl = document.createElement('div');
                badgeEl.className = 'badge-item';
                badgeEl.title = badge.description;
                badgeEl.innerHTML = `
                    <i class="fas ${badge.icon} ${badge.color} badge-icon"></i>
                    <span class="badge-name">${badge.name}</span>
                `;
                badgesListContainer.appendChild(badgeEl);
            });
        } catch (error) {
            console.error("Error loading badges:", error);
            badgesListContainer.innerHTML = '<p class="text-sm text-red-500">Could not load achievements.</p>';
        }
    };

    const loadProfileFeed = async (userId) => {
        const container = document.getElementById('tab-content-feed');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading feed...</p>';
        try {
            const snapshot = await db.collection('posts').where('authorId', '==', userId).orderBy('timestamp', 'desc').get();
            if(snapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user hasn\'t posted anything yet.</p>';
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const post = doc.data();
                const postElement = document.createElement('div');
                postElement.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md';
                postElement.innerHTML = `
                    <div class="flex items-center mb-4">
                        <img src="${post.authorPhotoURL}" alt="author" class="h-10 w-10 rounded-full mr-4 object-cover">
                        <div>
                            <p class="font-bold dark:text-white">${post.author}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                        </div>
                    </div>
                    <p class="mb-4 whitespace-pre-wrap dark:text-gray-300">${post.content}</p>
                     ${post.mediaUrl ? (post.mediaType.startsWith('image/') ? `<img src="${post.mediaUrl}" class="w-full rounded-lg">` : `<video src="${post.mediaUrl}" controls class="w-full rounded-lg"></video>`) : ''}
                `;
                container.appendChild(postElement);
            });
        } catch (error) {
            console.error("Error loading profile feed:", error);
            if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('posts', [{ name: 'authorId', order: 'asc' }, { name: 'timestamp', order: 'desc' }]);
                displayIndexError(container, indexLink);
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load feed.</p>`;
            }
        }
    };

    const loadProfileDecks = async (userId, isOwnProfile) => {
        const container = document.getElementById('tab-content-decks');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading decks...</p>';
        try {
            const snapshot = await db.collection('users').doc(userId).collection('decks').orderBy('createdAt', 'desc').get();
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user has no public decks.</p>';
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const deck = doc.data();
                const deckCard = document.createElement('div');
                deckCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col';
                
                let pinButtonHTML = '';
                if (isOwnProfile) {
                    pinButtonHTML = `<button class="pin-deck-btn text-xs text-blue-500 hover:underline mt-2" data-deck-id="${doc.id}">Pin to Profile</button>`;
                }
                
                deckCard.innerHTML = `
                    <a href="deck.html?deckId=${doc.id}" class="block hover:opacity-80 flex-grow">
                        <h3 class="text-xl font-bold truncate dark:text-white">${deck.name}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${deck.format || deck.tcg}</p>
                    </a>
                    ${pinButtonHTML}
                `;
                container.appendChild(deckCard);
            });
        } catch (error) {
            console.error("Error loading profile decks:", error);
            if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('decks', [{ name: 'createdAt', order: 'desc' }]);
                displayIndexError(container, indexLink);
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load decks.</p>`;
            }
        }
    };
    
    const loadProfileCollection = async (userId, listType, isOwnProfile = false) => {
        const container = document.getElementById(`tab-content-${listType}`);
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading...</p>';
        try {
            const snapshot = await db.collection('users').doc(userId).collection(listType).orderBy('name').limit(32).get();
            if (snapshot.empty) {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user's ${listType} is empty or private.</p>`;
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const card = doc.data();
                const cardEl = document.createElement('div');
                cardEl.className = 'relative group';
                
                let pinButtonHTML = '';
                if (isOwnProfile && listType === 'collection') {
                     pinButtonHTML = `<button class="pin-card-btn text-white text-xs ml-1" title="Pin to Profile" data-card-id="${doc.id}"><i class="fas fa-thumbtack"></i></button>`;
                }

                cardEl.innerHTML = `
                    <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block">
                        <img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="rounded-lg shadow-md w-full ${card.forSale ? 'border-4 border-green-500' : ''}" onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                    </a>
                    <div class="absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        ${pinButtonHTML}
                    </div>
                `;
                container.appendChild(cardEl);
            });
        } catch (error) {
            console.error(`Error loading ${listType}:`, error);
            container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load this section. This is likely a Firestore Security Rules issue.</p>`;
        }
    };

    const loadTradeBinder = async (userId, userData) => {
        const container = document.getElementById('tab-content-trade-binder');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading trade binder...</p>';
        try {
            const snapshot = await db.collection('users').doc(userId).collection('collection').where('forSale', '==', true).get();
            if (snapshot.empty) {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user has no cards listed for trade.</p>`;
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const card = doc.data();
                const cardEl = document.createElement('div');
                cardEl.className = 'relative group';
                
                const priceUsd = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
                const sellerCurrency = userData.primaryCurrency || 'SEK';
                const formattedPrice = priceUsd > 0 ? window.HatakeSocial.convertAndFormatPrice(priceUsd, 'USD') : '';
                const priceTagHTML = formattedPrice 
                    ? `<div class="absolute top-1 left-1 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">${formattedPrice}</div>`
                    : '';

                let tradeButtonHTML = '';
                if (currentUser && currentUser.uid !== userId) {
                    tradeButtonHTML = `<a href="trades.html?propose_to_card=${doc.id}" class="absolute bottom-0 left-0 right-0 block w-full text-center bg-green-600 text-white text-xs font-bold py-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">Start Trade</a>`;
                }

                cardEl.innerHTML = `
                    <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block">
                        <img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="rounded-lg shadow-md w-full" onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                    </a>
                    ${priceTagHTML}
                    ${tradeButtonHTML}
                `;
                container.appendChild(cardEl);
            });
        } catch (error) {
            console.error("Error loading trade binder: ", error);
             if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('collection', [{ name: 'forSale', order: 'asc' }]);
                displayIndexError(container, indexLink);
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load trade binder.</p>`;
            }
        }
    };

    const loadFeaturedItems = async (userId, userData) => {
        const container = document.getElementById('featured-items-section');
        container.innerHTML = '';
        
        let contentHTML = '';

        if (userData.featuredDeck) {
            const deckDoc = await db.collection('users').doc(userId).collection('decks').doc(userData.featuredDeck).get();
            if (deckDoc.exists) {
                const deck = deckDoc.data();
                contentHTML += `
                    <div class="mb-4">
                        <h4 class="font-semibold text-gray-700 dark:text-gray-300">Featured Deck</h4>
                        <a href="deck.html?deckId=${deckDoc.id}" class="block bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg mt-1 hover:shadow-md">
                            <p class="font-bold text-lg text-blue-600 dark:text-blue-400">${deck.name}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">${deck.format || deck.tcg}</p>
                        </a>
                    </div>
                `;
            }
        }

        if (userData.featuredCards && userData.featuredCards.length > 0) {
             contentHTML += `<h4 class="font-semibold text-gray-700 dark:text-gray-300 mt-4">Featured Cards</h4>`;
             contentHTML += `<div class="flex flex-wrap gap-2 mt-2">`;
             for (const cardId of userData.featuredCards) {
                const cardDoc = await db.collection('users').doc(userId).collection('collection').doc(cardId).get();
                if (cardDoc.exists) {
                    const card = cardDoc.data();
                    contentHTML += `<a href="card-view.html?name=${encodeURIComponent(card.name)}"><img src="${card.imageUrl}" alt="${card.name}" class="w-20 rounded-md hover:scale-105 transition-transform" onerror="this.onerror=null;this.src='https://placehold.co/80x112';"></a>`;
                }
             }
             contentHTML += `</div>`;
        }

        if (contentHTML) {
            container.innerHTML = `<h3 class="font-bold text-lg mb-2 dark:text-white">Featured Items</h3><div class="border-t dark:border-gray-700 pt-4">${contentHTML}</div>`;
        }
    };

    const loadMutualConnections = async (profileUserId, profileUserData) => {
        const container = document.getElementById('mutual-connections-section');
        if (!currentUser) return;

        const myDoc = await db.collection('users').doc(currentUser.uid).get();
        const myData = myDoc.data();
        
        const myFriends = new Set(myData.friends || []);
        const theirFriends = new Set(profileUserData.friends || []);
        const mutualFriends = [...myFriends].filter(friendId => theirFriends.has(friendId));

        if (mutualFriends.length > 0) {
            container.innerHTML += `<p><i class="fas fa-user-friends mr-2"></i>You have ${mutualFriends.length} mutual friend${mutualFriends.length > 1 ? 's' : ''}.</p>`;
        }
    };

    const loadProfileTradeHistory = async (userId) => {
        const container = document.getElementById('tab-content-trade-history');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading trade history...</p>';

        try {
            const snapshot = await db.collection('trades')
                .where('participants', 'array-contains', userId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user has no trade history.</p>';
                return;
            }

            container.innerHTML = '';
            snapshot.forEach(doc => {
                const trade = doc.data();
                const isProposer = trade.proposerId === userId;
                const otherPartyName = isProposer ? trade.receiverName : trade.proposerName;
                const otherPartyId = isProposer ? trade.receiverId : trade.proposerId;
                const statusClasses = { pending: 'bg-yellow-100 text-yellow-800', accepted: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', };
                const statusClass = statusClasses[trade.status] || 'bg-gray-100';
                const tradeCard = `<div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow"><div class="flex justify-between items-center mb-2"><p class="font-semibold dark:text-white">Trade with <a href="profile.html?uid=${otherPartyId}" class="text-blue-600 hover:underline">${otherPartyName}</a></p><span class="px-3 py-1 text-sm font-semibold rounded-full ${statusClass}">${trade.status}</span></div><p class="text-xs text-gray-400 text-left">${new Date(trade.createdAt.toDate()).toLocaleDateString()}</p></div>`;
                container.innerHTML += tradeCard;
            });

        } catch (error) {
            console.error("Error loading trade history:", error);
            if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('trades', [{ name: 'participants', order: 'asc' }, { name: 'createdAt', order: 'desc' }]);
                displayIndexError(container, indexLink);
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load trade history.</p>`;
            }
        }
    };

    const loadProfileFeedback = async (userId) => {
        const container = document.getElementById('tab-content-feedback');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading feedback...</p>';
        try {
            const feedbackSnapshot = await db.collection('feedback').where('forUserId', '==', userId).orderBy('createdAt', 'desc').get();

            if (feedbackSnapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user has not received any feedback yet.</p>';
                return;
            }

            container.innerHTML = '';
            feedbackSnapshot.forEach(doc => {
                const feedback = doc.data();
                const ratings = feedback.ratings || {};
                const accuracyStars = '★'.repeat(ratings.accuracy || 0) + '☆'.repeat(5 - (ratings.accuracy || 0));
                const packagingStars = '★'.repeat(ratings.packaging || 0) + '☆'.repeat(5 - (ratings.packaging || 0));

                const feedbackCard = `
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <div class="flex justify-between items-center mb-2">
                            <p class="font-semibold dark:text-gray-200">From: <a href="profile.html?uid=${feedback.fromUserId}" class="text-blue-600 hover:underline">${feedback.fromUserName}</a></p>
                            <div class="text-xs text-gray-400">${new Date(feedback.createdAt.toDate()).toLocaleDateString()}</div>
                        </div>
                        <div class="text-sm space-y-1 my-2 text-yellow-400">
                           <p><strong>Accuracy:</strong> ${accuracyStars}</p>
                           <p><strong>Packaging:</strong> ${packagingStars}</p>
                        </div>
                        <p class="text-gray-700 dark:text-gray-300 italic">"${feedback.comment || 'No comment left.'}"</p>
                    </div>`;
                container.innerHTML += feedbackCard;
            });
        } catch (error) {
            console.error("Error loading feedback:", error);
            if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('feedback', [{ name: 'forUserId', order: 'asc' }, { name: 'createdAt', order: 'desc' }]);
                displayIndexError(container, indexLink);
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load feedback.</p>`;
            }
        }
    };
    
    const loadProfileFriends = async (userId) => {
        const container = document.getElementById('tab-content-friends');
        if (!container) return;

        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading friends...</p>';

        try {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            const friendIds = userData.friends || [];
            
            let friendsHTML = '';

            if (currentUser && currentUser.uid === userId) {
                 const friendRequests = await db.collection('friendRequests')
                                           .where('receiverId', '==', userId)
                                           .where('status', '==', 'pending')
                                           .get();
                if (!friendRequests.empty) {
                    friendsHTML += '<h3 class="text-xl font-bold mb-4 dark:text-white">Friend Requests</h3>';
                    friendsHTML += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">';
                    for (const doc of friendRequests.docs) {
                        const request = doc.data();
                        const senderDoc = await db.collection('users').doc(request.senderId).get();
                        if (senderDoc.exists) {
                            const sender = senderDoc.data();
                            friendsHTML += `
                                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center justify-between">
                                    <a href="profile.html?uid=${request.senderId}" class="flex items-center space-x-3">
                                        <img src="${sender.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-12 h-12 rounded-full object-cover">
                                        <div>
                                            <p class="font-semibold dark:text-white">${sender.displayName}</p>
                                            <p class="text-sm text-gray-500">@${sender.handle}</p>
                                        </div>
                                    </a>
                                    <div class="flex space-x-2">
                                        <button class="accept-friend-btn bg-green-500 text-white w-8 h-8 rounded-full" data-request-id="${doc.id}" data-sender-id="${request.senderId}"><i class="fas fa-check"></i></button>
                                        <button class="reject-friend-btn bg-red-500 text-white w-8 h-8 rounded-full" data-request-id="${doc.id}"><i class="fas fa-times"></i></button>
                                    </div>
                                </div>
                            `;
                        }
                    }
                    friendsHTML += '</div>';
                }
            }

            friendsHTML += `<h3 class="text-xl font-bold mb-4 dark:text-white">All Friends (${friendIds.length})</h3>`;
            if (friendIds.length === 0) {
                friendsHTML += '<p class="text-gray-500 dark:text-gray-400 p-4">No friends to display.</p>';
            } else {
                friendsHTML += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
                for (const friendId of friendIds) {
                    const friendDoc = await db.collection('users').doc(friendId).get();
                    if (friendDoc.exists) {
                        const friend = friendDoc.data();
                        friendsHTML += `
                            <a href="profile.html?uid=${friendId}" class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center space-x-3 hover:shadow-lg">
                                <img src="${friend.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-12 h-12 rounded-full object-cover">
                                <div>
                                    <p class="font-semibold dark:text-white">${friend.displayName}</p>
                                    <p class="text-sm text-gray-500">@${friend.handle}</p>
                                </div>
                            </a>
                        `;
                    }
                }
                friendsHTML += '</div>';
            }
            container.innerHTML = friendsHTML;

        } catch (error) {
            console.error("Error loading friends:", error);
            container.innerHTML = '<p class="text-red-500 p-4">Could not load friends list.</p>';
        }
    };
    
    // Event delegation for actions on the profile page
    document.body.addEventListener('click', async (event) => {
        const acceptButton = event.target.closest('.accept-friend-btn');
        const rejectButton = event.target.closest('.reject-friend-btn');
        const pinDeckBtn = event.target.closest('.pin-deck-btn');
        const pinCardBtn = event.target.closest('.pin-card-btn');

        if (acceptButton) {
            const requestId = acceptButton.dataset.requestId;
            const senderId = acceptButton.dataset.senderId;

            const batch = db.batch();
            const userRef = db.collection('users').doc(currentUser.uid);
            const senderRef = db.collection('users').doc(senderId);
            const requestRef = db.collection('friendRequests').doc(requestId);

            batch.update(userRef, { friends: firebase.firestore.FieldValue.arrayUnion(senderId) });
            batch.update(senderRef, { friends: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            batch.delete(requestRef);
            
            const notificationData = {
                message: `${currentUser.displayName} accepted your friend request.`,
                link: `/profile.html?uid=${currentUser.uid}`,
                isRead: false,
                timestamp: new Date()
            };
            const notificationRef = db.collection('users').doc(senderId).collection('notifications').doc();
            batch.set(notificationRef, notificationData);
            
            await batch.commit();
            loadProfileFriends(currentUser.uid);
        }

        if (rejectButton) {
            const requestId = rejectButton.dataset.requestId;
            await db.collection('friendRequests').doc(requestId).delete();
            loadProfileFriends(currentUser.uid);
        }

        if (pinDeckBtn) {
            const deckId = pinDeckBtn.dataset.deckId;
            await db.collection('users').doc(currentUser.uid).update({ featuredDeck: deckId });
            alert('Deck pinned to your profile!');
            setupProfilePage(); // Reload profile to show changes
        }

        if (pinCardBtn) {
            const cardId = pinCardBtn.dataset.cardId;
            const userRef = db.collection('users').doc(currentUser.uid);
            await db.runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                let featured = userDoc.data().featuredCards || [];
                if (!featured.includes(cardId)) {
                    featured.push(cardId);
                    if (featured.length > 4) featured.shift(); // Keep only the last 4
                } else {
                    featured = featured.filter(id => id !== cardId); // Unpin if already pinned
                }
                transaction.update(userRef, { featuredCards: featured });
            });
            alert('Featured cards updated!');
            setupProfilePage();
        }
    });

    // Initial call to start loading the page content
    setupProfilePage();
});
