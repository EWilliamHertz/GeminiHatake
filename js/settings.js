/**
 * HatakeSocial - Settings Page Script
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles all logic for the settings.html page.
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

    // Image previews and inputs
    const profilePicPreview = document.getElementById('profile-pic-preview');
    const profilePicUpload = document.getElementById('profile-pic-upload');
    const bannerPicPreview = document.getElementById('banner-pic-preview');
    const bannerPicUpload = document.getElementById('banner-pic-upload');
    let newProfilePicFile = null;
    let newBannerPicFile = null;

    // Form fields
    const displayNameInput = document.getElementById('displayName');
    const handleInput = document.getElementById('handle');
    const bioInput = document.getElementById('bio');
    const favoriteTcgInput = document.getElementById('favoriteTcg');
    const accountEmailEl = document.getElementById('account-email');
    
    // Buttons
    const resetPasswordBtn = document.getElementById('reset-password-btn');
    const deleteAccountBtn = document.getElementById('delete-account-btn');

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
    };

    // --- Event Listeners ---

    // Image preview listeners
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

    // Form submission
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

            // Upload profile picture if a new one was selected
            if (newProfilePicFile) {
                const filePath = `profile-pictures/${user.uid}/${newProfilePicFile.name}`;
                const fileRef = storage.ref(filePath);
                await fileRef.put(newProfilePicFile);
                updatedData.photoURL = await fileRef.getDownloadURL();
                await user.updateProfile({ photoURL: updatedData.photoURL });
            }

            // Upload banner picture if a new one was selected
            if (newBannerPicFile) {
                const filePath = `banner-pictures/${user.uid}/${newBannerPicFile.name}`;
                const fileRef = storage.ref(filePath);
                await fileRef.put(newBannerPicFile);
                updatedData.bannerURL = await fileRef.getDownloadURL();
            }
            
            // Update user's display name in Firebase Auth
            if (user.displayName !== updatedData.displayName) {
                await user.updateProfile({ displayName: updatedData.displayName });
            }

            // Update user document in Firestore
            await db.collection('users').doc(user.uid).update(updatedData);

            alert("Profile saved successfully!");
            newProfilePicFile = null;
            newBannerPicFile = null;

        } catch (error) {
            console.error("Error saving profile:", error);
            alert("Could not save profile. " + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Profile';
        }
    });

    // Security buttons
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

    // --- Initial Load ---
    loadUserData();
});
