document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    if (!document.getElementById('profile-displayName')) return;

    const setupProfilePage = async () => {
        const params = new URLSearchParams(window.location.search);
        let username = params.get('user');
        
        if (!username && window.location.pathname !== '/' && !window.location.pathname.includes('profile.html')) {
             const pathSegments = window.location.pathname.split('/').filter(Boolean);
             if(pathSegments.length > 0) username = pathSegments[pathSegments.length - 1];
        }

        let profileUserId, profileUserData;

        if (username) {
            const userQuery = await db.collection('users').where('handle', '==', username).limit(1).get();
            if (!userQuery.empty) {
                const userDoc = userQuery.docs[0];
                profileUserId = userDoc.id;
                profileUserData = userDoc.data();
            } else {
                document.querySelector('main').innerHTML = '<h1 class="text-center text-2xl font-bold mt-10">User not found.</h1>';
                return;
            }
        } else if (currentUser) {
            profileUserId = currentUser.uid;
            const userDoc = await db.collection('users').doc(profileUserId).get();
            profileUserData = userDoc.data();
        } else {
            alert("Please log in to see your profile or specify a user.");
            window.location.href = 'index.html';
            return;
        }

        document.getElementById('profile-displayName').textContent = profileUserData.displayName;
        document.getElementById('profile-handle').textContent = `@${profileUserData.handle}`;
        document.getElementById('profile-bio').textContent = profileUserData.bio;
        document.getElementById('profile-fav-tcg').textContent = profileUserData.favoriteTcg || 'Not set';
        document.getElementById('profile-avatar').src = profileUserData.photoURL || 'https://placehold.co/128x128';
        document.getElementById('profile-banner').src = profileUserData.bannerURL || 'https://placehold.co/1200x300';

        const actionButtonsContainer = document.getElementById('profile-action-buttons');
        if (currentUser && currentUser.uid !== profileUserId) {
            actionButtonsContainer.innerHTML = `
                <button id="add-friend-btn" class="px-4 py-2 bg-blue-500 text-white rounded-full text-sm">Add Friend</button>
                <button id="message-btn" class="px-4 py-2 bg-gray-500 text-white rounded-full text-sm" data-uid="${profileUserId}">Message</button>`;
            document.getElementById('message-btn').addEventListener('click', (e) => {
                window.location.href = `/messages.html?with=${e.currentTarget.dataset.uid}`;
            });
        } else if (currentUser && currentUser.uid === profileUserId) {
            document.getElementById('edit-profile-btn').classList.remove('hidden');
        }

        const tabs = document.querySelectorAll('.profile-tab-button');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.profile-tab-content').forEach(content => content.classList.add('hidden'));
                document.getElementById(`tab-content-${tab.dataset.tab}`).classList.remove('hidden');
            });
        });

        loadProfileDecks(profileUserId);
        loadProfileCollection(profileUserId, 'collection');
        loadProfileCollection(profileUserId, 'wishlist');
    };
    
    const loadProfileDecks = async (userId) => {
        const container = document.getElementById('tab-content-decks');
        if (!container) return;
        container.innerHTML = '<p class="text-gray-500">Loading decks...</p>';
        const snapshot = await db.collection('users').doc(userId).collection('decks').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            container.innerHTML = '<p class="text-gray-500">This user has no public decks.</p>';
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
            container.innerHTML = `<p class="text-gray-500">This user's ${listType} is empty or private.</p>`;
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

    setupProfilePage();
});
