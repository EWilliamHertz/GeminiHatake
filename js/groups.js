/**
 * HatakeSocial - Groups Page Script (v15 - Notification Link Fix)
 *
 * - FIX: Corrects the group invitation notification to include a direct link to the specific group.
 * - FIX: Adds logic to check for a groupId in the URL, allowing direct navigation to a group from a notification.
 * - All other existing functionalities (real-time updates, trade posts, etc.) are preserved.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const groupsPage = document.getElementById('groups-main-view');
    if (!groupsPage) return;

    // --- State ---
    let userWishlist = [];
    let userCollection = [];
    let tradePostDraft = { haves: [], wants: [] };
    let myGroupsUnsubscribe = null;
    let discoverGroupsUnsubscribe = null;

    // --- DOM Elements ---
    const createGroupBtn = document.getElementById('create-group-btn');
    const createGroupModal = document.getElementById('create-group-modal');
    const closeGroupModalBtn = document.getElementById('close-group-modal');
    const createGroupForm = document.getElementById('create-group-form');
    const myGroupsList = document.getElementById('my-groups-list');
    const discoverGroupsList = document.getElementById('discover-groups-list');
    const groupDetailView = document.getElementById('group-detail-view');
    const inviteMemberModal = document.getElementById('invite-member-modal');
    const closeInviteModalBtn = document.getElementById('close-invite-modal');
    const inviteUserSearchInput = document.getElementById('invite-user-search');
    const inviteUserResultsContainer = document.getElementById('invite-user-results');
    
    // Trade Post Modal Elements
    const tradePostModal = document.getElementById('trade-post-modal');
    const closeTradePostModalBtn = document.getElementById('close-trade-post-modal');
    const tradePostForm = document.getElementById('trade-post-form');
    const tradePostModalTitle = document.getElementById('trade-post-modal-title');
    const tradePostTypeInput = document.getElementById('trade-post-type');
    const havesSearchInput = document.getElementById('trade-post-haves-search');
    const havesResultsContainer = document.getElementById('trade-post-haves-results');
    const wantsSearchInput = document.getElementById('trade-post-wants-search');
    const wantsResultsContainer = document.getElementById('trade-post-wants-results');


    if (user) {
        createGroupBtn.classList.remove('hidden');
        // Pre-load user's collection and wishlist for the trade post modal
        db.collection('users').doc(user.uid).collection('collection').get().then(snap => {
            userCollection = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        }).catch(err => console.error("Could not load user collection:", err));
        db.collection('users').doc(user.uid).collection('wishlist').get().then(snap => {
            userWishlist = snap.docs.map(doc => ({id: doc.id, ...doc.data()}));
        }).catch(err => console.error("Could not load user wishlist:", err));
    }
    createGroupBtn.addEventListener('click', () => openModal(createGroupModal));
    closeGroupModalBtn.addEventListener('click', () => closeModal(createGroupModal));
    closeInviteModalBtn.addEventListener('click', () => closeModal(inviteMemberModal));
    closeTradePostModalBtn.addEventListener('click', () => closeModal(tradePostModal));

    createGroupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!user) {
            alert("You must be logged in to create a group.");
            return;
        }

        const groupName = document.getElementById('groupName').value;
        const groupDescription = document.getElementById('groupDescription').value;
        const isPublic = document.getElementById('groupPublic').checked;
        const groupType = document.getElementById('groupType').value;

        const submitButton = createGroupForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        try {
            const groupData = {
                name: groupName,
                description: groupDescription,
                isPublic: isPublic,
                groupType: groupType,
                creatorId: user.uid,
                creatorName: user.displayName,
                participants: [user.uid],
                participantInfo: { [user.uid]: { displayName: user.displayName, photoURL: user.photoURL } },
                moderators: [user.uid],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                participantCount: 1,
                pinnedPost: null
            };

            await db.collection('groups').add(groupData);
            alert("Group created successfully!");
            closeModal(createGroupModal);
            createGroupForm.reset();
        } catch (error) {
            console.error("Error creating group:", error);
            alert("Could not create group. " + error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    const createGroupCard = (groupData, groupId) => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col cursor-pointer hover:shadow-lg transition-shadow';
        
        let typeIcon = '';
        switch(groupData.groupType) {
            case 'trading_guild': typeIcon = '<i class="fas fa-exchange-alt text-green-500" title="Trading Guild"></i>'; break;
            case 'strategy_lab': typeIcon = '<i class="fas fa-brain text-blue-500" title="Strategy Lab"></i>'; break;
            case 'regional_hub': typeIcon = '<i class="fas fa-map-marker-alt text-red-500" title="Regional Hub"></i>'; break;
            default: typeIcon = '<i class="fas fa-users text-gray-500" title="General Group"></i>';
        }

        card.innerHTML = `
            <div class="flex-grow">
                <h3 class="font-bold text-xl mb-2 text-gray-800 dark:text-white">${groupData.name}</h3>
                <p class="text-gray-600 dark:text-gray-300 text-sm mb-4">${groupData.description.substring(0, 100)}...</p>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400 flex justify-between items-center mt-auto">
                <span><i class="fas fa-users mr-2"></i>${groupData.participantCount || 0} members</span>
                <span class="flex items-center gap-x-2">${typeIcon} ${groupData.isPublic ? 'Public' : 'Private'}</span>
            </div>
        `;
        card.addEventListener('click', () => viewGroup(groupId));
        return card;
    };

    const loadMyGroups = () => {
        if (!user) return;
        if(myGroupsUnsubscribe) myGroupsUnsubscribe();

        myGroupsUnsubscribe = db.collection('groups')
            .where('participants', 'array-contains', user.uid)
            .onSnapshot(snapshot => {
                myGroupsList.innerHTML = '';
                if (snapshot.empty) {
                    myGroupsList.innerHTML = '<p class="text-gray-500 dark:text-gray-400">You are not a member of any groups yet.</p>';
                    return;
                }
                snapshot.forEach(doc => {
                    myGroupsList.appendChild(createGroupCard(doc.data(), doc.id));
                });
            }, err => {
                console.error("Error loading my groups:", err);
                myGroupsList.innerHTML = '<p class="text-red-500">Could not load your groups.</p>';
            });
    };
    
    const loadDiscoverGroups = () => {
        if(discoverGroupsUnsubscribe) discoverGroupsUnsubscribe();

        discoverGroupsUnsubscribe = db.collection('groups')
            .where('isPublic', '==', true)
            .limit(10)
            .onSnapshot(snapshot => {
                discoverGroupsList.innerHTML = '';
                if (snapshot.empty) {
                    discoverGroupsList.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No public groups to discover right now.</p>';
                    return;
                }
                snapshot.forEach(doc => {
                    const groupData = doc.data();
                    if (user && groupData.participants && groupData.participants.includes(user.uid)) {
                        // Don't show groups the user is already in
                    } else {
                        discoverGroupsList.appendChild(createGroupCard(groupData, doc.id));
                    }
                });
            }, err => {
                console.error("Error loading discover groups:", err);
                discoverGroupsList.innerHTML = '<p class="text-red-500">Could not load groups to discover.</p>';
            });
    };
    
    const loadGroupFeed = async (groupId) => {
        const feedContainer = document.getElementById('group-feed-container');
        if (!feedContainer) return;
        feedContainer.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>';
        
        try {
            const groupDoc = await db.collection('groups').doc(groupId).get();
            if (!groupDoc.exists) {
                feedContainer.innerHTML = '<p class="text-red-500">Group not found.</p>';
                return;
            }
            const groupData = groupDoc.data();
            const pinnedPostId = groupData.pinnedPost;

            const postsRef = db.collection('groups').doc(groupId).collection('posts').orderBy('timestamp', 'desc');
            
            postsRef.onSnapshot(async snapshot => {
                if (snapshot.empty && !pinnedPostId) {
                    feedContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">No posts in this group yet. Be the first!</p>';
                    return;
                }

                feedContainer.innerHTML = '';

                if (pinnedPostId) {
                    const pinnedPostDoc = await db.collection('groups').doc(groupId).collection('posts').doc(pinnedPostId).get();
                    if (pinnedPostDoc.exists) {
                        const pinnedPostEl = createPostElement(pinnedPostDoc.id, pinnedPostDoc.data(), true);
                        feedContainer.appendChild(pinnedPostEl);
                    }
                }
                
                snapshot.forEach(doc => {
                    if (doc.id !== pinnedPostId) {
                        const postEl = createPostElement(doc.id, doc.data(), false);
                        feedContainer.appendChild(postEl);
                    }
                });
            }, error => {
                console.error(`Error loading group feed for ${groupId}:`, error);
                feedContainer.innerHTML = '<p class="text-center text-red-500 dark:text-red-400 p-4">Could not load group posts. Check permissions.</p>';
            });
        } catch (error) {
            console.error("Error fetching group data:", error);
            feedContainer.innerHTML = '<p class="text-center text-red-500 dark:text-red-400 p-4">Could not load group data.</p>';
        }
    };

    const createPostElement = (postId, postData, isPinned) => {
        const postEl = document.createElement('div');
        postEl.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md relative';
        
        if (postData.postType && ['wts', 'wtb', 'wtt'].includes(postData.postType)) {
            postEl.innerHTML = renderTradePost(postData);
        } else {
            postEl.innerHTML = renderStandardPost(postData);
        }

        if (isPinned) {
            const pinIcon = document.createElement('div');
            pinIcon.innerHTML = `<i class="fas fa-thumbtack text-yellow-500 absolute top-2 right-2"></i>`;
            postEl.prepend(pinIcon);
        }

        return postEl;
    }

    const renderStandardPost = (post) => {
        return `
            <div class="flex items-center mb-4">
                <a href="profile.html?uid=${post.authorId}"><img src="${post.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${post.author}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
                <div>
                    <a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white hover:underline">${post.author}</a>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                </div>
            </div>
            <p class="mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200">${post.content}</p>
        `;
    };

    const renderTradePost = (post) => {
        const postTypeColors = {
            wts: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
            wtb: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            wtt: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
        };
        const renderCardList = (cards) => {
            if (!cards || cards.length === 0) return '<p class="text-xs italic text-gray-500">None</p>';
            return cards.map(card => `
                <a href="card-view.html?name=${encodeURIComponent(card.name)}" target="_blank" class="flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded-md">
                    <img src="${card.imageUrl || 'https://placehold.co/32x44'}" class="w-8 h-11 rounded-sm object-cover">
                    <span class="text-sm dark:text-gray-300">${card.name}</span>
                </a>
            `).join('');
        };

        return `
            <div class="flex items-center mb-4">
                <a href="profile.html?uid=${post.authorId}"><img src="${post.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${post.author}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
                <div>
                    <a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white hover:underline">${post.author}</a>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                </div>
            </div>
            <div class="border-t dark:border-gray-700 pt-3">
                <div class="flex justify-between items-center">
                    <h4 class="text-lg font-bold dark:text-white">${post.title}</h4>
                    <span class="px-2 py-1 text-xs font-bold rounded-full ${postTypeColors[post.postType]}">${post.postType.toUpperCase()}</span>
                </div>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-2 mb-4">${post.body}</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h5 class="font-semibold mb-2 dark:text-gray-200">Haves:</h5>
                        <div class="space-y-1">${renderCardList(post.haves)}</div>
                    </div>
                    <div>
                        <h5 class="font-semibold mb-2 dark:text-gray-200">Wants:</h5>
                        <div class="space-y-1">${renderCardList(post.wants)}</div>
                    </div>
                </div>
            </div>
        `;
    };

    const viewGroup = async (groupId) => {
        groupsPage.classList.add('hidden');
        groupDetailView.classList.remove('hidden');
        groupDetailView.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i></div>';

        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            groupDetailView.innerHTML = '<p class="text-red-500 p-4">Group not found.</p>';
            return;
        }
        
        // Store the current group ID in the container for later access
        groupDetailView.dataset.groupId = groupId;

        const groupData = groupDoc.data();
        const isMember = user ? groupData.participants.includes(user.uid) : false;
        const isAdmin = user ? groupData.moderators.includes(user.uid) : false;

        let actionButtonsHTML = '';
        if (user) {
            if (isMember) {
                if (isAdmin) {
                    actionButtonsHTML += `<button id="invite-member-action-btn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-full text-sm">Invite Member</button>`;
                }
                actionButtonsHTML += `<button id="leave-group-action-btn" class="ml-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-full text-sm">Leave Group</button>`;
            } else if (groupData.isPublic) {
                actionButtonsHTML = `<button id="join-group-action-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full text-sm">Join Group</button>`;
            }
        }

        let createPostHTML = '';
        if (isMember) {
            if (groupData.groupType === 'trading_guild') {
                createPostHTML = `
                    <div id="create-group-post-container" class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-4">Create a Trade Post</h3>
                        <div class="flex flex-wrap gap-2">
                            <button data-post-type="wts" class="trade-post-btn bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-full">Want to Sell (WTS)</button>
                            <button data-post-type="wtb" class="trade-post-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-full">Want to Buy (WTB)</button>
                            <button data-post-type="wtt" class="trade-post-btn bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-full">Want to Trade (WTT)</button>
                        </div>
                    </div>
                `;
            } else {
                createPostHTML = `
                    <div id="create-group-post-container" class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-4">Create a Post</h3>
                        <textarea id="group-post-content" class="w-full p-3 border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-gray-900 dark:text-gray-200" rows="3" placeholder="Share something with the group..."></textarea>
                        <div class="text-right mt-2">
                            <button id="submit-group-post-btn" class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">Post</button>
                        </div>
                    </div>
                `;
            }
        } else {
            createPostHTML = '<p class="text-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">Join the group to post.</p>';
        }

        groupDetailView.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                <div class="p-6">
                    <button id="back-to-groups-list" class="text-blue-600 dark:text-blue-400 hover:underline mb-4"><i class="fas fa-arrow-left mr-2"></i>Back to All Groups</button>
                    <div class="flex justify-between items-start">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-800 dark:text-white">${groupData.name}</h1>
                            <p class="text-gray-500 dark:text-gray-400">${groupData.isPublic ? 'Public Group' : 'Private Group'} • ${groupData.participantCount || 0} members</p>
                        </div>
                        <div class="flex-shrink-0 flex space-x-2">${actionButtonsHTML}</div>
                    </div>
                    <p class="mt-4 text-gray-700 dark:text-gray-300">${groupData.description}</p>
                </div>
            </div>
            <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2 space-y-6">${createPostHTML}<div id="group-feed-container" class="space-y-6"></div></div>
                <div class="md:col-span-1 space-y-6"><div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md"><h3 class="font-bold text-gray-800 dark:text-white mb-2">Members</h3><div id="group-member-list" class="space-y-2"></div></div></div>
            </div>
        `;
        
        loadGroupFeed(groupId);
        populateMembersAndSetupListeners(groupId, groupData);
    };
    
    // --- Event Listeners and Handlers ---
    const populateMembersAndSetupListeners = (groupId, groupData) => {
        document.getElementById('back-to-groups-list')?.addEventListener('click', () => {
            groupDetailView.classList.add('hidden');
            groupsPage.classList.remove('hidden');
        });

        document.getElementById('join-group-action-btn')?.addEventListener('click', () => handleAction('join', groupId, groupData.name));
        document.getElementById('leave-group-action-btn')?.addEventListener('click', () => handleAction('leave', groupId, groupData.name));
        
        document.getElementById('invite-member-action-btn')?.addEventListener('click', () => {
            document.getElementById('invite-group-id').value = groupId;
            inviteUserSearchInput.value = '';
            inviteUserResultsContainer.innerHTML = '';
            openModal(inviteMemberModal);
        });
        
        document.getElementById('submit-group-post-btn')?.addEventListener('click', async () => {
            const content = document.getElementById('group-post-content').value;
            if (!content.trim()) return;

            const postData = {
                authorId: user.uid,
                author: user.displayName,
                authorPhotoURL: user.photoURL,
                content: content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            };

            try {
                await db.collection('groups').doc(groupId).collection('posts').add(postData);
                document.getElementById('group-post-content').value = '';
            } catch (error) {
                console.error("Error creating post:", error);
                alert("Could not create post. Check permissions.");
            }
        });
    };

    const handleAction = async (action, groupId, groupName) => {
        if (!user) {
            alert("Please log in first.");
            return;
        }

        const groupRef = db.collection('groups').doc(groupId);

        try {
            if (action === 'join') {
                await groupRef.update({
                    participants: firebase.firestore.FieldValue.arrayUnion(user.uid),
                    participantCount: firebase.firestore.FieldValue.increment(1),
                    [`participantInfo.${user.uid}`]: { displayName: user.displayName, photoURL: user.photoURL }
                });
                alert(`Welcome to ${groupName}!`);
            } else if (action === 'leave') {
                if (confirm(`Are you sure you want to leave ${groupName}?`)) {
                    await groupRef.update({
                        participants: firebase.firestore.FieldValue.arrayRemove(user.uid),
                        participantCount: firebase.firestore.FieldValue.increment(-1),
                        [`participantInfo.${user.uid}`]: firebase.firestore.FieldValue.delete()
                    });
                    alert(`You have left ${groupName}.`);
                }
            }
            viewGroup(groupId);
        } catch (error) {
            console.error(`Error performing action '${action}':`, error);
            alert(`Could not ${action} the group. Please check your permissions and try again.`);
        }
    };

    inviteUserSearchInput.addEventListener('keyup', async (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const groupId = document.getElementById('invite-group-id').value;
        if (searchTerm.length < 2 || !groupId) {
            inviteUserResultsContainer.innerHTML = '';
            return;
        }

        const groupDoc = await db.collection('groups').doc(groupId).get();
        const existingMembers = groupDoc.data().participants || [];

        const usersRef = db.collection('users');
        const snapshot = await usersRef.orderBy('handle').startAt(searchTerm).endAt(searchTerm + '\uf8ff').limit(5).get();
        
        inviteUserResultsContainer.innerHTML = '';
        if (snapshot.empty) {
            inviteUserResultsContainer.innerHTML = '<p class="p-2 text-sm text-gray-500">No users found.</p>';
            return;
        }

        snapshot.forEach(doc => {
            const userData = doc.data();
            const userId = doc.id;

            if (existingMembers.includes(userId)) return;

            const resultItem = document.createElement('div');
            resultItem.className = 'flex items-center justify-between p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md';
            resultItem.innerHTML = `
                <div class="flex items-center space-x-2">
                    <img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-8 h-8 rounded-full object-cover">
                    <span class="dark:text-white">${userData.displayName} (@${userData.handle})</span>
                </div>
                <button class="invite-user-btn bg-blue-500 text-white px-3 py-1 text-xs rounded-full hover:bg-blue-600" data-uid="${userId}">Invite</button>
            `;
            resultItem.querySelector('.invite-user-btn').addEventListener('click', (e) => {
                e.target.disabled = true;
                e.target.textContent = 'Invited';
                inviteUserToGroup(userId, userData, groupId, groupDoc.data().name);
            });
            inviteUserResultsContainer.appendChild(resultItem);
        });
    });

    const inviteUserToGroup = async (userIdToInvite, userDataToInvite, groupId, groupName) => {
        if (!user) return;
        
        // ** THE FIX IS HERE **
        // The link now includes the groupId so the user is taken directly to the group page.
        const notificationData = {
            message: `${user.displayName} invited you to join the group "${groupName}".`,
            link: `groups.html?groupId=${groupId}`,
            isRead: false,
            timestamp: new Date()
        };

        try {
            await db.collection('users').doc(userIdToInvite).collection('notifications').add(notificationData);
            alert(`Invitation sent to ${userDataToInvite.displayName}.`);
        } catch (error) {
            console.error("Error sending invitation:", error);
            alert("Could not send invitation.");
        }
    };
    
    // --- Trade Post Modal Logic ---
    const openTradePostModal = (type) => {
        tradePostForm.reset();
        tradePostDraft = { haves: [], wants: [] };
        tradePostTypeInput.value = type;

        const havesSection = document.getElementById('trade-post-haves-section');
        const wantsSection = document.getElementById('trade-post-wants-section');
        
        switch(type) {
            case 'wts':
                tradePostModalTitle.textContent = 'Create "Want to Sell" Post';
                havesSection.classList.remove('hidden');
                wantsSection.classList.add('hidden');
                break;
            case 'wtb':
                tradePostModalTitle.textContent = 'Create "Want to Buy" Post';
                havesSection.classList.add('hidden');
                wantsSection.classList.remove('hidden');
                break;
            case 'wtt':
                tradePostModalTitle.textContent = 'Create "Want to Trade" Post';
                havesSection.classList.remove('hidden');
                wantsSection.classList.remove('hidden');
                break;
        }
        renderTradePostDraft();
        openModal(tradePostModal);
    };

    const renderTradePostDraft = () => {
        const havesList = document.getElementById('trade-post-haves-list');
        const wantsList = document.getElementById('trade-post-wants-list');
        havesList.innerHTML = tradePostDraft.haves.map(c => `<div class="flex items-center justify-between text-sm p-1 bg-white dark:bg-gray-800 rounded"><span>${c.name}</span><button type="button" class="remove-draft-item-btn text-red-500" data-id="${c.id}" data-list="haves">&times;</button></div>`).join('');
        wantsList.innerHTML = tradePostDraft.wants.map(c => `<div class="flex items-center justify-between text-sm p-1 bg-white dark:bg-gray-800 rounded"><span>${c.name}</span><button type="button" class="remove-draft-item-btn text-red-500" data-id="${c.id}" data-list="wants">&times;</button></div>`).join('');
    };
    
    const handleCardSearch = (e, listType) => {
        const input = e.target;
        const resultsContainer = listType === 'haves' ? havesResultsContainer : wantsResultsContainer;
        const sourceList = listType === 'haves' ? userCollection : userWishlist;
        const searchTerm = input.value.toLowerCase();

        if (searchTerm.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }
        
        const filtered = sourceList.filter(c => c.name.toLowerCase().includes(searchTerm));
        resultsContainer.innerHTML = '';
        if (filtered.length > 0) {
            resultsContainer.classList.remove('hidden');
            filtered.slice(0, 7).forEach(card => {
                const item = document.createElement('div');
                item.className = 'p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-700';
                item.textContent = card.name;
                item.addEventListener('click', () => {
                    if (!tradePostDraft[listType].some(c => c.id === card.id)) {
                        tradePostDraft[listType].push(card);
                        renderTradePostDraft();
                    }
                    input.value = '';
                    resultsContainer.classList.add('hidden');
                });
                resultsContainer.appendChild(item);
            });
        }
    };

    havesSearchInput.addEventListener('input', (e) => handleCardSearch(e, 'haves'));
    wantsSearchInput.addEventListener('input', (e) => handleCardSearch(e, 'wants'));

    tradePostForm.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-draft-item-btn')) {
            const cardId = e.target.dataset.id;
            const listName = e.target.dataset.list;
            tradePostDraft[listName] = tradePostDraft[listName].filter(c => c.id !== cardId);
            renderTradePostDraft();
        }
    });

    tradePostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const groupId = document.getElementById('group-detail-view').dataset.groupId;
        if (!groupId || !user) return;
        
        const postData = {
            title: document.getElementById('trade-post-title-input').value,
            body: document.getElementById('trade-post-body-input').value,
            postType: tradePostTypeInput.value,
            haves: tradePostDraft.haves.map(c => ({ name: c.name, imageUrl: c.imageUrl || '' })),
            wants: tradePostDraft.wants.map(c => ({ name: c.name, imageUrl: c.imageUrl || '' })),
            authorId: user.uid,
            author: user.displayName,
            authorPhotoURL: user.photoURL,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await db.collection('groups').doc(groupId).collection('posts').add(postData);
            alert('Trade post created!');
            closeModal(tradePostModal);
        } catch (error) {
            console.error('Error creating trade post:', error);
            alert('Could not create trade post.');
        }
    });

    // Event delegation for the main group view
    groupDetailView.addEventListener('click', (e) => {
        const button = e.target.closest('.trade-post-btn');
        if (button) {
            openTradePostModal(button.dataset.postType);
        }
    });

    // ** NEW ** Function to check for URL parameters on page load
    const checkForUrlParams = () => {
        const params = new URLSearchParams(window.location.search);
        const groupId = params.get('groupId');
        if (groupId) {
            viewGroup(groupId);
        }
    };

    // Initial Load
    loadMyGroups();
    loadDiscoverGroups();
    checkForUrlParams(); // Check for a direct link to a group
});
