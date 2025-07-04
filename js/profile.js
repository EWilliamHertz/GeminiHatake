/**
 * HatakeSocial - Profile Page Script (v5 - Final Robust Version)
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It dynamically builds the profile page HTML before populating it,
 * preventing any "element not found" errors.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

    // Show a loading spinner immediately
    profileContainer.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i></div>';

    const setupProfilePage = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const username = params.get('user');
            const userIdParam = params.get('uid');

            let userDoc;

            if (username) {
                const userQuery = await db.collection('users').where('handle', '==', username).limit(1).get();
                if (!userQuery.empty) userDoc = userQuery.docs[0];
            } else if (userIdParam) {
                userDoc = await db.collection('users').doc(userIdParam).get();
            } else if (currentUser) {
                userDoc = await db.collection('users').doc(currentUser.uid).get();
            }

            if (!userDoc || !userDoc.exists) {
                throw new Error("User document could not be found.");
            }
            
            const profileUserId = userDoc.id;
            const profileUserData = userDoc.data();

            // --- Dynamically build the entire profile page HTML ---
            profileContainer.innerHTML = `
                <div class="bg-white rounded-lg shadow-xl overflow-hidden">
                    <div class="relative">
                        <img id="profile-banner" class="w-full h-48 object-cover" src="${profileUserData.bannerURL || 'https://placehold.co/1200x300/cccccc/969696?text=Banner'}" alt="Profile banner">
                        <div class="absolute top-4 right-4">
                            <button id="edit-profile-btn" class="hidden px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 text-sm">Edit Profile</button>
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
                                    </div>
                                    <div id="profile-action-buttons" class="flex space-x-2"></div>
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
                        </nav>
                    </div>
                    <div class="mt-6">
                        <div id="tab-content-feed" class="profile-tab-content space-y-6"></div>
                        <div id="tab-content-decks" class="profile-tab-content hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
                        <div id="tab-content-collection" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div>
                        <div id="tab-content-wishlist" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div>
                    </div>
                </div>
            `;

            // --- Now that the HTML exists, attach listeners and load data ---
            
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

            const tabs = document.querySelectorAll('.profile-tab-button');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.add('hidden'));
                    document.getElementById(`tab-content-${tab.dataset.tab}`).classList.remove('hidden');
                });
            });

            loadProfileFeed(profileUserId);
            loadProfileDecks(profileUserId);
            loadProfileCollection(profileUserId, 'collection');
            loadProfileCollection(profileUserId, 'wishlist');

        } catch (error) {
            console.error("A critical error occurred while setting up the profile page:", error);
            profileContainer.innerHTML = `<h1 class="text-center text-red-500 font-bold mt-10">An error occurred while loading this profile.</h1>`;
        }
    };
    
    const loadProfileFeed = async (userId) => { /* ... */ };
    const loadProfileDecks = async (userId) => { /* ... */ };
    const loadProfileCollection = async (userId, listType) => { /* ... */ };

    setupProfilePage();
});
