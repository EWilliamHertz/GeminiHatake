/**
 * HatakeSocial - Profile Page Script
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles all logic for displaying user profiles, including their feed,
 * decks, collection, and wishlist.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const profileContainer = document.getElementById('profile-container');
    // If this element doesn't exist, we're not on the profile page, so do nothing.
    if (!profileContainer) return;

    const setupProfilePage = async () => {
        const params = new URLSearchParams(window.location.search);
        let username = params.get('user');

        // This allows for clean URLs like /username instead of /profile.html?user=username
        // Note: This requires server-side configuration (like a .htaccess file or netlify.toml) to work on a live server.
        if (!username && window.location.pathname !== '/' && !window.location.pathname.includes('profile.html')) {
             const pathSegments = window.location.pathname.split('/').filter(Boolean);
             if(pathSegments.length > 0) {
                username = pathSegments[pathSegments.length - 1];
             }
        }

        let profileUserId, profileUserData;

        if (username) {
            // If a username is in the URL, find that user in Firestore
            const userQuery = await db.collection('users').where('handle', '==', username).limit(1).get();
            if (!userQuery.empty) {
                const userDoc = userQuery.docs[0];
                profileUserId = userDoc.id;
                profileUserData = userDoc.data();
            } else {
                profileContainer.innerHTML = '<h1 class="text-center text-2xl font-bold mt-10">User not found.</h1>';
                return;
            }
        } else if (currentUser) {
            // If no username in URL, show the logged-in user's own profile
            profileUserId = currentUser.uid;
            const userDoc = await db.collection('users').doc(profileUserId).get();
            profileUserData = userDoc.data();
        } else {
            // If no user is specified and nobody is logged in, prompt to log in.
            alert("Please log in to see your profile or specify a user in the URL (e.g., profile.html?user=profilename).");
            window.location.href = 'index.html';
            return;
        }

        // --- Populate Profile Header ---
        document.getElementById('profile-displayName').textContent = profileUserData.displayName;
        document.getElementById('profile-handle').textContent = `@${profileUserData.handle}`;
        document.getElementById('profile-bio').textContent = profileUserData.bio;
        document.getElementById('profile-fav-tcg').textContent = profileUserData.favoriteTcg || 'Not set';
        document.getElementById('profile-avatar').src = profileUserData.photoURL || 'https://placehold.co/128x128';
        document.getElementById('profile-banner').src = profileUserData.bannerURL || 'https://placehold.co/1200x300/cccccc/969696?text=Banner';

        // --- Show Action Buttons (Follow, Message, Edit) ---
        const actionButtonsContainer = document.getElementById('profile-action-buttons');
        if (currentUser && currentUser.uid !== profileUserId) {
            // Viewing someone else's profile
            actionButtonsContainer.innerHTML = `
                <button id="follow-btn" class="px-4 py-2 bg-blue-500 text-white rounded-full text-sm">Follow</button>
                <button id="message-btn" class="px-4 py-2 bg-gray-500 text-white rounded-full text-sm" data-uid="${profileUserId}">Message</button>`;
            document.getElementById('message-btn').addEventListener('click', (e) => {
                window.location.href = `/messages.html?with=${e.currentTarget.dataset.uid}`;
            });
        } else if (currentUser && currentUser.uid === profileUserId) {
            // Viewing your own profile
            const editProfileBtn = document.getElementById('edit-profile-btn');
            editProfileBtn.classList.remove('hidden');
            editProfileBtn.addEventListener('click', () => {
                // Populate the modal with existing data before opening
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
            // In a real app, you'd check if this handle is already taken
            const updatedData = {
                displayName: document.getElementById('edit-displayName').value,
                handle: newHandle,
                bio: document.getElementById('edit-bio').value,
                favoriteTcg: document.getElementById('edit-fav-tcg').value,
            };
            await db.collection('users').doc(currentUser.uid).update(updatedData);
            closeModal(document.getElementById('edit-profile-modal'));
            location.reload(); // Reload to see changes
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
    };
    
    const loadProfileFeed = async (userId) => {
        const container = document.getElementById('tab-content-feed');
        if (!container) return;
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
    };

    const loadProfileDecks = async (userId) => {
        const container = document.getElementById('tab-content-decks');
        if (!container) return;
        container.innerHTML = '<p class="text-gray-500">Loading decks...</p>';
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
    };
    
    const loadProfileCollection = async (userId, listType) => {
        const container = document.getElementById(`tab-content-${listType}`);
        if (!container) return;
        container.innerHTML = '<p class="text-gray-500">Loading...</p>';
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
    };

    // Run the setup function for the page
    setupProfilePage();
});
