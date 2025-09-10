/**
* HatakeSocial - Merged Authentication & Global UI Script (v17 - Redirection & Stability)
*
* - NEW: Redirects user to app.html immediately after successful login or registration.
* - NEW: Redirects logged-in users from the landing page (index.html) to app.html automatically.
* - FIX: Resolves a race condition where the app would try to load a user's profile before the backend function created it, causing a flashing/reload loop. Now uses a Firestore onSnapshot listener to wait for the document to exist.
* - FIX: Ensures the verification email is sent immediately and reliably upon registration.
* - FIX: Corrects the logic that was preventing the Terms of Service modal from appearing.
*/

// --- Global Toast Notification Function ---
const showToast = (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-5 right-5 z-[1003]'; // Higher z-index
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

// --- Global Modal Helper Functions ---
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


document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';

    // --- Firebase Initialization ---
    if (!firebase.apps.length) {
        // Replace with your actual Firebase config if not using /__/firebase/init.js
        firebase.initializeApp(); 
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
        console.warn('Firebase Functions library not loaded.');
    }

    const googleProvider = new firebase.auth.GoogleAuthProvider();
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');

    // --- MESSENGER WIDGET FIX ---
    if (localStorage.getItem('messengerWidget-visible') === null) {
        localStorage.setItem('messengerWidget-visible', 'false');
    }

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
            if (fromRate === undefined) return `N/A`;
            const amountInSEK = amount / fromRate;
            const toRate = this.conversionRates[toCurrency];
            if (toRate === undefined) return `N/A`;
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
    
    const setupGlobalListeners = () => {
        const headerSearchForm = document.querySelector('header form#header-search-form');
        const googleLoginButton = document.getElementById('googleLoginButton');
        const googleRegisterButton = document.getElementById('googleRegisterButton');
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');
        const registerForm = document.getElementById('registerForm');

        document.getElementById('closeLoginModal')?.addEventListener('click', () => closeModal(loginModal));
        document.getElementById('closeRegisterModal')?.addEventListener('click', () => closeModal(registerModal));

        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorMessageEl = document.getElementById('login-error-message');

            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    window.location.href = 'app.html';
                })
                .catch(err => {
                    errorMessageEl.textContent = err.message;
                    errorMessageEl.classList.remove('hidden');
                });
        });

        if(registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                showTermsModal();
            });
        } else {
            console.warn("Could not find the registration form to attach listener.");
        }

        const handleGoogleAuth = () => {
            auth.signInWithPopup(googleProvider)
                .then(result => {
                    console.log('Google sign-in successful. Redirecting...');
                    window.location.href = 'app.html';
                })
                .catch(err => showToast(err.message, "error"));
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
                scrollToTopBtn.classList.toggle('hidden', window.pageYOffset <= 200);
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
    let verificationTimer = null;
    
    auth.onAuthStateChanged(async (user) => {
        if (verificationTimer) {
            clearInterval(verificationTimer);
            verificationTimer = null;
        }

        const mainSidebarNav = document.querySelector('#sidebar nav');
        const existingAdminSidebarLink = document.getElementById('admin-sidebar-link');
        if (existingAdminSidebarLink) {
            existingAdminSidebarLink.remove();
        }

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

            verificationTimer = setInterval(async () => {
                await user.reload();
                if (user.emailVerified) {
                    clearInterval(verificationTimer);
                    window.location.reload();
                }
            }, 5000);
            document.body.style.opacity = '1';
            return;
        }

        const userActions = document.getElementById('user-actions');
        const authContainerSidebar = document.getElementById('auth-container-sidebar');
        const mobileUserActions = document.getElementById('mobile-user-actions');
        
        if (user) {
            const isIndexPage = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html');
            if (isIndexPage) {
                window.location.href = 'app.html';
                return; 
            }

            closeModal(loginModal);
            closeModal(registerModal);
            try {
                const userDocRef = db.collection('users').doc(user.uid);
                let unsubscribeUserDoc = userDocRef.onSnapshot(async (doc) => {
                    if (doc.exists) {
                        if (unsubscribeUserDoc) unsubscribeUserDoc(); 
                        const userData = doc.data();
                        window.HatakeSocial.currentUserData = userData;
                        const photoURL = userData.photoURL || 'https://i.imgur.com/B06rBhI.png';
                        const idTokenResult = await user.getIdTokenResult(true);
                        const isAdmin = idTokenResult.claims.admin === true;
                        
                        handleAdminAccess(isAdmin);
                        
                        if (isAdmin && mainSidebarNav) {
                            const adminLink = document.createElement('a');
                            adminLink.id = 'admin-sidebar-link';
                            adminLink.className = 'flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md font-bold';
                            adminLink.href = 'admin.html';
                            adminLink.innerHTML = `<i class="fas fa-user-shield w-6 text-center"></i><span class="ml-3">Admin Panel</span>`;
                            mainSidebarNav.appendChild(adminLink);
                        }

                        if (userActions) {
                            userActions.innerHTML = `
                            <div class="relative">
                                <button id="cart-btn" class="text-gray-300 hover:text-indigo-400 text-xl"><i class="fas fa-shopping-cart"></i><span id="cart-item-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span></button>
                            </div>
                            <div class="relative">
                                <button id="notification-bell-btn" class="text-gray-300 hover:text-indigo-400 text-xl"><i class="fas fa-bell"></i><span id="notification-count" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center hidden">0</span></button>
                                <div id="notification-dropdown" class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-20 hidden">
                                    <div class="p-3 font-bold border-b dark:border-gray-700">Notifications</div>
                                    <div id="notification-list" class="max-h-96 overflow-y-auto"><p class="p-4 text-sm text-gray-500">No new notifications.</p></div>
                                    <a href="notifications.html" class="block text-center p-2 text-sm text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700">View all</a>
                                </div>
                            </div>
                            <div class="relative">
                                <button id="profile-avatar-btn"><img src="${photoURL}" alt="User Avatar" class="w-10 h-10 rounded-full object-cover border-2 border-transparent hover:border-indigo-500"></button>
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

                        if (authContainerSidebar) {
                            authContainerSidebar.innerHTML = `<div class="flex items-center"><img src="${photoURL}" alt="User Avatar" class="w-10 h-10 rounded-full object-cover"><div class="ml-3"><p class="font-semibold text-gray-800 dark:text-white">${userData.displayName}</p><button id="logout-btn-sidebar" class="text-sm text-gray-500 hover:underline">Logout</button></div></div>`;
                            document.getElementById('logout-btn-sidebar').addEventListener('click', () => auth.signOut());
                        }

                        if (mobileUserActions) {
                            mobileUserActions.innerHTML = `<div class="flex items-center space-x-4 px-3 py-2"><img src="${photoURL}" alt="User Avatar" class="h-10 w-10 rounded-full border-2 border-blue-500 object-cover"><div><div class="font-medium text-base text-gray-800 dark:text-white">${userData.displayName}</div><div class="font-medium text-sm text-gray-500 dark:text-gray-400">${user.email}</div></div></div><div class="mt-3 space-y-1"><a href="profile.html" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Profile</a><a href="settings.html" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Settings</a><a href="#" id="mobileLogoutButton" class="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Logout</a></div>`;
                            document.getElementById('mobileLogoutButton').addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });
                        }
                        listenForAcceptedRequests(user);

                    } else {
                        console.log("User document not found for uid:", user.uid, ". Waiting for it to be created by the backend function...");
                    }
                }, (error) => {
                    console.error("Error listening to user document:", error);
                    showToast("Could not load your profile data.", "error");
                    auth.signOut();
                });

            } catch (error) {
                console.error("Error during authenticated state setup:", error);
                showToast("Could not load your profile.", "error");
                auth.signOut();
            }
        } else { // User is logged out
            window.HatakeSocial.currentUserData = null;
            if (friendRequestHandshakeListener) friendRequestHandshakeListener();
            if (unsubscribeNotifications) unsubscribeNotifications();

            handleAdminAccess(false);

            const loginButtonsHTML = `
                <button id="header-login-btn" class="text-gray-300 hover:text-white transition-colors">Log In</button>
                <button id="header-register-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors">Sign Up Free</button>
            `;
            if (userActions) {
                userActions.innerHTML = loginButtonsHTML;
                document.getElementById('header-login-btn').addEventListener('click', () => openModal(document.getElementById('loginModal')));
                document.getElementById('header-register-btn').addEventListener('click', () => openModal(document.getElementById('registerModal')));
            }
            if (authContainerSidebar) {
                authContainerSidebar.innerHTML = loginButtonsHTML.replace('header-login-btn', 'sidebar-login-btn').replace('header-register-btn', 'sidebar-register-btn');
                document.getElementById('sidebar-login-btn').addEventListener('click', () => openModal(document.getElementById('loginModal')));
                document.getElementById('sidebar-register-btn').addEventListener('click', () => openModal(document.getElementById('registerModal')));
            }
            if (mobileUserActions) {
                mobileUserActions.innerHTML = `<div class="space-y-2"><button id="mobileLoginButton" class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Login</button><button id="mobileRegisterButton" class="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Register</button></div>`;
                document.getElementById('mobileLoginButton').addEventListener('click', () => openModal(document.getElementById('loginModal')));
                document.getElementById('mobileRegisterButton').addEventListener('click', () => openModal(document.getElementById('registerModal')));
            }
        }
        document.dispatchEvent(new CustomEvent('authReady', { detail: { user } }));
        window.authReady = true;

        document.body.style.transition = 'opacity 0.3s ease-in-out';
        document.body.style.opacity = '1';
    });

    setupGlobalListeners();
    setupCurrencySelector();

    window.addEventListener('click', () => {
        document.getElementById('profile-dropdown')?.classList.add('hidden');
        document.getElementById('notification-dropdown')?.classList.add('hidden');
    });
});

function handleAdminAccess(isAdmin) {
    const currentPage = window.location.pathname.split('/').pop();
    const adminPages = ['admin.html', 'create-article.html', 'edit-article.html'];

    if (adminPages.includes(currentPage) && !isAdmin) {
        console.log('User is not an admin. Redirecting to home.');
        window.location.href = 'index.html';
    }

    const writeArticleBtn = document.getElementById('write-new-article-btn');
    if (writeArticleBtn) {
        writeArticleBtn.classList.toggle('hidden', !isAdmin);
    }
}

async function showTermsModal() {
    const termsModal = document.createElement('div');
    termsModal.id = 'terms-modal';
    termsModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1002]';
    let termsContent = '<p>Loading Terms of Service...</p>';
    let privacyContent = '<p>Loading Privacy Policy...</p>';

    try {
        const termsResponse = await fetch('terms.html');
        termsContent = termsResponse.ok ? await termsResponse.text() : '<p>Could not load Terms of Service.</p>';
        const privacyResponse = await fetch('privacy.html');
        privacyContent = privacyResponse.ok ? await privacyResponse.text() : '<p>Could not load Privacy Policy.</p>';
    } catch (error) {
        console.error('Error fetching legal documents:', error);
        termsContent = '<p>Error loading content. Please try again later.</p>';
        privacyContent = '';
    }

    termsModal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col" style="height: 90vh; max-height: 800px;">
        <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
            <h2 class="text-xl font-bold">Terms of Service and Privacy Policy</h2>
            <button id="close-terms-modal" class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold">&times;</button>
        </div>
        <div id="terms-content" class="p-6 flex-grow overflow-y-auto">
            ${termsContent}
            <hr class="my-8">
            ${privacyContent}
        </div>
        <div class="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div class="flex items-center">
                <input type="checkbox" id="terms-checkbox" disabled class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                <label for="terms-checkbox" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    I have read and agree to the Terms of Service and Privacy Policy.
                </label>
            </div>
            <button id="final-register-btn" disabled class="w-full mt-4 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                Register
            </button>
        </div>
    </div>`;

    document.body.appendChild(termsModal);

    const termsContentEl = termsModal.querySelector('#terms-content');
    const termsCheckbox = termsModal.querySelector('#terms-checkbox');
    const finalRegisterBtn = termsModal.querySelector('#final-register-btn');

    termsContentEl.addEventListener('scroll', () => {
        if (termsContentEl.scrollTop + termsContentEl.clientHeight >= termsContentEl.scrollHeight - 10) {
            termsCheckbox.disabled = false;
        }
    });

    termsCheckbox.addEventListener('change', () => {
        finalRegisterBtn.disabled = !termsCheckbox.checked;
    });

    termsModal.querySelector('#close-terms-modal').addEventListener('click', () => {
        termsModal.remove();
    });

    finalRegisterBtn.addEventListener('click', async () => {
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const errorMessageEl = document.getElementById('register-error-message');

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.sendEmailVerification();
            // Redirect immediately. The verification screen will appear on the app.html page.
            window.location.href = 'app.html';
        } catch (err) {
            if(errorMessageEl) {
                errorMessageEl.textContent = err.message;
                errorMessageEl.classList.remove('hidden');
            } else {
                showToast(err.message, "error");
            }
            termsModal.remove();
        }
    });
}