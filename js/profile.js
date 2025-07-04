/**
 * HatakeSocial - Profile Page Script (v4 - Stable & Debugged)
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles all logic for displaying user profiles, including their feed,
 * decks, collection, and wishlist. It can find users by handle OR by UID.
 * This version assumes the 'handle' index has been created in Firestore.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const profileContainer = document.getElementById('profile-container');
    // If this element doesn't exist, we're not on the profile page, so do nothing.
    if (!profileContainer) return;

    const setupProfilePage = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const username = params.get('user');
            const userIdParam = params.get('uid');

            let userDoc;

            if (username) {
                const userQuery = await db.collection('users').where('handle', '==', username).limit(1).get();
                if (!userQuery.empty) {
                    userDoc = userQuery.docs[0];
                } else {
                    throw new Error(`No user found with handle: ${username}`);
                }
            } else if (userIdParam) {
                userDoc = await db.collection('users').doc(userIdParam).get();
            } else if (currentUser) {
                userDoc = await db.collection('users').doc(currentUser.uid).get();
            } else {
                 // If no user is specified and nobody is logged in, show an error
                profileContainer.innerHTML = '<h1 class="text-center text-2xl font-bold mt-10">Please specify a user to view their profile.</h1>';
                return;
            }

            if (!userDoc || !userDoc.exists) {
                throw new Error("User document could not be found in the database.");
            }
            
            const profileUserId = userDoc.id;
            const profileUserData = userDoc.data();

            // --- Populate Profile Header ---
            document.getElementById('profile-displayName').textContent = profileUserData.displayName || 'No Name';
            document.getElementById('profile-handle').textContent = `@${profileUserData.handle || 'no-handle'}`;
            document.getElementById('profile-bio').textContent = profileUserData.bio || 'No bio yet.';
            document.getElementById('profile-fav-tcg').textContent = profileUserData.favoriteTcg || 'Not set';
            document.getElementById('profile-avatar').src = profileUserData.photoURL || 'https://placehold.co/128x128';
            document.getElementById('profile-banner').src = profileUserData.bannerURL || 'https://placehold.co/1200x300/cccccc/969696?text=Banner';

            // --- Show Action Buttons ---
            const actionButtonsContainer = document.getElementById('profile-action-buttons');
            if (currentUser && currentUser.uid !== profileUserId) {
                actionButtonsContainer.innerHTML = `
                    <button id="follow-btn" class="px-4 py-2 bg-blue-500 text-white rounded-full text-sm">Follow</button>
                    <button id="message-btn" class="px-4 py-2 bg-gray-500 text-white rounded-full text-sm" data-uid="${profileUserId}">Message</button>`;
                document.getElementById('message-btn').addEventListener('click', (e) => {
                    window.location.href = `/messages.html?with=${e.currentTarget.dataset.uid}`;
                });
            } else if (currentUser && currentUser.uid === profileUserId) {
                const editProfileBtn = document.getElementById('edit-profile-btn');
                editProfileBtn.classList.remove('hidden');
                editProfileBtn.addEventListener('click', () => {
                    document.getElementById('edit-displayName').value = profileUserData.displayName;
                    document.getElementById('edit-handle').value = profileUserData.handle;
                    document.getElementById('edit-bio').value = profileUserData.bio;
                    document.getElementById('edit-fav-tcg').value = profileUserData.favoriteTcg;
                    openModal(document.getElementById('edit-profile-modal'));
                });
            }

            // --- Setup Edit Profile Form ---
            document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                if(!currentUser) return;
                const newHandle = document.getElementById('edit-handle').value.toLowerCase();
                const updatedData = {
                    displayName: document.getElementById('edit-displayName').value,
                    handle: newHandle,
                    bio: document.getElementById('edit-bio').value,
                    favoriteTcg: document.getElementById('edit-fav-tcg').value,
                };
                await db.collection('users').doc(currentUser.uid).update(updatedData);
                closeModal(document.getElementById('edit-profile-modal'));
                location.reload();
            });
            document.getElementById('close-edit-modal')?.addEventListener('click', () => closeModal(document.getElementById('edit-profile-modal')));

            // --- Setup Profile Tabs ---
            const tabs = document.querySelectorAll('.profile-tab-button');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.add('hidden'));
                    document.getElementById(`tab-content-${tab.dataset.tab}`).classList.remove('hidden');
                });
            });

            // --- Load Initial Content for the First Tab ---
            loadProfileFeed(profileUserId);
            loadProfileDecks(profileUserId);
            loadProfileCollection(profileUserId, 'collection');
            loadProfileCollection(profileUserId, 'wishlist');

        } catch (error) {
            console.error("A critical error occurred while setting up the profile page:", error);
            profileContainer.innerHTML = `<h1 class="text-center text-red-500 font-bold mt-10">An error occurred while loading this profile. Check the console for details.</h1>`;
        }
    };
    
    const loadProfileFeed = async (userId) => {
        const container = document.getElementById('tab-content-feed');
        if (!container) return;
        container.innerHTML = '<p class="text-gray-500">Loading feed...</p>';
        try {
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
                        <img src="${post.authorPhotoURL}" alt="author" class="h-10 w-10 rounded-full mr-4">
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
        } catch (error) {
            console.error(`profile.js: Error loading feed for user ${userId}:`, error);
            container.innerHTML = '<p class="text-center text-red-500">Could not load feed.</p>';
        }
    };

    const loadProfileDecks = async (userId) => {
        const container = document.getElementById('tab-content-decks');
        if (!container) return;
        container.innerHTML = '<p class="text-gray-500">Loading decks...</p>';
        try {
            const snapshot = await db.collection('users').doc(userId).collection('decks').orderBy('createdAt', 'desc').get();
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500">This user has no public decks.</p>';
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const deck = doc.data();
                const deckCard = document.createElement('div');
                deckCard.className = 'bg-white p-4 rounded-lg shadow-md';
                deckCard.innerHTML = `<h3 class="text-xl font-bold truncate">${deck.name}</h3><p class="text-sm text-gray-500">${deck.format || deck.tcg}</p>`;
                container.appendChild(deckCard);
            });
        } catch (error) {
            console.error(`profile.js: Error loading decks for user ${userId}:`, error);
            container.innerHTML = '<p class="text-center text-red-500">Could not load decks.</p>';
        }
    };
    
    const loadProfileCollection = async (userId, listType) => {
        const container = document.getElementById(`tab-content-${listType}`);
        if (!container) return;
        container.innerHTML = '<p class="text-gray-500">Loading...</p>';
        try {
            const snapshot = await db.collection('users').doc(userId).collection(listType).limit(24).get();
            if (snapshot.empty) {
                container.innerHTML = `<p class="text-center text-gray-500">This user's ${listType} is empty or private.</p>`;
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const card = doc.data();
                const cardEl = document.createElement('div');
                cardEl.innerHTML = `<img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="rounded-lg shadow-md w-full">`;
                container.appendChild(cardEl);
            });
        } catch (error) {
            console.error(`profile.js: Error loading ${listType} for user ${userId}:`, error);
            container.innerHTML = `<p class="text-center text-red-500">Could not load ${listType}.</p>`;
        }
    };

    // Run the setup function for the page
    setupProfilePage();
});
