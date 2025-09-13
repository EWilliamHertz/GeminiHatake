/**
 * HatakeSocial - Merged Settings Page Script
 *
 * Combines all settings functionalities into a single file:
 * - Profile, Payouts, Account, Shipping, Security, Display settings.
 * - NEW: Privacy settings (Profile & Collection visibility).
 * - NEW: Notification settings (Email & Push toggles).
 * - NEW: App/PWA installation, sharing, and status display.
 * - Uses a left-side navigation menu to switch between sections.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const settingsContainer = document.getElementById('settings-page-container');
    if (!settingsContainer) return;

    if (!user) {
        alert("You must be logged in to view settings.");
        window.location.href = 'index.html';
        return;
    }

    // --- Get DOM Elements ---
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

    // Privacy Section (New)
    const profileVisibilitySelect = document.getElementById('profile-visibility-select');
    const collectionVisibilitySelect = document.getElementById('collection-visibility-select');
    const savePrivacyBtn = document.getElementById('save-privacy-btn');

    // Notifications Section (New)
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
    const primaryCurrencySelect = document.getElementById('primaryCurrency');
    const priceSourceSelect = document.getElementById('price-source-select');
    const deleteAccountBtn = document.getElementById('delete-account-btn');

    // Shipping Section
    const shippingCurrencyDisplay = document.getElementById('shipping-currency-display');
    const shippingDomesticInput = document.getElementById('shippingDomestic');
    const shippingEuropeInput = document.getElementById('shippingEurope');
    const shippingNorthAmericaInput = document.getElementById('shippingNorthAmerica');
    const shippingRestOfWorldInput = document.getElementById('shippingRestOfWorld');

    // Security Section
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    const mfaSection = document.getElementById('mfa-section');
    let confirmationResult = null;

    // Display Section
    const dateFormatSelect = document.getElementById('date-format-select');
    const messengerWidgetToggle = document.getElementById('messenger-widget-toggle');

    // App/PWA Section (New)
    const installAppBtn = document.getElementById('install-app-btn');
    const shareAppBtn = document.getElementById('share-app-btn');
    const installStatus = document.getElementById('install-status');
    const swStatus = document.getElementById('sw-status');
    const offlineStatus = document.getElementById('offline-status');


    // --- Section Switching Logic ---
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = `settings-${button.dataset.section}`;

            // Update button styles
            navButtons.forEach(btn => {
                btn.classList.remove('bg-blue-100', 'dark:bg-blue-800', 'text-blue-700', 'dark:text-blue-200');
                btn.classList.add('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-200', 'dark:hover:bg-gray-700');
            });
            button.classList.add('bg-blue-100', 'dark:bg-blue-800', 'text-blue-700', 'dark:text-blue-200');
            button.classList.remove('text-gray-600', 'dark:text-gray-300', 'hover:bg-gray-200', 'dark:hover:bg-gray-700');

            // Show/Hide content sections
            sections.forEach(section => {
                section.id === sectionId ? section.classList.remove('hidden') : section.classList.add('hidden');
            });
        });
    });

    // --- Load Initial Data ---
    const loadUserData = async () => {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
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
            primaryCurrencySelect.value = data.primaryCurrency || 'SEK';
            priceSourceSelect.value = data.priceSource || 'eur';
            dateFormatSelect.value = data.dateFormat || 'dmy';
            if (messengerWidgetToggle) {
                messengerWidgetToggle.checked = data.messengerWidgetVisible !== false; // Default to true
            }

            // Shipping
            if (data.shippingProfile) {
                shippingDomesticInput.value = data.shippingProfile.domestic || '';
                shippingEuropeInput.value = data.shippingProfile.europe || '';
                shippingNorthAmericaInput.value = data.shippingProfile.northAmerica || '';
                shippingRestOfWorldInput.value = data.shippingProfile.restOfWorld || '';
            }
            shippingCurrencyDisplay.textContent = primaryCurrencySelect.value;
        }
        loadMfaStatus();
    };

    // --- Save Logic & Event Listeners ---

    // Profile & Address Save
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-profile-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            const updatedData = {
                displayName: displayNameInput.value,
                handle: handleInput.value.toLowerCase(),
                bio: bioInput.value,
                favoriteTcg: favoriteTcgInput.value,
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
                },
            };
            if (newProfilePicFile) {
                const filePath = `profile-pictures/${user.uid}/${Date.now()}_${newProfilePicFile.name}`;
                const fileRef = storage.ref(filePath);
                const uploadTask = await fileRef.put(newProfilePicFile);
                updatedData.photoURL = await uploadTask.ref.getDownloadURL();
                await user.updateProfile({ photoURL: updatedData.photoURL });
            }
            if (newBannerPicFile) {
                const filePath = `banner-pictures/${user.uid}/${Date.now()}_${newBannerPicFile.name}`;
                const fileRef = storage.ref(filePath);
                const uploadTask = await fileRef.put(newBannerPicFile);
                updatedData.bannerURL = await uploadTask.ref.getDownloadURL();
            }
            if (user.displayName !== updatedData.displayName) {
                await user.updateProfile({ displayName: updatedData.displayName });
            }
            await db.collection('users').doc(user.uid).update(updatedData);
            alert("Profile settings saved successfully!");
            newProfilePicFile = null;
            newBannerPicFile = null;
        } catch (error) {
            console.error("Error saving profile settings:", error);
            alert("Could not save profile settings. " + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Profile & Address';
        }
    });

    // Privacy Save
    savePrivacyBtn?.addEventListener('click', async () => {
        savePrivacyBtn.disabled = true;
        savePrivacyBtn.textContent = 'Saving...';
        try {
            await db.collection('users').doc(user.uid).update({
                'privacy.profileVisibility': profileVisibilitySelect.value,
                'privacy.collectionVisibility': collectionVisibilitySelect.value
            });
            alert('Privacy settings saved successfully!');
        } catch (error) {
            console.error("Error saving privacy settings:", error);
            alert("Could not save privacy settings. " + error.message);
        } finally {
            savePrivacyBtn.disabled = false;
            savePrivacyBtn.textContent = 'Save Privacy Settings';
        }
    });

    // Notifications Save
    saveNotificationsBtn?.addEventListener('click', async () => {
        saveNotificationsBtn.disabled = true;
        saveNotificationsBtn.textContent = 'Saving...';
        try {
            await db.collection('users').doc(user.uid).update({
                'notifications.email': emailNotificationsToggle.checked,
                'notifications.push': pushNotificationsToggle.checked
            });
            alert('Notification settings saved successfully!');
        } catch (error) {
            console.error("Error saving notification settings:", error);
            alert("Could not save notification settings. " + error.message);
        } finally {
            saveNotificationsBtn.disabled = false;
            saveNotificationsBtn.textContent = 'Save Notification Settings';
        }
    });

    // Display Save
    document.getElementById('save-display-settings-btn')?.addEventListener('click', async () => {
        const saveBtn = document.getElementById('save-display-settings-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            const newDateFormat = dateFormatSelect.value;
            const isMessengerVisible = messengerWidgetToggle ? messengerWidgetToggle.checked : true;
            await db.collection('users').doc(user.uid).update({
                dateFormat: newDateFormat,
                messengerWidgetVisible: isMessengerVisible
            });
            localStorage.setItem('userDateFormat', newDateFormat);
            localStorage.setItem('messengerWidget-visible', isMessengerVisible);
            if (isMessengerVisible) {
                if (typeof window.initializeMessengerWidget === 'function' && !document.getElementById('messenger-widget-container')) {
                    window.initializeMessengerWidget({ detail: { user } });
                }
            } else {
                if (typeof window.destroyMessengerWidget === 'function') {
                    window.destroyMessengerWidget();
                }
            }
            alert("Display settings saved successfully!");
        } catch (error) {
            console.error("Error saving display settings:", error);
            alert("Could not save display settings. " + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Display Settings';
        }
    });

    // Payout Save
    payoutForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('save-payout-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            const payoutData = {
                payoutDetails: {
                    iban: ibanInput.value.trim(),
                    swift: swiftInput.value.trim(),
                    clearing: clearingInput.value.trim(),
                    bankAccount: bankAccountInput.value.trim()
                }
            };
            await db.collection('users').doc(user.uid).update(payoutData);
            alert("Payout settings saved successfully!");
        } catch (error) {
            console.error("Error saving payout settings:", error);
            alert("Could not save payout settings. " + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Payout Settings';
        }
    });

    // Other Listeners
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
    primaryCurrencySelect.addEventListener('change', () => {
        shippingCurrencyDisplay.textContent = primaryCurrencySelect.value;
    });
    resetPasswordBtn.addEventListener('click', () => {
        auth.sendPasswordResetEmail(user.email)
            .then(() => { alert("Password reset email sent! Please check your inbox."); })
            .catch((error) => {
                console.error("Error sending password reset email:", error);
                alert("Could not send password reset email. " + error.message);
            });
    });
    deleteAccountBtn.addEventListener('click', () => {
        const confirmation = prompt("This is a permanent action. To confirm, please type 'DELETE' in all caps.");
        if (confirmation === 'DELETE') {
            user.delete().then(() => {
                alert("Account deleted successfully.");
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error("Error deleting account:", error);
                alert("Could not delete account. You may need to log in again. " + error.message);
            });
        } else {
            alert("Deletion cancelled.");
        }
    });

    // --- PWA / App Section Logic ---
    const initializePwaSection = () => {
        let deferredPrompt;

        const setInstallStatus = (installed) => {
            if (installed) {
                installStatus.textContent = 'Installed';
                installStatus.className = 'px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
                installAppBtn.textContent = 'Already Installed';
                installAppBtn.disabled = true;
                installAppBtn.className = 'bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold cursor-not-allowed';
            } else {
                 installStatus.textContent = 'Not Installed';
                 installStatus.className = 'px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
            }
        };

        setInstallStatus(localStorage.getItem('pwa-installed') === 'true' || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches));
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installAppBtn.style.display = 'block';
        });

        installAppBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    localStorage.setItem('pwa-installed', 'true');
                    setInstallStatus(true);
                }
                deferredPrompt = null;
            } else {
                alert('Installation is not available. Please follow the instructions for your browser.');
            }
        });

        shareAppBtn.addEventListener('click', async () => {
            const shareData = {
                title: 'HatakeSocial - Ultimate TCG Social Platform',
                text: 'Join the ultimate TCG social platform for Magic, Pokemon, & Yu-Gi-Oh players!',
                url: window.location.origin
            };
            try {
                if (navigator.share) {
                    await navigator.share(shareData);
                } else {
                    throw new Error('Share API not supported');
                }
            } catch (err) {
                navigator.clipboard.writeText(shareData.url).then(() => {
                    alert('App URL copied to clipboard!');
                }).catch(() => {
                    prompt('Copy this URL to share the app:', shareData.url);
                });
            }
        });

        window.addEventListener('appinstalled', () => {
            localStorage.setItem('pwa-installed', 'true');
            setInstallStatus(true);
        });

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then(registration => {
                if (registration && registration.active) {
                    swStatus.textContent = 'Active';
                    swStatus.className = 'px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
                    offlineStatus.textContent = 'Available';
                    offlineStatus.className = 'px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
                } else {
                    swStatus.textContent = 'Inactive';
                    swStatus.className = 'px-3 py-1 rounded-full text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
                    offlineStatus.textContent = 'Unavailable';
                    offlineStatus.className = 'px-3 py-1 rounded-full text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
                }
            });
        }
    };
    
    // --- MFA Functions ---
    const loadMfaStatus = () => {
        const mfaEnabled = user.multiFactor.enrolledFactors.length > 0;
        if (mfaEnabled) {
            mfaSection.innerHTML = `
                <p class="text-green-600 font-semibold">Multi-Factor Authentication is enabled.</p>
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
            if (!phoneNumber) { alert("Please enter a phone number."); return; }
            try {
                const phoneProvider = new firebase.auth.PhoneAuthProvider();
                confirmationResult = await phoneProvider.verifyPhoneNumber(phoneNumber, window.recaptchaVerifier);
                alert("Verification code sent!");
                document.getElementById('mfa-verification-step').classList.remove('hidden');
            } catch (error) {
                console.error("Error sending verification code:", error);
                alert("Error sending code: " + error.message);
            }
        });
        document.getElementById('verify-mfa-btn').addEventListener('click', async () => {
            const code = document.getElementById('mfa-code-input').value;
            if (!code) { alert("Please enter the verification code."); return; }
            try {
                const cred = firebase.auth.PhoneAuthProvider.credential(confirmationResult.verificationId, code);
                await user.multiFactor.enroll(cred, "My Phone");
                alert("MFA enabled successfully!");
                loadMfaStatus();
            } catch (error) {
                console.error("Error verifying MFA code:", error);
                alert("Error verifying code: " + error.message);
            }
        });
    };
    const disableMfa = async () => {
        if (confirm("Are you sure you want to disable Multi-Factor Authentication?")) {
            try {
                await user.multiFactor.unenroll(user.multiFactor.enrolledFactors[0].uid);
                alert("MFA has been disabled.");
                loadMfaStatus();
            } catch (error) {
                console.error("Error disabling MFA:", error);
                alert("Could not disable MFA. " + error.message);
            }
        }
    };

    // --- Initialize Page ---
    loadUserData();
    initializePwaSection();
});