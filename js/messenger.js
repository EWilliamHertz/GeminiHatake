/**
 * HatakeSocial - Messenger Widget Script (v2 - Query Fixed)
 *
 * This script handles all logic for the site-wide messenger widget.
 * - Corrects the Firestore query to use the 'participants' field.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const messengerWidget = document.getElementById('messenger-widget');
    if (!messengerWidget || !user) {
        if(messengerWidget) messengerWidget.style.display = 'none';
        return;
    }
    
    messengerWidget.style.display = 'block';

    // --- DOM Elements ---
    const widgetHeader = document.getElementById('messenger-widget-header');
    const widgetBody = document.getElementById('messenger-widget-body');
    const conversationListEl = document.getElementById('widget-conversations-list');
    const chatViewEl = document.getElementById('widget-chat-view');
    const chatHeaderName = document.getElementById('widget-chat-header-name');
    const backToConversationsBtn = document.getElementById('widget-back-btn');
    const messagesContainer = document.getElementById('widget-messages-container');
    const messageInput = document.getElementById('widget-message-input');
    const sendMessageBtn = document.getElementById('widget-send-btn');

    let currentConversationId = null;
    let currentConversationListener = null;

    // --- Main Functions ---

    // Toggle widget visibility (minimize/maximize)
    widgetHeader.addEventListener('click', (e) => {
        if (e.target.closest('#widget-back-btn')) return; // Don't toggle if back button is clicked
        messengerWidget.classList.toggle('minimized');
    });

    // Go back from a chat view to the conversation list
    backToConversationsBtn.addEventListener('click', () => {
        chatViewEl.classList.add('hidden');
        conversationListEl.parentElement.classList.remove('hidden');
        if (currentConversationListener) {
            currentConversationListener(); // Unsubscribe from message updates
            currentConversationListener = null;
        }
        currentConversationId = null;
    });

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
                const conversationId = doc.id;
                let title = '';
                let imageUrl = 'https://placehold.co/40x40/cccccc/969696?text=G';

                if (convo.isGroupChat) {
                    title = convo.groupName || 'Group Chat';
                    imageUrl = convo.groupImage || imageUrl;
                } else {
                    const otherUserId = convo.participants.find(id => id !== user.uid);
                    const otherUserInfo = convo.participantInfo[otherUserId];
                    if (otherUserInfo) {
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
                convoEl.addEventListener('click', () => openChat(conversationId, title));
                conversationListEl.appendChild(convoEl);
            });
        }, error => {
            console.error("Error loading widget conversations: ", error);
            conversationListEl.innerHTML = '<p class="text-center text-sm text-red-500 p-4">Error loading chats.</p>';
        });
    };

    // Open a specific chat
    const openChat = (conversationId, title) => {
        currentConversationId = conversationId;
        conversationListEl.parentElement.classList.add('hidden');
        chatViewEl.classList.remove('hidden');
        chatHeaderName.textContent = title;
        messagesContainer.innerHTML = ''; // Clear previous messages

        if (currentConversationListener) currentConversationListener(); // Detach old listener

        const conversationRef = db.collection('conversations').doc(conversationId);
        currentConversationListener = conversationRef.onSnapshot(doc => {
            messagesContainer.innerHTML = '';
            if (doc.exists) {
                const conversation = doc.data();
                const messages = conversation.messages || [];
                messages.forEach(msg => {
                    const msgEl = document.createElement('div');
                    const isSent = msg.senderId === user.uid;
                    const senderInfo = conversation.participantInfo[msg.senderId];
                    const senderName = senderInfo ? senderInfo.displayName : 'Unknown';

                    msgEl.className = `flex flex-col mb-3 ${isSent ? 'items-end' : 'items-start'}`;
                    msgEl.innerHTML = `
                        ${!isSent ? `<div class="text-xs text-gray-500 dark:text-gray-400 ml-2">${senderName}</div>` : ''}
                        <div class="max-w-xs p-3 rounded-lg ${isSent ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white'}">
                            ${msg.content}
                        </div>
                    `;
                    messagesContainer.appendChild(msgEl);
                });
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        });
    };

    // Send a message
    const sendMessage = async () => {
        const content = messageInput.value.trim();
        if (!content || !currentConversationId) return;

        const conversationRef = db.collection('conversations').doc(currentConversationId);
        
        const newMessage = {
            content: content,
            senderId: user.uid,
            timestamp: new Date()
        };

        messageInput.value = '';

        try {
            await conversationRef.update({
                messages: firebase.firestore.FieldValue.arrayUnion(newMessage),
                lastMessage: content,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending message: ", error);
        }
    };

    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Initial Load
    loadConversations();
});
