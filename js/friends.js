/**
 * HatakeSocial - Friends Page Script
 *
 * This script handles all logic for the friends.html page, including
 * displaying friends, showing friend requests, and handling accept/reject actions.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const friendsPageContainer = document.getElementById('friends-page-container');
    if (!friendsPageContainer) return;

    if (!currentUser) {
        friendsPageContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">Please log in to manage your friends.</p>';
        return;
    }

    const requestsListEl = document.getElementById('friend-requests-list');
    const friendsListEl = document.getElementById('friends-list');

    const loadFriendsPage = async () => {
        loadFriendRequests();
        loadFriendsList();
    };

    const loadFriendRequests = async () => {
        requestsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Loading requests...</p>';
        const requestsSnapshot = await db.collection('friendRequests')
            .where('receiverId', '==', currentUser.uid)
            .where('status', '==', 'pending')
            .get();

        if (requestsSnapshot.empty) {
            requestsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No new friend requests.</p>';
            return;
        }

        requestsListEl.innerHTML = '';
        requestsSnapshot.forEach(async (doc) => {
            const request = doc.data();
            const senderDoc = await db.collection('users').doc(request.senderId).get();
            if (senderDoc.exists) {
                const sender = senderDoc.data();
                const requestCard = document.createElement('div');
                requestCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center justify-between';
                requestCard.innerHTML = `
                    <a href="profile.html?uid=${request.senderId}" class="flex items-center space-x-3">
                        <img src="${sender.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-12 h-12 rounded-full object-cover">
                        <div>
                            <p class="font-semibold text-gray-800 dark:text-white">${sender.displayName}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">@${sender.handle}</p>
                        </div>
                    </a>
                    <div class="flex space-x-2">
                        <button class="accept-friend-btn bg-green-500 text-white w-8 h-8 rounded-full hover:bg-green-600 transition" data-request-id="${doc.id}" data-sender-id="${request.senderId}"><i class="fas fa-check"></i></button>
                        <button class="reject-friend-btn bg-red-500 text-white w-8 h-8 rounded-full hover:bg-red-600 transition" data-request-id="${doc.id}"><i class="fas fa-times"></i></button>
                    </div>
                `;
                requestsListEl.appendChild(requestCard);
            }
        });
    };

    const loadFriendsList = async () => {
        friendsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Loading friends...</p>';
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const friendIds = userDoc.data()?.friends || [];

        if (friendIds.length === 0) {
            friendsListEl.innerHTML = '<p class="text-gray-500 dark:text-gray-400">You haven\'t added any friends yet.</p>';
            return;
        }

        friendsListEl.innerHTML = '';
        for (const friendId of friendIds) {
            const friendDoc = await db.collection('users').doc(friendId).get();
            if (friendDoc.exists) {
                const friend = friendDoc.data();
                const friendCard = document.createElement('a');
                friendCard.href = `profile.html?uid=${friendId}`;
                friendCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col items-center text-center hover:shadow-lg transition';
                friendCard.innerHTML = `
                    <img src="${friend.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-24 h-24 rounded-full object-cover mb-4">
                    <p class="font-semibold text-gray-800 dark:text-white">${friend.displayName}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">@${friend.handle}</p>
                `;
                friendsListEl.appendChild(friendCard);
            }
        }
    };

    // Event Delegation for handling accept/reject buttons
    friendsPageContainer.addEventListener('click', async (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        const isAccept = target.classList.contains('accept-friend-btn');
        const isReject = target.classList.contains('reject-friend-btn');

        if (isAccept) {
            const requestId = target.dataset.requestId;
            const senderId = target.dataset.senderId;
            
            // Use a Cloud Function trigger or a more secure rule for this in production
            const batch = db.batch();
            const userRef = db.collection('users').doc(currentUser.uid);
            const senderRef = db.collection('users').doc(senderId);
            const requestRef = db.collection('friendRequests').doc(requestId);

            batch.update(userRef, { friends: firebase.firestore.FieldValue.arrayUnion(senderId) });
            batch.update(senderRef, { friends: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
            batch.delete(requestRef);

            await batch.commit();
            loadFriendsPage(); // Refresh both lists
        }

        if (isReject) {
            const requestId = target.dataset.requestId;
            await db.collection('friendRequests').doc(requestId).delete();
            loadFriendsPage(); // Refresh both lists
        }
    });

    // Initial Load
    loadFriendsPage();
});
