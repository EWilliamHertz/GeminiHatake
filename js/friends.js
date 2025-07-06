// js/friends.js

document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;

    // This function will be called from profile.js to load the friends tab content
    window.loadProfileFriends = async (userId) => {
        const container = document.getElementById('tab-content-friends');
        if (!container) return;

        container.innerHTML = '<p class="text-gray-500">Loading friends...</p>';

        try {
            // Get the user's friends and friend requests
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            const friendIds = userData.friends || [];
            const friendRequests = await db.collection('friendRequests')
                                           .where('receiverId', '==', userId)
                                           .where('status', '==', 'pending')
                                           .get();

            let friendsHTML = '';

            // Display Friend Requests (only if viewing your own profile)
            if (currentUser && currentUser.uid === userId && !friendRequests.empty) {
                friendsHTML += '<h3 class="text-xl font-bold mb-4">Friend Requests</h3>';
                friendsHTML += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">';
                for (const doc of friendRequests.docs) {
                    const request = doc.data();
                    const senderDoc = await db.collection('users').doc(request.senderId).get();
                    if (senderDoc.exists) {
                        const sender = senderDoc.data();
                        friendsHTML += `
                            <div class="bg-white p-4 rounded-lg shadow-md flex items-center justify-between">
                                <a href="profile.html?uid=${request.senderId}" class="flex items-center space-x-3">
                                    <img src="${sender.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-12 h-12 rounded-full object-cover">
                                    <div>
                                        <p class="font-semibold">${sender.displayName}</p>
                                        <p class="text-sm text-gray-500">@${sender.handle}</p>
                                    </div>
                                </a>
                                <div class="flex space-x-2">
                                    <button class="accept-friend-btn bg-green-500 text-white p-2 rounded-full" data-request-id="${doc.id}" data-sender-id="${request.senderId}"><i class="fas fa-check"></i></button>
                                    <button class="reject-friend-btn bg-red-500 text-white p-2 rounded-full" data-request-id="${doc.id}"><i class="fas fa-times"></i></button>
                                </div>
                            </div>
                        `;
                    }
                }
                friendsHTML += '</div>';
            }

            // Display Friends List
            friendsHTML += `<h3 class="text-xl font-bold mb-4">All Friends (${friendIds.length})</h3>`;
            if (friendIds.length === 0) {
                friendsHTML += '<p class="text-gray-500">No friends to display.</p>';
            } else {
                friendsHTML += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
                for (const friendId of friendIds) {
                    const friendDoc = await db.collection('users').doc(friendId).get();
                    if (friendDoc.exists) {
                        const friend = friendDoc.data();
                        friendsHTML += `
                            <a href="profile.html?uid=${friendId}" class="bg-white p-4 rounded-lg shadow-md flex items-center space-x-3 hover:shadow-lg">
                                <img src="${friend.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-12 h-12 rounded-full object-cover">
                                <div>
                                    <p class="font-semibold">${friend.displayName}</p>
                                    <p class="text-sm text-gray-500">@${friend.handle}</p>
                                </div>
                            </a>
                        `;
                    }
                }
                friendsHTML += '</div>';
            }

            container.innerHTML = friendsHTML;

        } catch (error) {
            console.error("Error loading friends:", error);
            container.innerHTML = '<p class="text-red-500">Could not load friends list.</p>';
        }
    };

    // Event listeners for friend request buttons
    document.body.addEventListener('click', async (event) => {
        if (event.target.closest('.accept-friend-btn')) {
            const button = event.target.closest('.accept-friend-btn');
            const requestId = button.dataset.requestId;
            const senderId = button.dataset.senderId;

            // Add each other to friends lists and delete the request
            const batch = db.batch();
            const userRef = db.collection('users').doc(currentUser.uid);
            const senderRef = db.collection('users').doc(senderId);
            const requestRef = db.collection('friendRequests').doc(requestId);

            batch.update(userRef, { friends: firebase.firestore.FieldValue.arrayUnion(senderId) });
            batch.update(senderRef, { friends: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            batch.delete(requestRef);

            await batch.commit();
            window.loadProfileFriends(currentUser.uid); // Refresh the list
        }

        if (event.target.closest('.reject-friend-btn')) {
            const button = event.target.closest('.reject-friend-btn');
            const requestId = button.dataset.requestId;
            await db.collection('friendRequests').doc(requestId).delete();
            window.loadProfileFriends(currentUser.uid); // Refresh the list
        }
    });

    // Add a friend request button to other users' profiles
    const actionButtonsContainer = document.getElementById('profile-action-buttons');
    if (actionButtonsContainer && currentUser && window.location.search.includes('user=')) {
        const params = new URLSearchParams(window.location.search);
        const username = params.get('user');
        if (username) {
            const userQuery = await db.collection('users').where('handle', '==', username).limit(1).get();
            if (!userQuery.empty) {
                const profileUser = userQuery.docs[0];
                const profileUserId = profileUser.id;

                if (profileUserId !== currentUser.uid) {
                    const friendRequestBtn = document.createElement('button');
                    friendRequestBtn.id = 'add-friend-btn';
                    friendRequestBtn.className = 'px-4 py-2 bg-blue-500 text-white rounded-full text-sm';
                    friendRequestBtn.textContent = 'Add Friend';
                    actionButtonsContainer.appendChild(friendRequestBtn);

                    friendRequestBtn.addEventListener('click', async () => {
                        const requestRef = db.collection('friendRequests');
                        await requestRef.add({
                            senderId: currentUser.uid,
                            receiverId: profileUserId,
                            status: 'pending',
                            createdAt: new Date()
                        });
                        friendRequestBtn.textContent = 'Request Sent';
                        friendRequestBtn.disabled = true;
                    });
                }
            }
        }
    }
});
