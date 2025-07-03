document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.appspot.com",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:e0d3c35c3c0a2c3c3c0a2c"
    };

    // --- Firebase Initialization ---
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Global State & Helpers ---
    let currentDeck = null;
    const openModal = (modal) => { if (modal) modal.classList.add('open'); };
    const closeModal = (modal) => { if (modal) modal.classList.remove('open'); };

    // --- Core UI & Authentication (Runs on all pages) ---
    const setupCoreUI = () => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const logoutButton = document.getElementById('logoutButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');

        auth.onAuthStateChanged(async (user) => {
            if (user) {
                if (loginButton) loginButton.classList.add('hidden');
                if (registerButton) registerButton.classList.add('hidden');
                if (userAvatar) userAvatar.classList.remove('hidden');

                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const photo = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';
                    const name = userData.displayName || 'User';
                    if (userAvatar) userAvatar.src = photo;
                    
                    const sidebarUserInfo = document.getElementById('sidebar-user-info');
                    if (sidebarUserInfo) {
                        document.getElementById('sidebar-user-avatar').src = photo;
                        document.getElementById('sidebar-user-name').textContent = name;
                        document.getElementById('sidebar-user-handle').textContent = `@${name.toLowerCase().replace(/\s/g, '')}`;
                    }
                }
            } else {
                if (loginButton) loginButton.classList.remove('hidden');
                if (registerButton) registerButton.classList.remove('hidden');
                if (userAvatar) userAvatar.classList.add('hidden');
                if (userDropdown) userDropdown.classList.add('hidden');
            }
        });

        if (loginButton) loginButton.addEventListener('click', () => openModal(loginModal));
        if (registerButton) registerButton.addEventListener('click', () => openModal(registerModal));
        document.getElementById('closeLoginModal')?.addEventListener('click', () => closeModal(loginModal));
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => closeModal(registerModal));

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            auth.signInWithEmailAndPassword(email, password).then(() => closeModal(loginModal)).catch(err => alert(err.message));
        });

        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    const defaultPhotoURL = `https://ui-avatars.com/api/?name=${email.charAt(0)}&background=random&color=fff`;
                    cred.user.updateProfile({ displayName: email.split('@')[0], photoURL: defaultPhotoURL });
                    return db.collection('users').doc(cred.user.uid).set({
                        displayName: email.split('@')[0],
                        email: email,
                        photoURL: defaultPhotoURL,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                })
                .then(() => closeModal(registerModal))
                .catch(err => alert(err.message));
        });

        document.getElementById('googleLoginButton')?.addEventListener('click', () => {
            auth.signInWithPopup(googleProvider).then(result => {
                if (result.additionalUserInfo.isNewUser) {
                    const user = result.user;
                    db.collection('users').doc(user.uid).set({
                        displayName: user.displayName, email: user.email, photoURL: user.photoURL,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
                closeModal(loginModal);
            }).catch(error => alert(error.message));
        });

        if (logoutButton) logoutButton.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
        if (userAvatar) userAvatar.addEventListener('click', () => userDropdown.classList.toggle('hidden'));
    };

    // --- INDEX.HTML LOGIC ---
    const setupIndexPage = () => {
        const postsContainer = document.getElementById('postsContainer');
        if (!postsContainer) return;

        const postContentInput = document.getElementById('postContent');
        const submitPostBtn = document.getElementById('submitPostBtn');
        const postStatusMessage = document.getElementById('postStatusMessage');
        const postImageUpload = document.getElementById('postImageUpload');
        let selectedFile = null;

        const renderComments = (commentsListEl, comments) => {
            commentsListEl.innerHTML = !comments || comments.length === 0 ? '<p class="text-gray-500 text-sm">No comments yet.</p>' : '';
            comments?.sort((a, b) => a.timestamp - b.timestamp).forEach(comment => {
                commentsListEl.innerHTML += `<div class="pt-2 border-t mt-2"><p><strong>${comment.author || 'Anonymous'}:</strong> ${comment.content}</p></div>`;
            });
        };

        const renderPosts = async () => {
            const postsSnapshot = await db.collection('posts').orderBy('timestamp', 'desc').get();
            postsContainer.innerHTML = '';
            postsSnapshot.forEach(doc => {
                const post = doc.data();
                const postElement = document.createElement('div');
                postElement.className = 'bg-white p-4 rounded-lg shadow-md post-container';
                postElement.dataset.id = doc.id;

                const content = post.content?.replace(/\[(.*?)\]/g, `<a href="#" class="text-blue-500 card-link" data-card-name="$1">$1</a>`) || '';
                postElement.innerHTML = `
                    <div class="flex items-center mb-4">
                        <img src="${post.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="author" class="h-10 w-10 rounded-full mr-4">
                        <div>
                            <p class="font-bold">${post.author || 'Anonymous'}</p>
                            <p class="text-sm text-gray-500">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                        </div>
                    </div>
                    <p class="mb-4">${content}</p>
                    ${post.mediaUrl ? (post.mediaType.startsWith('image/') ? `<img src="${post.mediaUrl}" class="w-full rounded-lg">` : `<video src="${post.mediaUrl}" controls class="w-full rounded-lg"></video>`) : ''}
                    <div class="flex justify-between items-center mt-4 text-gray-600">
                        <button class="like-btn flex items-center hover:text-red-500"><i class="far fa-heart mr-1"></i> <span class="likes-count">${post.likes?.length || 0}</span></button>
                        <button class="comment-btn flex items-center hover:text-blue-500"><i class="far fa-comment mr-1"></i> <span class="comments-count">${post.comments?.length || 0}</span></button>
                    </div>
                    <div class="comments-section hidden mt-4">
                        <div class="comments-list"></div>
                        <form class="comment-form flex mt-4"><input type="text" class="w-full border rounded-l-lg p-2" placeholder="Write a comment..."><button type="submit" class="bg-blue-500 text-white px-4 rounded-r-lg">Post</button></form>
                    </div>`;
                postsContainer.appendChild(postElement);
            });
        };

        renderPosts();

        submitPostBtn.addEventListener('click', async () => {
            const content = postContentInput.value;
            const user = auth.currentUser;
            if (!user) { postStatusMessage.textContent = 'You must be logged in.'; return; }
            if (!content.trim() && !selectedFile) { postStatusMessage.textContent = 'Please write something.'; return; }
            postStatusMessage.textContent = 'Posting...';
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) throw new Error("User profile not found.");
                const userData = userDoc.data();
                let mediaUrl = null, mediaType = null;
                if (selectedFile) {
                    const filePath = `posts/${user.uid}/${Date.now()}_${selectedFile.name}`;
                    const fileRef = storage.ref(filePath);
                    await fileRef.put(selectedFile);
                    mediaUrl = await fileRef.getDownloadURL();
                    mediaType = selectedFile.type;
                }
                await db.collection('posts').add({
                    author: userData.displayName || 'Anonymous', authorId: user.uid, authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                    content, timestamp: firebase.firestore.FieldValue.serverTimestamp(), likes: [], comments: [], mediaUrl, mediaType
                });
                postContentInput.value = ''; postImageUpload.value = ''; selectedFile = null;
                postStatusMessage.textContent = 'Posted!';
                setTimeout(() => postStatusMessage.textContent = '', 2000);
                renderPosts();
            } catch (error) { postStatusMessage.textContent = `Error: ${error.message}`; }
        });

        postsContainer.addEventListener('click', async (e) => {
            const user = auth.currentUser;
            if (!user) { alert("Please log in to interact."); return; }
            const postElement = e.target.closest('.post-container');
            if (!postElement) return;
            const postId = postElement.dataset.id;
            const postRef = db.collection('posts').doc(postId);

            if (e.target.closest('.comment-btn')) {
                const commentsSection = postElement.querySelector('.comments-section');
                const wasHidden = commentsSection.classList.toggle('hidden');
                if (!wasHidden) {
                    const postDoc = await postRef.get();
                    renderComments(commentsSection.querySelector('.comments-list'), postDoc.data().comments);
                }
            } else if (e.target.closest('.like-btn')) {
                db.runTransaction(async t => {
                    const doc = await t.get(postRef);
                    const likes = doc.data().likes || [];
                    const index = likes.indexOf(user.uid);
                    index === -1 ? likes.push(user.uid) : likes.splice(index, 1);
                    t.update(postRef, { likes });
                    return likes;
                }).then(likes => postElement.querySelector('.likes-count').textContent = likes.length);
            }
        });

        postsContainer.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (e.target.classList.contains('comment-form')) {
                const user = auth.currentUser, input = e.target.querySelector('input'), content = input.value.trim();
                if (!content || !user) return;
                const postElement = e.target.closest('.post-container'), postId = postElement.dataset.id;
                const postRef = db.collection('posts').doc(postId);
                const newComment = { author: user.displayName || 'Anonymous', authorId: user.uid, content, timestamp: firebase.firestore.FieldValue.serverTimestamp() };
                await postRef.update({ comments: firebase.firestore.FieldValue.arrayUnion(newComment) });
                input.value = '';
                const postDoc = await postRef.get();
                renderComments(postElement.querySelector('.comments-list'), postDoc.data().comments);
                postElement.querySelector('.comments-count').textContent = postDoc.data().comments.length;
            }
        });

        document.getElementById('uploadImageBtn')?.addEventListener('click', () => postImageUpload.click());
        document.getElementById('uploadVideoBtn')?.addEventListener('click', () => postImageUpload.click());
        if (postImageUpload) postImageUpload.addEventListener('change', e => selectedFile = e.target.files[0]);
    };

    // --- DECK.HTML LOGIC ---
    const setupDeckPage = () => {
        const deckBuilderForm = document.getElementById('deck-builder-form');
        if (!deckBuilderForm) return;

        const saveDeckBtn = document.getElementById('save-deck-btn');
        const tabs = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(item => item.classList.remove('text-blue-600', 'border-blue-600'));
                tab.classList.add('text-blue-600', 'border-blue-600');
                const targetId = tab.id.replace('tab-', 'content-');
                tabContents.forEach(content => content.id === targetId ? content.classList.remove('hidden') : content.classList.add('hidden'));
                if (tab.id === 'tab-my-decks') loadMyDecks();
                if (tab.id === 'tab-community-decks') loadCommunityDecks();
            });
        });

        deckBuilderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const deckNameInput = document.getElementById('deck-name-input');
            const decklistInput = document.getElementById('decklist-input');
            const statusEl = document.getElementById('deck-builder-status');
            statusEl.textContent = 'Building deck...';
            saveDeckBtn.classList.add('hidden');

            const lines = decklistInput.value.split('\n').filter(line => line.trim() !== '');
            const cardPromises = lines.map(line => {
                const match = line.match(/^(\d+)\s+(.*)/);
                if (!match) return null;
                return fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(match[2].trim())}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(cardData => cardData ? { ...cardData, quantity: parseInt(match[1], 10) } : null);
            }).filter(p => p);

            const cardResults = (await Promise.all(cardPromises)).filter(c => c);
            currentDeck = { name: deckNameInput.value, cards: cardResults, createdAt: new Date() };
            displayDeck(currentDeck);
            saveDeckBtn.classList.remove('hidden');
            statusEl.textContent = 'Deck built successfully!';
        });

        saveDeckBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) { alert("You must be logged in to save a deck."); return; }
            if (!currentDeck) { alert("No deck has been built yet."); return; }
            try {
                await db.collection('users').doc(user.uid).collection('decks').add(currentDeck);
                alert(`Deck "${currentDeck.name}" saved!`);
            } catch (error) { alert("Failed to save deck."); }
        });
    };

    const displayDeck = (deck) => {
        const cardsDisplayEl = document.getElementById('deck-cards-display');
        const deckStatsEl = document.getElementById('deck-stats');
        cardsDisplayEl.innerHTML = '';
        deckStatsEl.classList.remove('hidden');
        document.getElementById('deck-stats-name').textContent = deck.name;

        const categorizedCards = {};
        let totalCards = 0, totalPrice = 0;
        deck.cards.forEach(card => {
            const type = card.type_line.split('—')[0].trim();
            if (!categorizedCards[type]) categorizedCards[type] = [];
            categorizedCards[type].push(card);
            totalCards += card.quantity;
            totalPrice += parseFloat(card.prices.usd || 0) * card.quantity;
        });

        Object.keys(categorizedCards).sort().forEach(category => {
            const categoryEl = document.createElement('div');
            categoryEl.innerHTML = `<h3 class="text-xl font-bold border-b-2 pb-2 mb-4">${category}</h3>`;
            const gridEl = document.createElement('div');
            gridEl.className = 'grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4';
            categorizedCards[category].forEach(card => {
                gridEl.innerHTML += `<div><img src="${card.image_uris?.normal}" alt="${card.name}" class="rounded-lg shadow-md"><p class="text-center font-semibold mt-1">${card.quantity}x ${card.name}</p><p class="text-center text-sm text-gray-600">$${card.prices.usd || 'N/A'}</p></div>`;
            });
            categoryEl.appendChild(gridEl);
            cardsDisplayEl.appendChild(categoryEl);
        });
        document.getElementById('total-cards-count').textContent = totalCards;
        document.getElementById('total-deck-price').textContent = `$${totalPrice.toFixed(2)}`;
    };

    const loadMyDecks = async () => {
        const myDecksList = document.getElementById('my-decks-list');
        const user = auth.currentUser;
        if (!user) { myDecksList.innerHTML = '<p>Please log in to see your decks.</p>'; return; }
        myDecksList.innerHTML = '<p>Loading...</p>';
        const snapshot = await db.collection('users').doc(user.uid).collection('decks').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) { myDecksList.innerHTML = '<p>You have no saved decks.</p>'; return; }
        myDecksList.innerHTML = '';
        snapshot.forEach(doc => {
            const deck = doc.data();
            const totalPrice = deck.cards.reduce((acc, card) => acc + parseFloat(card.prices.usd || 0) * card.quantity, 0);
            const deckCard = document.createElement('div');
            deckCard.className = 'bg-white p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl';
            deckCard.innerHTML = `<h3 class="text-xl font-bold">${deck.name}</h3><p class="text-gray-600">${deck.createdAt.toDate().toLocaleDateString()}</p><p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>`;
            deckCard.addEventListener('click', () => {
                document.getElementById('tab-builder').click();
                displayDeck(deck);
            });
            myDecksList.appendChild(deckCard);
        });
    };

    const loadCommunityDecks = async () => {
        const communityDecksList = document.getElementById('community-decks-list');
        communityDecksList.innerHTML = '<p>Loading...</p>';
        try {
            const snapshot = await db.collectionGroup('decks').orderBy('createdAt', 'desc').limit(21).get();
            if (snapshot.empty) { communityDecksList.innerHTML = '<p>No community decks found.</p>'; return; }
            communityDecksList.innerHTML = '';
            snapshot.forEach(doc => {
                const deck = doc.data();
                const totalPrice = deck.cards.reduce((acc, card) => acc + parseFloat(card.prices.usd || 0) * card.quantity, 0);
                const deckCard = document.createElement('div');
                deckCard.className = 'bg-white p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl';
                deckCard.innerHTML = `<h3 class="text-xl font-bold">${deck.name}</h3><p class="text-gray-600">${deck.createdAt.toDate().toLocaleDateString()}</p><p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>`;
                deckCard.addEventListener('click', () => {
                    document.getElementById('tab-builder').click();
                    displayDeck(deck);
                });
                communityDecksList.appendChild(deckCard);
            });
        } catch (error) {
            console.error(error);
            communityDecksList.innerHTML = `<p class="text-red-500">Error loading decks. The necessary database index might be missing. Please check the browser console for a link to create it.</p>`;
        }
    };

    // --- Page Initialization ---
    setupCoreUI();
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        setupIndexPage();
    } else if (window.location.pathname.includes('deck.html')) {
        setupDeckPage();
    }
});
