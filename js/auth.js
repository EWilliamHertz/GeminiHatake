/**
 * HatakeSocial - Merged Authentication & Global UI Script (v30 - Login Fix)
 *
 * This script corrects a race condition where login/register modals would close
 * before the UI had a chance to update, making it seem like the login failed.
 *
 * - FIX: Modals are now closed from within the `onAuthStateChanged` listener,
 * ensuring the UI is ready to update when a user session is confirmed.
 * - Merged Features:
 * - Full Firebase configuration and initialization within DOMContentLoaded.
 * - Robust email verification flow on login.
 * - Dynamic injection of the header's notification bell and profile dropdown upon user login.
 * - When logged out, header buttons now trigger login/register modals instead of navigating.
 * - Real-time notification listener for the bell icon and dropdown content.
 * - Friend request handshake logic.
 * - Global utilities like `showToast`, modal handlers, and currency conversion.
 */

// --- Global Toast Notification Function ---
const showToast = (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) { // Create container if it doesn't exist
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-5 right-5 z-50';
        document.body.appendChild(toastContainer);
        container = toastContainer;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${iconClass} toast-icon"></i> <p>${message}</p>`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
};


document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';

    // --- Firebase Initialization ---
    const firebaseConfig = {
        apiKey: "AIzaSyD2Z9tCmmgReMG77ywXukKC_YIXsbP3uoU",
        authDomain: "hatakesocial-88b5e.firebaseapp.com",
        projectId: "hatakesocial-88b5e",
        storageBucket: "hatakesocial-88b5e.firebasestorage.app",
        messagingSenderId: "1091697032506",
        appId: "1:1091697032506:web:6a7cf9f10bd12650b22403",
        measurementId: "G-EH0PS2Z84J"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    if (typeof firebase.analytics === 'function') {
        window.analytics = firebase.analytics();
    }
    
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.storage = firebase.storage();
    
    if (typeof firebase.functions === 'function') {
        window.functions = firebase.functions();
    } else {
        window.functions = null;
        console.warn('Firebase Functions library not loaded. Some features may not work.');
    }

    const googleProvider = new firebase.auth.GoogleAuthProvider();
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');


    // --- Internationalization & Currency ---
    window.HatakeSocial = {
        conversionRates: { SEK: 1, USD: 0.095, EUR: 0.088 },
        currentCurrency: localStorage.getItem('hatakeCurrency') || 'SEK',
        currentUserData: null,
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
            <label for="currency-selector" class="text-sm text-gray-600 dark:text-gray-400">Currency</label>
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
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            const errorMsg = modal.querySelector('[id$="-error-message"]');
            if (errorMsg) {
                errorMsg.classList.add('hidden');
                errorMsg.textContent = '';
            }
        }
    };
    window.closeModal = (modal) => { 
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    };
    
    const setupGlobalListeners = () => {
        const headerSearchForm = document.querySelector('header form#header-search-form'); 
        const googleLoginButton = document.getElementById('googleLoginButton');
        const googleRegisterButton = document.getElementById('googleRegisterButton');
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        document.getElementById('closeLoginModal')?.addEventListener('click', () => closeModal(loginModal));
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => closeModal(registerModal));

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorMessageEl = document.getElementById('login-error-message');

            auth.signInWithEmailAndPassword(email, password)
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
            const referrer = document.getElementById('registerReferrer')?.value.trim() || '';
            const displayName = email.split('@')[0];
            const handle = displayName.replace(/[^a-zA-Z0-9]/g, '');
            const errorMessageEl = document.getElementById('register-error-message');

            auth.createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    const defaultPhotoURL = `https://ui-avatars.com/api/?name=${displayName.charAt(0)}&background=random&color=fff`;
                    
                    cred.user.sendEmailVerification();

                    cred.user.updateProfile({ displayName: displayName, photoURL: defaultPhotoURL });
                    return db.collection('users').doc(cred.user.uid).set({
                        displayName: displayName,
                        displayName_lower: displayName.toLowerCase(),
                        email: email, photoURL: defaultPhotoURL,
                        city: city, country: country, favoriteTcg: favoriteTcg,
                        referrer: referrer,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        handle: handle,
                        isAdmin: false,
                        primaryCurrency: 'SEK'
                    });
                })
                .then(() => {
                    showToast("Registration successful! A verification link has been sent to your email.", "success");
                })
                .catch(err => {
                    if(errorMessageEl) {
                        errorMessageEl.textContent = err.message;
                        errorMessageEl.classList.remove('hidden');
                    } else {
                        showToast(err.message, "error");
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
                            handle: handle, bio: "New HatakeSocial user!", favoriteTcg: "Not set", isAdmin: false, primaryCurrency: 'SEK',
                            referrer: ''
                        });
                    }
                });
            }).catch(err => showToast(err.message, "error"));
        };
        
        if (googleLoginButton) googleLoginButton.addEventListener('click', handleGoogleAuth);
        if (googleRegisterButton) googleRegisterButton.addEventListener('click', handleGoogleAuth);

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

    let friendRequestHandshakeListener = null;
    function listenForAcceptedRequests(user) {
        if (friendRequestHandshakeListener) {
            friendRequestHandshakeListener();
        }

        const sentRequestsRef = db.collection('friendRequests')
            .where('senderId', '==', user.uid)
            .where('status', '==', 'accepted');

        friendRequestHandshakeListener = sentRequestsRef.onSnapshot(async (snapshot) => {
            if (snapshot.empty) return;

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
            } catch (error) {
                console.error("Error completing friend handshake:", error);
            }
        }, error => {
            console.error("Error listening for accepted friend requests:", error);
        });
    }
    
    function sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    let unsubscribeNotifications = null;
    auth.onAuthStateChanged(async (user) => {
        if (user && !user.emailVerified) {
            document.body.innerHTML = `
                <div class="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
                    <div class="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl text-center max-w-lg mx-4">
                        <h1 class="text-2xl font-bold text-gray-800 dark:text-white mb-4">Please Verify Your Email</h1>
                        <p class="text-gray-600 dark:text-gray-400 mb-6">
                            A verification link has been sent to <strong>${user.email}</strong>. Please check your inbox (and spam folder) and click the link to activate your account.
                        </p>
                        <div class="space-x-4">
                            <button id="resend-verification-btn" class="px-5 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Resend Email</button>
                            <button onclick="firebase.auth().signOut()" class="px-5 py-2 bg-gray-600 text-white font-semibold rounded-full hover:bg-gray-700">Logout</button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('resend-verification-btn').addEventListener('click', () => {
                user.sendEmailVerification()
                    .then(() => showToast('A new verification email has been sent.', 'success'))
                    .catch(err => showToast('Error sending email: ' + err.message, 'error'));
            });
    
            document.body.style.opacity = '1';
            return;
        }
    
        const userActions = document.getElementById('user-actions');
        const authContainerSidebar = document.getElementById('auth-container-sidebar');
        const mobileUserActions = document.getElementById('mobile-user-actions');
        
        if (user) {
            // User is logged in, close modals
            closeModal(loginModal);
            closeModal(registerModal);
            
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    console.warn("User document not found. Signing out.");
                    auth.signOut();
                    return;
                }
                const userData = userDoc.data();
                window.HatakeSocial.currentUserData = userData;
                const isAdmin = userData.isAdmin === true;
                const photoURL = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';

                // 1. Populate Header User Actions (Dynamic Injection)
                if (userActions) {
                    userActions.innerHTML = `
                        <div class="relative">
                            <button id="cart-btn" class="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 text-xl">
                                <i class="fas fa-shopping-cart"></i>
                                <span id="cart-item-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span>
                            </button>
                        </div>
                        <div class="relative">
                            <button id="notification-bell-btn" class="text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 text-xl"><i class="fas fa-bell"></i><span id="notification-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span></button>
                            <div id="notification-dropdown" class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-20 hidden">
                                <div class="p-3 font-bold border-b dark:border-gray-700">Notifications</div>
                                <div id="notification-list" class="max-h-96 overflow-y-auto"><p class="p-4 text-sm text-gray-500">No new notifications.</p></div>
                                <a href="notifications.html" class="block text-center p-2 text-sm text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700">View all</a>
                            </div>
                        </div>
                        <div class="relative">
                            <button id="profile-avatar-btn"><img src="${photoURL}" alt="User Avatar" class="w-10 h-10 rounded-full object-cover border-2 border-transparent hover:border-blue-500"></button>
                            <div id="profile-dropdown" class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-20 hidden">
                                <a href="profile.html?uid=${user.uid}" class="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">My Profile</a>
                                <a href="settings.html" class="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Settings</a>
                                ${isAdmin ? `<a href="admin.html" class="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Admin Panel</a>` : ''}
                                <hr class="border-gray-200 dark:border-gray-600">
                                <button id="logout-btn-dropdown" class="block w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Logout</button>
                            </div>
                        </div>`;
                    
                    document.getElementById('cart-btn').addEventListener('click', () => openModal(document.getElementById('cartModal')));
                    document.getElementById('notification-bell-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('profile-dropdown').classList.add('hidden'); document.getElementById('notification-dropdown').classList.toggle('hidden'); });
                    document.getElementById('profile-avatar-btn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('notification-dropdown').classList.add('hidden'); document.getElementById('profile-dropdown').classList.toggle('hidden'); });
                    document.getElementById('logout-btn-dropdown').addEventListener('click', () => auth.signOut());
                }

                // 2. Setup Notification Listener
                if (unsubscribeNotifications) unsubscribeNotifications();
                unsubscribeNotifications = db.collection('users').doc(user.uid).collection('notifications').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
                    const unreadCount = snapshot.docs.filter(doc => !doc.data().isRead).length;
                    const countEl = document.getElementById('notification-count');
                    const listEl = document.getElementById('notification-list');
                    if (countEl) { countEl.textContent = unreadCount; countEl.classList.toggle('hidden', unreadCount === 0); }
                    if (listEl) {
                        if (snapshot.empty) { listEl.innerHTML = '<p class="p-4 text-sm text-gray-500">No new notifications.</p>'; } 
                        else {
                            listEl.innerHTML = '';
                            snapshot.docs.slice(0, 5).forEach(doc => {
                                const notif = doc.data();
                                const el = document.createElement('a');
                                el.href = notif.link || '#';
                                el.className = `flex items-start p-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/50' : ''}`;
                                el.innerHTML = `<div class="flex-shrink-0 mr-3"><div class="w-3 h-3 rounded-full ${!notif.isRead ? 'bg-blue-500' : 'bg-transparent'} mt-1.5"></div></div><div><p class="text-sm text-gray-700 dark:text-gray-300">${sanitizeHTML(notif.message)}</p><p class="text-xs text-gray-500">${new Date(notif.timestamp?.toDate()).toLocaleString()}</p></div>`;
                                el.addEventListener('click', () => db.collection('users').doc(user.uid).collection('notifications').doc(doc.id).update({ isRead: true }));
                                listEl.appendChild(el);
                            });
                        }
                    }
                }, err => console.error("Notification listener error:", err));

                // 3. Populate Sidebar
                if (authContainerSidebar) {
                    authContainerSidebar.innerHTML = `<div class="flex items-center"><img src="${photoURL}" alt="User Avatar" class="w-10 h-10 rounded-full object-cover"><div class="ml-3"><p class="font-semibold text-gray-800 dark:text-white">${userData.displayName}</p><button id="logout-btn-sidebar" class="text-sm text-gray-500 hover:underline">Logout</button></div></div>`;
                    document.getElementById('logout-btn-sidebar').addEventListener('click', () => auth.signOut());
                }

                // 4. Populate Mobile Menu
                if (mobileUserActions) {
                    mobileUserActions.innerHTML = `<div class="flex items-center space-x-4 px-3 py-2"><img src="${photoURL}" alt="User Avatar" class="h-10 w-10 rounded-full border-2 border-blue-500 object-cover"><div><div class="font-medium text-base text-gray-800 dark:text-white">${userData.displayName}</div><div class="font-medium text-sm text-gray-500 dark:text-gray-400">${user.email}</div></div></div><div class="mt-3 space-y-1"><a href="profile.html" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Profile</a><a href="settings.html" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Settings</a><a href="#" id="mobileLogoutButton" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Logout</a></div>`;
                    document.getElementById('mobileLogoutButton').addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
                }
                
                listenForAcceptedRequests(user);

            } catch (error) {
                console.error("Error during authenticated state setup:", error);
                showToast("Could not load your profile.", "error");
                auth.signOut();
            }
        } else {
            // --- User is Logged Out ---
            window.HatakeSocial.currentUserData = null;
            if (friendRequestHandshakeListener) friendRequestHandshakeListener();
            if (unsubscribeNotifications) unsubscribeNotifications();

            const loginButtonsHTML = `
                <div class="space-x-2">
                    <button id="header-login-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Login</button>
                    <button id="header-register-btn" class="px-4 py-2 bg-gray-600 text-white font-semibold rounded-full hover:bg-gray-700">Register</button>
                </div>`;
            if (userActions) {
                userActions.innerHTML = loginButtonsHTML;
                document.getElementById('header-login-btn').addEventListener('click', () => openModal(document.getElementById('loginModal')));
                document.getElementById('header-register-btn').addEventListener('click', () => openModal(document.getElementById('registerModal')));
            }
            if (authContainerSidebar) {
                authContainerSidebar.innerHTML = loginButtonsHTML;
                document.getElementById('header-login-btn').addEventListener('click', () => openModal(document.getElementById('loginModal')));
                document.getElementById('header-register-btn').addEventListener('click', () => openModal(document.getElementById('registerModal')));
            }
    
            if (mobileUserActions) {
                mobileUserActions.innerHTML = `<div class="space-y-2"><button id="mobileLoginButton" class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Login</button><button id="mobileRegisterButton" class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Register</button></div>`;
                document.getElementById('mobileLoginButton').addEventListener('click', () => openModal(document.getElementById('loginModal')));
                document.getElementById('mobileRegisterButton').addEventListener('click', () => openModal(document.getElementById('registerModal')));
            }
        }
        
        document.dispatchEvent(new CustomEvent('authReady', { detail: { user } }));
        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });
    
    setupGlobalListeners();
    setupCurrencySelector();

    // Global click listener to close dropdowns
    window.addEventListener('click', () => {
        document.getElementById('profile-dropdown')?.classList.add('hidden');
        document.getElementById('notification-dropdown')?.classList.add('hidden');
    });
});