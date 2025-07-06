/**
 * HatakeSocial - Settings Page Script (v3 - Multi-Factor Authentication)
 *
 * This version adds the full UI and logic for enabling and disabling
 * multi-factor authentication via phone number.
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
    const accountEmailEl = document.getElementById('account-email');
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    const deleteAccountBtn = document.getElementById('delete-account-btn');
    const mfaSection = document.getElementById('mfa-section');
    let confirmationResult = null;

    // --- Tab Switching Logic ---
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = `settings-${button.dataset.section}`;
            navButtons.forEach(btn => {
                btn.classList.remove('bg-blue-100', 'text-blue-700');
                btn.classList.add('text-gray-600', 'hover:bg-gray-200');
            });
            button.classList.add('bg-blue-100', 'text-blue-700');
            button.classList.remove('text-gray-600', 'hover:bg-gray-200');
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
            displayNameInput.value = data.displayName || '';
            handleInput.value = data.handle || '';
            bioInput.value = data.bio || '';
            favoriteTcgInput.value = data.favoriteTcg || '';
            profilePicPreview.src = data.photoURL || 'https://placehold.co/96x96';
            bannerPicPreview.src = data.bannerURL || 'https://placehold.co/600x200';
            accountEmailEl.textContent = user.email;
        }
        loadMfaStatus();
    };

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
                <p class="text-gray-600">Add an extra layer of security to your account.</p>
                <div class="mt-4 space-y-2">
                    <input type="tel" id="phone-number-input" class="block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Enter phone number (e.g., +16505551234)">
                    <div id="recaptcha-container"></div>
                    <button id="send-verification-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Send Verification Code</button>
                </div>
                <div id="mfa-verification-step" class="hidden mt-4 space-y-2">
                    <input type="text" id="mfa-code-input" class="block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Enter 6-digit code">
                    <button id="verify-mfa-btn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700">Verify & Enable</button>
                </div>
            `;
            setupMfaEventListeners();
        }
    };

    const setupMfaEventListeners = () => {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
          'size': 'invisible'
        });

        document.getElementById('send-verification-btn').addEventListener('click', async () => {
            const phoneNumber = document.getElementById('phone-number-input').value;
            if (!phoneNumber) {
                alert("Please enter a phone number.");
                return;
            }
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
            if (!code) {
                alert("Please enter the verification code.");
                return;
            }
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


    // --- Event Listeners ---
    profilePicUpload.addEventListener('change', (e) => {
        newProfilePicFile = e.target.files[0];
        if (newProfilePicFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                profilePicPreview.src = event.target.result;
            };
            reader.readAsDataURL(newProfilePicFile);
        }
    });

    bannerPicUpload.addEventListener('change', (e) => {
        newBannerPicFile = e.target.files[0];
        if (newBannerPicFile) {
            const reader = new FileReader();
            reader.onload = (event) => {
                bannerPicPreview.src = event.target.result;
            };
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
                displayName: displayNameInput.value,
                handle: handleInput.value.toLowerCase(),
                bio: bioInput.value,
                favoriteTcg: favoriteTcgInput.value,
            };

            // **FIXED LOGIC**: Await the upload and URL retrieval correctly
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

            alert("Profile saved successfully!");
            newProfilePicFile = null;
            newBannerPicFile = null;

        } catch (error) {
            console.error("Error saving profile:", error);
            alert("Could not save profile. " + error.message);
        } finally {
            // **FIXED LOGIC**: This now runs reliably
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Profile';
        }
    });

    resetPasswordBtn.addEventListener('click', () => {
        auth.sendPasswordResetEmail(user.email)
            .then(() => {
                alert("Password reset email sent! Please check your inbox.");
            })
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
                alert("Could not delete account. You may need to log in again to perform this action. " + error.message);
            });
        } else {
            alert("Deletion cancelled.");
        }
    });

    loadUserData();
});
