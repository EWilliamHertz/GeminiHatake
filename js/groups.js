/**
 * HatakeSocial - Groups Page Script (v6 - Invite Feature & Index Fix)
 *
 * - FIX: Corrects the Firestore query for discovering public groups, which requires an index.
 * - NEW: Adds complete functionality for admins to invite users to groups.
 * - FIX: Ensures joining/leaving a group also updates the corresponding conversation document.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const groupsPage = document.getElementById('groups-main-view');
    if (!groupsPage) return;

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

    // --- Event Listeners for Modals ---
    if (user) {
        createGroupBtn.classList.remove('hidden');
    }
    createGroupBtn.addEventListener('click', () => openModal(createGroupModal));
    closeGroupModalBtn.addEventListener('click', () => closeModal(createGroupModal));
    closeInviteModalBtn.addEventListener('click', () => closeModal(inviteMemberModal));

    // --- Group Creation Form ---
    createGroupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!user) {
            alert("You must be logged in to create a group.");
            return;
        }

        const groupName = document.getElementById('groupName').value;
        const groupDescription = document.getElementById('groupDescription').value;
        const isPublic = document.getElementById('groupPublic').checked;

        const submitButton = createGroupForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Creating...';

        try {
            const groupData = {
                name: groupName,
                description: groupDescription,
                isPublic: isPublic,
                creatorId: user.uid,
                creatorName: user.displayName,
                participants: [user.uid],
                participantInfo: {
                    [user.uid]: {
                        displayName: user.displayName,
                        photoURL: user.photoURL
                    }
                },
                moderators: [user.uid],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                participantCount: 1
            };

            const groupDocRef = await db.collection('groups').add(groupData);
            
            // Also create a corresponding conversation for the group chat
            await db.collection('conversations').doc(groupDocRef.id).set({
                isGroupChat: true,
                groupName: groupName,
                participants: [user.uid],
                participantInfo: {
                    [user.uid]: { displayName: user.displayName, photoURL: user.photoURL }
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: 'Group created!'
            });

            alert("Group created successfully!");
            closeModal(createGroupModal);
            createGroupForm.reset();
            loadMyGroups();
            loadDiscoverGroups();

        } catch (error) {
            console.error("Error creating group:", error);
            alert("Could not create group. " + error.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Create Group';
        }
    });

    // --- Core Functions ---
    const createGroupCard = (groupData, groupId) => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col cursor-pointer hover:shadow-lg transition-shadow';
        card.innerHTML = `
            <div class="flex-grow">
                <h3 class="font-bold text-xl mb-2 text-gray-800 dark:text-white">${groupData.name}</h3>
                <p class="text-gray-600 dark:text-gray-300 text-sm mb-4">${groupData.description.substring(0, 100)}...</p>
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400 flex justify-between items-center mt-auto">
                <span><i class="fas fa-users mr-2"></i>${groupData.participantCount || groupData.participants.length} members</span>
                <span>${groupData.isPublic ? '<i class="fas fa-globe-americas mr-1"></i> Public' : '<i class="fas fa-lock mr-1"></i> Private'}</span>
            </div>
        `;
        card.addEventListener('click', () => viewGroup(groupId));
        return card;
    };

    const loadMyGroups = async () => {
        if (!user) {
            myGroupsList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">Log in to see your groups.</p>';
            return;
        }
        myGroupsList.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>';
        const snapshot = await db.collection('groups').where('participants', 'array-contains', user.uid).get();

        if (snapshot.empty) {
            myGroupsList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">You haven\'t joined any groups yet.</p>';
            return;
        }

        myGroupsList.innerHTML = '';
        snapshot.forEach(doc => {
            myGroupsList.appendChild(createGroupCard(doc.data(), doc.id));
        });
    };

    const loadDiscoverGroups = async () => {
        discoverGroupsList.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>';
        try {
            // FIX: This query requires an index. See instructions.
            const snapshot = await db.collection('groups').where('isPublic', '==', true).orderBy('createdAt', 'desc').limit(10).get();

            if (snapshot.empty) {
                discoverGroupsList.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">No public groups to show right now.</p>';
                return;
            }

            discoverGroupsList.innerHTML = '';
            snapshot.forEach(doc => {
                const groupData = doc.data();
                // Don't show groups the user is already in
                if (!user || !groupData.participants.includes(user.uid)) {
                   discoverGroupsList.appendChild(createGroupCard(groupData, doc.id));
                }
            });
        } catch (error) {
            console.error("Error loading discoverable groups:", error);
            discoverGroupsList.innerHTML = `<p class="text-red-500 text-sm p-4">Error loading groups. This is likely because the required database index has not been created or is still building. Please follow the setup instructions carefully.</p>`;
        }
    };
    
    const loadGroupFeed = async (groupId) => {
        // This function would load posts related to the group. Assuming it exists in another file.
        // Placeholder implementation:
        const feedContainer = document.getElementById('group-feed-container');
        if (feedContainer) feedContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Feed loading is handled by index.js or similar.</p>';
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

        const groupData = groupDoc.data();
        const isMember = user ? groupData.participants.includes(user.uid) : false;
        const isAdmin = user ? groupData.moderators.includes(user.uid) : false;

        let actionButtonsHTML = '';
        if (user) {
            if (isMember) {
                actionButtonsHTML += `<button id="leave-group-action-btn" class="px-4 py-2 bg-red-600 text-white font-semibold rounded-full text-sm">Leave Group</button>`;
                if (isAdmin) {
                    actionButtonsHTML += `<button id="invite-member-action-btn" class="ml-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-full text-sm">Invite Member</button>`;
                }
            } else if (groupData.isPublic) {
                actionButtonsHTML = `<button id="join-group-action-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full text-sm">Join Group</button>`;
            }
        }

        groupDetailView.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
                <div class="p-6">
                    <button id="back-to-groups-list" class="text-blue-600 dark:text-blue-400 hover:underline mb-4"><i class="fas fa-arrow-left mr-2"></i>Back to All Groups</button>
                    <div class="flex justify-between items-start">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-800 dark:text-white">${groupData.name}</h1>
                            <p class="text-gray-500 dark:text-gray-400">${groupData.isPublic ? 'Public Group' : 'Private Group'} • ${groupData.participantCount || groupData.participants.length} members</p>
                        </div>
                        <div class="flex-shrink-0 flex space-x-2">
                            ${actionButtonsHTML}
                        </div>
                    </div>
                    <p class="mt-4 text-gray-700 dark:text-gray-300">${groupData.description}</p>
                </div>
            </div>

            <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2 space-y-6">
                    ${isMember ? `
                    <div id="create-group-post-container" class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                         <h3 class="font-bold text-gray-800 dark:text-white mb-2">Create a post in this group</h3>
                         <textarea id="groupPostContent" class="w-full p-2 border rounded-md bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600" rows="3" placeholder="Share something with the group..."></textarea>
                         <div class="text-right mt-2">
                            <button id="submitGroupPostBtn" class="px-4 py-2 bg-blue-500 text-white rounded-full font-semibold">Post</button>
                         </div>
                    </div>` : '<p class="text-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">Join the group to post.</p>'}
                    <div id="group-feed-container" class="space-y-6"></div>
                </div>
                <div class="md:col-span-1 space-y-6">
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                        <h3 class="font-bold text-gray-800 dark:text-white mb-2">Members</h3>
                        <div id="group-member-list" class="space-y-2"></div>
                    </div>
                </div>
            </div>
        `;
        
        loadGroupFeed(groupId);

        // Populate and handle view logic
        populateMembersAndSetupListeners(groupId, groupData);
    };

    function populateMembersAndSetupListeners(groupId, groupData) {
        const memberListEl = document.getElementById('group-member-list');
        memberListEl.innerHTML = '';
        for (const memberId in groupData.participantInfo) {
            const member = groupData.participantInfo[memberId];
            const memberEl = document.createElement('a');
            memberEl.href = `profile.html?uid=${memberId}`;
            memberEl.className = 'flex items-center space-x-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded';
            memberEl.innerHTML = `
                <img src="${member.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-8 h-8 rounded-full object-cover">
                <span class="text-sm font-medium text-gray-800 dark:text-white">${member.displayName}</span>
            `;
            memberListEl.appendChild(memberEl);
        }

        document.getElementById('back-to-groups-list').addEventListener('click', () => {
            groupDetailView.classList.add('hidden');
            groupsPage.classList.remove('hidden');
            loadMyGroups();
            loadDiscoverGroups();
        });

        const handleAction = async (action) => {
            const groupRef = db.collection('groups').doc(groupId);
            const convoRef = db.collection('conversations').doc(groupId);

            if (action === 'join') {
                await groupRef.update({
                    participants: firebase.firestore.FieldValue.arrayUnion(user.uid),
                    participantCount: firebase.firestore.FieldValue.increment(1),
                    [`participantInfo.${user.uid}`]: { displayName: user.displayName, photoURL: user.photoURL }
                });
                await convoRef.update({
                    participants: firebase.firestore.FieldValue.arrayUnion(user.uid),
                    [`participantInfo.${user.uid}`]: { displayName: user.displayName, photoURL: user.photoURL }
                });
                alert(`Joined ${groupData.name}!`);
            } else if (action === 'leave') {
                if (confirm(`Are you sure you want to leave ${groupData.name}?`)) {
                    await groupRef.update({
                        participants: firebase.firestore.FieldValue.arrayRemove(user.uid),
                        participantCount: firebase.firestore.FieldValue.increment(-1),
                        [`participantInfo.${user.uid}`]: firebase.firestore.FieldValue.delete()
                    });
                     await convoRef.update({
                        participants: firebase.firestore.FieldValue.arrayRemove(user.uid),
                        [`participantInfo.${user.uid}`]: firebase.firestore.FieldValue.delete()
                    });
                    alert(`You have left ${groupData.name}.`);
                    document.getElementById('back-to-groups-list').click(); // Go back to main list
                    return;
                } else {
                    return;
                }
            }
            viewGroup(groupId);
        };
        
        document.getElementById('join-group-action-btn')?.addEventListener('click', () => handleAction('join'));
        document.getElementById('leave-group-action-btn')?.addEventListener('click', () => handleAction('leave'));
        document.getElementById('invite-member-action-btn')?.addEventListener('click', () => {
            document.getElementById('invite-group-id').value = groupId;
            openModal(inviteMemberModal);
        });

        // Post submission logic...
        document.getElementById('submitGroupPostBtn')?.addEventListener('click', async () => {
             const content = document.getElementById('groupPostContent').value.trim();
            if (!content) return alert("Please write something to post.");

            const postData = {
                author: user.displayName, authorId: user.uid, authorPhotoURL: user.photoURL,
                content: content, timestamp: new Date(), likes: [], comments: [],
                groupId: groupId, groupName: groupData.name
            };

            await db.collection('posts').add(postData);
            document.getElementById('groupPostContent').value = '';
            loadGroupFeed(groupId); // Refresh feed
        });
    }
    
    // --- NEW: Invite User Logic ---
    inviteUserSearchInput.addEventListener('keyup', async (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length < 2) {
            inviteUserResultsContainer.classList.add('hidden');
            return;
        }

        inviteUserResultsContainer.innerHTML = '<p class="p-2 text-sm text-gray-500">Searching...</p>';
        inviteUserResultsContainer.classList.remove('hidden');

        try {
            const snapshot = await db.collection('users').where('handle', '>=', searchTerm).where('handle', '<=', searchTerm + '\uf8ff').limit(10).get();
            inviteUserResultsContainer.innerHTML = '';
            if (snapshot.empty) {
                inviteUserResultsContainer.innerHTML = '<p class="p-2 text-sm text-gray-500">No users found.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const userData = doc.data();
                const resultItem = document.createElement('div');
                resultItem.className = 'flex items-center space-x-3 p-2 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700';
                resultItem.innerHTML = `
                    <img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-8 h-8 rounded-full object-cover">
                    <span>${userData.displayName} (@${userData.handle})</span>
                `;
                resultItem.addEventListener('click', () => inviteUserToGroup(doc.id, userData));
                inviteUserResultsContainer.appendChild(resultItem);
            });
        } catch (error) {
            console.error("Error searching for users to invite:", error);
            inviteUserResultsContainer.innerHTML = '<p class="p-2 text-sm text-red-500">Error searching users.</p>';
        }
    });

    const inviteUserToGroup = async (userIdToInvite, userDataToInvite) => {
        const groupId = document.getElementById('invite-group-id').value;
        if (!groupId) return;

        const groupRef = db.collection('groups').doc(groupId);
        const convoRef = db.collection('conversations').doc(groupId);

        if (confirm(`Are you sure you want to add ${userDataToInvite.displayName} to this group?`)) {
            try {
                await groupRef.update({
                    participants: firebase.firestore.FieldValue.arrayUnion(userIdToInvite),
                    participantCount: firebase.firestore.FieldValue.increment(1),
                    [`participantInfo.${userIdToInvite}`]: {
                        displayName: userDataToInvite.displayName,
                        photoURL: userDataToInvite.photoURL
                    }
                });
                await convoRef.update({
                    participants: firebase.firestore.FieldValue.arrayUnion(userIdToInvite),
                    [`participantInfo.${userIdToInvite}`]: {
                        displayName: userDataToInvite.displayName,
                        photoURL: userDataToInvite.photoURL
                    }
                });
                alert(`${userDataToInvite.displayName} has been added to the group.`);
                closeModal(inviteMemberModal);
                viewGroup(groupId); // Refresh the group view
            } catch (error) {
                console.error("Error inviting user:", error);
                alert("Failed to invite user.");
            }
        }
    };


    // --- Initial Load ---
    loadMyGroups();
    loadDiscoverGroups();
});
