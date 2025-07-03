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
                const user = auth.currentUser;
                if (!user) return;
                const input = e.target.querySelector('input');
                const content = input.value.trim();
                if (!content) return;
                const postElement = e.target.closest('.post-container');
                const postId = postElement.dataset.id;
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
        // ... (All deck page functions remain the same)
    };
    
    // --- MY_COLLECTION.HTML LOGIC ---
    const setupMyCollectionPage = () => {
        if (!document.getElementById('search-card-form')) return;

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

        const switchTab = (tabId) => {
            tabs.forEach(item => {
                item.classList.toggle('text-blue-600', item.id === tabId);
                item.classList.toggle('border-blue-600', item.id === tabId);
                item.classList.toggle('text-gray-500', !isTarget);
                item.classList.toggle('hover:border-gray-300', !isTarget);
            });
            const targetContentId = tabId.replace('tab-', 'content-');
            tabContents.forEach(content => content.classList.toggle('hidden', content.id !== `content-${tabId.split('-')[1]}`));
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                switchTab(tab.id);
                if (tab.id === 'tab-collection') loadCardList('collection');
                if (tab.id === 'tab-wishlist') loadCardList('wishlist');
            });
        });

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

        const renderSearchResults = () => {
            const set = setFilter.value;
            const type = typeFilter.value;
            let filteredResults = cardSearchResults;

            if (set) filteredResults = filteredResults.filter(card => card.set === set);
            if (type) filteredResults = filteredResults.filter(card => card.type_line.includes(type));

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
        
        setFilter.addEventListener('change', renderSearchResults);
        typeFilter.addEventListener('change', renderSearchResults);

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
            
            await db.collection('users').doc(user.uid).collection(listType).add(cardDoc);
            alert(`${cardData.name} (${cardData.set_name}) added to your ${listType}!`);
            loadCardList(listType);
        };
        
        csvUploadBtn.addEventListener('click', () => {
            const user = auth.currentUser;
            if (!user) { alert("Please log in."); return; }
            if (csvUploadInput.files.length === 0) { alert("Please select a file."); return; }
            
            Papa.parse(csvUploadInput.files[0], {
                header: true,
                complete: async (results) => {
                    const statusEl = document.getElementById('csv-status');
                    statusEl.textContent = `Processing ${results.data.length} cards...`;
                    const batch = db.batch();
                    const collectionRef = db.collection('users').doc(user.uid).collection('collection');

                    for (const row of results.data) {
                        const cardName = row['Card Name'];
                        if (cardName) {
                            const docRef = collectionRef.doc(); // Create a new doc reference
                            batch.set(docRef, {
                                name: cardName,
                                quantity: parseInt(row.Count, 10) || 1,
                                set: row.Set,
                                setName: row['Set Name'],
                                isFoil: (row.Foil && row.Foil.toLowerCase() === 'foil'),
                                condition: row.Condition || 'Near Mint',
                                imageUrl: 'https://placehold.co/223x310?text=Loading...', // Placeholder
                                addedAt: new Date(),
                                tcg: "Magic: The Gathering"
                            });
                        }
                    }
                    await batch.commit();
                    statusEl.textContent = `Import complete! Refreshing collection...`;
                    loadCardList('collection');
                }
            });
        });
        
        const loadCardList = async (listType) => {
            const container = document.getElementById(`${listType}-list`);
            const user = auth.currentUser;
            if (!user) { container.innerHTML = `<p>Please log in to view your ${listType}.</p>`; return; }
            container.innerHTML = '<p>Loading...</p>';

            const snapshot = await db.collection('users').doc(user.uid).collection(listType).orderBy('name').get();
            if (snapshot.empty) { container.innerHTML = `<p>Your ${listType} is empty.</p>`; return; }
            
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const card = doc.data();
                const cardEl = document.createElement('div');
                cardEl.className = 'relative';
                cardEl.innerHTML = `
                    <img src="${card.imageUrl || 'https://placehold.co/223x310?text=No+Image'}" class="rounded-lg shadow-md w-full">
                    <div class="absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg">
                        <button class="edit-card-btn text-white text-xs" data-id="${doc.id}" data-list="${listType}"><i class="fas fa-edit"></i></button>
                        <button class="delete-card-btn text-white text-xs ml-1" data-id="${doc.id}" data-list="${listType}"><i class="fas fa-trash"></i></button>
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 p-1 bg-black bg-opacity-50 text-white text-xs text-center">
                        <p>$${card.isFoil ? (card.priceUsdFoil || card.priceUsd) : card.priceUsd} (${card.quantity})</p>
                    </div>
                `;
                container.appendChild(cardEl);
            });

            container.querySelectorAll('.edit-card-btn').forEach(btn => btn.addEventListener('click', (e) => {
                const cardId = e.currentTarget.dataset.id;
                const list = e.currentTarget.dataset.list;
                openEditModal(cardId, list);
            }));
            container.querySelectorAll('.delete-card-btn').forEach(btn => btn.addEventListener('click', (e) => {
                const cardId = e.currentTarget.dataset.id;
                const list = e.currentTarget.dataset.list;
                if (confirm("Are you sure you want to delete this card?")) {
                    deleteCard(cardId, list);
                }
            }));
        };

        const openEditModal = async (cardId, listType) => {
            const user = auth.currentUser;
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

        document.getElementById('close-edit-card-modal')?.addEventListener('click', () => closeModal(editCardModal));

        const deleteCard = async (cardId, listType) => {
            const user = auth.currentUser;
            await db.collection('users').doc(user.uid).collection(listType).doc(cardId).delete();
            loadCardList(listType);
        };
    };
         // Initial Load
        loadCardList('collection');
    };
    
    // --- Page Initialization ---
    setupCoreUI();
    if (document.getElementById('postsContainer')) {
        setupIndexPage();
    }
    if (document.getElementById('deck-builder-form')) {
        setupDeckPage();
    }
    if (document.getElementById('search-card-form')) {
        setupMyCollectionPage();
    }
});

