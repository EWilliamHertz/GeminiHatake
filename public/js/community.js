/**
 * Enhanced Groups System for HatakeSocial
 * Implements improved group creation, search, and management features
 */

class EnhancedGroupsManager {
    constructor(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
        this.groupSearchTimeout = null;
        this.init();
    }

    init() {
        this.setupGroupSearch();
        this.setupEnhancedGroupCreation();
        this.setupGroupFilters();
        this.loadEnhancedGroupsList();
    }

    setupGroupSearch() {
        const searchInput = document.getElementById('group-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.groupSearchTimeout);
            this.groupSearchTimeout = setTimeout(() => {
                this.searchGroups(e.target.value);
            }, 300);
        });
    }

    async searchGroups(searchTerm) {
        const resultsContainer = document.getElementById('group-search-results');
        if (!resultsContainer) return;

        if (searchTerm.length < 2) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden');
            return;
        }

        try {
            // Search by name (case-insensitive)
            const nameQuery = this.db.collection('groups')
                .where('isPublic', '==', true)
                .orderBy('name')
                .startAt(searchTerm.toLowerCase())
                .endAt(searchTerm.toLowerCase() + '\uf8ff')
                .limit(10);

            // Search by tags
            const tagQuery = this.db.collection('groups')
                .where('isPublic', '==', true)
                .where('tags', 'array-contains-any', [searchTerm.toLowerCase()])
                .limit(10);

            const [nameResults, tagResults] = await Promise.all([
                nameQuery.get(),
                tagQuery.get()
            ]);

            const allResults = new Map();
            
            nameResults.forEach(doc => {
                allResults.set(doc.id, { id: doc.id, ...doc.data() });
            });

            tagResults.forEach(doc => {
                allResults.set(doc.id, { id: doc.id, ...doc.data() });
            });

            this.displaySearchResults(Array.from(allResults.values()));
        } catch (error) {
            console.error('Error searching groups:', error);
            resultsContainer.innerHTML = '<p class="text-red-500 p-2">Search error occurred</p>';
        }
    }

    displaySearchResults(groups) {
        const resultsContainer = document.getElementById('group-search-results');
        if (!resultsContainer) return;

        if (groups.length === 0) {
            resultsContainer.innerHTML = '<p class="text-gray-500 p-2">No groups found</p>';
            resultsContainer.classList.remove('hidden');
            return;
        }

        resultsContainer.innerHTML = groups.map(group => `
            <div class="group-search-result p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600" 
                 data-group-id="${group.id}">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="font-semibold text-gray-800 dark:text-white">${group.name}</h4>
                        <p class="text-sm text-gray-600 dark:text-gray-400">${group.description || 'No description'}</p>
                        <div class="flex items-center mt-1 space-x-2">
                            <span class="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                ${group.participantCount || 0} members
                            </span>
                            ${group.category ? `<span class="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">${group.category}</span>` : ''}
                        </div>
                    </div>
                    <button class="join-group-btn bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                            data-group-id="${group.id}">
                        ${group.participants && group.participants.includes(this.currentUser?.uid) ? 'View' : 'Join'}
                    </button>
                </div>
            </div>
        `).join('');

        resultsContainer.classList.remove('hidden');

        // Add event listeners
        resultsContainer.querySelectorAll('.group-search-result').forEach(result => {
            result.addEventListener('click', (e) => {
                if (!e.target.classList.contains('join-group-btn')) {
                    this.viewGroupDetails(result.dataset.groupId);
                }
            });
        });

        resultsContainer.querySelectorAll('.join-group-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleGroupJoin(btn.dataset.groupId);
            });
        });
    }

    setupEnhancedGroupCreation() {
        const createGroupForm = document.getElementById('enhanced-create-group-form');
        if (!createGroupForm) return;

        createGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createEnhancedGroup(new FormData(createGroupForm));
        });

        // Setup tag input
        this.setupTagInput();
    }

    setupTagInput() {
        const tagInput = document.getElementById('group-tags-input');
        const tagsContainer = document.getElementById('selected-tags');
        if (!tagInput || !tagsContainer) return;

        let selectedTags = [];

        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const tag = tagInput.value.trim().toLowerCase();
                if (tag && !selectedTags.includes(tag) && selectedTags.length < 5) {
                    selectedTags.push(tag);
                    this.renderTags(selectedTags, tagsContainer);
                    tagInput.value = '';
                }
            }
        });

        this.renderTags = (tags, container) => {
            container.innerHTML = tags.map(tag => `
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    ${tag}
                    <button type="button" class="ml-1 text-blue-600 hover:text-blue-800" onclick="this.parentElement.remove(); selectedTags = selectedTags.filter(t => t !== '${tag}')">
                        ×
                    </button>
                </span>
            `).join('');
            
            // Update hidden input
            const hiddenInput = document.getElementById('group-tags-hidden');
            if (hiddenInput) {
                hiddenInput.value = JSON.stringify(tags);
            }
        };
    }

    async createEnhancedGroup(formData) {
        if (!this.currentUser) {
            alert('Please log in to create a group');
            return;
        }

        const submitBtn = document.querySelector('#enhanced-create-group-form button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;

        try {
            const tags = JSON.parse(formData.get('tags') || '[]');
            
            const groupData = {
                name: formData.get('name'),
                description: formData.get('description'),
                category: formData.get('category'),
                isPublic: formData.get('visibility') === 'public',
                creatorId: this.currentUser.uid,
                participants: [this.currentUser.uid],
                moderators: [this.currentUser.uid],
                participantCount: 1,
                participantInfo: {
                    [this.currentUser.uid]: {
                        displayName: this.currentUser.displayName,
                        photoURL: this.currentUser.photoURL,
                        role: 'creator',
                        joinedAt: new Date()
                    }
                },
                tags: tags,
                chatEnabled: formData.get('chatEnabled') === 'on',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
                settings: {
                    allowInvites: formData.get('allowInvites') === 'on',
                    moderationLevel: formData.get('moderationLevel') || 'medium'
                }
            };

            const docRef = await this.db.collection('groups').add(groupData);
            
            // Create initial welcome message if chat is enabled
            if (groupData.chatEnabled) {
                await this.db.collection('groups').doc(docRef.id).collection('messages').add({
                    senderId: 'system',
                    senderName: 'System',
                    content: `Welcome to ${groupData.name}! This is the beginning of your group chat.`,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    type: 'system'
                });
            }

            alert('Group created successfully!');
            this.closeModal('enhanced-create-group-modal');
            this.loadEnhancedGroupsList();
            
        } catch (error) {
            console.error('Error creating group:', error);
            alert('Failed to create group. Please try again.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    setupGroupFilters() {
        const categoryFilter = document.getElementById('group-category-filter');
        const sortFilter = document.getElementById('group-sort-filter');

        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.loadEnhancedGroupsList());
        }

        if (sortFilter) {
            sortFilter.addEventListener('change', () => this.loadEnhancedGroupsList());
        }
    }

    async loadEnhancedGroupsList() {
        const myGroupsContainer = document.getElementById('enhanced-my-groups');
        const discoverGroupsContainer = document.getElementById('enhanced-discover-groups');
        
        if (!myGroupsContainer || !discoverGroupsContainer) return;

        try {
            // Load user's groups
            if (this.currentUser) {
                const myGroupsQuery = this.db.collection('groups')
                    .where('participants', 'array-contains', this.currentUser.uid)
                    .orderBy('lastActivity', 'desc');

                const myGroupsSnapshot = await myGroupsQuery.get();
                this.renderGroupsList(myGroupsSnapshot.docs, myGroupsContainer, true);
            }

            // Load discoverable groups
            const categoryFilter = document.getElementById('group-category-filter')?.value;
            const sortFilter = document.getElementById('group-sort-filter')?.value || 'activity';

            let discoverQuery = this.db.collection('groups')
                .where('isPublic', '==', true);

            if (categoryFilter && categoryFilter !== 'all') {
                discoverQuery = discoverQuery.where('category', '==', categoryFilter);
            }

            // Apply sorting
            switch (sortFilter) {
                case 'members':
                    discoverQuery = discoverQuery.orderBy('participantCount', 'desc');
                    break;
                case 'newest':
                    discoverQuery = discoverQuery.orderBy('createdAt', 'desc');
                    break;
                case 'activity':
                default:
                    discoverQuery = discoverQuery.orderBy('lastActivity', 'desc');
                    break;
            }

            const discoverSnapshot = await discoverQuery.limit(20).get();
            
            // Filter out groups user is already in
            const userGroupIds = this.currentUser ? 
                (await this.db.collection('groups')
                    .where('participants', 'array-contains', this.currentUser.uid)
                    .get()).docs.map(doc => doc.id) : [];

            const filteredGroups = discoverSnapshot.docs.filter(doc => 
                !userGroupIds.includes(doc.id)
            );

            this.renderGroupsList(filteredGroups, discoverGroupsContainer, false);

        } catch (error) {
            console.error('Error loading groups:', error);
        }
    }

    renderGroupsList(groupDocs, container, isUserGroups = false) {
        if (groupDocs.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <p class="text-gray-500 dark:text-gray-400">
                        ${isUserGroups ? "You haven't joined any groups yet." : "No groups found."}
                    </p>
                    ${!isUserGroups ? '<button class="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700" onclick="document.getElementById(\'enhanced-create-group-modal\').classList.remove(\'hidden\')">Create the first group</button>' : ''}
                </div>
            `;
            return;
        }

        container.innerHTML = groupDocs.map(doc => {
            const group = doc.data();
            const isOwner = group.creatorId === this.currentUser?.uid;
            const isMember = group.participants?.includes(this.currentUser?.uid);
            
            return `
                <div class="group-card bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer" 
                     data-group-id="${doc.id}">
                    <div class="p-6">
                        <div class="flex items-start justify-between mb-4">
                            <div class="flex-1">
                                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">${group.name}</h3>
                                <p class="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">${group.description || 'No description available'}</p>
                                
                                <div class="flex flex-wrap gap-2 mb-3">
                                    ${group.category ? `<span class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">${group.category}</span>` : ''}
                                    ${group.tags ? group.tags.slice(0, 3).map(tag => 
                                        `<span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">${tag}</span>`
                                    ).join('') : ''}
                                </div>
                            </div>
                            
                            <div class="flex flex-col items-end">
                                <span class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                    ${group.participantCount || 0} member${(group.participantCount || 0) !== 1 ? 's' : ''}
                                </span>
                                ${group.chatEnabled ? '<i class="fas fa-comments text-green-500 text-sm" title="Chat enabled"></i>' : ''}
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                <span class="text-xs px-2 py-1 rounded-full ${group.isPublic ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}">
                                    ${group.isPublic ? 'Public' : 'Private'}
                                </span>
                                ${isOwner ? '<span class="text-xs px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full">Owner</span>' : ''}
                            </div>
                            
                            <div class="flex space-x-2">
                                ${isMember ? 
                                    `<button class="view-group-btn bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700" data-group-id="${doc.id}">
                                        ${group.chatEnabled ? 'Open Chat' : 'View'}
                                    </button>` :
                                    `<button class="join-group-btn bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700" data-group-id="${doc.id}">
                                        Join
                                    </button>`
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners
        container.querySelectorAll('.group-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('join-group-btn') && !e.target.classList.contains('view-group-btn')) {
                    this.viewGroupDetails(card.dataset.groupId);
                }
            });
        });

        container.querySelectorAll('.join-group-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleGroupJoin(btn.dataset.groupId);
            });
        });

        container.querySelectorAll('.view-group-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.viewGroupDetails(btn.dataset.groupId);
            });
        });
    }

    async handleGroupJoin(groupId) {
        if (!this.currentUser) {
            alert('Please log in to join groups');
            return;
        }

        try {
            const groupRef = this.db.collection('groups').doc(groupId);
            const groupDoc = await groupRef.get();
            
            if (!groupDoc.exists) {
                alert('Group not found');
                return;
            }

            const groupData = groupDoc.data();
            
            if (groupData.participants?.includes(this.currentUser.uid)) {
                this.viewGroupDetails(groupId);
                return;
            }

            await groupRef.update({
                participants: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid),
                participantCount: firebase.firestore.FieldValue.increment(1),
                [`participantInfo.${this.currentUser.uid}`]: {
                    displayName: this.currentUser.displayName,
                    photoURL: this.currentUser.photoURL,
                    role: 'member',
                    joinedAt: new Date()
                },
                lastActivity: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert(`Welcome to ${groupData.name}!`);
            this.loadEnhancedGroupsList();
            
        } catch (error) {
            console.error('Error joining group:', error);
            alert('Failed to join group. Please try again.');
        }
    }

    async viewGroupDetails(groupId) {
        try {
            const groupDoc = await this.db.collection('groups').doc(groupId).get();
            if (!groupDoc.exists) {
                alert('Group not found');
                return;
            }

            const groupData = groupDoc.data();
            
            // If chat is enabled and user is a member, open chat
            if (groupData.chatEnabled && groupData.participants?.includes(this.currentUser?.uid)) {
                if (window.groupChatManager) {
                    window.groupChatManager.openGroupChat(groupId);
                } else {
                    alert('Chat system is loading...');
                }
            } else {
                // Show group info modal
                this.showGroupInfoModal(groupId, groupData);
            }
        } catch (error) {
            console.error('Error viewing group details:', error);
            alert('Failed to load group details');
        }
    }

    showGroupInfoModal(groupId, groupData) {
        const modalHTML = `
            <div id="group-info-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h2 class="text-2xl font-bold text-gray-800 dark:text-white">${groupData.name}</h2>
                            <button class="text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold" onclick="document.getElementById('group-info-modal').remove()">×</button>
                        </div>
                        
                        <div class="space-y-4">
                            <div>
                                <h3 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h3>
                                <p class="text-gray-600 dark:text-gray-400">${groupData.description || 'No description available'}</p>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <h3 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Category</h3>
                                    <span class="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">${groupData.category || 'Uncategorized'}</span>
                                </div>
                                <div>
                                    <h3 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Members</h3>
                                    <span class="text-gray-600 dark:text-gray-400">${groupData.participantCount || 0} members</span>
                                </div>
                            </div>
                            
                            ${groupData.tags && groupData.tags.length > 0 ? `
                                <div>
                                    <h3 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Tags</h3>
                                    <div class="flex flex-wrap gap-2">
                                        ${groupData.tags.map(tag => `<span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">${tag}</span>`).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            <div class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                                <div class="flex items-center space-x-4">
                                    <span class="text-sm px-3 py-1 rounded-full ${groupData.isPublic ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}">
                                        ${groupData.isPublic ? 'Public' : 'Private'}
                                    </span>
                                    ${groupData.chatEnabled ? '<span class="text-sm px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">Chat Enabled</span>' : ''}
                                </div>
                                
                                ${!groupData.participants?.includes(this.currentUser?.uid) ? `
                                    <button onclick="window.enhancedGroupsManager.handleGroupJoin('${groupId}'); document.getElementById('group-info-modal').remove();" 
                                            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                                        Join Group
                                    </button>
                                ` : groupData.chatEnabled ? `
                                    <button onclick="window.groupChatManager?.openGroupChat('${groupId}'); document.getElementById('group-info-modal').remove();" 
                                            class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                                        Open Chat
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

// Community Tab Management
class CommunityManager {
    constructor(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
        this.currentTab = 'groups';
        this.init();
    }

    init() {
        this.setupTabSwitching();
        this.setupFriendsManagement();
        
        // Initialize groups manager
        this.groupsManager = new EnhancedGroupsManager(this.db, this.currentUser);
        
        // Load initial content
        this.loadFriendsContent();
    }

    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.community-tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });
    }

    switchTab(tabId) {
        // Update active tab button
        document.querySelectorAll('.community-tab-btn').forEach(btn => {
            btn.classList.remove('active', 'border-blue-500', 'text-blue-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });
        
        const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active', 'border-blue-500', 'text-blue-600');
            activeBtn.classList.remove('border-transparent', 'text-gray-500');
        }

        // Show/hide tab content
        document.querySelectorAll('.community-tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        const activeContent = document.getElementById(`tab-${tabId}`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }

        // Show/hide create group button
        const createGroupBtn = document.getElementById('create-group-btn');
        if (createGroupBtn) {
            if (tabId === 'groups') {
                createGroupBtn.style.display = 'flex';
            } else {
                createGroupBtn.style.display = 'none';
            }
        }

        this.currentTab = tabId;
    }

    setupFriendsManagement() {
        // Friend search functionality
        const friendSearchInput = document.getElementById('friend-search-input');
        if (friendSearchInput) {
            let searchTimeout;
            friendSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchUsers(e.target.value);
                }, 300);
            });
        }
    }

    async searchUsers(query) {
        if (!query.trim()) {
            document.getElementById('friend-search-results').classList.add('hidden');
            return;
        }

        try {
            const resultsContainer = document.getElementById('friend-search-results');
            resultsContainer.innerHTML = '<div class="p-4 text-center"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
            resultsContainer.classList.remove('hidden');

            const usersSnapshot = await this.db.collection('users')
                .where('handle', '>=', query.toLowerCase())
                .where('handle', '<=', query.toLowerCase() + '\uf8ff')
                .limit(10)
                .get();

            if (usersSnapshot.empty) {
                resultsContainer.innerHTML = '<div class="p-4 text-center text-gray-500">No users found</div>';
                return;
            }

            const resultsHTML = usersSnapshot.docs.map(doc => {
                const user = doc.data();
                return `
                    <div class="p-4 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                            <img src="${user.profilePicture || 'https://via.placeholder.com/40'}" 
                                 alt="${user.handle}" class="w-10 h-10 rounded-full">
                            <div>
                                <div class="font-medium">${user.handle}</div>
                                <div class="text-sm text-gray-500">${user.displayName || ''}</div>
                            </div>
                        </div>
                        <button class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                                onclick="communityManager.sendFriendRequest('${doc.id}')">
                            Add Friend
                        </button>
                    </div>
                `;
            }).join('');

            resultsContainer.innerHTML = resultsHTML;

        } catch (error) {
            console.error('Error searching users:', error);
            document.getElementById('friend-search-results').innerHTML = 
                '<div class="p-4 text-center text-red-500">Error searching users</div>';
        }
    }

    async loadFriendsContent() {
        await Promise.all([
            this.loadFriendRequests(),
            this.loadFriendsList(),
            this.loadSuggestedFriends()
        ]);
    }

    async loadFriendRequests() {
        try {
            if (!this.currentUser) return;

            const requestsSnapshot = await this.db.collection('friendRequests')
                .where('to', '==', this.currentUser.uid)
                .where('status', '==', 'pending')
                .get();

            const container = document.getElementById('friend-requests-container');
            
            if (requestsSnapshot.empty) {
                container.innerHTML = `
                    <div class="text-center py-8">
                        <i class="fas fa-user-plus text-4xl text-gray-400 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">No pending friend requests</p>
                    </div>
                `;
                return;
            }

            const requestsHTML = await Promise.all(requestsSnapshot.docs.map(async doc => {
                const request = doc.data();
                const userDoc = await this.db.collection('users').doc(request.from).get();
                const user = userDoc.data();
                
                return `
                    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
                        <div class="flex items-center space-x-3">
                            <img src="${user?.profilePicture || 'https://via.placeholder.com/40'}" 
                                 alt="${user?.handle}" class="w-10 h-10 rounded-full">
                            <div>
                                <div class="font-medium">${user?.handle || 'Unknown User'}</div>
                                <div class="text-sm text-gray-500">${user?.displayName || ''}</div>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                                    onclick="communityManager.acceptFriendRequest('${doc.id}')">
                                Accept
                            </button>
                            <button class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
                                    onclick="communityManager.rejectFriendRequest('${doc.id}')">
                                Decline
                            </button>
                        </div>
                    </div>
                `;
            }));

            container.innerHTML = requestsHTML.join('');

        } catch (error) {
            console.error('Error loading friend requests:', error);
        }
    }

    async loadFriendsList() {
        try {
            if (!this.currentUser) return;

            const friendsSnapshot = await this.db.collection('friends')
                .where('users', 'array-contains', this.currentUser.uid)
                .where('status', '==', 'accepted')
                .get();

            const container = document.getElementById('friends-list');
            
            if (friendsSnapshot.empty) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <i class="fas fa-user-friends text-4xl text-gray-400 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">No friends yet</p>
                        <p class="text-sm text-gray-400">Start by searching for users to add as friends</p>
                    </div>
                `;
                return;
            }

            const friendsHTML = await Promise.all(friendsSnapshot.docs.map(async doc => {
                const friendship = doc.data();
                const friendId = friendship.users.find(id => id !== this.currentUser.uid);
                const userDoc = await this.db.collection('users').doc(friendId).get();
                const user = userDoc.data();
                
                return `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <div class="flex items-center space-x-4 mb-4">
                            <img src="${user?.profilePicture || 'https://via.placeholder.com/60'}" 
                                 alt="${user?.handle}" class="w-12 h-12 rounded-full">
                            <div>
                                <div class="font-medium text-lg">${user?.handle || 'Unknown User'}</div>
                                <div class="text-sm text-gray-500">${user?.displayName || ''}</div>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm"
                                    onclick="window.location.href='profile.html?user=${friendId}'">
                                View Profile
                            </button>
                            <button class="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 text-sm"
                                    onclick="window.location.href='messages.html?user=${friendId}'">
                                Message
                            </button>
                        </div>
                    </div>
                `;
            }));

            container.innerHTML = friendsHTML.join('');

        } catch (error) {
            console.error('Error loading friends list:', error);
        }
    }

    async loadSuggestedFriends() {
        try {
            if (!this.currentUser) return;

            // Simple suggestion: recent users (excluding current user and existing friends)
            const usersSnapshot = await this.db.collection('users')
                .orderBy('lastActive', 'desc')
                .limit(20)
                .get();

            const container = document.getElementById('suggested-friends');
            
            // Filter out current user and existing friends
            const suggestions = usersSnapshot.docs.filter(doc => doc.id !== this.currentUser.uid);
            
            if (suggestions.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-8">
                        <i class="fas fa-users text-4xl text-gray-400 mb-4"></i>
                        <p class="text-gray-500 dark:text-gray-400">No suggestions available</p>
                    </div>
                `;
                return;
            }

            const suggestionsHTML = suggestions.slice(0, 6).map(doc => {
                const user = doc.data();
                return `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <div class="flex items-center space-x-4 mb-4">
                            <img src="${user.profilePicture || 'https://via.placeholder.com/60'}" 
                                 alt="${user.handle}" class="w-12 h-12 rounded-full">
                            <div>
                                <div class="font-medium text-lg">${user.handle || 'Unknown User'}</div>
                                <div class="text-sm text-gray-500">${user.displayName || ''}</div>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm"
                                    onclick="communityManager.sendFriendRequest('${doc.id}')">
                                Add Friend
                            </button>
                            <button class="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 text-sm"
                                    onclick="window.location.href='profile.html?user=${doc.id}'">
                                View Profile
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = suggestionsHTML;

        } catch (error) {
            console.error('Error loading suggested friends:', error);
        }
    }

    async sendFriendRequest(userId) {
        try {
            if (!this.currentUser) return;

            await this.db.collection('friendRequests').add({
                from: this.currentUser.uid,
                to: userId,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Show success message
            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: "Friend request sent!",
                    duration: 3000,
                    backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)"
                }).showToast();
            }

        } catch (error) {
            console.error('Error sending friend request:', error);
        }
    }

    async acceptFriendRequest(requestId) {
        try {
            const requestDoc = await this.db.collection('friendRequests').doc(requestId).get();
            const request = requestDoc.data();

            // Create friendship
            await this.db.collection('friends').add({
                users: [request.from, request.to],
                status: 'accepted',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update request status
            await this.db.collection('friendRequests').doc(requestId).update({
                status: 'accepted'
            });

            // Reload friend requests and friends list
            await this.loadFriendRequests();
            await this.loadFriendsList();

            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: "Friend request accepted!",
                    duration: 3000,
                    backgroundColor: "linear-gradient(to right, #00b09b, #96c93d)"
                }).showToast();
            }

        } catch (error) {
            console.error('Error accepting friend request:', error);
        }
    }

    async rejectFriendRequest(requestId) {
        try {
            await this.db.collection('friendRequests').doc(requestId).update({
                status: 'rejected'
            });

            await this.loadFriendRequests();

            if (typeof Toastify !== 'undefined') {
                Toastify({
                    text: "Friend request declined",
                    duration: 3000,
                    backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)"
                }).showToast();
            }

        } catch (error) {
            console.error('Error rejecting friend request:', error);
        }
    }
}

// Initialize when DOM is loaded and user is authenticated
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const db = firebase.firestore();
    
    if (document.getElementById('enhanced-groups-container')) {
        window.communityManager = new CommunityManager(db, currentUser);
    }
});
