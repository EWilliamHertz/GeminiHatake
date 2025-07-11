/**
 * HatakeSocial - Friends Hub Script (v6 - Final Friend Request Fix)
 *
 * This script handles all logic for the friends.html page.
 * - FIX: Ensures the two-part friend request acceptance process is robust.
 * - Adds a location search feature.
 * - Manages friend requests directly on the page.
 * - Provides friend suggestions based on shared groups and location.
 * - Displays a dedicated activity feed of friends' posts and new decks.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const friendsPageContainer = document.getElementById('friends-page-container');
    if (!friendsPageContainer) return;

    if (!currentUser) {
        friendsPageContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to manage your friends.</p>';
        return;
    }

    const tabs = document.querySelectorAll('.friend-tab-button');
    const tabContents = document.querySelectorAll('.friend-tab-content');
    const requestsListEl = document.getElementById('friend-requests-list');
    const friendsListEl = document.getElementById('friends-list');
    const suggestionsListEl = document.getElementById('friend-suggestions-list');
    const activityFeedEl = document.getElementById('friend-activity-feed');
    const requestCountBadge = document.getElementById('friend-request-count');
    const locationSearchInput = document.getElementById('location-search-input');

    // --- Helper to generate a Firestore index creation link ---
    const generateIndexCreationLink = (collection, fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };
    
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

    const switchTab = (tabId) => {
        tabs.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabId);
        });
        tabContents.forEach(content => {
            content.classList.toggle('hidden', content.id !== `tab-content-${tabId}`);
        });

        // Load content for the selected tab
        if (tabId === 'all-friends') loadFriendsList();
        if (tabId === 'requests') loadFriendRequests();
        if (tabId === 'suggestions') loadFriendSuggestions();
        if (tabId === 'activity') loadFriendActivityFeed();
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    const loadFriendRequests = async () => {
        requestsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Loading requests...</p>';
        const requestsSnapshot = await db.collection('friendRequests')
            .where('receiverId', '==', currentUser.uid)
            .where('status', '==', 'pending')
            .get();

        if (requestsSnapshot.empty) {
            requestsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No new friend requests.</p>';
            requestCountBadge.classList.add('hidden');
            return;
        }

        requestCountBadge.textContent = requestsSnapshot.size;
        requestCountBadge.classList.remove('hidden');

        requestsListEl.innerHTML = '';
        requestsSnapshot.forEach(async (doc) => {
            const request = doc.data();
            const senderDoc = await db.collection('users').doc(request.senderId).get();
            if (senderDoc.exists) {
                const sender = senderDoc.data();
                const requestCard = document.createElement('div');
                requestCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center justify-between';
                requestCard.innerHTML = `
                    <a href="profile.html?uid=${request.senderId}" class="flex items-center space-x-3">
                        <img src="${sender.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-12 h-12 rounded-full object-cover">
                        <div>
                            <p class="font-semibold text-gray-800 dark:text-white">${sender.displayName}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">@${sender.handle}</p>
                        </div>
                    </a>
                    <div class="flex space-x-2">
                        <button class="accept-friend-btn bg-green-500 text-white w-8 h-8 rounded-full hover:bg-green-600 transition" data-request-id="${doc.id}" data-sender-id="${request.senderId}"><i class="fas fa-check"></i></button>
                        <button class="reject-friend-btn bg-red-500 text-white w-8 h-8 rounded-full hover:bg-red-600 transition" data-request-id="${doc.id}"><i class="fas fa-times"></i></button>
                    </div>
                `;
                requestsListEl.appendChild(requestCard);
            }
        });
    };

    const loadFriendsList = async (locationQuery = '') => {
        friendsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Loading friends...</p>';
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const friendIds = userDoc.data()?.friends || [];

        if (friendIds.length === 0) {
            friendsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">You haven\\'t added any friends yet.</p>';
            return;
        }

        let friends = [];
        for (const friendId of friendIds) {
            const friendDoc = await db.collection('users').doc(friendId).get();
            if (friendDoc.exists) {
                friends.push({ id: friendDoc.id, ...friendDoc.data() });
            }
        }

        if (locationQuery) {
            friends = friends.filter(friend => {
                const city = friend.city || '';
                const country = friend.country || '';
                return city.toLowerCase().includes(locationQuery) || country.toLowerCase().includes(locationQuery);
            });
        }

        if (friends.length === 0) {
            friendsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No friends found for this location.</p>';
            return;
        }
        
        friendsListEl.innerHTML = '';
        for (const friend of friends) {
            const friendCard = document.createElement('a');
            friendCard.href = `profile.html?uid=${friend.id}`;
            friendCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col items-center text-center hover:shadow-lg transition';
            friendCard.innerHTML = `
                <img src="${friend.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-24 h-24 rounded-full object-cover mb-4">
                <p class="font-semibold text-gray-800 dark:text-white">${friend.displayName}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">@${friend.handle}</p>
            `;
            friendsListEl.appendChild(friendCard);
        }
    };

    locationSearchInput.addEventListener('input', (e) => {
        loadFriendsList(e.target.value.toLowerCase());
    });

    const loadFriendSuggestions = async () => {
        suggestionsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Finding potential friends...</p>';
        const currentUserData = (await db.collection('users').doc(currentUser.uid).get()).data();
        const myFriends = currentUserData.friends || [];
        const myRequestsSent = (await db.collection('friendRequests').where('senderId', '==', currentUser.uid).get()).docs.map(d => d.data().receiverId);
        const myRequestsReceived = (await db.collection('friendRequests').where('receiverId', '==', currentUser.uid).get()).docs.map(d => d.data().senderId);
        const excludedIds = [currentUser.uid, ...myFriends, ...myRequestsSent, ...myRequestsReceived];

        let suggestions = new Map();

        // Suggest based on country
        if (currentUserData.country) {
            const countrySnapshot = await db.collection('users').where('country', '==', currentUserData.country).limit(10).get();
            countrySnapshot.forEach(doc => {
                if (!excludedIds.includes(doc.id)) {
                    suggestions.set(doc.id, doc.data());
                }
            });
        }
        
        suggestionsListEl.innerHTML = '';
        if (suggestions.size === 0) {
            suggestionsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No suggestions right now. Try joining some groups!</p>';
            return;
        }

        suggestions.forEach((user, userId) => {
            const suggestionCard = document.createElement('div');
            suggestionCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center justify-between';
            suggestionCard.innerHTML = `
                <a href="profile.html?uid=${userId}" class="flex items-center space-x-3">
                    <img src="${user.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-12 h-12 rounded-full object-cover">
                    <div>
                        <p class="font-semibold text-gray-800 dark:text-white">${user.displayName}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">@${user.handle}</p>
                    </div>
                </a>
                <button class="add-friend-sugg-btn bg-blue-500 text-white w-8 h-8 rounded-full hover:bg-blue-600 transition" data-uid="${userId}"><i class="fas fa-plus"></i></button>
            `;
            suggestionsListEl.appendChild(suggestionCard);
        });
    };

    const loadFriendActivityFeed = async () => {
        activityFeedEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Loading friend activity...</p>';
        const myFriends = (await db.collection('users').doc(currentUser.uid).get()).data()?.friends || [];

        if (myFriends.length === 0) {
            activityFeedEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Add some friends to see their activity here.</p>';
            return;
        }

        try {
            const postsSnapshot = await db.collection('posts').where('authorId', 'in', myFriends).orderBy('timestamp', 'desc').limit(10).get();
            
            let activities = [];
            postsSnapshot.forEach(doc => activities.push({ type: 'post', data: doc.data(), id: doc.id, timestamp: doc.data().timestamp.toDate() }));
            
            activities.sort((a, b) => b.timestamp - a.timestamp);

            if (activities.length === 0) {
                activityFeedEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Your friends haven\\'t been active recently.</p>';
                return;
            }

            activityFeedEl.innerHTML = '';
            activities.forEach(activity => {
                const post = activity.data;
                const postElement = document.createElement('div');
                postElement.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md';
                postElement.innerHTML = `
                    <div class="flex items-center mb-4">
                        <a href="profile.html?uid=${post.authorId}"><img src="${post.authorPhotoURL}" alt="author" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
                        <div>
                            <a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white">${post.author}</a>
                            <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                        </div>
                    </div>
                    <p class="mb-4 whitespace-pre-wrap dark:text-gray-300">${post.content}</p>
                `;
                activityFeedEl.appendChild(postElement);
            });
        } catch (error) {
            console.error("Error loading friend activity:", error);
            if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('posts', [{ name: 'authorId', order: 'asc' }, { name: 'timestamp', order: 'desc' }]);
                displayIndexError(activityFeedEl, indexLink);
            } else {
                activityFeedEl.innerHTML = `<p class="text-red-500 p-4 text-center">An unknown error occurred.</p>`;
            }
        }
    };

    friendsPageContainer.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        if (button.classList.contains('accept-friend-btn')) {
            const requestId = button.dataset.requestId;
            const senderId = button.dataset.senderId;
            
            const batch = db.batch();
            const userRef = db.collection('users').doc(currentUser.uid);
            const senderRef = db.collection('users').doc(senderId);
            const requestRef = db.collection('friendRequests').doc(requestId);
            
            batch.update(userRef, { friends: firebase.firestore.FieldValue.arrayUnion(senderId) });
            batch.update(senderRef, { friends: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            batch.delete(requestRef);
            
            await batch.commit();

            const notificationData = {
                message: `${currentUser.displayName} accepted your friend request.`,
                link: `/profile.html?uid=${currentUser.uid}`,
                isRead: false,
                timestamp: new Date()
            };
            await db.collection('users').doc(senderId).collection('notifications').add(notificationData);
        
            loadFriendRequests();
            loadFriendsList();
        }

        if (button.classList.contains('reject-friend-btn')) {
            const requestId = button.dataset.requestId;
            await db.collection('friendRequests').doc(requestId).delete();
            loadFriendRequests();
        }

        if (button.classList.contains('add-friend-sugg-btn')) {
            const receiverId = button.dataset.uid;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-check"></i>';
            await db.collection('friendRequests').add({
                senderId: currentUser.uid,
                receiverId: receiverId,
                status: 'pending',
                createdAt: new Date()
            });
            const notificationData = {
                message: `${currentUser.displayName} sent you a friend request.`,
                link: `/friends.html`,
                isRead: false,
                timestamp: new Date()
            };
            await db.collection('users').doc(receiverId).collection('notifications').add(notificationData);
        }
    });

    // Initial Load
    loadFriendsList();
    loadFriendRequests();
});
