/**
 * HatakeSocial - Groups Page Script (v2 - Group Feeds)
 *
 * This script handles all logic for the groups.html page.
 * - NEW: Adds functionality to create and view posts within a specific group.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const groupsPage = document.getElementById('groups-main-view');
    if (!groupsPage) return; // Exit if not on the groups page

    // --- DOM Elements ---
    const createGroupBtn = document.getElementById('create-group-btn');
    const createGroupModal = document.getElementById('create-group-modal');
    const closeGroupModalBtn = document.getElementById('close-group-modal');
    const createGroupForm = document.getElementById('create-group-form');
    const myGroupsList = document.getElementById('my-groups-list');
    const discoverGroupsList = document.getElementById('discover-groups-list');
    const groupDetailView = document.getElementById('group-detail-view');

    // --- Show Create Button if Logged In ---
    if (user) {
        createGroupBtn.classList.remove('hidden');
    }

    // --- Event Listeners ---
    createGroupBtn.addEventListener('click', () => openModal(createGroupModal));
    closeGroupModalBtn.addEventListener('click', () => closeModal(createGroupModal));

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
                members: [user.uid],
                memberInfo: {
                    [user.uid]: {
                        displayName: user.displayName,
                        photoURL: user.photoURL
                    }
                },
                moderators: [user.uid],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                memberCount: 1
            };

            await db.collection('groups').add(groupData);

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

    // --- Main Functions ---

    const createGroupCard = (groupData, groupId) => {
        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-lg shadow-md flex flex-col cursor-pointer hover:shadow-lg transition-shadow';
        card.innerHTML = `
            <div class="flex-grow">
                <h3 class="font-bold text-xl mb-2">${groupData.name}</h3>
                <p class="text-gray-600 text-sm mb-4">${groupData.description.substring(0, 100)}...</p>
            </div>
            <div class="text-sm text-gray-500 flex justify-between items-center mt-auto">
                <span><i class="fas fa-users mr-2"></i>${groupData.memberCount || groupData.members.length} members</span>
                <span>${groupData.isPublic ? '<i class="fas fa-globe-americas mr-1"></i> Public' : '<i class="fas fa-lock mr-1"></i> Private'}</span>
            </div>
        `;
        card.addEventListener('click', () => viewGroup(groupId));
        return card;
    };

    const loadMyGroups = async () => {
        if (!user) {
            myGroupsList.innerHTML = '<p class="text-gray-500 text-sm">Log in to see your groups.</p>';
            return;
        }
        myGroupsList.innerHTML = '<p class="text-gray-500">Loading...</p>';
        const snapshot = await db.collection('groups').where('members', 'array-contains', user.uid).get();

        if (snapshot.empty) {
            myGroupsList.innerHTML = '<p class="text-gray-500 text-sm">You haven\'t joined any groups yet.</p>';
            return;
        }

        myGroupsList.innerHTML = '';
        snapshot.forEach(doc => {
            myGroupsList.appendChild(createGroupCard(doc.data(), doc.id));
        });
    };

    const loadDiscoverGroups = async () => {
        discoverGroupsList.innerHTML = '<p class="text-gray-500">Loading...</p>';
        try {
            const snapshot = await db.collection('groups').where('isPublic', '==', true).orderBy('createdAt', 'desc').limit(10).get();

            if (snapshot.empty) {
                discoverGroupsList.innerHTML = '<p class="text-gray-500 text-sm">No public groups to show right now.</p>';
                return;
            }

            discoverGroupsList.innerHTML = '';
            snapshot.forEach(doc => {
                discoverGroupsList.appendChild(createGroupCard(doc.data(), doc.id));
            });
        } catch (error) {
            console.error(error);
            discoverGroupsList.innerHTML = `<p class="text-red-500 text-sm">Error loading groups. The necessary database index might still be building. Please wait a few minutes and refresh.</p>`;
        }
    };
    
    // --- NEW: Function to load the feed for a specific group ---
    const loadGroupFeed = async (groupId) => {
        const feedContainer = document.getElementById('group-feed-container');
        feedContainer.innerHTML = '<p class="text-center text-gray-500">Loading feed...</p>';

        try {
            const postsSnapshot = await db.collection('posts')
                .where('groupId', '==', groupId)
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();

            if (postsSnapshot.empty) {
                feedContainer.innerHTML = '<p class="text-center text-gray-500">No posts in this group yet. Be the first!</p>';
                return;
            }

            feedContainer.innerHTML = '';
            postsSnapshot.forEach(doc => {
                const post = doc.data();
                const postElement = document.createElement('div');
                postElement.className = 'bg-white p-4 rounded-lg shadow-md';
                postElement.innerHTML = `
                    <div class="flex items-center mb-4">
                        <a href="profile.html?uid=${post.authorId}"><img src="${post.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${post.author}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
                        <div>
                            <a href="profile.html?uid=${post.authorId}" class="font-bold hover:underline">${post.author}</a>
                            <p class="text-sm text-gray-500">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                        </div>
                    </div>
                    <p class="mb-4 whitespace-pre-wrap">${post.content}</p>
                `;
                feedContainer.appendChild(postElement);
            });
        } catch (error) {
            console.error("Error loading group feed:", error);
            feedContainer.innerHTML = `<p class="text-center text-red-500">Error loading feed. The required database index might be building. Please wait a few minutes and refresh.</p>`;
        }
    };

    const viewGroup = async (groupId) => {
        groupsPage.classList.add('hidden');
        groupDetailView.classList.remove('hidden');
        groupDetailView.innerHTML = '<p class="text-gray-500 p-4">Loading group...</p>';

        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            groupDetailView.innerHTML = '<p class="text-red-500 p-4">Group not found.</p>';
            return;
        }

        const groupData = groupDoc.data();
        const isMember = user ? groupData.members.includes(user.uid) : false;
        const isAdmin = user ? groupData.moderators.includes(user.uid) : false;

        let joinButtonHTML = '';
        if (user && !isMember && groupData.isPublic) {
            joinButtonHTML = `<button id="join-group-action-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-full text-sm">Join Group</button>`;
        } else if (user && isMember) {
            joinButtonHTML = `<button id="leave-group-action-btn" class="px-4 py-2 bg-red-600 text-white font-semibold rounded-full text-sm">Leave Group</button>`;
        }

        groupDetailView.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl overflow-hidden">
                <div class="p-6">
                    <button id="back-to-groups-list" class="text-blue-600 hover:underline mb-4"><i class="fas fa-arrow-left mr-2"></i>Back to All Groups</button>
                    <div class="flex justify-between items-start">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-800">${groupData.name}</h1>
                            <p class="text-gray-500">${groupData.isPublic ? 'Public Group' : 'Private Group'} • ${groupData.memberCount || groupData.members.length} members</p>
                        </div>
                        <div class="flex-shrink-0">
                            ${joinButtonHTML}
                        </div>
                    </div>
                    <p class="mt-4 text-gray-700">${groupData.description}</p>
                </div>
            </div>

            <div class="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-2 space-y-6">
                    <!-- Group Post Creation -->
                    ${isMember ? `
                    <div id="create-group-post-container" class="bg-white p-4 rounded-lg shadow-md">
                        <h3 class="font-bold mb-2">Create a post in this group</h3>
                        <textarea id="groupPostContent" class="w-full p-2 border rounded-md" rows="3" placeholder="Share something with the group..."></textarea>
                        <div class="text-right mt-2">
                            <button id="submitGroupPostBtn" class="px-4 py-2 bg-blue-500 text-white rounded-full font-semibold">Post</button>
                        </div>
                    </div>` : ''}
                    <!-- Group Feed -->
                    <div id="group-feed-container" class="space-y-6"></div>
                </div>
                <div class="md:col-span-1 space-y-6">
                    <!-- Member List -->
                    <div class="bg-white p-4 rounded-lg shadow-md">
                        <h3 class="font-bold mb-2">Members</h3>
                        <div id="group-member-list" class="space-y-2"></div>
                    </div>
                </div>
            </div>
        `;
        
        // --- NEW: Load the feed for this specific group ---
        loadGroupFeed(groupId);

        const memberListEl = document.getElementById('group-member-list');
        memberListEl.innerHTML = '';
        for (const memberId in groupData.memberInfo) {
            const member = groupData.memberInfo[memberId];
            const memberEl = document.createElement('a');
            memberEl.href = `profile.html?uid=${memberId}`;
            memberEl.className = 'flex items-center space-x-2 p-1 hover:bg-gray-100 rounded';
            memberEl.innerHTML = `
                <img src="${member.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-8 h-8 rounded-full object-cover">
                <span class="text-sm font-medium">${member.displayName}</span>
            `;
            memberListEl.appendChild(memberEl);
        }

        document.getElementById('back-to-groups-list').addEventListener('click', () => {
            groupDetailView.classList.add('hidden');
            groupsPage.classList.remove('hidden');
            loadMyGroups();
            loadDiscoverGroups();
        });

        const joinBtn = document.getElementById('join-group-action-btn');
        const leaveBtn = document.getElementById('leave-group-action-btn');
        const submitPostBtn = document.getElementById('submitGroupPostBtn');

        joinBtn?.addEventListener('click', async () => {
             await groupRef.update({
                members: firebase.firestore.FieldValue.arrayUnion(user.uid),
                memberCount: firebase.firestore.FieldValue.increment(1),
                [`memberInfo.${user.uid}`]: {
                    displayName: user.displayName,
                    photoURL: user.photoURL
                }
            });
            alert(`Joined ${groupData.name}!`);
            viewGroup(groupId);
        });

        leaveBtn?.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to leave ${groupData.name}?`)) {
                await groupRef.update({
                    members: firebase.firestore.FieldValue.arrayRemove(user.uid),
                    memberCount: firebase.firestore.FieldValue.increment(-1),
                    [`memberInfo.${user.uid}`]: firebase.firestore.FieldValue.delete()
                });
                alert(`You have left ${groupData.name}.`);
                groupDetailView.classList.add('hidden');
                groupsPage.classList.remove('hidden');
                loadMyGroups();
            }
        });

        // --- NEW: Event listener for submitting a post to the group feed ---
        submitPostBtn?.addEventListener('click', async () => {
            const content = document.getElementById('groupPostContent').value.trim();
            if (!content) {
                alert("Please write something to post.");
                return;
            }

            submitPostBtn.disabled = true;
            try {
                const postData = {
                    author: user.displayName,
                    authorId: user.uid,
                    authorPhotoURL: user.photoURL,
                    content: content,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    likes: [],
                    comments: [],
                    groupId: groupId, // Link the post to this group
                    groupName: groupData.name
                };
                await db.collection('posts').add(postData);
                document.getElementById('groupPostContent').value = '';
                loadGroupFeed(groupId); // Refresh the feed
            } catch (error) {
                console.error("Error creating group post:", error);
                alert("Failed to create post.");
            } finally {
                submitPostBtn.disabled = false;
            }
        });
    };

    // --- Initial Load ---
    loadMyGroups();
    loadDiscoverGroups();
});
