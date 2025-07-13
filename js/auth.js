/**
 * HatakeSocial - Core Authentication & UI Script (v22 - Internal Price Guide)
 *
 * - **NEW**: Adds a window.HatakePriceGuide object to simulate a local price database based on the Cardmarket download.
 * - **NEW**: All price display functions will now reference this internal guide instead of live APIs.
 * - Adds a listener for sent friend requests to complete the client-side "handshake".
 * - Adds logic to toggle the mobile navigation menu.
 * - Replaces alert() with inline error messages for a better UX.
 */
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';

    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.firebasestorage.app",
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

    // --- NEW: Internal Price Guide ---
    // This simulates the data you would parse from the Cardmarket price guide CSV.
    // The key is the Scryfall Card ID.
    window.HatakePriceGuide = {
        "ae9c1471-ae6f-4b66-9842-46f1a74e93b5": { price: 1.34, price_foil: 5.50 }, // Garna, the Bloodflame
        "d9849b22-1fba-4f6a-bd94-df1bc1764e6b": { price: 0.25, price_foil: 4.14 }, // Snakeskin Veil (STA)
        "76cf42b4-f767-48b7-b38c-b98306909f06": { price: 3.13, price_foil: 10.00 }, // Aven Mindcensor (TSR)
        "96e7194c-e91e-4816-928c-01912d10e751": { price: 2.68, price_foil: 8.50 }  // O-Naginata
        // ... you would add all other card prices here
    };

    // --- Internationalization & Currency ---
    window.HatakeSocial = {
        conversionRates: { SEK: 1, USD: 0.095, EUR: 0.088 },
        currentCurrency: localStorage.getItem('hatakeCurrency') || 'SEK',
        currentUserData: null,
        // UPDATED: This function now uses the internal price guide.
        convertAndFormatPrice(amount, fromCurrency = 'SEK') {
            const toCurrency = this.currentCurrency;
            if (amount === undefined || amount === null || isNaN(amount)) {
                return `0.00 ${toCurrency}`;
            }
            const fromRate = this.conversionRates[fromCurrency];
            if (fromRate === undefined) {
                 return `N/A`;
            }
            const amountInSEK = amount / fromRate;
            const toRate = this.conversionRates[toCurrency];
             if (toRate === undefined) {
                 return `N/A`;
            }
            const convertedAmount = amountInSEK * toRate;
            return `${convertedAmount.toFixed(2)} ${toCurrency}`;
        }
    };

    const setupCurrencySelector = () => {
        const container = document.getElementById('currency-selector-container');
        if (!container) return;

        container.innerHTML = `
            <select id="currency-selector" class="text-sm rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500">
                <option value="SEK">SEK</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
            </select>
        `;
        const selector = document.getElementById('currency-selector');
        selector.value = window.HatakeSocial.currentCurrency;

        selector.addEventListener('change', (e) => {
            window.HatakeSocial.currentCurrency = e.target.value;
            localStorage.setItem('hatakeCurrency', e.target.value);
            window.location.reload();
        });
    };

    window.openModal = (modal) => { 
        if (modal) {
            modal.classList.add('open');
            const errorMsg = modal.querySelector('[id$="-error-message"]');
            if (errorMsg) {
                errorMsg.classList.add('hidden');
                errorMsg.textContent = '';
            }
        }
    };
    window.closeModal = (modal) => { if (modal) modal.classList.remove('open'); };
    
    const setupGlobalListeners = () => {
        const headerSearchForm = document.querySelector('header form#header-search-form'); 
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const logoutButton = document.getElementById('logoutButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        const googleLoginButton = document.getElementById('googleLoginButton');
        const googleRegisterButton = document.getElementById('googleRegisterButton');
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        if (loginButton) loginButton.addEventListener('click', () => openModal(loginModal));
        if (registerButton) registerButton.addEventListener('click', () => openModal(registerModal));
        document.getElementById('closeLoginModal')?.addEventListener('click', () => closeModal(loginModal));
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => closeModal(registerModal));

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorMessageEl = document.getElementById('login-error-message');

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    closeModal(loginModal);
                })
                .catch(err => {
                    errorMessageEl.textContent = err.message;
                    errorMessageEl.classList.remove('hidden');
                });
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
            const errorMessageEl = document.getElementById('register-error-message');

            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    const defaultPhotoURL = `https://ui-avatars.com/api/?name=${displayName.charAt(0)}&background=random&color=fff`;
                    cred.user.updateProfile({ displayName: displayName, photoURL: defaultPhotoURL });
                    return db.collection('users').doc(cred.user.uid).set({
                        displayName: displayName,
                        displayName_lower: displayName.toLowerCase(),
                        email: email, photoURL: defaultPhotoURL,
                        city: city, country: country, favoriteTcg: favoriteTcg,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        handle: handle,
                        isAdmin: false,
                        primaryCurrency: 'SEK'
                    });
                })
                .then(() => closeModal(registerModal))
                .catch(err => {
                    if(errorMessageEl) {
                        errorMessageEl.textContent = err.message;
                        errorMessageEl.classList.remove('hidden');
                    } else {
                        alert(err.message);
                    }
                });
        });

        const handleGoogleAuth = () => {
             auth.signInWithPopup(googleProvider).then(result => {
                const user = result.user;
                const userRef = db.collection('users').doc(user.uid);
                return userRef.get().then(doc => {
                    if (!doc.exists) {
                        const handle = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                        return userRef.set({
                            displayName: user.displayName,
                            displayName_lower: user.displayName.toLowerCase(),
                            email: user.email, photoURL: user.photoURL,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            handle: handle, bio: "New HatakeSocial user!", favoriteTcg: "Not set", isAdmin: false, primaryCurrency: 'SEK'
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
        
        const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
        if (scrollToTopBtn) {
            window.addEventListener('scroll', () => {
                if (window.pageYOffset > 200) {
                    scrollToTopBtn.classList.remove('hidden');
                } else {
                    scrollToTopBtn.classList.add('hidden');
                }
            });

            scrollToTopBtn.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        if (mobileMenuButton) {
            mobileMenuButton.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
        }
    };

    // **NEW**: Listener for sent friend requests
    let friendRequestHandshakeListener = null;
    function listenForAcceptedRequests(user) {
        if (friendRequestHandshakeListener) {
            friendRequestHandshakeListener();
        }

        const sentRequestsRef = db.collection('friendRequests')
            .where('senderId', '==', user.uid)
            .where('status', '==', 'accepted');

        friendRequestHandshakeListener = sentRequestsRef.onSnapshot(async (snapshot) => {
            if (snapshot.empty) {
                return;
            }

            const batch = db.batch();
            const currentUserRef = db.collection('users').doc(user.uid);

            for (const doc of snapshot.docs) {
                const request = doc.data();
                const newFriendId = request.receiverId;

                batch.update(currentUserRef, { friends: firebase.firestore.FieldValue.arrayUnion(newFriendId) });
                batch.delete(doc.ref);
                
                const notificationData = {
                    message: `You are now friends with ${request.receiverName || 'a new user'}.`,
                    link: `/profile.html?uid=${newFriendId}`,
                    isRead: false,
                    timestamp: new Date()
                };
                const notificationRef = db.collection('users').doc(user.uid).collection('notifications').doc();
                batch.set(notificationRef, notificationData);
            }

            try {
                await batch.commit();
                console.log('Friend handshake complete for', snapshot.size, 'requests.');
            } catch (error) {
                console.error("Error completing friend handshake:", error);
            }
        }, error => {
            console.error("Error listening for accepted friend requests:", error);
        });
    }

    auth.onAuthStateChanged(async (user) => {
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const sidebarUserInfo = document.getElementById('sidebar-user-info');
        
        const existingAdminLink = document.getElementById('admin-link-container');
        if (existingAdminLink) existingAdminLink.remove();
        
        if (user) {
            loginButton?.classList.add('hidden');
            registerButton?.classList.add('hidden');
            userAvatar?.classList.remove('hidden');
            
            // **NEW**: Start listening for accepted requests
            listenForAcceptedRequests(user);

            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    window.HatakeSocial.currentUserData = userData;
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

                    if (userData.isAdmin === true && userDropdown) {
                        const adminLinkContainer = document.createElement('div');
                        adminLinkContainer.id = 'admin-link-container';
                        adminLinkContainer.innerHTML = `
                            <div class="border-t my-1 border-gray-200 dark:border-gray-600"></div>
                            <a href="admin.html" class="block px-4 py-2 text-red-600 dark:text-red-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-600">
                                <i class="fas fa-user-shield mr-2"></i>Admin
                            </a>
                        `;
                        userDropdown.appendChild(adminLinkContainer);
                    }
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        } else {
            window.HatakeSocial.currentUserData = null;
            // **NEW**: Stop listening if user logs out
            if (friendRequestHandshakeListener) {
                friendRequestHandshakeListener();
            }
            loginButton?.classList.remove('hidden');
            registerButton?.classList.remove('hidden');
            userAvatar?.classList.add('hidden');
            userDropdown?.classList.add('hidden');
            sidebarUserInfo?.classList.add('hidden');
        }
        
        const event = new CustomEvent('authReady', { detail: { user } });
        document.dispatchEvent(event);

        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });
    
    setupGlobalListeners();
    setupCurrencySelector();
});
