document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
    // This configuration is using the details you provided.
    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.appspot.com",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:e0d3c35c3c0a2c3c3c0a2c" // Example App ID
    };

    // --- Firebase Initialization ---
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Helper Functions ---
    const openModal = (modal) => { if (modal) modal.classList.add('open'); };
    const closeModal = (modal) => { if (modal) modal.classList.remove('open'); };

    // --- Core Authentication & UI Management ---
    // This section runs on every page to manage the user's login state.
    const setupCoreUI = () => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const logoutButton = document.getElementById('logoutButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');

        // Modals
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        const closeLoginModal = document.getElementById('closeLoginModal');
        const closeRegisterModal = document.getElementById('closeRegisterModal');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        // Auth State Listener: This is the most important part for UI updates.
        auth.onAuthStateChanged(async (user) => {
            const sidebarUserInfo = document.getElementById('sidebar-user-info');
            const createPostSection = document.getElementById('create-post-section');

            if (user) {
                // User is logged in
                if (loginButton) loginButton.classList.add('hidden');
                if (registerButton) registerButton.classList.add('hidden');
                if (userAvatar) userAvatar.classList.remove('hidden');

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
                if (createPostSection) createPostSection.classList.remove('hidden');

            } else {
                // User is logged out
                if (loginButton) loginButton.classList.remove('hidden');
                if (registerButton) registerButton.classList.remove('hidden');
                if (userAvatar) userAvatar.classList.add('hidden');
                if (userDropdown) userDropdown.classList.add('hidden');
                if (sidebarUserInfo) sidebarUserInfo.classList.add('hidden');
                if (createPostSection) createPostSection.classList.add('hidden');
            }
        });

        // Event Listeners for auth actions
        if (loginButton) loginButton.addEventListener('click', () => openModal(loginModal));
        if (registerButton) registerButton.addEventListener('click', () => openModal(registerModal));
        if (closeLoginModal) closeLoginModal.addEventListener('click', () => closeModal(loginModal));
        if (closeRegisterModal) closeRegisterModal.addEventListener('click', () => closeModal(registerModal));

        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                auth.signInWithEmailAndPassword(email, password)
                    .then(() => closeModal(loginModal))
                    .catch(err => alert(err.message));
            });
        }

        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('registerEmail').value;
                const password = document.getElementById('registerPassword').value;
                const city = document.getElementById('registerCity')?.value || '';
                const country = document.getElementById('registerCountry')?.value || '';
                const favoriteTcg = document.getElementById('registerFavoriteTcg')?.value || '';

                auth.createUserWithEmailAndPassword(email, password)
                    .then(cred => {
                        const defaultPhotoURL = `https://ui-avatars.com/api/?name=${email.charAt(0)}&background=random&color=fff`;
                        cred.user.updateProfile({ displayName: email.split('@')[0], photoURL: defaultPhotoURL });
                        return db.collection('users').doc(cred.user.uid).set({
                            displayName: email.split('@')[0],
                            email: email,
                            photoURL: defaultPhotoURL,
                            city,
                            country,
                            favoriteTcg,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    })
                    .then(() => closeModal(registerModal))
                    .catch(err => alert(err.message));
            });
        }
        
        const googleLoginButton = document.getElementById('googleLoginButton');
        if (googleLoginButton) {
            googleLoginButton.addEventListener('click', () => {
                 auth.signInWithPopup(googleProvider)
                .then(result => {
                    const user = result.user;
                    // Check if user is new to create a profile
                    if (result.additionalUserInfo.isNewUser) {
                        db.collection('users').doc(user.uid).set({
                            displayName: user.displayName,
                            email: user.email,
                            photoURL: user.photoURL,
                            city: '', country: '', favoriteTcg: '',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                    }
                    closeModal(loginModal);
                })
                .catch(error => alert(error.message));
            });
        }


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

    // --- INDEX.HTML: Feed, Posts, Comments ---
    const setupFeedPage = () => {
        const postsContainer = document.getElementById('postsContainer');
        if (!postsContainer) return;

        const postContentInput = document.getElementById('postContent');
        const submitPostBtn = document.getElementById('submitPostBtn');
        const postStatusMessage = document.getElementById('postStatusMessage');
        const postImageUpload = document.getElementById('postImageUpload');
        let selectedFile = null;

        const renderComments = (commentsListEl, comments) => {
            commentsListEl.innerHTML = '';
            if (!comments || comments.length === 0) {
                commentsListEl.innerHTML = '<p class="text-gray-500 text-sm">No comments yet.</p>';
                return;
            }
            comments.sort((a, b) => a.timestamp - b.timestamp).forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.classList.add('pt-2', 'border-t', 'mt-2');
                commentEl.innerHTML = `<p><strong>${comment.author || 'Anonymous'}:</strong> ${comment.content}</p>`;
                commentsListEl.appendChild(commentEl);
            });
        };

        const renderPosts = async () => {
            const postsSnapshot = await db.collection('posts').orderBy('timestamp', 'desc').get();
            postsContainer.innerHTML = '';
            postsSnapshot.forEach(doc => {
                const post = doc.data();
                const postElement = document.createElement('div');
                postElement.classList.add('bg-white', 'p-4', 'rounded-lg', 'shadow-md', 'post-container');
                postElement.dataset.id = doc.id;

                const cardRegex = /\[(.*?)\]/g;
                const content = post.content ? post.content.replace(cardRegex, (match, cardName) => {
                    return `<a href="#" class="text-blue-500 card-link" data-card-name="${cardName}">${cardName}</a>`;
                }) : '';

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
                        <form class="comment-form flex mt-4">
                            <input type="text" class="w-full border rounded-l-lg p-2" placeholder="Write a comment...">
                            <button type="submit" class="bg-blue-500 text-white px-4 rounded-r-lg">Post</button>
                        </form>
                    </div>
                `;
                postsContainer.appendChild(postElement);
            });
        };

        renderPosts();

        if (submitPostBtn) {
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
                }
            });
        }

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
                    const commentsListEl = commentsSection.querySelector('.comments-list');
                    renderComments(commentsListEl, postDoc.data().comments);
                }
            }

            if (e.target.closest('.like-btn')) {
                db.runTransaction(async transaction => {
                    const postDoc = await transaction.get(postRef);
                    if (!postDoc.exists) throw "Post not found!";
                    const likes = postDoc.data().likes || [];
                    const userLikeIndex = likes.indexOf(user.uid);
                    if (userLikeIndex === -1) {
                        likes.push(user.uid);
                    } else {
                        likes.splice(userLikeIndex, 1);
                    }
                    transaction.update(postRef, { likes });
                    return likes;
                }).then(likes => {
                    postElement.querySelector('.likes-count').textContent = likes.length;
                });
            }
        });

        postsContainer.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (e.target.classList.contains('comment-form')) {
                const user = auth.currentUser;
                const input = e.target.querySelector('input');
                const content = input.value.trim();
                if (!content || !user) return;

                const postElement = e.target.closest('.post-container');
                const postId = postElement.dataset.id;
                const postRef = db.collection('posts').doc(postId);
                const commentsListEl = postElement.querySelector('.comments-list');

                const newComment = {
                    author: user.displayName || 'Anonymous',
                    authorId: user.uid,
                    content: content,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };
                await postRef.update({ comments: firebase.firestore.FieldValue.arrayUnion(newComment) });
                input.value = '';
                const postDoc = await postRef.get();
                renderComments(commentsListEl, postDoc.data().comments);
                postElement.querySelector('.comments-count').textContent = postDoc.data().comments.length;
            }
        });

        document.getElementById('uploadImageBtn')?.addEventListener('click', () => postImageUpload.click());
        document.getElementById('uploadVideoBtn')?.addEventListener('click', () => postImageUpload.click());
        if(postImageUpload) postImageUpload.addEventListener('change', e => selectedFile = e.target.files[0]);
    };

    // --- DECK.HTML: Deck Builder ---
    const setupDeckBuilderPage = () => {
        const deckBuilderForm = document.getElementById('deck-builder-form');
        if (!deckBuilderForm) return;

        deckBuilderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const decklistInput = document.getElementById('decklist-input');
            const statusEl = document.getElementById('deck-builder-status');
            const cardsDisplayEl = document.getElementById('deck-cards-display');
            const deckStatsEl = document.getElementById('deck-stats');

            statusEl.textContent = 'Building deck... This may take a moment.';
            deckStatsEl.classList.remove('hidden');
            cardsDisplayEl.innerHTML = '';
            
            const lines = decklistInput.value.split('\n').filter(line => line.trim() !== '');
            const cardPromises = lines.map(line => {
                const match = line.match(/^(\d+)\s+(.*)/);
                if (!match) return null;
                const quantity = parseInt(match[1], 10);
                const cardName = match[2].trim();
                return fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`)
                    .then(res => res.ok ? res.json() : Promise.reject(`Card not found: ${cardName}`))
                    .then(cardData => ({ ...cardData, quantity }))
                    .catch(err => {
                        console.warn(err);
                        return null;
                    });
            }).filter(p => p);

            try {
                const cardResults = await Promise.all(cardPromises);
                const categorizedCards = {};
                let totalCards = 0;
                let totalPrice = 0;

                cardResults.forEach(card => {
                    if (card) {
                        const type = card.type_line.split('—')[0].trim();
                        if (!categorizedCards[type]) categorizedCards[type] = [];
                        categorizedCards[type].push(card);
                        totalCards += card.quantity;
                        const price = parseFloat(card.prices.usd || 0);
                        totalPrice += price * card.quantity;
                    }
                });

                Object.keys(categorizedCards).sort().forEach(category => {
                    const categoryEl = document.createElement('div');
                    categoryEl.innerHTML = `<h3 class="text-xl font-bold border-b-2 border-gray-300 pb-2 mb-4">${category} (${categorizedCards[category].reduce((acc, c) => acc + c.quantity, 0)})</h3>`;
                    const gridEl = document.createElement('div');
                    gridEl.classList.add('grid', 'grid-cols-2', 'sm:grid-cols-3', 'md:grid-cols-4', 'lg:grid-cols-6', 'gap-4');
                    categorizedCards[category].forEach(card => {
                        const cardEl = document.createElement('div');
                        cardEl.innerHTML = `
                            <img src="${card.image_uris?.normal || ''}" alt="${card.name}" class="rounded-lg shadow-md transition-transform hover:scale-105">
                            <p class="text-center font-semibold mt-1">${card.quantity}x ${card.name}</p>
                            <p class="text-center text-sm text-gray-600">$${card.prices.usd || 'N/A'}</p>
                        `;
                        gridEl.appendChild(cardEl);
                    });
                    categoryEl.appendChild(gridEl);
                    cardsDisplayEl.appendChild(categoryEl);
                });

                document.getElementById('total-cards-count').textContent = totalCards;
                document.getElementById('total-deck-price').textContent = `$${totalPrice.toFixed(2)}`;
                statusEl.textContent = 'Deck built successfully!';
            } catch (error) {
                statusEl.textContent = 'An error occurred while building the deck.';
                console.error(error);
            }
        });
    };

    // --- Initialize Page-Specific Logic ---
    // This runs the correct setup function based on which page is currently loaded.
    setupCoreUI();
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        setupFeedPage();
    } else if (window.location.pathname.includes('deck.html')) {
        setupDeckBuilderPage();
    }
});
