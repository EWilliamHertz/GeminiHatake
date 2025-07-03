/**
 * HatakeSocial - Complete TCG Social Platform Script
 *
 * This script manages all frontend logic for the HatakeSocial platform,
 * including Firebase authentication, Firestore database interactions, social feed,
 * deck building, and collection management.
 *
 * It is structured to run specific logic based on the current HTML page,
 * identified by the presence of unique element IDs.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    // IMPORTANT: Replace with your actual Firebase project configuration.
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
    let cardSearchResults = [];
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
        const googleLoginButton = document.getElementById('googleLoginButton');

        auth.onAuthStateChanged(async (user) => {
            const sidebarUserInfo = document.getElementById('sidebar-user-info');
            const createPostSection = document.getElementById('create-post-section');
            if (user) {
                // User is signed in
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
                        document.getElementById('sidebar-user-handle').textContent = `@${userData.handle || name.toLowerCase().replace(/\s/g, '')}`;
                    }
                }
            } else {
                // User is signed out
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
        
        if (googleLoginButton) {
            googleLoginButton.addEventListener('click', () => {
                auth.signInWithPopup(googleProvider).then(result => {
                    const user = result.user;
                    const userRef = db.collection('users').doc(user.uid);
                    userRef.get().then(doc => {
                        if (!doc.exists) {
                            // If user document doesn't exist, create it
                            userRef.set({
                                displayName: user.displayName,
                                email: user.email,
                                photoURL: user.photoURL,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                                handle: user.displayName.toLowerCase().replace(/\s/g, ''),
                                bio: "New HatakeSocial user!"
                            });
                        }
                    });
                    closeModal(loginModal);
                    closeModal(registerModal);
                }).catch(err => alert(err.message));
            });
        }


        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const displayName = email.split('@')[0];
            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    const defaultPhotoURL = `https://ui-avatars.com/api/?name=${displayName.charAt(0)}&background=random&color=fff`;
                    cred.user.updateProfile({ displayName: displayName, photoURL: defaultPhotoURL });
                    return db.collection('users').doc(cred.user.uid).set({
                        displayName: displayName,
                        email: email,
                        photoURL: defaultPhotoURL,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        handle: displayName.toLowerCase().replace(/\s/g, ''),
                        bio: "New HatakeSocial user!"
                    });
                })
                .then(() => closeModal(registerModal))
                .catch(err => alert(err.message));
        });

        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                auth.signOut();
            });
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
                // Regex to find [deck:deckId:Deck Name] and convert to a link
                content = content.replace(/\[deck:([^:]+):([^\]]+)\]/g, `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 hover:underline">[Deck: $2]</a>`);
                // Regex to find [Card Name] and make it a hoverable link (functionality to be added)
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
        
        auth.onAuthStateChanged(user => {
            if (user) {
                renderPosts();
            } else {
                postsContainer.innerHTML = '<p class="text-center text-gray-500">Please log in to see the feed.</p>';
            }
        });

        submitPostBtn.addEventListener('click', async () => {
            const content = postContentInput.value;
            const user = auth.currentUser;
            if (!user) { postStatusMessage.textContent = 'You must be logged in.'; return; }
            if (!content.trim() && !selectedFile) { postStatusMessage.textContent = 'Please write something or select a file.'; return; }
            
            submitPostBtn.disabled = true;
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
                    author: userData.displayName || 'Anonymous',
                    authorId: user.uid,
                    authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                    content,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    likes: [],
                    comments: [],
                    mediaUrl,
                    mediaType
                });
                postContentInput.value = '';
                postImageUpload.value = '';
                selectedFile = null;
                postStatusMessage.textContent = 'Posted!';
                setTimeout(() => postStatusMessage.textContent = '', 2000);
                renderPosts();
            } catch (error) {
                postStatusMessage.textContent = `Error: ${error.message}`;
                console.error("Post creation error:", error);
            } finally {
                submitPostBtn.disabled = false;
            }
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
                const user = auth.currentUser;
                if (!user) return;
                const input = e.target.querySelector('input');
                const content = input.value.trim();
                if (!content) return;
                const postElement = e.target.closest('.post-container');
                const postId = postElement.dataset.id;
                const postRef = db.collection('posts').doc(postId);
                const newComment = {
                    author: user.displayName || 'Anonymous',
                    authorId: user.uid,
                    content,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };
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
        if (!document.getElementById('deck-builder-form')) return;

        // --- 1. Get all DOM elements ---
        const deckBuilderForm = document.getElementById('deck-builder-form');
        const tabs = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        const deckFilters = document.getElementById('deck-filters');
        const tcgFilterButtons = document.getElementById('tcg-filter-buttons');
        const formatFilterContainer = document.getElementById('format-filter-container');
        const formatFilterButtons = document.getElementById('format-filter-buttons');
        const deckTcgSelect = document.getElementById('deck-tcg-select');
        const deckFormatSelectContainer = document.getElementById('deck-format-select-container');
        const deckFormatSelect = document.getElementById('deck-format-select');
        const editingDeckIdInput = document.getElementById('editing-deck-id');
        const builderTitle = document.getElementById('builder-title');
        const buildDeckBtn = document.getElementById('build-deck-btn');
        const deckNameInput = document.getElementById('deck-name-input');
        const deckBioInput = document.getElementById('deck-bio-input');
        const decklistInput = document.getElementById('decklist-input');
        const shareDeckToFeedBtn = document.getElementById('share-deck-to-feed-btn');
        
        const formats = {
            "Magic: The Gathering": ["Standard", "Modern", "Legacy", "Vintage", "Commander", "Pauper", "Oldschool"],
            "Pokémon": ["Standard", "Expanded"],
            "Flesh and Blood": ["Classic Constructed", "Blitz"],
            "Yu-Gi-Oh!": ["Advanced", "Traditional"]
        };

        // --- 2. Define all helper functions ---
        const switchTab = (tabId) => {
            tabs.forEach(item => {
                const isTarget = item.id === tabId;
                item.classList.toggle('text-blue-600', isTarget);
                item.classList.toggle('border-blue-600', isTarget);
                item.classList.toggle('text-gray-500', !isTarget);
                item.classList.toggle('hover:border-gray-300', !isTarget);
                item.classList.remove('hidden'); // Ensure no tabs are permanently hidden
            });
            document.getElementById('tab-deck-view').classList.add('hidden'); // Hide the view tab by default

            const targetContentId = tabId.replace('tab-', 'content-');
            tabContents.forEach(content => content.id === targetContentId ? content.classList.remove('hidden') : content.classList.add('hidden'));
            
            if (tabId === 'tab-my-decks' || tabId === 'tab-community-decks') {
                deckFilters.classList.remove('hidden');
            } else {
                deckFilters.classList.add('hidden');
            }
        };

        const viewDeck = (deck, deckId) => {
            switchTab('tab-deck-view');
            document.getElementById('tab-deck-view').classList.remove('hidden'); // Explicitly show the view tab
            deckToShare = { ...deck, id: deckId };
    
            document.getElementById('deck-view-name').textContent = deck.name;
            document.getElementById('deck-view-author').textContent = `by ${deck.authorName || 'Anonymous'}`;
            document.getElementById('deck-view-format').textContent = deck.format || 'N/A';
            const bioEl = document.getElementById('deck-view-bio');
            if (deck.bio) {
                bioEl.textContent = deck.bio;
                bioEl.classList.remove('hidden');
            } else {
                bioEl.classList.add('hidden');
            }
            
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
                deckCard.className = 'bg-white p-4 rounded-lg shadow-md';
                deckCard.innerHTML = `
                    <div class="cursor-pointer hover:opacity-80">
                        <h3 class="text-xl font-bold">${deck.name}</h3>
                        <p class="text-sm text-gray-500">${deck.format || deck.tcg}</p>
                        <p class="text-blue-500 font-semibold mt-2">Value: $${totalPrice.toFixed(2)}</p>
                    </div>
                    <button class="edit-deck-btn mt-2 text-sm text-gray-500 hover:text-black">Edit</button>`;
                
                deckCard.querySelector('.cursor-pointer').addEventListener('click', () => viewDeck(deck, doc.id));
                deckCard.querySelector('.edit-deck-btn').addEventListener('click', () => editDeck(deck, doc.id));
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
                console.error("Error loading community decks. This likely requires a composite index in Firestore.", error);
                communityDecksList.innerHTML = `<p class="text-red-500">Error loading decks. The necessary database index might be missing. See console for details.</p>`;
            }
        };

        const editDeck = (deck, deckId) => {
            switchTab('tab-builder');
            builderTitle.textContent = "Edit Deck";
            buildDeckBtn.textContent = "Update Deck";
            editingDeckIdInput.value = deckId;

            deckNameInput.value = deck.name;
            deckBioInput.value = deck.bio || '';
            deckTcgSelect.value = deck.tcg;
            
            deckTcgSelect.dispatchEvent(new Event('change'));
            deckFormatSelect.value = deck.format;

            decklistInput.value = deck.cards.map(c => `${c.quantity} ${c.name}`).join('\n');
        };

        const applyFilters = () => {
            const activeTcg = tcgFilterButtons.querySelector('.filter-btn-active').dataset.tcg;
            const activeFormat = formatFilterButtons.querySelector('.filter-btn-active')?.dataset.format || 'all';
            const activeList = document.querySelector('#tab-my-decks.text-blue-600') ? 'my' : 'community';

            if (activeList === 'my') {
                loadMyDecks(activeTcg, activeFormat);
            } else {
                loadCommunityDecks(activeTcg, activeFormat);
            }
        };

        // --- 3. Attach event listeners ---
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if(tab.id === 'tab-deck-view') return; // Don't allow clicking the view tab directly
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
            const user = auth.currentUser;
            if (!user) { alert("Please log in to build a deck."); return; }

            buildDeckBtn.disabled = true;
            buildDeckBtn.textContent = 'Processing...';

            const deckData = {
                name: deckNameInput.value,
                bio: deckBioInput.value,
                tcg: deckTcgSelect.value,
                format: deckFormatSelect.value,
                authorId: user.uid,
                authorName: user.displayName || 'Anonymous',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                cards: []
            };

            const lines = decklistInput.value.split('\n').filter(line => line.trim() !== '');
            const cardPromises = lines.map(line => {
                const match = line.match(/^(\d+)\s+(.*)/);
                if (!match) return null;
                const cardName = match[2].trim().replace(/\s\/\/.*$/, '');
                return fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(cardData => cardData ? { ...cardData, quantity: parseInt(match[1], 10) } : null);
            }).filter(p => p);

            deckData.cards = (await Promise.all(cardPromises)).filter(c => c);

            const editingId = editingDeckIdInput.value;
            try {
                if (editingId) {
                    await db.collection('users').doc(user.uid).collection('decks').doc(editingId).update(deckData);
                    alert("Deck updated successfully!");
                    viewDeck(deckData, editingId);
                } else {
                    const docRef = await db.collection('users').doc(user.uid).collection('decks').add(deckData);
                    alert("Deck saved successfully!");
                    viewDeck(deckData, docRef.id);
                }
            } catch (error) {
                console.error("Error saving deck:", error);
                alert("Could not save deck. See console for details.");
            } finally {
                buildDeckBtn.disabled = false;
                buildDeckBtn.textContent = 'Build & Price Deck';
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
                applyFilters();
            }
        });

        formatFilterButtons.addEventListener('click', (e) => {
            if (e.target.classList.contains('format-filter-btn')) {
                formatFilterButtons.querySelectorAll('.format-filter-btn').forEach(btn => btn.classList.remove('filter-btn-active'));
                e.target.classList.add('filter-btn-active');
                applyFilters();
            }
        });

        shareDeckToFeedBtn.addEventListener('click', async () => {
            if (!deckToShare) {
                alert("No deck is being viewed.");
                return;
            }
            const user = auth.currentUser;
            if (!user) {
                alert("You must be logged in to share.");
                return;
            }
            const postContent = `Check out my deck: [deck:${deckToShare.id}:${deckToShare.name}]!`;
             try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) throw new Error("User profile not found.");
                const userData = userDoc.data();

                await db.collection('posts').add({
                    author: userData.displayName || 'Anonymous',
                    authorId: user.uid,
                    authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                    content: postContent,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    likes: [],
                    comments: []
                });
                alert("Deck shared to your feed!");
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Error sharing deck:", error);
                alert("Could not share deck. See console for details.");
            }
        });

        // --- 4. Initial Load ---
        const urlParams = new URLSearchParams(window.location.search);
        const deckId = urlParams.get('deckId');
        if (deckId) {
            // This is a complex query that might require an index.
            // It searches all 'decks' collections across all users.
            db.collectionGroup('decks').where(firebase.firestore.FieldPath.documentId(), '==', deckId).limit(1).get()
                .then(snapshot => {
                    if (!snapshot.empty) {
                        const doc = snapshot.docs[0];
                        viewDeck(doc.data(), doc.id);
                    } else {
                        alert("Deck not found!");
                    }
                }).catch(err => {
                    console.error("Error fetching deck by ID:", err);
                    alert("Could not load the specified deck.");
                });
        }
    };

    // --- MY_COLLECTION.HTML LOGIC ---
    const setupMyCollectionPage = () => {
        if (!document.getElementById('search-card-form')) return;

        // --- 1. Get all DOM elements ---
        const tabs = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        const searchCardBtn = document.getElementById('search-card-btn');
        const searchResultsSection = document.getElementById('card-search-results-section');
        const searchResultsContainer = document.getElementById('card-search-results');
        const setFilter = document.getElementById('filter-set');
        const typeFilter = document.getElementById('filter-type');
        const csvUploadBtn = document.getElementById('csv-upload-btn');
        const csvUploadInput = document.getElementById('csv-upload-input');
        const editCardModal = document.getElementById('edit-card-modal');
        const editCardForm = document.getElementById('edit-card-form');
        const closeEditModalBtn = document.getElementById('close-edit-card-modal');

        // --- 2. Define all helper functions ---
        const openEditModal = async (cardId, listType) => {
            const user = auth.currentUser;
            if (!user) return;
            const docRef = db.collection('users').doc(user.uid).collection(listType).doc(cardId);
            const docSnap = await docRef.get();
            if (docSnap.exists) {
                const card = docSnap.data();
                document.getElementById('edit-card-id').value = cardId;
                document.getElementById('edit-card-list-type').value = listType;
                document.getElementById('edit-card-quantity').value = card.quantity;
                document.getElementById('edit-card-condition').value = card.condition;
                document.getElementById('edit-card-foil').checked = card.isFoil;
                openModal(editCardModal);
            }
        };

        const deleteCard = async (cardId, listType) => {
            const user = auth.currentUser;
            if (!user) return;
            await db.collection('users').doc(user.uid).collection(listType).doc(cardId).delete();
            loadCardList(listType);
        };

        const loadCardList = async (listType) => {
            const container = document.getElementById(`${listType}-list`);
            const user = auth.currentUser;
            if (!user) {
                container.innerHTML = `<p>Please log in to view your ${listType}.</p>`;
                return;
            }
            container.innerHTML = '<p>Loading...</p>';

            try {
                const snapshot = await db.collection('users').doc(user.uid).collection(listType).orderBy('name').get();
                if (snapshot.empty) {
                    container.innerHTML = `<p>Your ${listType} is empty.</p>`;
                    return;
                }

                container.innerHTML = '';
                snapshot.forEach(doc => {
                    const card = doc.data();
                    const cardEl = document.createElement('div');
                    cardEl.className = 'relative group';
                    cardEl.innerHTML = `
                        <img src="${card.imageUrl || 'https://placehold.co/223x310?text=No+Image'}" alt="${card.name}" class="rounded-lg shadow-md w-full aspect-[5/7] object-cover">
                        <div class="absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg">
                            <button class="edit-card-btn text-white text-xs" data-id="${doc.id}" data-list="${listType}"><i class="fas fa-edit"></i></button>
                            <button class="delete-card-btn text-white text-xs ml-1" data-id="${doc.id}" data-list="${listType}"><i class="fas fa-trash"></i></button>
                        </div>
                        <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent text-white text-xs text-center rounded-b-lg">
                             <p class="font-bold truncate">${card.name}</p>
                             <p>$${card.isFoil ? (card.priceUsdFoil || card.priceUsd) : card.priceUsd} (Qty: ${card.quantity})</p>
                        </div>
                    `;
                    container.appendChild(cardEl);
                });

                container.querySelectorAll('.edit-card-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditModal(e.currentTarget.dataset.id, e.currentTarget.dataset.list);
                }));
                container.querySelectorAll('.delete-card-btn').forEach(btn => btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm("Are you sure you want to delete this card?")) {
                        deleteCard(e.currentTarget.dataset.id, e.currentTarget.dataset.list);
                    }
                }));
            } catch (error) {
                console.error("Error loading card list:", error);
                container.innerHTML = `<p class="text-red-500">Error loading your ${listType}. See console for details.</p>`;
            }
        };

        const handleCsvUpload = () => {
            const user = auth.currentUser;
            if (!user) { alert("Please log in to upload a CSV."); return; }
            if (csvUploadInput.files.length === 0) { alert("Please select a CSV file."); return; }

            Papa.parse(csvUploadInput.files[0], {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    if (results.errors.length > 0) {
                        console.error("CSV parsing errors:", results.errors);
                        alert("There were errors parsing your CSV file. Please check the file format and console for details.");
                        return;
                    }

                    const statusEl = document.getElementById('csv-status');
                    statusEl.textContent = `Processing ${results.data.length} cards...`;
                    const batch = db.batch();
                    const collectionRef = db.collection('users').doc(user.uid).collection('collection');

                    for (const row of results.data) {
                        const cardName = row['Card Name'];
                        if (cardName) {
                            const docRef = collectionRef.doc();
                            batch.set(docRef, {
                                name: cardName,
                                quantity: parseInt(row.Count, 10) || 1,
                                set: row.Set,
                                setName: row['Set Name'] || '',
                                isFoil: (row.Foil && row.Foil.toLowerCase() === 'foil'),
                                condition: row.Condition || 'Near Mint',
                                imageUrl: 'https://placehold.co/223x310?text=Loading...',
                                addedAt: new Date(),
                                tcg: "Magic: The Gathering"
                            });
                        }
                    }

                    try {
                        await batch.commit();
                        statusEl.textContent = `Import complete! Refreshing collection...`;
                        loadCardList('collection');
                    } catch (error) {
                        console.error("CSV Upload Error (Firestore batch commit): ", error);
                        statusEl.textContent = "Error uploading. Check console for details.";
                    }
                },
                error: (err) => {
                    console.error("PapaParse Error:", err);
                    alert("A critical error occurred while parsing the CSV. Check the console for details.");
                }
            });
        };

        const addCardToDb = async (cardData) => {
           const user = auth.currentUser;
           if (!user) { alert("Please log in."); return; }
           const listType = document.querySelector('input[name="add-to-list"]:checked').value;
          
           const cardDoc = {
               name: cardData.name,
               tcg: "Magic: The Gathering",
               scryfallId: cardData.id,
               set: cardData.set,
               setName: cardData.set_name,
               imageUrl: cardData.image_uris?.normal || '',
               priceUsd: cardData.prices?.usd || '0.00',
               priceUsdFoil: cardData.prices?.usd_foil || '0.00',
               quantity: 1, isFoil: false, condition: 'Near Mint',
               addedAt: new Date()
           };
          
           try {
               await db.collection('users').doc(user.uid).collection(listType).add(cardDoc);
               alert(`${cardData.name} (${cardData.set_name}) added to your ${listType}!`);
               loadCardList(listType);
           } catch(error) {
               console.error("Error adding card: ", error);
               alert("Could not add card. See console for details.");
           }
       };

        const renderSearchResults = () => {
           const set = setFilter.value;
           const type = typeFilter.value;
           let filteredResults = cardSearchResults;

           if (set) filteredResults = filteredResults.filter(card => card.set === set);
           if (type) filteredResults = filteredResults.filter(card => card.type_line && card.type_line.includes(type));

           searchResultsContainer.innerHTML = '';
           if (filteredResults.length === 0) {
               searchResultsContainer.innerHTML = '<p>No results match your filters.</p>';
               return;
           }

           const uniqueSets = [...new Set(cardSearchResults.map(card => card.set_name))].sort();
           setFilter.innerHTML = '<option value="">All Sets</option>';
           uniqueSets.forEach(setName => setFilter.innerHTML += `<option value="${cardSearchResults.find(c=>c.set_name === setName).set}">${setName}</option>`);
          
           const uniqueTypes = [...new Set(cardSearchResults.map(card => card.type_line ? card.type_line.split('—')[0].trim() : 'Unknown'))].sort();
           typeFilter.innerHTML = '<option value="">All Types</option>';
           uniqueTypes.forEach(typeName => typeFilter.innerHTML += `<option value="${typeName}">${typeName}</option>`);

           filteredResults.forEach(card => {
               const cardEl = document.createElement('div');
               cardEl.className = 'cursor-pointer';
               cardEl.innerHTML = `<img src="${card.image_uris?.normal || ''}" class="rounded-lg shadow-md w-full">`;
               cardEl.addEventListener('click', () => addCardToDb(card));
               searchResultsContainer.appendChild(cardEl);
           });
       };

        // --- 3. Attach event listeners ---
        csvUploadBtn.addEventListener('click', handleCsvUpload);
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.id;
                tabs.forEach(item => {
                    item.classList.toggle('text-blue-600', item.id === tabId);
                    item.classList.toggle('border-blue-600', item.id === tabId);
                    item.classList.toggle('text-gray-500', item.id !== tabId);
                    item.classList.toggle('hover:border-gray-300', item.id !== tabId);
                });
                tabContents.forEach(content => {
                    content.classList.toggle('hidden', content.id !== `content-${tabId.split('-')[1]}`);
                });
                if (tab.id === 'tab-collection') loadCardList('collection');
                if (tab.id === 'tab-wishlist') loadCardList('wishlist');
            });
        });

        editCardForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            const cardId = document.getElementById('edit-card-id').value;
            const listType = document.getElementById('edit-card-list-type').value;
            const updatedData = {
                quantity: parseInt(document.getElementById('edit-card-quantity').value, 10),
                condition: document.getElementById('edit-card-condition').value,
                isFoil: document.getElementById('edit-card-foil').checked
            };
            await db.collection('users').doc(user.uid).collection(listType).doc(cardId).update(updatedData);
            closeModal(editCardModal);
            loadCardList(listType);
        });
        
        closeEditModalBtn.addEventListener('click', () => closeModal(editCardModal));

        searchCardBtn.addEventListener('click', async () => {
           const cardName = document.getElementById('search-card-name').value;
           if (!cardName) return;
           searchResultsSection.classList.remove('hidden');
           searchResultsContainer.innerHTML = '<p>Searching...</p>';
           try {
               const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(cardName)}&unique=prints`);
               if (!response.ok) throw new Error("Card not found.");
               const data = await response.json();
               cardSearchResults = data.data;
               renderSearchResults();
           } catch (error) {
               searchResultsContainer.innerHTML = `<p class="text-red-500">${error.message}</p>`;
           }
       });
       setFilter.addEventListener('change', renderSearchResults);
       typeFilter.addEventListener('change', renderSearchResults);

        // --- 4. Initial Load ---
        auth.onAuthStateChanged(user => {
            if (user) {
                loadCardList('collection');
            } else {
                document.getElementById('collection-list').innerHTML = '<p>Please log in to view your collection.</p>';
                document.getElementById('wishlist-list').innerHTML = '<p>Please log in to view your wishlist.</p>';
            }
        });
    };
    
    // --- PROFILE.HTML LOGIC ---
    const setupProfilePage = () => {
        if (!document.getElementById('profile-displayName')) return;

        const displayNameEl = document.getElementById('profile-displayName');
        const handleEl = document.getElementById('profile-handle');
        const bioEl = document.getElementById('profile-bio');
        const avatarEl = document.getElementById('profile-avatar');
        const bannerEl = document.getElementById('profile-banner');
        const editProfileBtn = document.getElementById('edit-profile-btn');
        const editProfileModal = document.getElementById('edit-profile-modal');
        const closeEditModalBtn = document.getElementById('close-edit-modal');
        const editProfileForm = document.getElementById('edit-profile-form');
        
        const loadProfile = async (userId) => {
            try {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    displayNameEl.textContent = userData.displayName || 'N/A';
                    handleEl.textContent = `@${userData.handle || 'N/A'}`;
                    bioEl.textContent = userData.bio || 'No bio yet.';
                    avatarEl.src = userData.photoURL || 'https://placehold.co/128x128?text=Avatar';
                    bannerEl.src = userData.bannerURL || 'https://placehold.co/1200x300/cccccc/969696?text=Banner';

                    // Populate modal with existing data
                    document.getElementById('edit-displayName').value = userData.displayName;
                    document.getElementById('edit-bio').value = userData.bio;

                } else {
                    alert("User profile not found.");
                }
            } catch (error) {
                console.error("Error loading profile:", error);
                alert("Could not load profile.");
            }
        };

        auth.onAuthStateChanged(user => {
            if (user) {
                loadProfile(user.uid);
                editProfileBtn.classList.remove('hidden');
            } else {
                editProfileBtn.classList.add('hidden');
                alert("Please log in to view your profile.");
            }
        });

        editProfileBtn.addEventListener('click', () => openModal(editProfileModal));
        closeEditModalBtn.addEventListener('click', () => closeModal(editProfileModal));

        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;
            if (!user) return;

            const newDisplayName = document.getElementById('edit-displayName').value;
            const newBio = document.getElementById('edit-bio').value;

            try {
                await db.collection('users').doc(user.uid).update({
                    displayName: newDisplayName,
                    bio: newBio
                });
                // Also update the auth profile if the name changed
                if(user.displayName !== newDisplayName){
                    await user.updateProfile({ displayName: newDisplayName });
                }
                closeModal(editProfileModal);
                loadProfile(user.uid); // Reload profile to show changes
                alert("Profile updated successfully!");
            } catch (error) {
                console.error("Error updating profile:", error);
                alert("Could not update profile.");
            }
        });
    };

    // --- Page Initialization ---
    // This will call the correct setup function based on the current page.
    setupCoreUI();
    setupIndexPage();
    setupDeckPage();
    setupMyCollectionPage();
    setupProfilePage();
});
