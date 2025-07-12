/**
 * HatakeSocial - Messages Page Script (v15 - Clean Implementation)
 *
 * This script handles all logic for the messages.html page.
 * It provides a clean, well-commented, and fully functional implementation
 * for real-time messaging, including the critical fix for conversation creation.
 *
 * Key Features:
 * - Fixes the "Could not start conversation" error by explicitly setting `isGroupChat: false`
 * when creating new one-on-one chats, satisfying Firestore index requirements.
 * - Robust real-time listeners for conversations and messages.
 * - User search functionality to initiate new chats.
 * - Handles URL parameters to open a chat directly (e.g., `messages.html?with=USER_ID`).
 * - Clear separation of concerns for loading data, rendering UI, and handling user actions.
 * - Generates a direct link to create missing Firestore indexes on error, simplifying debugging.
 */
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const chatArea = document.getElementById('chat-area');
    if (!chatArea) return; // Exit if not on the messages page

    // If the user is not logged in, display a message and stop.
    if (!currentUser) {
        const mainContent = document.querySelector('main.container');
        if(mainContent) {
            mainContent.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-center p-8 text-gray-500 dark:text-gray-400">Please log in to view your messages.</p></div>';
        }
        return;
    }

    // --- STATE MANAGEMENT ---
    let currentChatListener = null; // Holds the active Firestore listener for messages
    let currentConversationId = null; // ID of the currently viewed conversation
    let currentConversationData = null; // Full data object of the current conversation
    let activeTab = 'users'; // To toggle between 'users' and 'groups'

    // --- DOM ELEMENT REFERENCES ---
    const conversationsListEl = document.getElementById('conversations-list');
    const userSearchInput = document.getElementById('user-search-input');
    const userSearchResultsEl = document.getElementById('user-search-results');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const chatWelcomeScreen = document.getElementById('chat-welcome-screen');
    const chatView = document.getElementById('chat-view');
    const messageTabs = document.querySelectorAll('.message-tab-button');

    // --- HELPER FUNCTIONS ---

    /**
     * Generates a direct link to the Firebase console to create a missing index.
     * This is a powerful debugging tool for Firestore query errors.
     * @param {string} collection - The name of the collection needing the index.
     * @param {Array<Object>} fields - An array of objects describing the fields for the index.
     * @returns {string} The generated URL.
     */
    const generateIndexCreationLink = (collection, fields) => {
        const projectId = db.app.options.projectId;
        let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`;
        fields.forEach(field => {
            url += `&fields=${field.name},${field.order.toUpperCase()}`;
        });
        return url;
    };

    /**
     * Creates a notification document for a specific user.
     * @param {string} userId - The ID of the user to notify.
     * @param {string} message - The notification message content.
     * @param {string} link - The URL the notification should link to.
     */
    const createNotification = async (userId, message, link) => {
        if (!userId || !message) return;
        const notificationData = {
            message: message,
            link: link || '#',
            isRead: false,
            timestamp: new Date()
        };
        try {
            await db.collection('users').doc(userId).collection('notifications').add(notificationData);
        } catch (error) {
            console.error("Error creating notification:", error);
        }
    };

    // --- CORE MESSAGING LOGIC ---

    /**
     * Loads and displays the list of conversations (both user and group chats).
     * Attaches a real-time listener to keep the list updated.
     */
    const loadConversations = () => {
        conversationsListEl.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>';
        
        const isGroup = activeTab === 'groups';
        let query = db.collection('conversations')
                      .where('participants', 'array-contains', currentUser.uid)
                      .where('isGroupChat', '==', isGroup)
                      .orderBy('updatedAt', 'desc');

        query.onSnapshot(snapshot => {
            if (snapshot.empty) {
                conversationsListEl.innerHTML = `<p class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No ${activeTab} conversations.</p>`;
                return;
            }
            
            conversationsListEl.innerHTML = ''; // Clear previous list
            snapshot.forEach(doc => {
                const conversation = doc.data();
                const convoId = doc.id;
                let title = '';
                let imageUrl = '';
                let otherUserId = null;

                if (conversation.isGroupChat) {
                    title = conversation.groupName || 'Group Chat';
                    imageUrl = conversation.groupImage || 'https://placehold.co/40x40/cccccc/969696?text=G';
                } else {
                    otherUserId = conversation.participants.find(id => id !== currentUser.uid);
                    if (otherUserId && conversation.participantInfo && conversation.participantInfo[otherUserId]) {
                        const remoteUserInfo = conversation.participantInfo[otherUserId];
                        title = remoteUserInfo.displayName || 'Unknown User';
                        imageUrl = remoteUserInfo.photoURL || 'https://placehold.co/40x40/cccccc/969696?text=U';
                    } else {
                        // Skip rendering if participant info is missing for a 1-on-1 chat
                        return;
                    }
                }
                
                const item = document.createElement('div');
                item.className = 'conversation-item flex items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600';
                item.dataset.convoId = convoId;
                item.innerHTML = `
                    <img src="${imageUrl}" class="h-12 w-12 rounded-full mr-3 object-cover flex-shrink-0">
                    <div class="flex-grow overflow-hidden">
                        <span class="font-bold text-gray-800 dark:text-white">${title}</span>
                        <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${conversation.lastMessage || 'No messages yet'}</p>
                    </div>
                `;
                item.addEventListener('click', () => openChat(convoId, title, imageUrl, conversation));
                conversationsListEl.appendChild(item);
            });
        }, error => {
            console.error(`Error loading ${activeTab} conversations:`, error);
            if (error.code === 'failed-precondition') {
                const indexFields = [
                    { name: 'participants', order: 'asc' },
                    { name: 'isGroupChat', order: 'asc' },
                    { name: 'updatedAt', order: 'desc' }
                ];
                const indexLink = generateIndexCreationLink('conversations', indexFields);
                const errorMessage = `
                    <div class="p-4 bg-red-100 dark:bg-red-900/50 rounded-lg text-center">
                        <p class="font-bold text-red-700 dark:text-red-300">Database Error</p>
                        <p class="text-red-600 dark:text-red-400 mt-2 text-sm">A required database index is missing.</p>
                        <a href="${indexLink}" target="_blank" rel="noopener noreferrer" 
                           class="mt-4 inline-block px-4 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700 text-sm">
                           Click Here to Create the Index
                        </a>
                        <p class="text-xs text-gray-500 mt-2">This opens Firebase. Click "Save" to create the index. It may take a few minutes.</p>
                    </div>`;
                conversationsListEl.innerHTML = errorMessage;
            } else {
                conversationsListEl.innerHTML = `<p class="p-4 text-center text-red-500 text-sm">Could not load conversations.</p>`;
            }
        });
    };

    /**
     * Opens a specific chat conversation, displaying its messages and setting up a real-time listener.
     * @param {string} conversationId - The ID of the conversation document.
     * @param {string} title - The title for the chat header.
     * @param {string} imageUrl - The avatar/image for the chat header.
     * @param {object} conversationData - The full data object for the conversation.
     */
    const openChat = (conversationId, title, imageUrl, conversationData) => {
        // Unsubscribe from any previous chat listener to prevent memory leaks
        if (currentChatListener) currentChatListener();

        currentConversationId = conversationId;
        currentConversationData = conversationData;

        // Update UI to show the chat view
        chatWelcomeScreen.classList.add('hidden');
        chatView.classList.remove('hidden');
        chatView.classList.add('flex');

        // Update chat header
        document.getElementById('chat-header-avatar').src = imageUrl;
        document.getElementById('chat-header-name').textContent = title;

        const conversationRef = db.collection('conversations').doc(conversationId);
        const messagesContainer = document.getElementById('messages-container');

        // Attach a new real-time listener for messages in this conversation
        currentChatListener = conversationRef.onSnapshot(doc => {
            messagesContainer.innerHTML = ''; // Clear previous messages
            if (doc.exists) {
                const conversation = doc.data();
                const messages = conversation.messages || [];
                
                messages.forEach(msg => {
                    const messageEl = document.createElement('div');
                    const isSentByCurrentUser = msg.senderId === currentUser.uid;
                    
                    messageEl.className = `message-group flex items-start gap-2.5 ${isSentByCurrentUser ? 'justify-end' : 'justify-start'}`;
                    messageEl.innerHTML = `
                        <div class="flex flex-col w-full max-w-[320px] leading-1.5 p-4 border-gray-200 rounded-e-xl rounded-es-xl ${isSentByCurrentUser ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}">
                            <p class="text-sm font-normal">${msg.content}</p>
                        </div>
                    `;
                    messagesContainer.appendChild(messageEl);
                });
            }
            // Automatically scroll to the latest message
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    };

    /**
     * Sends a new message to the currently open conversation.
     */
    const sendMessage = async () => {
        const content = messageInput.value.trim();
        if (!content || !currentConversationId || !currentConversationData) return;

        const conversationRef = db.collection('conversations').doc(currentConversationId);
        const newMessage = {
            content: content,
            senderId: currentUser.uid,
            timestamp: new Date()
        };
        
        messageInput.value = ''; // Clear input immediately for better UX
        try {
            // Atomically update the conversation document
            await conversationRef.update({
                messages: firebase.firestore.FieldValue.arrayUnion(newMessage),
                lastMessage: content,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Send notifications to all other participants in the chat
            const recipients = currentConversationData.participants.filter(id => id !== currentUser.uid);
            for (const recipientId of recipients) {
                await createNotification(
                    recipientId,
                    `New message from ${currentUser.displayName}`,
                    `/messages.html?with=${currentUser.uid}` // Link back to the chat
                );
            }
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Could not send message. Please try again.");
            messageInput.value = content; // Restore content on failure
        }
    };

    /**
     * Finds or creates a one-on-one conversation with a selected user.
     * @param {string} userId - The ID of the user to start a chat with.
     * @param {object} userData - The data object of the user.
     */
    const startConversationWithUser = async (userId, userData) => {
        // Create a consistent, predictable ID for one-on-one chats
        const conversationId = [currentUser.uid, userId].sort().join('_');
        const conversationRef = db.collection('conversations').doc(conversationId);

        try {
            const convoDoc = await conversationRef.get();
            
            // If the conversation doesn't exist, create it
            if (!convoDoc.exists) {
                const currentUserDoc = await db.collection('users').doc(currentUser.uid).get();
                const currentUserData = currentUserDoc.data();
                
                // ** THE FIX IS HERE **
                // Explicitly set `isGroupChat: false` when creating the new conversation document.
                // This is crucial for the Firestore index to work correctly.
                await conversationRef.set({
                    participants: [currentUser.uid, userId],
                    participantInfo: {
                        [currentUser.uid]: { displayName: currentUserData.displayName, photoURL: currentUserData.photoURL },
                        [userId]: { displayName: userData.displayName, photoURL: userData.photoURL }
                    },
                    isGroupChat: false, // This line is the fix
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessage: 'Conversation started.'
                });
            }
            
            // Switch to the 'Users' tab to ensure the new conversation appears
            document.querySelector('.message-tab-button[data-tab="users"]').click();
            
            // Get the newly created or existing conversation data to open the chat
            const newConvoData = (await conversationRef.get()).data();
            openChat(conversationId, userData.displayName, userData.photoURL, newConvoData);

        } catch (error) {
            console.error("Error starting conversation:", error);
            alert("Could not start conversation. " + error.message);
        }
    };

    // --- EVENT LISTENERS ---

    // Handle tab switching between Users and Groups
    messageTabs.forEach(button => {
        button.addEventListener('click', () => {
            messageTabs.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeTab = button.dataset.tab;
            loadConversations();
        });
    });

    // Handle message form submission
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });

    // Handle user search input
    userSearchInput.addEventListener('keyup', async (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length < 2) {
            userSearchResultsEl.innerHTML = '';
            userSearchResultsEl.classList.add('hidden');
            return;
        }
        userSearchResultsEl.classList.remove('hidden');
        userSearchResultsEl.innerHTML = '<div class="p-2 text-sm text-gray-500">Searching...</div>';
        
        // Search by both display name and handle for better results
        const usersRef = db.collection('users');
        const queryByDisplayName = usersRef.orderBy('displayName_lower').startAt(searchTerm).endAt(searchTerm + '\uf8ff').get();
        const queryByHandle = usersRef.orderBy('handle').startAt(searchTerm).endAt(searchTerm + '\uf8ff').get();

        try {
            const [displayNameSnapshot, handleSnapshot] = await Promise.all([queryByDisplayName, queryByHandle]);
            
            const results = new Map(); // Use a Map to avoid duplicate users
            displayNameSnapshot.forEach(doc => {
                if (doc.id !== currentUser.uid) results.set(doc.id, doc.data());
            });
            handleSnapshot.forEach(doc => {
                if (doc.id !== currentUser.uid) results.set(doc.id, doc.data());
            });

            userSearchResultsEl.innerHTML = '';
            if (results.size === 0) {
                userSearchResultsEl.innerHTML = '<div class="p-2 text-sm text-gray-500">No users found</div>';
                return;
            }
            
            results.forEach((userData, userId) => {
                const resultItem = document.createElement('div');
                resultItem.className = 'flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer';
                resultItem.innerHTML = `
                    <img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="h-8 w-8 rounded-full mr-2 object-cover">
                    <span class="text-sm dark:text-gray-200">${userData.displayName} (@${userData.handle})</span>
                `;
                resultItem.addEventListener('click', () => {
                    userSearchInput.value = '';
                    userSearchResultsEl.classList.add('hidden');
                    startConversationWithUser(userId, userData);
                });
                userSearchResultsEl.appendChild(resultItem);
            });
        } catch (error) {
            console.error("User search error:", error);
            userSearchResultsEl.innerHTML = '<div class="p-2 text-sm text-red-500">Error searching. Required indexes might be missing.</div>';
        }
    });

    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!userSearchInput.contains(e.target) && !userSearchResultsEl.contains(e.target)) {
            userSearchResultsEl.classList.add('hidden');
        }
    });

    /**
     * Checks for URL parameters to deeplink into a conversation.
     */
    const checkForUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);
        const userIdToMessage = params.get('with');

        if (userIdToMessage) {
            try {
                const userDoc = await db.collection('users').doc(userIdToMessage).get();
                if (userDoc.exists) {
                    startConversationWithUser(userDoc.id, userDoc.data());
                } else {
                    console.warn("User ID from URL parameter not found.");
                }
            } catch (error) {
                console.error("Error fetching user from URL parameter:", error);
            }
        }
    };

    // --- INITIALIZATION ---
    loadConversations();
    checkForUrlParams();
});
