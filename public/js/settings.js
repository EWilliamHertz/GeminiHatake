/**
 * HatakeSocial - Complete Settings Page Script with Currency Integration
 *
 * This script manages all sections of the settings page.
 * It uses a centralized currency module to handle currency preferences,
 * which are saved via a dedicated button in the "Account" section.
 * - FIX: Synchronizes the messenger widget setting between Firestore and localStorage.
 */

// Import the centralized currency module
import { initCurrency, updateUserCurrency, getUserCurrency } from './modules/currency.js';

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const settingsContainer = document.getElementById('settings-page-container');
    if (!settingsContainer) return;

    if (!user) {
        const toast = window.showToast || alert;
        toast("You must be logged in to view settings.");
        window.location.href = 'index.html';
        return;
    }

    const db = firebase.firestore();
    const storage = firebase.storage();
    const auth = firebase.auth();

    // --- Get All DOM Elements ---
    const navButtons = document.querySelectorAll('.settings-nav-btn');
    const sections = document.querySelectorAll('.settings-section');

    // Profile Section
    const profileForm = document.getElementById('profile-settings-form');
    const profilePicPreview = document.getElementById('profile-pic-preview');
    const profilePicUpload = document.getElementById('profile-pic-upload');
    const bannerPicPreview = document.getElementById('banner-pic-preview');
    const bannerPicUpload = document.getElementById('banner-pic-upload');
    let newProfilePicFile = null;
    let newBannerPicFile = null;
    const displayNameInput = document.getElementById('displayName');
    const handleInput = document.getElementById('handle');
    const bioInput = document.getElementById('bio');
    const favoriteTcgInput = document.getElementById('favoriteTcg');
    const playstyleInput = document.getElementById('playstyle');
    const favoriteFormatInput = document.getElementById('favoriteFormat');
    const petCardInput = document.getElementById('petCard');
    const nemesisCardInput = document.getElementById('nemesisCard');
    const streetInput = document.getElementById('address-street');
    const cityInput = document.getElementById('address-city');
    const stateInput = document.getElementById('address-state');
    const zipInput = document.getElementById('address-zip');
    const countryInput = document.getElementById('address-country');

    // Privacy Section
    const profileVisibilitySelect = document.getElementById('profile-visibility-select');
    const collectionVisibilitySelect = document.getElementById('collection-visibility-select');
    const savePrivacyBtn = document.getElementById('save-privacy-btn');

    // Notifications Section
    const emailNotificationsToggle = document.getElementById('email-notifications-toggle');
    const pushNotificationsToggle = document.getElementById('push-notifications-toggle');
    const saveNotificationsBtn = document.getElementById('save-notifications-btn');

    // Payout Section
    const payoutForm = document.getElementById('payout-settings-form');
    const ibanInput = document.getElementById('iban');
    const swiftInput = document.getElementById('swift');
    const clearingInput = document.getElementById('clearing-number');
    const bankAccountInput = document.getElementById('bank-account');

    // Account Section
    const accountEmailEl = document.getElementById('account-email');
    const primaryCurrencySelect = document.getElementById('primary-currency');
    const priceSourceSelect = document.getElementById('price-source-select');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const saveAccountBtn = document.getElementById('save-account-btn');

    // Shipping Section
    const shippingCurrencyDisplay = document.getElementById('shipping-currency-display');
    const shippingDomesticInput = document.getElementById('shippingDomestic');
    const shippingEuropeInput = document.getElementById('shippingEurope');
    const shippingNorthAmericaInput = document.getElementById('shippingNorthAmerica');
    const shippingRestOfWorldInput = document.getElementById('shippingRestOfWorld');
    const saveShippingBtn = document.getElementById('save-shipping-btn');

    // Display Section
    const saveDisplayBtn = document.getElementById('save-display-settings-btn');
    const dateFormatSelect = document.getElementById('date-format-select');
    const messengerWidgetToggle = document.getElementById('messenger-widget-toggle');
    
    // Security Section
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    const mfaSection = document.getElementById('mfa-section');
    let confirmationResult = null;

    // App/PWA Section
    const installAppBtn = document.getElementById('install-app-btn');
    const shareAppBtn = document.getElementById('share-app-btn');
    const installStatus = document.getElementById('install-status');
    const swStatus = document.getElementById('sw-status');
    const offlineStatus = document.getElementById('offline-status');

    // --- Section Switching Logic ---
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = `settings-${button.dataset.section}`;
            navButtons.forEach(btn => {
                btn.classList.remove('bg-blue-100', 'dark:bg-blue-800', 'text-blue-700', 'dark:text-blue-200');
                btn.classList.add('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-200', 'dark:hover:bg-gray-700');
            });
            button.classList.add('bg-blue-100', 'dark:bg-blue-800', 'text-blue-700', 'dark:text-blue-200');
            button.classList.remove('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-200', 'dark:hover:bg-gray-700');
            sections.forEach(section => {
                section.id === sectionId ? section.classList.remove('hidden') : section.classList.add('hidden');
            });
        });
    });

    // --- Load Initial Data ---
    const loadUserData = async () => {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                console.error("User document not found!");
                return;
            }
            const data = userDoc.data();

            // Profile & Address
            displayNameInput.value = data.displayName || '';
            handleInput.value = data.handle || '';
            bioInput.value = data.bio || '';
            favoriteTcgInput.value = data.favoriteTcg || '';
            profilePicPreview.src = data.photoURL || 'https://placehold.co/96x96';
            bannerPicPreview.src = data.bannerURL || 'https://placehold.co/600x200';
            playstyleInput.value = data.playstyle || '';
            favoriteFormatInput.value = data.favoriteFormat || '';
            petCardInput.value = data.petCard || '';
            nemesisCardInput.value = data.nemesisCard || '';
            if (data.address) {
                streetInput.value = data.address.street || '';
                cityInput.value = data.address.city || '';
                stateInput.value = data.address.state || '';
                zipInput.value = data.address.zip || '';
                countryInput.value = data.address.country || '';
            }

            // Privacy
            if (data.privacy) {
                profileVisibilitySelect.value = data.privacy.profileVisibility || 'Public';
                collectionVisibilitySelect.value = data.privacy.collectionVisibility || 'Public';
            }

            // Notifications
            if (data.notifications) {
                emailNotificationsToggle.checked = data.notifications.email === true;
                pushNotificationsToggle.checked = data.notifications.push === true;
            }

            // Payouts
            if (data.payoutDetails) {
                ibanInput.value = data.payoutDetails.iban || '';
                swiftInput.value = data.payoutDetails.swift || '';
                clearingInput.value = data.payoutDetails.clearing || '';
                bankAccountInput.value = data.payoutDetails.bankAccount || '';
            }

            // Account & Display
            accountEmailEl.textContent = user.email;
            if (primaryCurrencySelect) {
                primaryCurrencySelect.value = data.primaryCurrency || getUserCurrency();
            }
            priceSourceSelect.value = data.priceSource || 'eur';
            dateFormatSelect.value = data.dateFormat || 'dmy';
            
            // Messenger Widget Setting
            if (messengerWidgetToggle) {
                // Sync Firestore setting to localStorage, then read from localStorage
                // This ensures consistency for messenger.js which reads from localStorage on page load.
                const isWidgetEnabledInDB = data.messengerWidgetEnabled === true;
                localStorage.setItem('messengerWidgetEnabled', isWidgetEnabledInDB);
                messengerWidgetToggle.checked = isWidgetEnabledInDB;
            }


            // Shipping
            if (data.shippingProfile) {
                shippingDomesticInput.value = data.shippingProfile.domestic || '';
                shippingEuropeInput.value = data.shippingProfile.europe || '';
                shippingNorthAmericaInput.value = data.shippingProfile.northAmerica || '';
                shippingRestOfWorldInput.value = data.shippingProfile.restOfWorld || '';
            }
            // Update the shipping currency display when data loads and on currency change
            const updateShippingCurrency = () => {
                shippingCurrencyDisplay.textContent = getUserCurrency();
            };
            document.addEventListener('currencyChange', updateShippingCurrency);
            updateShippingCurrency();


            loadMfaStatus();

        } catch (error) {
            console.error("Error loading user data:", error);
            (window.showToast || alert)("Failed to load user settings.", "error");
        }
    };

    // --- Helper for File Uploads ---
    const handleFileUpload = (file, path) => {
        const filePath = `${path}/${user.uid}/${Date.now()}_${file.name}`;
        const fileRef = storage.ref(filePath);
        return fileRef.put(file).then(snapshot => snapshot.ref.getDownloadURL());
    };

    // --- Save Logic & Event Listeners ---

    profilePicUpload.addEventListener('change', (e) => {
        newProfilePicFile = e.target.files[0];
        if (newProfilePicFile) {
            const reader = new FileReader();
            reader.onload = (event) => { profilePicPreview.src = event.target.result; };
            reader.readAsDataURL(newProfilePicFile);
        }
    });

    bannerPicUpload.addEventListener('change', (e) => {
        newBannerPicFile = e.target.files[0];
        if (newBannerPicFile) {
            const reader = new FileReader();
            reader.onload = (event) => { bannerPicPreview.src = event.target.result; };
            reader.readAsDataURL(newBannerPicFile);
        }
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-profile-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            const updatedData = {
                displayName: displayNameInput.value.trim(),
                handle: handleInput.value.toLowerCase().trim(),
                bio: bioInput.value.trim(),
                favoriteTcg: favoriteTcgInput.value.trim(),
                playstyle: playstyleInput.value.trim(),
                favoriteFormat: favoriteFormatInput.value.trim(),
                petCard: petCardInput.value.trim(),
                nemesisCard: nemesisCardInput.value.trim(),
                address: {
                    street: streetInput.value.trim(),
                    city: cityInput.value.trim(),
                    state: stateInput.value.trim(),
                    zip: zipInput.value.trim(),
                    country: countryInput.value.trim()
                }
            };

            if (newProfilePicFile) {
                updatedData.photoURL = await handleFileUpload(newProfilePicFile, 'profile-pictures');
                await user.updateProfile({ photoURL: updatedData.photoURL });
            }
            if (newBannerPicFile) {
                updatedData.bannerURL = await handleFileUpload(newBannerPicFile, 'banner-pictures');
            }
            if (user.displayName !== updatedData.displayName) {
                await user.updateProfile({ displayName: updatedData.displayName });
            }

            await db.collection('users').doc(user.uid).set(updatedData, { merge: true });

            (window.showToast || alert)("Profile settings saved successfully!", "success");
            newProfilePicFile = null;
            newBannerPicFile = null;
        } catch (error) {
            console.error("Error saving profile settings:", error);
            (window.showToast || alert)("Could not save profile settings. " + error.message, "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Profile & Address';
        }
    });

    savePrivacyBtn?.addEventListener('click', async () => {
        savePrivacyBtn.disabled = true;
        savePrivacyBtn.textContent = 'Saving...';
        try {
            await db.collection('users').doc(user.uid).set({
                privacy: {
                    profileVisibility: profileVisibilitySelect.value,
                    collectionVisibility: collectionVisibilitySelect.value
                }
            }, { merge: true });
            (window.showToast || alert)('Privacy settings saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving privacy settings:", error);
            (window.showToast || alert)("Could not save privacy settings. " + error.message, "error");
        } finally {
            savePrivacyBtn.disabled = false;
            savePrivacyBtn.textContent = 'Save Privacy Settings';
        }
    });

    saveNotificationsBtn?.addEventListener('click', async () => {
        saveNotificationsBtn.disabled = true;
        saveNotificationsBtn.textContent = 'Saving...';
        try {
            await db.collection('users').doc(user.uid).set({
                notifications: {
                    email: emailNotificationsToggle.checked,
                    push: pushNotificationsToggle.checked
                }
            }, { merge: true });
            (window.showToast || alert)('Notification settings saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving notification settings:", error);
            (window.showToast || alert)("Could not save notification settings. " + error.message, "error");
        } finally {
            saveNotificationsBtn.disabled = false;
            saveNotificationsBtn.textContent = 'Save Notification Settings';
        }
    });

    saveAccountBtn?.addEventListener('click', async () => {
        saveAccountBtn.disabled = true;
        saveAccountBtn.textContent = 'Saving...';
        try {
            const newCurrency = primaryCurrencySelect.value;
            const newPriceSource = priceSourceSelect.value;
            // Use the centralized function to update currency
            await updateUserCurrency(newCurrency); 
            // Update other non-currency fields
            await db.collection('users').doc(user.uid).update({
                priceSource: newPriceSource
            });
            (window.showToast || alert)('Account settings saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving account settings:", error);
            (window.showToast || alert)("Could not save account settings. " + error.message, "error");
        } finally {
            saveAccountBtn.disabled = false;
            saveAccountBtn.textContent = 'Save Changes';
        }
    });
    
    saveDisplayBtn?.addEventListener('click', async () => {
        saveDisplayBtn.disabled = true;
        saveDisplayBtn.textContent = 'Saving...';
        try {
            const isWidgetEnabled = messengerWidgetToggle.checked;
            
            // Save to localStorage for immediate use by messenger.js on next page load
            localStorage.setItem('messengerWidgetEnabled', isWidgetEnabled);
            
            // Save to Firestore for persistence across devices/sessions
            await db.collection('users').doc(user.uid).set({
                dateFormat: dateFormatSelect.value,
                messengerWidgetEnabled: isWidgetEnabled, // Use a consistent key
            }, { merge: true });
            
            (window.showToast || alert)('Display settings saved! Page will reload to apply changes.', 'success');

            // Reload the page to either initialize or destroy the widget
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error("Error saving display settings:", error);
            (window.showToast || alert)("Could not save display settings. " + error.message, "error");
            saveDisplayBtn.disabled = false;
            saveDisplayBtn.textContent = 'Save Display Settings';
        }
    });

    payoutForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-payout-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            await db.collection('users').doc(user.uid).set({
                payoutDetails: {
                    iban: ibanInput.value.trim(),
                    swift: swiftInput.value.trim(),
                    clearing: clearingInput.value.trim(),
                    bankAccount: bankAccountInput.value.trim()
                }
            }, { merge: true });
            (window.showToast || alert)('Payout settings saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving payout settings:", error);
            (window.showToast || alert)("Could not save payout settings. " + error.message, "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Payout Settings';
        }
    });

    saveShippingBtn?.addEventListener('click', async () => {
        saveShippingBtn.disabled = true;
        saveShippingBtn.textContent = 'Saving...';
        try {
            await db.collection('users').doc(user.uid).set({
                shippingProfile: {
                    domestic: parseFloat(shippingDomesticInput.value) || 0,
                    europe: parseFloat(shippingEuropeInput.value) || 0,
                    northAmerica: parseFloat(shippingNorthAmericaInput.value) || 0,
                    restOfWorld: parseFloat(shippingRestOfWorldInput.value) || 0
                }
            }, { merge: true });
            (window.showToast || alert)('Shipping settings saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving shipping settings:", error);
            (window.showToast || alert)("Could not save shipping settings. " + error.message, "error");
        } finally {
            saveShippingBtn.disabled = false;
            saveShippingBtn.textContent = 'Save Shipping Profile';
        }
    });

    resetPasswordBtn?.addEventListener('click', async () => {
        try {
            await auth.sendPasswordResetEmail(user.email);
            (window.showToast || alert)('Password reset email sent!', 'success');
        } catch (error) {
            console.error("Error sending password reset email:", error);
            (window.showToast || alert)("Could not send password reset email. " + error.message, "error");
        }
    });

    deleteAccountBtn?.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
            try {
                // It's good practice to delete user data before deleting the user auth record.
                await db.collection('users').doc(user.uid).delete(); 
                await user.delete();
                (window.showToast || alert)('Account deleted successfully.', 'success');
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Error deleting account:", error);
                (window.showToast || alert)("Could not delete account. You may need to log in again to perform this action. " + error.message, "error");
            }
        }
    });

    // --- PWA Section Functions ---
    const initializePwaSection = () => {
        let deferredPrompt;
        const installedClasses = ['bg-green-100', 'text-green-800', 'dark:bg-green-900', 'dark:text-green-200'];
        const notInstalledClasses = ['bg-yellow-100', 'text-yellow-800', 'dark:bg-yellow-900', 'dark:text-yellow-200'];
        
        const setInstallStatus = (isInstalled) => {
            if (installStatus) {
                installStatus.textContent = isInstalled ? 'Installed' : 'Not Installed';
                installStatus.classList.remove(...installedClasses, ...notInstalledClasses);
                installStatus.classList.add(...(isInstalled ? installedClasses : notInstalledClasses));
            }
            if (installAppBtn) {
                installAppBtn.style.display = isInstalled ? 'none' : 'block';
            }
        };

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        setInstallStatus(isStandalone);

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            setInstallStatus(false);
        });

        installAppBtn?.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    setInstallStatus(true);
                }
                deferredPrompt = null;
            }
        });

        shareAppBtn?.addEventListener('click', async () => {
            const shareData = {
                title: 'HatakeSocial - Ultimate TCG Social Platform',
                text: 'Join the ultimate TCG social platform for Magic, Pokemon, & Yu-Gi-Oh players!',
                url: window.location.origin
            };
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else {
                    throw new Error('Web Share API not supported');
                }
            } catch (err) {
                navigator.clipboard.writeText(shareData.url)
                    .then(() => (window.showToast || alert)('App URL copied to clipboard!', 'success'))
                    .catch(() => prompt('Copy this URL:', shareData.url));
            }
        });

        window.addEventListener('appinstalled', () => setInstallStatus(true));
        
        const activeClasses = ['bg-green-100', 'text-green-800', 'dark:bg-green-900', 'dark:text-green-200'];
        const inactiveClasses = ['bg-yellow-100', 'text-yellow-800', 'dark:bg-yellow-900', 'dark:text-yellow-200'];

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(reg => {
                const active = reg && reg.active;
                if (swStatus) {
                    swStatus.textContent = active ? 'Active' : 'Inactive';
                    swStatus.classList.remove(...activeClasses, ...inactiveClasses);
                    swStatus.classList.add(...(active ? activeClasses : inactiveClasses));
                }
                if (offlineStatus) {
                    offlineStatus.textContent = active ? 'Available' : 'Unavailable';
                    offlineStatus.classList.remove(...activeClasses, ...inactiveClasses);
                    offlineStatus.classList.add(...(active ? activeClasses : inactiveClasses));
                }
            });
        }
    };

    // --- MFA Functions ---
    const loadMfaStatus = () => {
        const mfaEnabled = user.multiFactor && user.multiFactor.enrolledFactors.length > 0;
        if (mfaEnabled) {
            mfaSection.innerHTML = `
                <p class="text-green-600 dark:text-green-400 font-semibold">Multi-Factor Authentication is enabled.</p>
                <button id="disable-mfa-btn" class="mt-4 px-4 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700">Disable MFA</button>
            `;
            document.getElementById('disable-mfa-btn').addEventListener('click', disableMfa);
        } else {
            mfaSection.innerHTML = `
                <p class="text-gray-600 dark:text-gray-400">Add an extra layer of security to your account.</p>
                <div class="mt-4 space-y-2">
                    <input type="tel" id="phone-number-input" class="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 dark:bg-gray-700" placeholder="Enter phone number (e.g., +16505551234)">
                    <div id="recaptcha-container"></div>
                    <button id="send-verification-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Send Verification Code</button>
                </div>
                <div id="mfa-verification-step" class="hidden mt-4 space-y-2">
                    <input type="text" id="mfa-code-input" class="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 dark:bg-gray-700" placeholder="Enter 6-digit code">
                    <button id="verify-mfa-btn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700">Verify & Enable</button>
                </div>
            `;
            setupMfaEventListeners();
        }
    };

    const setupMfaEventListeners = () => {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { 'size': 'invisible' });
        document.getElementById('send-verification-btn').addEventListener('click', async () => {
            const phoneNumber = document.getElementById('phone-number-input').value;
            if (!phoneNumber) { (window.showToast || alert)("Please enter a phone number.", "error"); return; }
            const sendBtn = document.getElementById('send-verification-btn');
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
            try {
                const phoneProvider = new firebase.auth.PhoneAuthProvider();
                confirmationResult = await phoneProvider.verifyPhoneNumber(phoneNumber, window.recaptchaVerifier);
                (window.showToast || alert)("Verification code sent!", "success");
                document.getElementById('mfa-verification-step').classList.remove('hidden');
            } catch (error) {
                console.error("Error sending verification code:", error);
                (window.showToast || alert)("Error sending code: " + error.message, "error");
            } finally {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send Verification Code';
            }
        });
        document.getElementById('verify-mfa-btn').addEventListener('click', async () => {
            const code = document.getElementById('mfa-code-input').value;
            if (!code) { (window.showToast || alert)("Please enter the verification code.", "error"); return; }
            try {
                const cred = firebase.auth.PhoneAuthProvider.credential(confirmationResult.verificationId, code);
                const multiFactorAssertion = firebase.auth.PhoneMultiFactorGenerator.assertion(cred);
                await user.multiFactor.enroll(multiFactorAssertion, "My Phone");
                (window.showToast || alert)("MFA enabled successfully!", "success");
                loadMfaStatus();
            } catch (error) {
                console.error("Error verifying MFA code:", error);
                (window.showToast || alert)("Error verifying code: " + error.message, "error");
            }
        });
    };

    const disableMfa = async () => {
        if (confirm("Are you sure you want to disable Multi-Factor Authentication?")) {
            try {
                // Assuming the first factor is the one to unenroll
                const phoneFactor = user.multiFactor.enrolledFactors[0]; 
                await user.multiFactor.unenroll(phoneFactor);
                (window.showToast || alert)("MFA has been disabled.", "success");
                loadMfaStatus();
            } catch (error) {
                console.error("Error disabling MFA:", error);
                (window.showToast || alert)("Could not disable MFA. " + error.message, "error");
            }
        }
    };

    // --- Initialize Page ---
    loadUserData();
    initializePwaSection();
});