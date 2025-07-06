/**
 * HatakeSocial - Messenger Widget Script (v3 - Redesign & Rules Fix)
 *
 * This script handles all logic for the site-wide messenger widget.
 * - NEW: Implements the redesigned UI with a circular open button.
 * - FIX: Works with the updated, correct security rules.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const messengerContainer = document.getElementById('messenger-widget-container');
    if (!messengerContainer) return;
    
    if (!user) {
        messengerContainer.style.display = 'none';
        return;
    }
    
    messengerContainer.style.display = 'block';

    // --- DOM Elements ---
    const widgetHeader = document.getElementById('messenger-widget-header');
    const conversationListEl = document.getElementById('widget-conversations-list');
    const openBtn = document.getElementById('messenger-open-btn');

    // --- Main Functions ---

    // Toggle widget visibility (minimize/maximize)
    const toggleWidget = () => {
        messengerContainer.classList.toggle('minimized');
    };

    widgetHeader.addEventListener('click', toggleWidget);
    openBtn.addEventListener('click', toggleWidget);


    // Load all conversations (users and groups)
    const loadConversations = () => {
        const conversationsRef = db.collection('conversations')
            .where('participants', 'array-contains', user.uid)
            .orderBy('updatedAt', 'desc');

        conversationsRef.onSnapshot(snapshot => {
            conversationListEl.innerHTML = '';
            if (snapshot.empty) {
                conversationListEl.innerHTML = '<p class="text-center text-sm text-gray-500 p-4">No conversations.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const convo = doc.data();
                let title = '';
                let imageUrl = 'https://placehold.co/40x40/cccccc/969696?text=G';

                if (convo.isGroupChat) {
                    title = convo.groupName || 'Group Chat';
                    imageUrl = convo.groupImage || imageUrl;
                } else {
                    const otherUserId = convo.participants.find(id => id !== user.uid);
                    if (otherUserId && convo.participantInfo && convo.participantInfo[otherUserId]) {
                        const otherUserInfo = convo.participantInfo[otherUserId];
                        title = otherUserInfo.displayName;
                        imageUrl = otherUserInfo.photoURL || 'https://placehold.co/40x40?text=U';
                    } else {
                        title = 'Unknown User';
                    }
                }

                const convoEl = document.createElement('div');
                convoEl.className = 'flex items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-200 dark:border-gray-700';
                convoEl.innerHTML = `
                    <img src="${imageUrl}" class="h-10 w-10 rounded-full mr-3 object-cover">
                    <div class="flex-grow overflow-hidden">
                        <span class="font-bold text-gray-800 dark:text-white">${title}</span>
                        <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${convo.lastMessage || 'No messages yet'}</p>
                    </div>
                `;
                // This would link to the main messages page, which you can implement later
                convoEl.addEventListener('click', () => {
                    window.location.href = `messages.html`;
                });
                conversationListEl.appendChild(convoEl);
            });
        }, error => {
            console.error("Error loading widget conversations: ", error);
            conversationListEl.innerHTML = '<p class="text-center text-sm text-red-500 p-4">Error loading chats.</p>';
        });
    };

    // Initial Load
    loadConversations();
});
