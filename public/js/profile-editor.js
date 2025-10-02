/**
 * Profile Editor for HatakeSocial
 * Handles profile editing including gaming platform accounts
 */

class ProfileEditor {
    constructor(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
        this.profileData = null;
        this.init();
    }

    init() {
        this.createEditModal();
        this.setupEventListeners();
    }

    createEditModal() {
        const modalHTML = `
            <div id="edit-profile-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Edit Profile</h2>
                            <button id="close-edit-modal" class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold">×</button>
                        </div>
                        
                        <form id="profile-edit-form" class="space-y-6">
                            <!-- Basic Information -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Display Name</label>
                                    <input type="text" id="edit-display-name" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your display name">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Handle</label>
                                    <input type="text" id="edit-handle" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="username">
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Bio</label>
                                <textarea id="edit-bio" rows="3" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tell us about yourself..."></textarea>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">City</label>
                                    <input type="text" id="edit-city" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your city">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Country</label>
                                    <input type="text" id="edit-country" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your country">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Favorite TCG</label>
                                    <select id="edit-favorite-tcg" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="">Select a TCG</option>
                                        <option value="Magic: The Gathering">Magic: The Gathering</option>
                                        <option value="Pokémon">Pokémon</option>
                                        <option value="Yu-Gi-Oh!">Yu-Gi-Oh!</option>
                                        <option value="Lorcana">Lorcana</option>
                                        <option value="One Piece">One Piece</option>
                                        <option value="Flesh and Blood">Flesh and Blood</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Gaming Platform Accounts -->
                            <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Gaming Platform Accounts</h3>
                                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Connect your gaming accounts to help other players find and play with you.</p>
                                
                                <!-- Magic: The Gathering Platforms -->
                                <div class="mb-6">
                                    <h4 class="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                        <i class="fas fa-magic text-purple-600 mr-2"></i>
                                        Magic: The Gathering
                                    </h4>
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Magic Arena</label>
                                            <input type="text" id="edit-mtg-arena" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="YourArenaName#12345">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Magic Online (MTGO)</label>
                                            <input type="text" id="edit-mtgo" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="YourMTGOUsername">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Untap.in</label>
                                            <input type="text" id="edit-untap" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="YourUntapUsername">
                                        </div>
                                    </div>
                                </div>

                                <!-- Pokémon Platforms -->
                                <div class="mb-6">
                                    <h4 class="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                        <i class="fas fa-bolt text-yellow-500 mr-2"></i>
                                        Pokémon
                                    </h4>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Pokémon TCG Online</label>
                                            <input type="text" id="edit-ptcgo" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="YourPTCGOUsername">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Pokémon TCG Live</label>
                                            <input type="text" id="edit-ptcg-live" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="YourTCGLiveUsername">
                                        </div>
                                    </div>
                                </div>

                                <!-- Yu-Gi-Oh! Platforms -->
                                <div class="mb-6">
                                    <h4 class="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                        <i class="fas fa-eye text-blue-600 mr-2"></i>
                                        Yu-Gi-Oh!
                                    </h4>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Yu-Gi-Oh! Master Duel</label>
                                            <input type="text" id="edit-master-duel" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="YourMasterDuelID">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Dueling Book</label>
                                            <input type="text" id="edit-dueling-book" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="YourDuelingBookUsername">
                                        </div>
                                    </div>
                                </div>

                                <!-- Other Platforms -->
                                <div class="mb-6">
                                    <h4 class="text-md font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                        <i class="fas fa-gamepad text-green-600 mr-2"></i>
                                        Other Platforms
                                    </h4>
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Tabletop Simulator</label>
                                            <input type="text" id="edit-tabletop-sim" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Steam Profile Name">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Cockatrice</label>
                                            <input type="text" id="edit-cockatrice" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="YourCockatriceUsername">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Discord</label>
                                            <input type="text" id="edit-discord" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="username#1234">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Privacy Settings -->
                            <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">Privacy Settings</h3>
                                <div class="space-y-3">
                                    <label class="flex items-center">
                                        <input type="checkbox" id="edit-show-collection" class="mr-3 rounded">
                                        <span class="text-gray-700 dark:text-gray-300">Show my collection publicly</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="edit-show-decks" class="mr-3 rounded">
                                        <span class="text-gray-700 dark:text-gray-300">Show my decks publicly</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="edit-show-trades" class="mr-3 rounded">
                                        <span class="text-gray-700 dark:text-gray-300">Show my trade history publicly</span>
                                    </label>
                                    <label class="flex items-center">
                                        <input type="checkbox" id="edit-show-gaming-accounts" class="mr-3 rounded">
                                        <span class="text-gray-700 dark:text-gray-300">Show my gaming accounts publicly</span>
                                    </label>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <button type="button" id="cancel-edit" class="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                                    Cancel
                                </button>
                                <button type="submit" class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    setupEventListeners() {
        const modal = document.getElementById('edit-profile-modal');
        const closeBtn = document.getElementById('close-edit-modal');
        const cancelBtn = document.getElementById('cancel-edit');
        const form = document.getElementById('profile-edit-form');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Close modal when clicking outside
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
    }

    async openModal(profileData) {
        this.profileData = profileData;
        await this.populateForm();
        document.getElementById('edit-profile-modal').classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('edit-profile-modal').classList.add('hidden');
    }

    async populateForm() {
        if (!this.profileData) return;

        // Basic information
        document.getElementById('edit-display-name').value = this.profileData.displayName || '';
        document.getElementById('edit-handle').value = this.profileData.handle || '';
        document.getElementById('edit-bio').value = this.profileData.bio || '';
        document.getElementById('edit-city').value = this.profileData.city || '';
        document.getElementById('edit-country').value = this.profileData.country || '';
        document.getElementById('edit-favorite-tcg').value = this.profileData.favoriteTcg || '';

        // Gaming accounts
        const gamingAccounts = this.profileData.gamingAccounts || {};
        document.getElementById('edit-mtg-arena').value = gamingAccounts.mtgArena || '';
        document.getElementById('edit-mtgo').value = gamingAccounts.mtgo || '';
        document.getElementById('edit-untap').value = gamingAccounts.untap || '';
        document.getElementById('edit-ptcgo').value = gamingAccounts.ptcgo || '';
        document.getElementById('edit-ptcg-live').value = gamingAccounts.ptcgLive || '';
        document.getElementById('edit-master-duel').value = gamingAccounts.masterDuel || '';
        document.getElementById('edit-dueling-book').value = gamingAccounts.duelingBook || '';
        document.getElementById('edit-tabletop-sim').value = gamingAccounts.tabletopSim || '';
        document.getElementById('edit-cockatrice').value = gamingAccounts.cockatrice || '';
        document.getElementById('edit-discord').value = gamingAccounts.discord || '';

        // Privacy settings
        const privacy = this.profileData.privacy || {};
        document.getElementById('edit-show-collection').checked = privacy.showCollection !== false;
        document.getElementById('edit-show-decks').checked = privacy.showDecks !== false;
        document.getElementById('edit-show-trades').checked = privacy.showTrades !== false;
        document.getElementById('edit-show-gaming-accounts').checked = privacy.showGamingAccounts !== false;
    }

    async handleSubmit(e) {
        e.preventDefault();

        try {
            const formData = new FormData(e.target);
            
            // Collect gaming accounts
            const gamingAccounts = {
                mtgArena: document.getElementById('edit-mtg-arena').value.trim(),
                mtgo: document.getElementById('edit-mtgo').value.trim(),
                untap: document.getElementById('edit-untap').value.trim(),
                ptcgo: document.getElementById('edit-ptcgo').value.trim(),
                ptcgLive: document.getElementById('edit-ptcg-live').value.trim(),
                masterDuel: document.getElementById('edit-master-duel').value.trim(),
                duelingBook: document.getElementById('edit-dueling-book').value.trim(),
                tabletopSim: document.getElementById('edit-tabletop-sim').value.trim(),
                cockatrice: document.getElementById('edit-cockatrice').value.trim(),
                discord: document.getElementById('edit-discord').value.trim()
            };

            // Remove empty accounts
            Object.keys(gamingAccounts).forEach(key => {
                if (!gamingAccounts[key]) {
                    delete gamingAccounts[key];
                }
            });

            // Collect privacy settings
            const privacy = {
                showCollection: document.getElementById('edit-show-collection').checked,
                showDecks: document.getElementById('edit-show-decks').checked,
                showTrades: document.getElementById('edit-show-trades').checked,
                showGamingAccounts: document.getElementById('edit-show-gaming-accounts').checked
            };

            // Prepare update data
            const updateData = {
                displayName: document.getElementById('edit-display-name').value.trim(),
                handle: document.getElementById('edit-handle').value.trim(),
                bio: document.getElementById('edit-bio').value.trim(),
                city: document.getElementById('edit-city').value.trim(),
                country: document.getElementById('edit-country').value.trim(),
                favoriteTcg: document.getElementById('edit-favorite-tcg').value,
                gamingAccounts: gamingAccounts,
                privacy: privacy,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Update user profile
            await this.db.collection('users').doc(this.currentUser.uid).update(updateData);

            // Show success message
            this.showToast('Profile updated successfully!', 'success');
            
            // Close modal
            this.closeModal();

            // Refresh the profile display
            if (window.enhancedProfileManager) {
                window.enhancedProfileManager.loadProfileData();
            }

        } catch (error) {
            console.error('Error updating profile:', error);
            this.showToast('Failed to update profile. Please try again.', 'error');
        }
    }

    showToast(message, type = 'info') {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white ${
            type === 'success' ? 'bg-green-600' : 
            type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        }`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize when DOM is loaded and user is authenticated
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const db = firebase.firestore();
    
    if (currentUser && document.getElementById('enhanced-profile-container')) {
        window.profileEditor = new ProfileEditor(db, currentUser);
    }
});
