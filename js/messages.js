// js/messages.js

document.addEventListener('DOMContentLoaded', () => {
    const db = firebase.firestore();
    let currentUser = null;
    let currentConversationId = null;
    let currentConversationData = null;
    let unsubscribeConversation = null;
    let usersCache = {}; // Cache for user data

    const conversationsList = document.getElementById('conversations-list');
    const chatWindow = document.getElementById('chat-window');
    const chatHeader = document.getElementById('chat-header');
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const sendMessageBtn = document.getElementById('send-message-btn');
    const newConversationBtn = document.getElementById('new-conversation-btn');
    const newConversationModal = document.getElementById('new-conversation-modal');
    const closeBtn = document.querySelector('.close-btn');
    const searchUserInput = document.getElementById('search-user-input');
    const searchResults = document.getElementById('search-results');
    const createConversationBtn = document.getElementById('create-conversation-btn');

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadConversations();
            checkUrlForConversation();
        } else {
            // Redirect to login if not authenticated
            window.location.href = '/';
        }
    });

    const getUserData = async (userId) => {
        if (usersCache[userId]) {
            return usersCache[userId];
        }
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                usersCache[userId] = userData;
                return userData;
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
        return { displayName: 'Unknown User', photoURL: 'images/default-avatar.png' }; // Default data
    };

    const loadConversations = async () => {
        if (!currentUser) return;
        conversationsList.innerHTML = 'Loading conversations...';
        try {
            db.collection('conversations')
              .where('participants', 'array-contains', currentUser.uid)
              .orderBy('updatedAt', 'desc')
              .onSnapshot(async (snapshot) => {
                  if (snapshot.empty) {
                      conversationsList.innerHTML = '<p>No conversations yet. Start a new one!</p>';
                      return;
                  }
                  conversationsList.innerHTML = '';
                  for (const doc of snapshot.docs) {
                      const conversation = doc.data();
                      const conversationId = doc.id;
                      const otherParticipantId = conversation.participants.find(id => id !== currentUser.uid);
                      
                      if (otherParticipantId) {
                          const otherUserData = await getUserData(otherParticipantId);
                          const conversationElement = document.createElement('div');
                          conversationElement.classList.add('conversation-item');
                          conversationElement.dataset.id = conversationId;
                          
                          conversationElement.innerHTML = `
                              <img src="${otherUserData.photoURL || 'images/default-avatar.png'}" alt="${otherUserData.displayName}" class="avatar">
                              <div>
                                  <strong>${otherUserData.displayName}</strong>
                                  <p>${conversation.lastMessage ? (conversation.lastMessage.length > 30 ? conversation.lastMessage.substring(0, 30) + '...' : conversation.lastMessage) : 'No messages yet'}</p>
                              </div>
                          `;
                          conversationElement.addEventListener('click', () => selectConversation(conversationId));
                          conversationsList.appendChild(conversationElement);
                      }
                  }
              });
        } catch (error) {
            console.error("Error loading conversations: ", error);
            conversationsList.innerHTML = '<p>Error loading conversations.</p>';
        }
    };

    const selectConversation = async (conversationId) => {
        if (unsubscribeConversation) {
            unsubscribeConversation();
        }

        currentConversationId = conversationId;
        chatWindow.style.display = 'flex';

        const conversationRef = db.collection('conversations').doc(conversationId);
        
        unsubscribeConversation = conversationRef.onSnapshot(async (doc) => {
            if (doc.exists) {
                currentConversationData = doc.data();
                const otherParticipantId = currentConversationData.participants.find(id => id !== currentUser.uid);
                const otherUserData = await getUserData(otherParticipantId);

                chatHeader.innerHTML = `<h3>Chat with ${otherUserData.displayName}</h3>`;
                renderMessages(currentConversationData.messages);
            }
        });
        
        // Update URL without reloading
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?with=' + currentConversationId;
        window.history.pushState({path:newUrl},'',newUrl);
    };

    const renderMessages = async (messages) => {
        messagesContainer.innerHTML = '';
        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = '<p>No messages yet. Say hello!</p>';
            return;
        }

        for (const message of messages) {
            const senderData = await getUserData(message.senderId);
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            if (message.senderId === currentUser.uid) {
                messageElement.classList.add('sent');
            } else {
                messageElement.classList.add('received');
            }
            
            const timestamp = message.timestamp?.toDate ? message.timestamp.toDate().toLocaleTimeString() : new Date().toLocaleTimeString();

            messageElement.innerHTML = `
                <img src="${senderData.photoURL || 'images/default-avatar.png'}" alt="${senderData.displayName}" class="avatar">
                <div class="message-content">
                    <p>${message.content}</p>
                    <span class="timestamp">${timestamp}</span>
                </div>
            `;
            messagesContainer.appendChild(messageElement);
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const sendMessage = async () => {
        const content = messageInput.value.trim();
        if (!content || !currentConversationId || !currentConversationData) return;

        const conversationRef = db.collection('conversations').doc(currentConversationId);
        const newMessage = {
            content: content,
            senderId: currentUser.uid,
            timestamp: new Date()
        };
        
        const originalInput = content;
        messageInput.value = ''; // Clear input immediately for better UX

        try {
            await conversationRef.update({
                messages: firebase.firestore.FieldValue.arrayUnion(newMessage),
                lastMessage: content,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Send notifications to other participants
            const recipients = currentConversationData.participants.filter(id => id !== currentUser.uid);
            for (const recipientId of recipients) {
                // Create a snippet of the message for the notification
                const snippet = content.length > 50 ? content.substring(0, 47) + '...' : content;
                await createNotification(
                    recipientId,
                    `${currentUser.displayName}: ${snippet}`,
                    `/messages.html?conversationId=${currentConversationId}`
                );
            }
        } catch (error) {
            console.error("Error sending message:", error);
            // Restore input if sending failed
            messageInput.value = originalInput;
            // Optionally show an error message to the user
            alert("Could not send message. Please try again.");
        }
    };
    
    const createNotification = async (userId, message, link) => {
        if (!userId || !message) return;
        try {
            await db.collection('notifications').add({
                userId: userId,
                message: message,
                link: link,
                read: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Error creating notification:", error);
        }
    };

    const checkUrlForConversation = () => {
        const params = new URLSearchParams(window.location.search);
        const conversationId = params.get('conversationId') || params.get('with');
        if (conversationId) {
            // Validate that the current user is part of this conversation
            db.collection('conversations').doc(conversationId).get().then(doc => {
                if (doc.exists && doc.data().participants.includes(currentUser.uid)) {
                    selectConversation(conversationId);
                } else {
                    console.warn("User is not a participant of the requested conversation or it does not exist.");
                }
            });
        }
    };

    // Event Listeners
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    newConversationBtn.addEventListener('click', () => {
        newConversationModal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
        newConversationModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == newConversationModal) {
            newConversationModal.style.display = 'none';
        }
    });

    let searchTimeout;
    searchUserInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const searchTerm = searchUserInput.value.trim();
        if (searchTerm.length < 2) {
            searchResults.innerHTML = '';
            return;
        }
        searchResults.innerHTML = 'Searching...';
        searchTimeout = setTimeout(async () => {
            try {
                const usersRef = db.collection('users');
                const snapshot = await usersRef.where('displayName', '>=', searchTerm).where('displayName', '<=', searchTerm + '\uf8ff').get();
                
                searchResults.innerHTML = '';
                if (snapshot.empty) {
                    searchResults.innerHTML = 'No users found.';
                    return;
                }
                snapshot.forEach(doc => {
                    if (doc.id !== currentUser.uid) { // Don't show current user in results
                        const user = doc.data();
                        const userElement = document.createElement('div');
                        userElement.classList.add('search-result-item');
                        userElement.innerHTML = `
                            <span>${user.displayName}</span>
                            <button data-id="${doc.id}" data-name="${user.displayName}">Start Chat</button>
                        `;
                        searchResults.appendChild(userElement);
                    }
                });
            } catch (error) {
                console.error("Error searching users:", error);
                searchResults.innerHTML = 'Error searching for users.';
            }
        }, 500);
    });

    searchResults.addEventListener('click', async (event) => {
        if (event.target.tagName === 'BUTTON') {
            const userId = event.target.dataset.id;
            
            // Check if a conversation already exists
            const existingConversation = await db.collection('conversations')
                .where('participants', '==', [currentUser.uid, userId].sort())
                .get();

            if (!existingConversation.empty) {
                // Conversation exists, select it
                const conversationId = existingConversation.docs[0].id;
                selectConversation(conversationId);
            } else {
                // Create a new conversation
                const newConversationRef = await db.collection('conversations').add({
                    participants: [currentUser.uid, userId].sort(), // Store sorted to make querying easier
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    messages: [],
                    lastMessage: ''
                });
                selectConversation(newConversationRef.id);
            }
            newConversationModal.style.display = 'none';
            searchUserInput.value = '';
            searchResults.innerHTML = '';
        }
    });
});
