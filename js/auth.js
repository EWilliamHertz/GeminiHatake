/**
 * HatakeSocial - Core Authentication & UI Script (v6 - Path Fix)
 *
 * This script is included on EVERY page. It handles:
 * 1. Firebase Initialization.
 * 2. All Login/Register Modal and Form logic.
 * 3. The main auth state listener that updates the header UI.
 * 4. Firing a custom 'authReady' event that all other page-specific scripts listen for.
 */
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';

    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.appspot.com",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:6a7cf9f10bd12650b22403"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.storage = firebase.storage();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    window.openModal = (modal) => { if (modal) modal.classList.add('open'); };
    window.closeModal = (modal) => { if (modal) modal.classList.remove('open'); };
    
    const setupModalAndFormListeners = () => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const logoutButton = document.getElementById('logoutButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        const googleLoginButton = document.getElementById('googleLoginButton');
        const googleRegisterButton = document.getElementById('googleRegisterButton');

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

        const handleGoogleAuth = () => {
             auth.signInWithPopup(googleProvider).then(result => {
                const user = result.user;
                const userRef = db.collection('users').doc(user.uid);
                return userRef.get().then(doc => {
                    if (!doc.exists) {
                        const handle = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                        return userRef.set({
                            displayName: user.displayName, email: user.email, photoURL: user.photoURL,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            handle: handle, bio: "New HatakeSocial user!", favoriteTcg: "Not set"
                        });
                    }
                });
            }).then(() => {
                closeModal(loginModal);
                closeModal(registerModal);
            }).catch(err => alert(err.message));
        };
        
        if (googleLoginButton) googleLoginButton.addEventListener('click', handleGoogleAuth);
        if (googleRegisterButton) googleRegisterButton.addEventListener('click', handleGoogleAuth);

        document.getElementById('registerForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const city = document.getElementById('registerCity')?.value || '';
            const country = document.getElementById('registerCountry')?.value || '';
            const favoriteTcg = document.getElementById('registerFavoriteTcg')?.value || '';
            const displayName = email.split('@')[0];
            const handle = displayName.replace(/[^a-zA-Z0-9]/g, '');

            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    const defaultPhotoURL = `https://ui-avatars.com/api/?name=${displayName.charAt(0)}&background=random&color=fff`;
                    cred.user.updateProfile({ displayName: displayName, photoURL: defaultPhotoURL });
                    return db.collection('users').doc(cred.user.uid).set({
                        displayName: displayName, email: email, photoURL: defaultPhotoURL,
                        city: city, country: country, favoriteTcg: favoriteTcg,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        handle: handle,
                        bio: "New HatakeSocial user!"
                    });
                })
                .then(() => closeModal(registerModal))
                .catch(err => alert(err.message));
        });

        if (logoutButton) logoutButton.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
        if (userAvatar) userAvatar.addEventListener('click', () => userDropdown.classList.toggle('hidden'));
    };

    auth.onAuthStateChanged(async (user) => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const userAvatar = document.getElementById('userAvatar');
        
        if (user) {
            if (loginButton) loginButton.classList.add('hidden');
            if (registerButton) registerButton.classList.add('hidden');
            if (userAvatar) userAvatar.classList.remove('hidden');
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                if (userAvatar) userAvatar.src = userDoc.data().photoURL || 'https://i.imgur.com/B06rBhI.png';
            }
            if (!window.location.pathname.includes('messages.html')) {
                injectMessengerWidget(user);
            }
        } else {
            if (loginButton) loginButton.classList.remove('hidden');
            if (registerButton) registerButton.classList.remove('hidden');
            if (userAvatar) userAvatar.classList.add('hidden');
        }
        
        const event = new CustomEvent('authReady', { detail: { user } });
        document.dispatchEvent(event);

        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });
    
    const injectMessengerWidget = (user) => {
        if (document.getElementById('messenger-widget')) return;
        const widgetHTML = `
            <div id="messenger-widget" class="minimized">
                <div id="messenger-widget-header"><h3 class="font-bold">Messages</h3><button id="messenger-toggle-btn"><i class="fas fa-chevron-up"></i></button></div>
                <div id="messenger-widget-body" class="hidden">
                    <div id="widget-conversations-list" class="flex-grow overflow-y-auto"></div>
                    <a href="messages.html" class="block text-center p-2 bg-gray-200 hover:bg-gray-300 text-sm font-semibold">View All Messages</a>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', widgetHTML);
        const widget = document.getElementById('messenger-widget');
        const toggleBtn = document.getElementById('messenger-toggle-btn');
        const body = document.getElementById('messenger-widget-body');
        toggleBtn.addEventListener('click', () => {
            widget.classList.toggle('minimized');
            body.classList.toggle('hidden');
            toggleBtn.innerHTML = widget.classList.contains('minimized') ? '<i class="fas fa-chevron-up"></i>' : '<i class="fas fa-chevron-down"></i>';
        });
        loadConversations(user.uid, document.getElementById('widget-conversations-list'));
    };

    const loadConversations = async (currentUserId, container) => {
        const usersSnapshot = await db.collection('users').get();
        if (!container) return;
        container.innerHTML = '';
        usersSnapshot.forEach(doc => {
            if (doc.id === currentUserId) return;
            const userData = doc.data();
            const item = document.createElement('div');
            item.className = 'conversation-item';
            item.innerHTML = `<img src="${userData.photoURL || 'https://placehold.co/40x40'}" class="h-10 w-10 rounded-full mr-3"><span class="font-bold">${userData.displayName}</span>`;
            item.addEventListener('click', () => {
                 // **THE FIX IS HERE:** Changed from /messages.html to messages.html
                 window.location.href = `messages.html?with=${doc.id}`;
            });
            container.appendChild(item);
        });
    };

    setupModalAndFormListeners();
});
