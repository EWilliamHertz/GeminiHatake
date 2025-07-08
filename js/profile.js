/**
 * HatakeSocial - Profile Page Script (v9 - Merged Functionality)
 *
 * This script handles all logic for the user profile page.
 * - Merges friend request/list logic and trade history from v7.
 * - Retains the granular reputation display and logic from v8.
 * - Creates notifications for friend requests and acceptances.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

    // --- Badge Definitions ---
    const badgeDefinitions = {
        pioneer: {
            name: 'Pioneer',
            description: 'One of the first 100 users to join HatakeSocial!',
            icon: 'fa-rocket',
            color: 'text-purple-500',
            async check(userData, userId) {
                const pioneerDate = new Date('2025-07-01');
                return userData.createdAt.toDate() < pioneerDate;
            }
        },
        collector: {
            name: 'Collector',
            description: 'Has over 100 cards in their collection.',
            icon: 'fa-box-open',
            color: 'text-blue-500',
            async check(userData, userId) {
                const snapshot = await db.collection('users').doc(userId).collection('collection').limit(101).get();
                return snapshot.size > 100;
            }
        },
        deckmaster: {
            name: 'Deck Master',
            description: 'Has created at least 5 decks.',
            icon: 'fa-layer-group',
            color: 'text-green-500',
            async check(userData, userId) {
                const snapshot = await db.collection('users').doc(userId).collection('decks').limit(5).get();
                return snapshot.size >= 5;
            }
        },
        socialite: {
            name: 'Socialite',
            description: 'Has more than 10 friends.',
            icon: 'fa-users',
            color: 'text-pink-500',
            async check(userData, userId) {
                return userData.friends && userData.friends.length > 10;
            }
        },
        trusted_trader: {
            name: 'Trusted Trader',
            description: 'Completed 10 trades with positive feedback.',
            icon: 'fa-handshake',
            color: 'text-yellow-500',
            async check(userData, userId) {
                 const avgRating = ((userData.averageAccuracy || 0) + (userData.averagePackaging || 0)) / 2;
                 return (userData.ratingCount || 0) >= 10 && avgRating >= 4.5;
            }
        }
    };

    const setupProfilePage = async () => {
        profileContainer.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i><p class="mt-4">Loading Profile...</p></div>';

        try {
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
            }

            if (!userDoc || !userDoc.exists) {
                throw new Error("User not found.");
            }

            const profileUserId = userDoc.id;
            const profileUserData = userDoc.data();
            const isOwnProfile = currentUser && currentUser.uid === profileUserId;

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

            let actionButtonHTML = '';
            if (!isOwnProfile && currentUser) {
                actionButtonHTML += `<button id="message-btn" class="px-4 py-2 bg-gray-500 text-white rounded-full text-sm" data-uid="${profileUserId}">Message</button>`;
                switch (friendStatus) {
                    case 'none': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-blue-500 text-white rounded-full text-sm">Add Friend</button>`; break;
                    case 'request_sent': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-gray-400 text-white rounded-full text-sm" disabled>Request Sent</button>`; break;
                    case 'friends': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-green-500 text-white rounded-full text-sm" disabled><i class="fas fa-check mr-2"></i>Friends</button>`; break;
                    case 'request_received': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-yellow-500 text-white rounded-full text-sm">Respond to Request</button>`; break;
                }
            }

            // --- REPUTATION DISPLAY ---
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

            profileContainer.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                    <div class="relative">
                        <img id="profile-banner" class="w-full h-48 object-cover" src="${profileUserData.bannerURL || 'https://placehold.co/1200x300/cccccc/969696?text=Banner'}" alt="Profile banner">
                        <div class="absolute top-4 right-4">
                            ${isOwnProfile ? `<a href="settings.html" class="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 text-sm">Edit Profile</a>` : ''}
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="flex items-end -mt-24">
                            <img id="profile-avatar" class="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 object-cover" src="${profileUserData.photoURL || 'https://placehold.co/128x128'}" alt="User avatar">
                            <div class="ml-4 flex-grow">
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
                            </div>
                        </div>
                        <div class="mt-4 border-t dark:border-gray-700 pt-4">
                            <p id="profile-bio" class="text-gray-700 dark:text-gray-300 mt-2">${profileUserData.bio || 'No bio yet.'}</p>
                            <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                <strong>Favorite TCG:</strong> <span id="profile-fav-tcg">${profileUserData.favoriteTcg || 'Not set'}</span>
                            </div>
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
                        <div id="tab-content-collection" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div>
                        <div id="tab-content-friends" class="profile-tab-content hidden"></div>
                        <div id="tab-content-wishlist" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div>
                        <div id="tab-content-trade-history" class="profile-tab-content hidden space-y-4"></div>
                        <div id="tab-content-feedback" class="profile-tab-content hidden space-y-4"></div>
                    </div>
                </div>
            `;
            
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

            document.querySelectorAll('.profile-tab-button').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.profile-tab-button').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.add('hidden'));
                    document.getElementById(`tab-content-${tab.dataset.tab}`).classList.remove('hidden');
                    if(tab.dataset.tab === 'friends') loadProfileFriends(profileUserId);
                });
            });

            if(window.location.hash) {
                const targetTab = document.querySelector(`.profile-tab-button[data-tab="${window.location.hash.substring(1)}"]`);
                if(targetTab) targetTab.click();
            }

            loadProfileFeed(profileUserId);
            loadProfileDecks(profileUserId);
            loadProfileCollection(profileUserId, 'collection');
            loadProfileCollection(profileUserId, 'wishlist');
            loadProfileTradeHistory(profileUserId);
            loadProfileFeedback(profileUserId);
            if (window.location.hash === '#friends') loadProfileFriends(profileUserId);
            
            if (isOwnProfile) {
                await evaluateAndAwardBadges(profileUserId, profileUserData);
            }
            await loadAndDisplayBadges(profileUserId);

        } catch (error) {
            console.error("Error loading profile:", error);
            profileContainer.innerHTML = `<div class="text-center p-8 bg-white rounded-lg shadow-md"><h1 class="text-2xl font-bold text-red-600">Error</h1><p class="mt-2">${error.message}</p></div>`;
        }
    };
    
    const evaluateAndAwardBadges = async (userId, userData) => {
        const userBadgesRef = db.collection('users').doc(userId).collection('badges');
        const existingBadgesSnapshot = await userBadgesRef.get();
        const existingBadgeIds = existingBadgesSnapshot.docs.map(doc => doc.id);

        for (const badgeId in badgeDefinitions) {
            if (!existingBadgeIds.includes(badgeId)) {
                const definition = badgeDefinitions[badgeId];
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
            }
        }
    };

    const loadAndDisplayBadges = async (userId) => {
        const badgesListContainer = document.getElementById('badges-list');
        badgesListContainer.innerHTML = '';
        const snapshot = await db.collection('users').doc(userId).collection('badges').get();

        if (snapshot.empty) {
            badgesListContainer.innerHTML = '<p class="text-sm text-gray-500">No achievements yet.</p>';
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
    };

    const loadProfileFeed = async (userId) => {
        const container = document.getElementById('tab-content-feed');
        container.innerHTML = '<p class="text-gray-500">Loading feed...</p>';
        const snapshot = await db.collection('posts').where('authorId', '==', userId).orderBy('timestamp', 'desc').get();
        if(snapshot.empty) {
            container.innerHTML = '<p class="text-center text-gray-500">This user hasn\'t posted anything yet.</p>';
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
    };

    const loadProfileDecks = async (userId) => {
        const container = document.getElementById('tab-content-decks');
        container.innerHTML = '<p class="text-gray-500">Loading decks...</p>';
        const snapshot = await db.collection('users').doc(userId).collection('decks').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            container.innerHTML = '<p class="text-center text-gray-500">This user has no public decks.</p>';
            return;
        }
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const deck = doc.data();
            const deckCard = document.createElement('a');
            deckCard.href = `deck.html?deckId=${doc.id}`;
            deckCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md block hover:shadow-lg';
            deckCard.innerHTML = `<h3 class="text-xl font-bold truncate dark:text-white">${deck.name}</h3><p class="text-sm text-gray-500 dark:text-gray-400">${deck.format || deck.tcg}</p>`;
            container.appendChild(deckCard);
        });
    };
    
    const loadProfileCollection = async (userId, listType) => {
        const container = document.getElementById(`tab-content-${listType}`);
        container.innerHTML = '<p class="text-gray-500">Loading...</p>';
        try {
            const snapshot = await db.collection('users').doc(userId).collection(listType).limit(32).get();
            if (snapshot.empty) {
                container.innerHTML = `<p class="text-center text-gray-500">This user's ${listType} is empty or private.</p>`;
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const card = doc.data();
                const cardEl = document.createElement('a');
                cardEl.href = `card-view.html?name=${encodeURIComponent(card.name)}`;
                cardEl.className = 'block relative';
                const forSaleIndicator = card.forSale ? 'border-4 border-green-500' : '';
                cardEl.innerHTML = `<img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="rounded-lg shadow-md w-full ${forSaleIndicator}">`;
                container.appendChild(cardEl);
            });
        } catch (error) {
            console.error("Error loading collection/wishlist: ", error);
            container.innerHTML = `<p class="text-center text-red-500">Could not load this section. This is likely a Firestore Security Rules issue.</p>`;
        }
    };

    const loadProfileTradeHistory = async (userId) => {
        const container = document.getElementById('tab-content-trade-history');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Loading trade history...</p>';

        try {
            const snapshot = await db.collection('trades')
                .where('participants', 'array-contains', userId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">This user has no trade history.</p>';
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
            container.innerHTML = `<p class="text-center text-red-500">Could not load trade history. The required database index may be building.</p>`;
        }
    };

    const loadProfileFeedback = async (userId) => {
        const container = document.getElementById('tab-content-feedback');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Loading feedback...</p>';
        try {
            const feedbackSnapshot = await db.collection('feedback').where('forUserId', '==', userId).orderBy('createdAt', 'desc').get();

            if (feedbackSnapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">This user has not received any feedback yet.</p>';
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
            container.innerHTML = `<p class="text-center text-red-500">Could not load feedback. The required database index may be building.</p>`;
        }
    };
    
    const loadProfileFriends = async (userId) => {
        const container = document.getElementById('tab-content-friends');
        if (!container) return;

        container.innerHTML = '<p class="text-gray-500">Loading friends...</p>';

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
                friendsHTML += '<p class="text-gray-500">No friends to display.</p>';
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
            container.innerHTML = '<p class="text-red-500">Could not load friends list.</p>';
        }
    };
    
    document.body.addEventListener('click', async (event) => {
        const acceptButton = event.target.closest('.accept-friend-btn');
        const rejectButton = event.target.closest('.reject-friend-btn');

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
            
            const senderDoc = await senderRef.get();
            const senderData = senderDoc.data();
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
    });

    setupProfilePage();
});
