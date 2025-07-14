/**
 * HatakeSocial - Messenger Widget Script (v4 - Full Chat Functionality)
 *
 * This script handles all logic for the site-wide messenger widget.
 * - NEW: Implements a full chat view within the widget itself.
 * - NEW: Users can now open conversations, view messages, and send replies without leaving the current page.
 * - NEW: Adds a "back" button to navigate from a chat view back to the conversation list.
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
    const widgetBody = document.getElementById('messenger-widget-body');
    const conversationListEl = document.getElementById('widget-conversations-list');
    const openBtn = document.getElementById('messenger-open-btn');
    const headerText = document.getElementById('widget-main-header-text');

    // --- State ---
    let currentConversationListener = null;
    let activeView = 'list'; // 'list' or 'chat'

    // --- Helper Functions ---
    const sanitizeHTML = (str) => {
        if (!str) return '';
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    };

    // --- Main Functions ---

    const toggleWidget = () => {
        messengerContainer.classList.toggle('minimized');
    };

    const showConversationList = () => {
        activeView = 'list';
        headerText.textContent = 'Messages';
        widgetBody.innerHTML = '<div id="widget-conversations-list" class="flex-grow overflow-y-auto"></div>';
        loadConversations();
    };

    const loadConversations = () => {
        const listEl = widgetBody.querySelector('#widget-conversations-list');
        if (!listEl) return;
        
        const conversationsRef = db.collection('conversations')
            .where('participants', 'array-contains', user.uid)
            .orderBy('updatedAt', 'desc');

        conversationsRef.onSnapshot(snapshot => {
            listEl.innerHTML = '';
            if (snapshot.empty) {
                listEl.innerHTML = '<p class="text-center text-sm text-gray-500 p-4">No conversations.</p>';
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
                    <img src="${sanitizeHTML(imageUrl)}" class="h-10 w-10 rounded-full mr-3 object-cover">
                    <div class="flex-grow overflow-hidden">
                        <span class="font-bold text-gray-800 dark:text-white">${sanitizeHTML(title)}</span>
                        <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${sanitizeHTML(convo.lastMessage) || 'No messages yet'}</p>
                    </div>
                `;
                convoEl.addEventListener('click', () => openChatView(doc.id, title));
                listEl.appendChild(convoEl);
            });
        }, error => {
            console.error("Error loading widget conversations: ", error);
            listEl.innerHTML = '<p class="text-center text-sm text-red-500 p-4">Error loading chats.</p>';
        });
    };

    const openChatView = (conversationId, title) => {
        activeView = 'chat';
        headerText.innerHTML = `<button id="widget-back-btn" class="mr-2 text-white"><i class="fas fa-arrow-left"></i></button> <span class="truncate">${sanitizeHTML(title)}</span>`;
        
        widgetBody.innerHTML = `
            <div id="widget-messages-container" class="flex-grow p-2 overflow-y-auto flex flex-col gap-2">
                <!-- Messages will be loaded here -->
            </div>
            <div class="p-2 border-t dark:border-gray-600">
                <form id="widget-message-form" class="flex">
                    <input type="text" class="w-full bg-gray-100 dark:bg-gray-700 p-2 rounded-l-md focus:outline-none" placeholder="Type a message...">
                    <button type="submit" class="bg-blue-600 text-white px-4 rounded-r-md font-semibold">Send</button>
                </form>
            </div>
        `;

        const messagesContainer = widgetBody.querySelector('#widget-messages-container');
        const messageForm = widgetBody.querySelector('#widget-message-form');
        const messageInput = messageForm.querySelector('input');

        document.getElementById('widget-back-btn').addEventListener('click', showConversationList);

        if (currentConversationListener) currentConversationListener(); // Unsubscribe from old listener

        currentConversationListener = db.collection('conversations').doc(conversationId)
            .onSnapshot(doc => {
                if (!doc.exists) return;
                const conversation = doc.data();
                messagesContainer.innerHTML = '';
                const messages = conversation.messages || [];
                messages.forEach(msg => {
                    const msgEl = document.createElement('div');
                    const isSent = msg.senderId === user.uid;
                    msgEl.className = `flex ${isSent ? 'justify-end' : 'justify-start'}`;
                    msgEl.innerHTML = `
                        <div class="max-w-xs px-3 py-2 rounded-lg ${isSent ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white'}">
                            ${sanitizeHTML(msg.content)}
                        </div>
                    `;
                    messagesContainer.appendChild(msgEl);
                });
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });
        
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = messageInput.value.trim();
            if (!content) return;

            const newMessage = {
                content: content,
                senderId: user.uid,
                timestamp: new Date()
            };
            
            messageInput.value = '';
            try {
                await db.collection('conversations').doc(conversationId).update({
                    messages: firebase.firestore.FieldValue.arrayUnion(newMessage),
                    lastMessage: content,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error("Error sending message from widget:", error);
                messageInput.value = content; // Restore on failure
            }
        });
    };

    // --- Initial Setup ---
    widgetHeader.addEventListener('click', () => {
        if (activeView === 'chat') {
            // If in chat view, header click should not minimize, only back button should work
            return;
        }
        toggleWidget();
    });
    openBtn.addEventListener('click', toggleWidget);

    showConversationList();
});
