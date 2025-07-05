/**
 * HatakeSocial - Core Authentication & UI Script (v12)
 *
 * This script is included on EVERY page. It handles:
 * 1. Firebase Initialization.
 * 2. All Login/Register Modal and Form logic.
 * 3. The main auth state listener that correctly updates the header UI.
 * 4. Firing a custom 'authReady' event that all other page-specific scripts listen for.
 * 5. Global search bar functionality with refresh prevention.
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
    
    const setupGlobalListeners = () => {
        const headerSearchForm = document.querySelector('header form'); 
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

        if (logoutButton) logoutButton.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
        if (userAvatar) userAvatar.addEventListener('click', () => userDropdown.classList.toggle('hidden'));

        if (headerSearchForm) {
            headerSearchForm.addEventListener('submit', (e) => {
                e.preventDefault(); 
                const searchBar = document.getElementById('searchBar');
                const query = searchBar.value.trim();
                if (query) {
                    window.location.href = `search.html?query=${encodeURIComponent(query)}`;
                }
            });
        }
    };

    auth.onAuthStateChanged(async (user) => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const userAvatar = document.getElementById('userAvatar');
        const sidebarUserInfo = document.getElementById('sidebar-user-info');
        
        if (user) {
            loginButton?.classList.add('hidden');
            registerButton?.classList.add('hidden');
            userAvatar?.classList.remove('hidden');

            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const photo = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';
                    const name = userData.displayName || 'User';
                    const handle = userData.handle || name.toLowerCase().replace(/\s/g, '');

                    if (userAvatar) userAvatar.src = photo;
                    
                    if (sidebarUserInfo) {
                        sidebarUserInfo.classList.remove('hidden');
                        document.getElementById('sidebar-user-avatar').src = photo;
                        document.getElementById('sidebar-user-name').textContent = name;
                        document.getElementById('sidebar-user-handle').textContent = `@${handle}`;
                    }
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        } else {
            loginButton?.classList.remove('hidden');
            registerButton?.classList.remove('hidden');
            userAvatar?.classList.add('hidden');
            document.getElementById('userDropdown')?.classList.add('hidden');
            sidebarUserInfo?.classList.add('hidden');
        }
        
        const event = new CustomEvent('authReady', { detail: { user } });
        document.dispatchEvent(event);

        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });
    
    setupGlobalListeners();
});
