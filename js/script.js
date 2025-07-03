document.addEventListener('DOMContentLoaded', () => {
    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.appspot.com",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:YOUR_WEB_APP_ID" // You might need to replace 'YOUR_WEB_APP_ID' with your actual web app ID from Firebase project settings.
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // --- Global Elements ---
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const logoutButton = document.getElementById('logoutButton');
    const userAvatar = document.getElementById('userAvatar');
    const userDropdown = document.getElementById('userDropdown');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const shareModal = document.getElementById('shareModal');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const closeRegisterModal = document.getElementById('closeRegisterModal');
    const closeShareModal = document.getElementById('closeShareModal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    const registerCity = document.getElementById('registerCity');
    const registerCountry = document.getElementById('registerCountry');
    const registerFavoriteTcg = document.getElementById('registerFavoriteTcg');
    const loginMessage = document.getElementById('loginMessage');
    const registerMessage = document.getElementById('registerMessage');
    const googleLoginButton = document.getElementById('googleLoginButton');
    const googleRegisterButton = document.getElementById('googleRegisterButton');
    const postsContainer = document.getElementById('postsContainer');
    const postContentInput = document.getElementById('postContent');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const uploadVideoBtn = document.getElementById('uploadVideoBtn');
    const postImageUpload = document.getElementById('postImageUpload');
    const submitPostBtn = document.getElementById('submitPostBtn');
    const postStatusMessage = document.getElementById('postStatusMessage');
    const searchBar = document.getElementById('searchBar');

    // Sidebar Elements
    const sidebarUserInfo = document.getElementById('sidebar-user-info');
    const sidebarUserAvatar = document.getElementById('sidebar-user-avatar');
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserHandle = document.getElementById('sidebar-user-handle');

    let selectedFile = null;

    // --- Modal Functions ---
    const openModal = (modal) => modal.classList.add('open');
    const closeModal = (modal) => modal.classList.remove('open');

    // --- Event Listeners ---
    if (loginButton) loginButton.addEventListener('click', () => openModal(loginModal));
    if (registerButton) registerButton.addEventListener('click', () => openModal(registerModal));
    if (closeLoginModal) closeLoginModal.addEventListener('click', () => closeModal(loginModal));
    if (closeRegisterModal) closeRegisterModal.addEventListener('click', () => closeModal(registerModal));
    if (closeShareModal) closeShareModal.addEventListener('click', () => closeModal(shareModal));

    // **FIX**: Added event listener for header avatar dropdown
    if (userAvatar) userAvatar.addEventListener('click', () => {
        userDropdown.classList.toggle('hidden');
    });

    // --- Firebase Auth ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            loginButton.classList.add('hidden');
            registerButton.classList.add('hidden');
            userAvatar.classList.remove('hidden');
            userAvatar.src = user.photoURL || 'https://i.imgur.com/B06rBhI.png'; // Use photoURL from auth object for immediate UI update

            // **FIX**: Added logic to update the sidebar with user info
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (sidebarUserInfo) sidebarUserInfo.classList.remove('hidden');
                if (sidebarUserAvatar) sidebarUserAvatar.src = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';
                if (sidebarUserName) sidebarUserName.textContent = userData.displayName || 'User';
                if (sidebarUserHandle) sidebarUserHandle.textContent = `@${(userData.displayName || 'user').toLowerCase().replace(/\s/g, '')}`;

                // Update header avatar with DB value in case it's different
                userAvatar.src = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';
            }

        } else {
            loginButton.classList.remove('hidden');
            registerButton.classList.remove('hidden');
            userAvatar.classList.add('hidden');
            userDropdown.classList.add('hidden'); // Hide dropdown on logout
            if (sidebarUserInfo) sidebarUserInfo.classList.add('hidden'); // Hide sidebar info on logout
        }
    });

    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', () => {
            auth.signInWithPopup(googleProvider)
                .then(result => {
                    const user = result.user;
                    db.collection('users').doc(user.uid).set({
                        displayName: user.displayName,
                        email: user.email,
                        photoURL: user.photoURL,
                        city: '',
                        country: '',
                        favoriteTcg: ''
                    }, { merge: true });
                    closeModal(loginModal);
                })
                .catch(error => loginMessage.textContent = error.message);
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = registerEmail.value;
            const password = registerPassword.value;
            const city = registerCity.value;
            const country = registerCountry.value;
            const favoriteTcg = registerFavoriteTcg.value;
            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    // Assign a default avatar for email/password sign-ups
                    const defaultPhotoURL = `https://ui-avatars.com/api/?name=${email.charAt(0)}&background=random&color=fff`;
                    // Update the auth profile itself
                    cred.user.updateProfile({
                        displayName: email.split('@')[0],
                        photoURL: defaultPhotoURL
                    });
                    // Store details in Firestore
                    return db.collection('users').doc(cred.user.uid).set({
                        displayName: email.split('@')[0],
                        email: email,
                        city: city,
                        country: country,
                        favoriteTcg: favoriteTcg,
                        photoURL: defaultPhotoURL
                    });
                })
                .then(() => closeModal(registerModal))
                .catch(error => registerMessage.textContent = error.message);
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = loginEmail.value;
            const password = loginPassword.value;
            auth.signInWithEmailAndPassword(email, password)
                .then(() => closeModal(loginModal))
                .catch(error => loginMessage.textContent = error.message);
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut();
            userDropdown.classList.add('hidden');
        });
    }

    // --- Firestore & Posts ---
    const renderPosts = async () => {
        const postsSnapshot = await db.collection('posts').orderBy('timestamp', 'desc').get();
        postsContainer.innerHTML = '';
        postsSnapshot.forEach(doc => {
            const post = doc.data();
            const postElement = document.createElement('div');
            postElement.classList.add('bg-white', 'p-4', 'rounded-lg', 'shadow-md');

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
                <div class="flex justify-between items-center mt-4">
                    <div>
                        <button class="like-btn" data-id="${doc.id}"><i class="far fa-heart"></i> <span class="likes-count">${post.likes?.length || 0}</span></button>
                        <button class="comment-btn" data-id="${doc.id}"><i class="far fa-comment"></i> <span class="comments-count">${post.comments?.length || 0}</span></button>
                        <button class="share-btn" data-id="${doc.id}"><i class="far fa-share-square"></i></button>
                    </div>
                </div>
                <div class="comments-section hidden mt-4">
                    <form class="comment-form flex">
                        <input type="text" class="w-full border rounded-l-lg p-2" placeholder="Write a comment...">
                        <button type="submit" class="bg-blue-500 text-white px-4 rounded-r-lg">Post</button>
                    </form>
                    <div class="comments-list mt-4"></div>
                </div>
            `;
            postsContainer.appendChild(postElement);
        });
    };

    if(postsContainer) renderPosts();

    if (submitPostBtn) {
        submitPostBtn.addEventListener('click', async () => {
            const content = postContentInput.value;
            const user = auth.currentUser;
            if (!user) {
                postStatusMessage.textContent = 'You must be logged in to post.';
                return;
            }

            postStatusMessage.textContent = 'Posting...';

            // Fetch user data from Firestore to get the correct display name and avatar
            const userDocRef = db.collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();
            const userData = userDoc.exists ? userDoc.data() : { displayName: 'Anonymous', photoURL: 'https://i.imgur.com/B06rBhI.png' };


            let mediaUrl = null;
            let mediaType = null;
            if (selectedFile) {
                const filePath = `posts/${user.uid}/${Date.now()}_${selectedFile.name}`;
                const fileRef = storage.ref(filePath);
                await fileRef.put(selectedFile);
                mediaUrl = await fileRef.getDownloadURL();
                mediaType = selectedFile.type;
            }

            await db.collection('posts').add({
                // Use the reliable data from the Firestore document
                author: userData.displayName,
                authorId: user.uid,
                authorPhotoURL: userData.photoURL,
                content: content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                likes: [],
                comments: [],
                mediaUrl: mediaUrl,
                mediaType: mediaType
            });

            postContentInput.value = '';
            selectedFile = null;
            postStatusMessage.textContent = 'Posted!';
            setTimeout(() => postStatusMessage.textContent = '', 2000);
            renderPosts();
        });
    }

    if (uploadImageBtn) uploadImageBtn.addEventListener('click', () => postImageUpload.click());
    if (uploadVideoBtn) uploadVideoBtn.addEventListener('click', () => postImageUpload.click());
    if (postImageUpload) postImageUpload.addEventListener('change', e => selectedFile = e.target.files[0]);

    // --- Post Interactions ---
    if (postsContainer) {
        postsContainer.addEventListener('click', async e => {
            const target = e.target;
            const postElement = target.closest('.bg-white');
            if(!postElement) return;

            const postId = postElement.querySelector('.like-btn')?.dataset.id;
            if (!postId) return;

            const postRef = db.collection('posts').doc(postId);
            const user = auth.currentUser;
            if (!user) {
                alert('Please login to interact with posts.');
                return;
            }

            if (target.closest('.like-btn')) {
                db.runTransaction(async transaction => {
                    const postDoc = await transaction.get(postRef);
                    if (!postDoc.exists) throw "Document does not exist!";

                    const likes = postDoc.data().likes || [];
                    const userLikeIndex = likes.indexOf(user.uid);

                    if (userLikeIndex === -1) {
                        likes.push(user.uid);
                    } else {
                        likes.splice(userLikeIndex, 1);
                    }
                    transaction.update(postRef, { likes: likes });
                    return likes;
                }).then(likes => {
                    const likesCount = postElement.querySelector('.likes-count');
                    likesCount.textContent = likes.length;
                });
            }

            if (target.closest('.comment-btn')) {
                const commentsSection = postElement.querySelector('.comments-section');
                commentsSection.classList.toggle('hidden');
            }

            if (target.closest('.share-btn')) {
                openModal(shareModal);
            }
        });

        postsContainer.addEventListener('submit', async e => {
            e.preventDefault();
            const target = e.target;
            if (target.classList.contains('comment-form')) {
                const postElement = target.closest('.bg-white');
                const postId = postElement.querySelector('.like-btn').dataset.id;
                const input = target.querySelector('input');
                const content = input.value;
                const user = auth.currentUser;

                if (content && user) {
                    const postRef = db.collection('posts').doc(postId);
                    const comment = {
                        author: user.displayName,
                        authorId: user.uid,
                        content: content,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await postRef.update({
                        comments: firebase.firestore.FieldValue.arrayUnion(comment)
                    });
                    input.value = '';
                }
            }
        });

        // --- Scryfall API ---
        postsContainer.addEventListener('mouseover', async e => {
            if (e.target.classList.contains('card-link')) {
                const cardName = e.target.dataset.cardName;
                if (e.target.querySelector('.card-tooltip')) return;
                try {
                    const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
                    if (!response.ok) return;
                    const card = await response.json();
                    if (card.image_uris) {
                        const tooltip = document.createElement('div');
                        tooltip.classList.add('card-tooltip');
                        tooltip.innerHTML = `<img src="${card.image_uris.normal}" alt="${card.name}">`;
                        e.target.appendChild(tooltip);
                    }
                } catch (error) {
                    console.error("Error fetching card data:", error);
                }
            }
        });

        postsContainer.addEventListener('mouseout', e => {
            if (e.target.classList.contains('card-link')) {
                const tooltip = e.target.querySelector('.card-tooltip');
                if (tooltip) tooltip.remove();
            }
        });
    }

    // --- Search ---
    if (searchBar) {
        searchBar.addEventListener('keyup', async e => {
            if (e.key === 'Enter') {
                const query = searchBar.value.toLowerCase();
                const usersRef = db.collection('users');
                const usersSnapshot = await usersRef.where('displayName', '>=', query).where('displayName', '<=', query + '\uf8ff').get();
            }
        });
    }
});
