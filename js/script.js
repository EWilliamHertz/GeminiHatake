document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.appspot.com",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:6a7cf9f10bd12650b22403"
    };

    // --- Firebase Initialization ---
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Global State & Helpers ---
    let deckToShare = null;
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
            const sidebarUserInfo = document.getElementById('sidebar-user-info');
            const createPostSection = document.getElementById('create-post-section');
            if (user) {
                if (loginButton) loginButton.classList.add('hidden');
                if (registerButton) registerButton.classList.add('hidden');
                if (userAvatar) userAvatar.classList.remove('hidden');
                if (createPostSection) createPostSection.classList.remove('hidden');

                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const photo = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';
                    const name = userData.displayName || 'User';
                    if (userAvatar) userAvatar.src = photo;
                    if (sidebarUserInfo) {
                        sidebarUserInfo.classList.remove('hidden');
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
                if (sidebarUserInfo) sidebarUserInfo.classList.add('hidden');
                if (createPostSection) createPostSection.classList.add('hidden');
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
                        displayName: email.split('@')[0], email: email, photoURL: defaultPhotoURL,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                })
                .then(() => closeModal(registerModal))
                .catch(err => alert(err.message));
        });

        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
        }
        if (userAvatar) {
            userAvatar.addEventListener('click', () => userDropdown.classList.toggle('hidden'));
        }
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
            comments?.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds).forEach(comment => {
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

                let content = post.content || '';
                content = content.replace(/\[deck:([^:]+):([^\]]+)\]/g, `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 hover:underline">[Deck: $2]</a>`);
                content = content.replace(/\[([^\]:]+)\]/g, `<a href="#" class="text-blue-500 card-link" data-card-name="$1">$1</a>`);

                postElement.innerHTML = `
                    <div class="flex items-center mb-4">
                        <img src="${post.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="author" class="h-10 w-10 rounded-full mr-4">
                        <div><p class="font-bold">${post.author || 'Anonymous'}</p><p class="text-sm text-gray-500">${new Date(post.timestamp?.toDate()).toLocaleString()}</p></div>
                    </div>
                    <p class="mb-4 whitespace-pre-wrap">${content}</p>
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
        const shareDeckModal = document.getElementById('share-deck-modal');
        const deckFilters = document.getElementById('deck-filters');
        const tcgFilterButtons = document.getElementById('tcg-filter-buttons');
        const formatFilterContainer = document.getElementById('format-filter-container');
        const formatFilterButtons = document.getElementById('format-filter-buttons');
        const deckTcgSelect = document.getElementById('deck-tcg-select');
        const deckFormatSelectContainer = document.getElementById('deck-format-select-container');
        const deckFormatSelect = document.getElementById('deck-format-select');

        const formats = {
            "Magic: The Gathering": ["Standard", "Modern", "Legacy", "Vintage", "Commander", "Pauper", "Oldschool"],
            "Pokémon": ["Standard", "Expanded"],
            "Flesh and Blood": ["Classic Constructed", "Blitz"],
            "Yu-Gi-Oh!": ["Advanced", "Traditional"]
        };

        const switchTab = (tabId) => {
            tabs.forEach(item => {
                const isTarget = item.id === tabId;
                item.classList.toggle('text-blue-600', isTarget);
                item.classList.toggle('border-blue-600', isTarget);
                item.classList.toggle('text-gray-500', !isTarget);
                item.classList.toggle('hover:border-gray-300', !isTarget);
            });
            const targetContentId = tabId.replace('tab-', 'content-');
            tabContents.forEach(content => content.id === targetContentId ? content.classList.remove('hidden') : content.classList.add('hidden'));
            
            if (tabId === 'tab-my-decks' || tabId === 'tab-community-decks') {
                deckFilters.classList.remove('hidden');
            } else {
                deckFilters.classList.add('hidden');
            }
        };
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                switchTab(tab.id);
                if (tab.id === 'tab-my-decks') loadMyDecks();
                if (tab.id === 'tab-community-decks') loadCommunityDecks();
            });
        });

        deckTcgSelect.addEventListener('change', () => {
            const selectedTcg = deckTcgSelect.value;
            if (formats[selectedTcg]) {
                deckFormatSelect.innerHTML = '<option value="" disabled selected>Select a Format</option>';
                formats[selectedTcg].forEach(format => {
                    deckFormatSelect.innerHTML += `<option value="${format}">${format}</option>`;
                });
                deckFormatSelectContainer.classList.remove('hidden');
            } else {
                deckFormatSelectContainer.classList.add('hidden');
            }
        });

        deckBuilderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const deckNameInput = document.getElementById('deck-name-input');
            const decklistInput = document.getElementById('decklist-input');
            const buildBtn = document.getElementById('build-deck-btn');

            buildBtn.disabled = true;
            buildBtn.textContent = 'Building...';
            saveDeckBtn.classList.add('hidden');

            const lines = decklistInput.value.split('\n').filter(line => line.trim() !== '');
            const cardPromises = lines.map(line => {
                const match = line.match(/^(\d+)\s+(.*)/);
                if (!match) return null;
                const cardName = match[2].trim().replace(/\s\/\/.*$/, '');
                return fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(cardData => cardData ? { ...cardData, quantity: parseInt(match[1], 10) } : null);
            }).filter(p => p);

            const cardResults = (await Promise.all(cardPromises)).filter(c => c);
            const user = auth.currentUser;
            const newDeck = {
                name: deckNameInput.value,
                cards: cardResults,
                createdAt: new Date(),
                tcg: deckTcgSelect.value,
                format: deckFormatSelect.value,
                authorId: user?.uid || null,
                authorName: user?.displayName || 'Anonymous'
            };
            viewDeck(newDeck, null, true);
            buildBtn.disabled = false;
            buildBtn.textContent = 'Build & Price Deck';
        });

        saveDeckBtn.addEventListener('click', async () => {
            const user = auth.currentUser;
            if (!user) { alert("You must be logged in to save a deck."); return; }
            if (!deckToShare) { alert("No deck has been built yet."); return; }
            saveDeckBtn.textContent = "Saving...";
            try {
                const docRef = await db.collection('users').doc(user.uid).collection('decks').add(deckToShare);
                deckToShare.id = docRef.id;
                alert(`Deck "${deckToShare.name}" saved!`);
            } catch (error) { alert("Failed to save deck."); }
            saveDeckBtn.textContent = "Save Deck";
        });

        document.getElementById('share-deck-to-feed-btn')?.addEventListener('click', () => {
             if (deckToShare) openModal(shareDeckModal);
        });
        document.getElementById('close-share-deck-modal')?.addEventListener('click', () => closeModal(shareDeckModal));
        document.getElementById('share-deck-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const message = document.getElementById('share-deck-message').value;
            const statusEl = document.getElementById('share-deck-status');
            if (!user) { statusEl.textContent = "You must be logged in."; return; }
            if (!deckToShare || !deckToShare.id) { statusEl.textContent = "Please save the deck before sharing."; return; }

            statusEl.textContent = "Posting...";
            const deckLink = `[deck:${deckToShare.id}:${deckToShare.name}]`;
            const postContent = message ? `${message}\n\n${deckLink}` : deckLink;

            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                await db.collection('posts').add({
                    author: userData.displayName || 'Anonymous',
                    authorId: user.uid,
                    authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                    content: postContent,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    likes: [], comments: []
                });
                statusEl.textContent = "Successfully posted to feed!";
                setTimeout(() => {
                    closeModal(shareDeckModal);
                    statusEl.textContent = "";
                    document.getElementById('share-deck-message').value = "";
                }, 1500);
            } catch (error) {
                statusEl.textContent = "Failed to post.";
                console.error("Share error: ", error);
            }
        });

        tcgFilterButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('tcg-filter-btn')) {
                tcgFilterButtons.querySelectorAll('.tcg-filter-btn').forEach(btn => btn.classList.remove('filter-btn-active'));
                e.target.classList.add('filter-btn-active');
                
                const selectedTcg = e.target.dataset.tcg;
                formatFilterButtons.innerHTML = '<button class="format-filter-btn filter-btn-active" data-format="all">All Formats</button>';
                if (selectedTcg !== 'all' && formats[selectedTcg]) {
                    formats[selectedTcg].forEach(format => {
                        formatFilterButtons.innerHTML += `<button class="format-filter-btn" data-format="${format}">${format}</button>`;
                    });
                    formatFilterContainer.classList.remove('hidden');
                } else {
                    formatFilterContainer.classList.add('hidden');
                }
                
                const activeTab = document.querySelector('#tab-my-decks.text-blue-600') ? 'my' : 'community';
                if (activeTab === 'my') loadMyDecks(selectedTcg);
                else loadCommunityDecks(selectedTcg);
            }
        });

        formatFilterButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('format-filter-btn')) {
                formatFilterButtons.querySelectorAll('.format-filter-btn').forEach(btn => btn.classList.remove('filter-btn-active'));
                e.target.classList.add('filter-btn-active');

                const selectedTcg = tcgFilterButtons.querySelector('.filter-btn-active').dataset.tcg;
                const selectedFormat = e.target.dataset.format;
                
                const activeTab = document.querySelector('#tab-my-decks.text-blue-600') ? 'my' : 'community';
                if (activeTab === 'my') loadMyDecks(selectedTcg, selectedFormat);
                else loadCommunityDecks(selectedTcg, selectedFormat);
            }
        });

        const viewDeck = (deck, deckId, isNewlyBuilt = false) => {
            switchTab('tab-deck-view');
            deckToShare = { ...deck, id: deckId };
    
            document.getElementById('deck-view-name').textContent = deck.name;
            document.getElementById('deck-view-author').textContent = `by ${deck.authorName || 'Anonymous'}`;
            
            const listEl = document.getElementById('deck-view-list');
            const featuredCardImg = document.getElementById('deck-view-featured-card');
            listEl.innerHTML = '';
    
            const categorizedCards = {};
            let totalPrice = 0;
            deck.cards.forEach(card => {
                const mainType = card.type_line.split(' // ')[0];
                let category = 'Other';
                if (mainType.includes('Creature')) category = 'Creatures';
                else if (mainType.includes('Planeswalker')) category = 'Planeswalkers';
                else if (mainType.includes('Instant') || mainType.includes('Sorcery')) category = 'Spells';
                else if (mainType.includes('Artifact')) category = 'Artifacts';
                else if (mainType.includes('Enchantment')) category = 'Enchantments';
                else if (mainType.includes('Land')) category = 'Lands';
                
                if (!categorizedCards[category]) categorizedCards[category] = [];
                categorizedCards[category].push(card);
                totalPrice += parseFloat(card.prices.usd || 0) * card.quantity;
            });
    
            document.getElementById('deck-view-price').textContent = `$${totalPrice.toFixed(2)}`;
            if (deck.cards.length > 0) {
                featuredCardImg.src = deck.cards[0].image_uris?.normal || 'https://placehold.co/223x310?text=No+Image';
            }
    
            const order = ['Creatures', 'Planeswalkers', 'Spells', 'Artifacts', 'Enchantments', 'Lands', 'Other'];
            order.forEach(category => {
                if (categorizedCards[category]) {
                    const cardCount = categorizedCards[category].reduce((acc, c) => acc + c.quantity, 0);
                    let categoryHTML = `<div class="break-inside-avoid mb-4"><h3 class="font-bold text-lg mb-2">${category} (${cardCount})</h3>`;
                    categorizedCards[category].forEach(card => {
                        categoryHTML += `<p>${card.quantity} <a href="#" class="card-link text-blue-600 hover:underline" data-card-name="${card.name}" data-card-image="${card.image_uris?.normal}">${card.name}</a></p>`;
                    });
                    categoryHTML += `</div>`;
                    listEl.innerHTML += categoryHTML;
                }
            });

            if(isNewlyBuilt) {
                saveDeckBtn.classList.remove('hidden');
            } else {
                saveDeckBtn.classList.add('hidden');
            }
        };

        const loadMyDecks = async (tcg = 'all', format = 'all') => {
            const myDecksList = document.getElementById('my-decks-list');
            const user = auth.currentUser;
            if (!user) { myDecksList.innerHTML = '<p>Please log in to see your decks.</p>'; return; }
            myDecksList.innerHTML = '<p>Loading...</p>';
            let query = db.collection('users').doc(user.uid).collection('decks');
            if(tcg !== 'all') query = query.where('tcg', '==', tcg);
            if(format !== 'all') query = query.where('format', '==', format);
            const snapshot = await query.orderBy('createdAt', 'desc').get();

            if (snapshot.empty) { myDecksList.innerHTML = '<p>No decks found for the selected filters.</p>'; return; }
            myDecksList.innerHTML = '';
            snapshot.forEach(doc => {
                const deck = doc.data();
                const totalPrice = deck.cards.reduce((acc, card) => acc + parseFloat(card.prices.usd || 0) * card.quantity, 0);
                const deckCard = document.createElement('div');
                deckCard.className = 'bg-white p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl';
                deckCard.innerHTML = `<h3 class="text-xl font-bold">${deck.name}</h3><p class="text-sm text-gray-500">by ${deck.authorName || 'Anonymous'}</p><p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>`;
                deckCard.addEventListener('click', () => viewDeck(deck, doc.id));
                myDecksList.appendChild(deckCard);
            });
        };
        
        const loadCommunityDecks = async (tcg = 'all', format = 'all') => {
            const communityDecksList = document.getElementById('community-decks-list');
            communityDecksList.innerHTML = '<p>Loading...</p>';
            try {
                let query = db.collectionGroup('decks');
                if(tcg !== 'all') query = query.where('tcg', '==', tcg);
                if(format !== 'all') query = query.where('format', '==', format);
                const snapshot = await query.orderBy('createdAt', 'desc').limit(21).get();

                if (snapshot.empty) { communityDecksList.innerHTML = '<p>No decks found for the selected filters.</p>'; return; }
                communityDecksList.innerHTML = '';
                snapshot.forEach(doc => {
                    const deck = doc.data();
                    const totalPrice = deck.cards.reduce((acc, card) => acc + parseFloat(card.prices.usd || 0) * card.quantity, 0);
                    const deckCard = document.createElement('div');
                    deckCard.className = 'bg-white p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl';
                    deckCard.innerHTML = `<h3 class="text-xl font-bold">${deck.name}</h3><p class="text-sm text-gray-500">by ${deck.authorName || 'Anonymous'}</p><p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>`;
                    deckCard.addEventListener('click', () => viewDeck(deck, doc.id));
                    communityDecksList.appendChild(deckCard);
                });
            } catch (error) {
                console.error(error);
                communityDecksList.innerHTML = `<p class="text-red-500">Error loading decks. The necessary database index might be missing.</p>`;
            }
        };

        const urlParams = new URLSearchParams(window.location.search);
        const deckId = urlParams.get('deckId');
        if (deckId) {
            db.collectionGroup('decks').where(firebase.firestore.FieldPath.documentId(), '==', deckId).limit(1).get()
                .then(snapshot => {
                    if (!snapshot.empty) {
                        const doc = snapshot.docs[0];
                        viewDeck(doc.data(), doc.id);
                    }
                });
        }
    };

    // --- GLOBAL EVENT LISTENERS (FOR CARD HOVER) ---
    document.body.addEventListener('mouseover', async (e) => {
        if (e.target.classList.contains('card-link')) {
            const featuredCardImg = document.getElementById('deck-view-featured-card');
            if (featuredCardImg && e.target.dataset.cardImage && e.target.closest('#deck-view-list')) {
                if (e.target.dataset.cardImage !== 'undefined') {
                    featuredCardImg.src = e.target.dataset.cardImage;
                }
            } else {
                if (document.querySelector('.card-tooltip')) return;
                const cardName = e.target.dataset.cardName;
                try {
                    const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
                    if (!response.ok) return;
                    const card = await response.json();
                    if (card.image_uris) {
                        const tooltip = document.createElement('div');
                        tooltip.className = 'card-tooltip';
                        tooltip.style.position = 'fixed';
                        tooltip.style.left = `${e.clientX + 20}px`;
                        tooltip.style.top = `${e.clientY - 150}px`;
                        tooltip.style.zIndex = '1000';
                        tooltip.innerHTML = `<img src="${card.image_uris.normal}" alt="${card.name}" style="width: 220px; border-radius: 10px;">`;
                        document.body.appendChild(tooltip);
                        e.target.addEventListener('mouseout', () => tooltip.remove(), { once: true });
                    }
                } catch (error) { console.error("Scryfall hover error:", error); }
            }
        }
    });

    // --- Page Initialization ---
    setupCoreUI();
    if (document.getElementById('postsContainer')) {
        setupIndexPage();
    }
    if (document.getElementById('deck-builder-form')) {
        setupDeckPage();
    }
});
