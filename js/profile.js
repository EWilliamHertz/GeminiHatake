/**
 * HatakeSocial - Profile Page Script (v4 - Final with Comments)
 *
 * This is the user's full profile.js file.
 * The code logic is correct and will work once the Security Rules and
 * Database Indexes from the accompanying instructions are in place.
 * I have added comments to clarify dependencies.
 */window.HatakeSocial.onAuthReady((user) => {    const currentUser = user;
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

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

            // Reputation Display
            const averageRating = profileUserData.averageRating || 0;
            const ratingCount = profileUserData.ratingCount || 0;
            let starsHTML = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= averageRating) starsHTML += '<i class="fas fa-star text-yellow-400"></i>';
                else if (i - 0.5 <= averageRating) starsHTML += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
                else starsHTML += '<i class="far fa-star text-gray-300"></i>';
            }
            const reputationHTML = `
                <div class="flex items-center space-x-2 text-sm text-gray-600 mt-1">
                    <span class="flex">${starsHTML}</span>
                    <span class="font-semibold">${averageRating.toFixed(1)}</span>
                    <span>(${ratingCount} ratings)</span>
                </div>
            `;

            profileContainer.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl overflow-hidden">
                    <div class="relative">
                        <img id="profile-banner" class="w-full h-48 object-cover" src="${profileUserData.bannerURL || 'https://placehold.co/1200x300/cccccc/969696?text=Banner'}" alt="Profile banner">
                        <div class="absolute top-4 right-4">
                            ${currentUser && currentUser.uid === profileUserId ? `<a href="settings.html" class="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 text-sm">Edit Profile</a>` : ''}
                        </div>
                    </div>
                    <div class="p-6">
                        <div class="flex items-end -mt-24">
                            <img id="profile-avatar" class="w-32 h-32 rounded-full border-4 border-white bg-gray-200 object-cover" src="${profileUserData.photoURL || 'https://placehold.co/128x128'}" alt="User avatar">
                            <div class="ml-4 flex-grow">
                                <div class="flex justify-between items-center">
                                     <div>
                                        <h1 id="profile-displayName" class="text-3xl font-bold text-gray-800">${profileUserData.displayName || 'No Name'}</h1>
                                        <p id="profile-handle" class="text-gray-600">@${profileUserData.handle || 'no-handle'}</p>
                                        ${reputationHTML}
                                    </div>
                                    <div id="profile-action-buttons" class="flex space-x-2">
                                        ${currentUser && currentUser.uid !== profileUserId ? `<button id="message-btn" class="px-4 py-2 bg-gray-500 text-white rounded-full text-sm" data-uid="${profileUserId}">Message</button>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="mt-4 border-t pt-4">
                            <p id="profile-bio" class="text-gray-700 mt-2">${profileUserData.bio || 'No bio yet.'}</p>
                            <div class="mt-2 text-sm text-gray-600">
                                <strong>Favorite TCG:</strong> <span id="profile-fav-tcg">${profileUserData.favoriteTcg || 'Not set'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-6">
                    <div class="border-b border-gray-200">
                        <nav id="profile-tabs" class="flex space-x-8" aria-label="Tabs">
                            <button data-tab="feed" class="profile-tab-button active">Feed</button>
                            <button data-tab="decks" class="profile-tab-button">Decks</button>
                            <button data-tab="collection" class="profile-tab-button">Collection</button>
                            <button data-tab="wishlist" class="profile-tab-button">Wishlist</button>
                            <button data-tab="trade-history" class="profile-tab-button">Trade History</button>
                            <button data-tab="feedback" class="profile-tab-button">Feedback</button>
                        </nav>
                    </div>
                    <div class="mt-6">
                        <div id="tab-content-feed" class="profile-tab-content space-y-6"></div>
                        <div id="tab-content-decks" class="profile-tab-content hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
                        <div id="tab-content-collection" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div>
                        <div id="tab-content-wishlist" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div>
                        <div id="tab-content-trade-history" class="profile-tab-content hidden space-y-4"></div>
                        <div id="tab-content-feedback" class="profile-tab-content hidden space-y-4"></div>
                    </div>
                </div>
            `;

            document.getElementById('message-btn')?.addEventListener('click', (e) => {
                window.location.href = `messages.html?with=${e.currentTarget.dataset.uid}`;
            });

            document.querySelectorAll('.profile-tab-button').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.profile-tab-button').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.add('hidden'));
                    document.getElementById(`tab-content-${tab.dataset.tab}`).classList.remove('hidden');
                });
            });

            // Load initial tab content
            loadProfileFeed(profileUserId);
            loadProfileDecks(profileUserId);
            loadProfileCollection(profileUserId, 'collection');
            loadProfileCollection(profileUserId, 'wishlist');
            loadProfileTradeHistory(profileUserId);
            loadProfileFeedback(profileUserId);

        } catch (error) {
            console.error("Error loading profile:", error);
            profileContainer.innerHTML = `<div class="text-center p-8 bg-white rounded-lg shadow-md"><h1 class="text-2xl font-bold text-red-600">Error</h1><p class="mt-2">${error.message}</p></div>`;
        }
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
            postElement.className = 'bg-white p-4 rounded-lg shadow-md';
            postElement.innerHTML = `
                <div class="flex items-center mb-4">
                    <img src="${post.authorPhotoURL}" alt="author" class="h-10 w-10 rounded-full mr-4 object-cover">
                    <div>
                        <p class="font-bold">${post.author}</p>
                        <p class="text-sm text-gray-500">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                    </div>
                </div>
                <p class="mb-4 whitespace-pre-wrap">${post.content}</p>
                 ${post.mediaUrl ? (post.mediaType.startsWith('image/') ? `<img src="${post.mediaUrl}" class="w-full rounded-lg">` : `<video src="${post.mediaUrl}" controls class="w-full rounded-lg"></video>`) : ''}
            `;
            container.appendChild(postElement);
        });
    };

    // DEPENDENCY: Works out of the box with Firestore basic indexing.
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
            deckCard.className = 'bg-white p-4 rounded-lg shadow-md block hover:shadow-lg';
            deckCard.innerHTML = `<h3 class="text-xl font-bold truncate">${deck.name}</h3><p class="text-sm text-gray-500">${deck.format || deck.tcg}</p>`;
            container.appendChild(deckCard);
        });
    };
    
    // DEPENDENCY: Requires Firestore rule `allow read: if request.auth != null;` on the user subcollections path.
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

    // DEPENDENCY: Requires Firestore index on `trades` collection: (participants ARRAY, createdAt DESC)
    const loadProfileTradeHistory = async (userId) => {
        const container = document.getElementById('tab-content-trade-history');
        container.innerHTML = '<p class="text-gray-500">Loading trade history...</p>';

        try {
            const snapshot = await db.collection('trades')
                .where('participants', 'array-contains', userId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();

            if (snapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500">This user has no trade history.</p>';
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
                const tradeCard = `<div class="bg-white p-4 rounded-lg shadow"><div class="flex justify-between items-center mb-2"><p class="font-semibold">Trade with <a href="profile.html?uid=${otherPartyId}" class="text-blue-600 hover:underline">${otherPartyName}</a></p><span class="px-3 py-1 text-sm font-semibold rounded-full ${statusClass}">${trade.status}</span></div><p class="text-xs text-gray-400 text-left">${new Date(trade.createdAt.toDate()).toLocaleDateString()}</p></div>`;
                container.innerHTML += tradeCard;
            });

        } catch (error) {
            console.error("Error loading trade history:", error);
            container.innerHTML = `<p class="text-center text-red-500">Could not load trade history. The required database index may be building.</p>`;
        }
    };

    // DEPENDENCY: Requires Firestore index on `feedback` collection: (forUserId ASC, createdAt DESC)
    const loadProfileFeedback = async (userId) => {
        const container = document.getElementById('tab-content-feedback');
        container.innerHTML = '<p class="text-gray-500">Loading feedback...</p>';
        try {
            const feedbackSnapshot = await db.collection('feedback').where('forUserId', '==', userId).orderBy('createdAt', 'desc').get();

            if (feedbackSnapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500">This user has not received any feedback yet.</p>';
                return;
            }

            container.innerHTML = '';
            feedbackSnapshot.forEach(doc => {
                const feedback = doc.data();
                let starsHTML = '';
                for (let i = 1; i <= 5; i++) {
                    starsHTML += `<i class="fas fa-star ${i <= feedback.rating ? 'text-yellow-400' : 'text-gray-300'}"></i>`;
                }
                const feedbackCard = `<div class="bg-white p-4 rounded-lg shadow"><div class="flex justify-between items-center mb-2"><p class="font-semibold">From: <a href="profile.html?uid=${feedback.fromUserId}" class="text-blue-600 hover:underline">${feedback.fromUserName}</a></p><div class="flex items-center space-x-1">${starsHTML}</div></div><p class="text-gray-700 italic">"${feedback.comment || 'No comment left.'}"</p><p class="text-xs text-gray-400 text-right mt-2">${new Date(feedback.createdAt.toDate()).toLocaleDateString()}</p></div>`;
                container.innerHTML += feedbackCard;
            });
        } catch (error) {
            console.error("Error loading feedback:", error);
            container.innerHTML = `<p class="text-center text-red-500">Could not load feedback. The required database index may be building.</p>`;
        }
    };

    setupProfilePage();
});
