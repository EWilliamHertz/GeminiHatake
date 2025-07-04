/**
 * HatakeSocial - Profile Page Script (v5 - Combined & Stable)
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It intelligently checks if the required Firestore index exists.
 * If not, it provides a link in the console to create it.
 * If the index exists, it loads the full profile page.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

    const setupProfilePage = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const username = params.get('user');
            const userIdParam = params.get('uid');

            let userDoc;

            // This is the query that requires the special index.
            // We run it first to check if the index exists.
            if (username) {
                const userQuery = await db.collection('users').where('handle', '==', username).limit(1).get();
                if (!userQuery.empty) {
                    userDoc = userQuery.docs[0];
                }
            } else if (userIdParam) {
                userDoc = await db.collection('users').doc(userIdParam).get();
            } else if (currentUser) {
                userDoc = await db.collection('users').doc(currentUser.uid).get();
            }

            // If we still don't have a user document, something is wrong.
            if (!userDoc || !userDoc.exists) {
                throw new Error("User document could not be found. If you are trying to view a profile by its handle, the required database index might be missing.");
            }
            
            const profileUserId = userDoc.id;
            const profileUserData = userDoc.data();

            // --- If we get here, the index exists and the user was found. Load the page. ---

            // Populate Profile Header
            document.getElementById('profile-displayName').textContent = profileUserData.displayName || 'No Name';
            document.getElementById('profile-handle').textContent = `@${profileUserData.handle || 'no-handle'}`;
            document.getElementById('profile-bio').textContent = profileUserData.bio || 'No bio yet.';
            document.getElementById('profile-fav-tcg').textContent = profileUserData.favoriteTcg || 'Not set';
            document.getElementById('profile-avatar').src = profileUserData.photoURL || 'https://placehold.co/128x128';
            document.getElementById('profile-banner').src = profileUserData.bannerURL || 'https://placehold.co/1200x300/cccccc/969696?text=Banner';

            // Show Action Buttons
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

            // Setup Edit Profile Form
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

            // Setup Profile Tabs
            const tabs = document.querySelectorAll('.profile-tab-button');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.add('hidden'));
                    document.getElementById(`tab-content-${tab.dataset.tab}`).classList.remove('hidden');
                });
            });

            // Load Initial Content for the First Tab
            loadProfileFeed(profileUserId);
            loadProfileDecks(profileUserId);
            loadProfileCollection(profileUserId, 'collection');
            loadProfileCollection(profileUserId, 'wishlist');

        } catch (error) {
            // This block will run if the index is missing.
            console.error("THIS IS THE EXPECTED ERROR IF THE INDEX IS MISSING. CLICK THE LINK IN THIS ERROR MESSAGE TO CREATE THE INDEX:", error);
            profileContainer.innerHTML = `<div class="text-center p-8">
                <h1 class="text-2xl font-bold text-red-600">Action Required: Database Index Missing</h1>
                <p class="mt-2">The database needs a one-time setup to display profiles by username.</p>
                <p class="mt-4 font-semibold">Please follow these steps:</p>
                <ol class="text-left inline-block mt-2 space-y-1">
                    <li>1. Open the Developer Console (press F12).</li>
                    <li>2. Find the red error message that starts with "THIS IS THE EXPECTED ERROR...".</li>
                    <li>3. Click the long <span class="font-mono bg-gray-200 px-1">https://console.firebase.google.com...</span> link inside that error message.</li>
                    <li>4. A new browser tab will open to Firebase with the index details pre-filled.</li>
                    <li>5. Click the "Create" button.</li>
                    <li>6. Wait for the index status to become "Enabled", then refresh this page.</li>
                </ol>
            </div>`;
        }
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
