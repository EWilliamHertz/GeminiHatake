/**
 * HatakeSocial - Core Authentication & UI Script (v23 - Merged UI/UX Revamp)
 *
 * - NEW: Adds a global `showToast` function for non-blocking notifications.
 * - NEW: Implements the real-time notification bell and dropdown.
 * - Merges all previous functionality including defensive checks, currency conversion, and friend request handshakes.
 */

// --- NEW: Global Toast Notification Function ---
const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${iconClass} toast-icon"></i> <p>${message}</p>`;
    
    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Animate out and remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
};


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
    
    if (typeof firebase.functions === 'function') {
        window.functions = firebase.functions();
    } else {
        window.functions = null;
        console.warn('Firebase Functions library not loaded. Some features may not work.');
    }

    const googleProvider = new firebase.auth.GoogleAuthProvider();

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
                    closeModal(document.getElementById('registerModal'));
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
            }).then(() => {
                closeModal(loginModal);
                closeModal(registerModal);
            }).catch(err => showToast(err.message, "error"));
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
            } catch (error) {
                console.error("Error completing friend handshake:", error);
            }
        }, error => {
            console.error("Error listening for accepted friend requests:", error);
        });
    }

    let unsubscribeNotifications = null;
    const setupNotificationBell = (user) => {
        const bellBtn = document.getElementById('notification-bell-btn');
        const counter = document.getElementById('notification-count');
        const dropdown = document.getElementById('notification-dropdown');
        const list = document.getElementById('notification-list');

        if (!bellBtn || !counter || !dropdown || !list) return;

        const notificationsRef = db.collection('users').doc(user.uid).collection('notifications');

        unsubscribeNotifications = notificationsRef.where('isRead', '==', false)
            .onSnapshot(snapshot => {
                const unreadCount = snapshot.size;
                counter.textContent = unreadCount;
                if (unreadCount > 0) {
                    counter.classList.remove('hidden');
                } else {
                    counter.classList.add('hidden');
                }
            });

        bellBtn.addEventListener('click', async () => {
            dropdown.classList.toggle('hidden');
            if (!dropdown.classList.contains('hidden')) {
                list.innerHTML = '<li>Loading...</li>';
                const snapshot = await notificationsRef.orderBy('timestamp', 'desc').limit(10).get();
                list.innerHTML = '';
                if (snapshot.empty) {
                    list.innerHTML = '<li class="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No notifications yet.</li>';
                } else {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        const notif = doc.data();
                        const li = document.createElement('li');
                        li.innerHTML = `
                            <a href="${notif.link || '#'}" class="notification-item ${!notif.isRead ? '' : 'is-read'}">
                                <img src="${notif.fromAvatar || 'https://i.imgur.com/B06rBhI.png'}" alt="${notif.fromName}">
                                <div class="notification-item-content">
                                    <p>${sanitizeHTML(notif.message)}</p>
                                    <span class="timestamp">${new Date(notif.timestamp.toDate()).toLocaleString()}</span>
                                </div>
                            </a>
                        `;
                        list.appendChild(li);

                        if (!notif.isRead) {
                            batch.update(doc.ref, { isRead: true });
                        }
                    });
                    await batch.commit();
                }
            }
        });
    };

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
    
        const loginButton = document.getElementById('loginButton');
        const registerButton = document.getElementById('registerButton');
        const userAvatar = document.getElementById('userAvatar');
        const userDropdown = document.getElementById('userDropdown');
        const sidebarUserInfo = document.getElementById('sidebar-user-info');
        const mobileUserActions = document.getElementById('mobile-user-actions');
    
        const existingAdminLink = document.getElementById('admin-link-container');
        if (existingAdminLink) existingAdminLink.remove();
        
        if (user) {
            loginButton?.classList.add('hidden');
            registerButton?.classList.add('hidden');
            userAvatar?.classList.remove('hidden');
            
            if (mobileUserActions) {
                mobileUserActions.innerHTML = `
                    <div class="flex items-center space-x-4 px-3 py-2">
                        <img src="${user.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="User Avatar" class="h-10 w-10 rounded-full border-2 border-blue-500 object-cover">
                        <div>
                            <div class="font-medium text-base text-gray-800 dark:text-white">${user.displayName}</div>
                            <div class="font-medium text-sm text-gray-500 dark:text-gray-400">${user.email}</div>
                        </div>
                    </div>
                    <div class="mt-3 space-y-1">
                        <a href="profile.html" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Profile</a>
                        <a href="settings.html" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Settings</a>
                        <a href="#" id="mobileLogoutButton" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Logout</a>
                    </div>
                `;
                document.getElementById('mobileLogoutButton').addEventListener('click', (e) => {
                    e.preventDefault();
                    auth.signOut();
                });
            }
            
            listenForAcceptedRequests(user);
            setupNotificationBell(user);
    
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
            if (friendRequestHandshakeListener) friendRequestHandshakeListener();
            if (unsubscribeNotifications) unsubscribeNotifications();

            loginButton?.classList.remove('hidden');
            registerButton?.classList.remove('hidden');
            userAvatar?.classList.add('hidden');
            userDropdown?.classList.add('hidden');
            sidebarUserInfo?.classList.add('hidden');
    
            if (mobileUserActions) {
                mobileUserActions.innerHTML = `
                    <div class="space-y-2">
                        <button id="mobileLoginButton" class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Login</button>
                        <button id="mobileRegisterButton" class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Register</button>
                    </div>
                `;
                document.getElementById('mobileLoginButton').addEventListener('click', () => openModal(document.getElementById('loginModal')));
                document.getElementById('mobileRegisterButton').addEventListener('click', () => openModal(document.getElementById('registerModal')));
            }
        }
        
        const event = new CustomEvent('authReady', { detail: { user } });
        document.dispatchEvent(event);
    
        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });
    
    setupGlobalListeners();
    setupCurrencySelector();
});
