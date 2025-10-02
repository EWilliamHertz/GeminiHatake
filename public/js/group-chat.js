/**
 * Real-time Group Chat System for HatakeSocial
 * Implements live messaging functionality for groups with real-time updates
 */

class GroupChatManager {
    constructor(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
        this.activeGroupId = null;
        this.messagesListener = null;
        this.typingTimeout = null;
        this.typingUsers = new Set();
        this.messageCache = new Map();
        this.init();
    }

    init() {
        this.setupChatInterface();
        this.setupMessageHandlers();
        this.setupTypingIndicators();
    }

    setupChatInterface() {
        // Create chat interface if it doesn't exist
        if (!document.getElementById('group-chat-container')) {
            this.createChatInterface();
        }
    }

    createChatInterface() {
        const chatHTML = `
            <div id="group-chat-container" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
                    <!-- Chat Header -->
                    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                                <i class="fas fa-users text-white"></i>
                            </div>
                            <div>
                                <h3 id="chat-group-name" class="font-semibold text-gray-800 dark:text-white">Group Chat</h3>
                                <p id="chat-group-members" class="text-sm text-gray-500 dark:text-gray-400">0 members</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button id="chat-group-info-btn" class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                                <i class="fas fa-info-circle"></i>
                            </button>
                            <button id="close-chat-btn" class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Chat Messages Area -->
                    <div id="chat-messages-container" class="flex-1 overflow-y-auto p-4 space-y-4">
                        <div class="text-center text-gray-500 dark:text-gray-400">
                            <i class="fas fa-comments text-4xl mb-2"></i>
                            <p>Welcome to the group chat!</p>
                        </div>
                    </div>

                    <!-- Typing Indicators -->
                    <div id="typing-indicators" class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hidden">
                        <i class="fas fa-circle animate-pulse"></i>
                        <span id="typing-text">Someone is typing...</span>
                    </div>

                    <!-- Chat Input Area -->
                    <div class="border-t border-gray-200 dark:border-gray-700 p-4">
                        <div class="flex items-end space-x-2">
                            <div class="flex-1">
                                <div class="flex items-center space-x-2 mb-2">
                                    <button id="attach-file-btn" class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                                        <i class="fas fa-paperclip"></i>
                                    </button>
                                    <button id="emoji-btn" class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                                        <i class="fas fa-smile"></i>
                                    </button>
                                </div>
                                <textarea id="chat-message-input" 
                                         class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" 
                                         placeholder="Type your message..." 
                                         rows="2"></textarea>
                            </div>
                            <button id="send-message-btn" 
                                    class="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                        <div class="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>Press Enter to send, Shift+Enter for new line</span>
                            <span id="message-counter">0/500</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- File Upload Input (Hidden) -->
            <input type="file" id="chat-file-input" class="hidden" accept="image/*,video/*,.pdf,.doc,.docx">
        `;

        document.body.insertAdjacentHTML('beforeend', chatHTML);
    }

    setupMessageHandlers() {
        const sendBtn = document.getElementById('send-message-btn');
        const messageInput = document.getElementById('chat-message-input');
        const closeChatBtn = document.getElementById('close-chat-btn');
        const attachFileBtn = document.getElementById('attach-file-btn');
        const fileInput = document.getElementById('chat-file-input');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                } else if (e.key === 'Enter' && e.shiftKey) {
                    // Allow new line
                    return;
                }
            });

            messageInput.addEventListener('input', (e) => {
                this.updateMessageCounter();
                this.handleTyping();
            });

            messageInput.addEventListener('paste', (e) => {
                // Handle pasted images
                const items = e.clipboardData.items;
                for (let item of items) {
                    if (item.type.indexOf('image') !== -1) {
                        const file = item.getAsFile();
                        this.handleFileUpload(file);
                        e.preventDefault();
                        break;
                    }
                }
            });
        }

        if (closeChatBtn) {
            closeChatBtn.addEventListener('click', () => this.closeChat());
        }

        if (attachFileBtn && fileInput) {
            attachFileBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });
        }
    }

    setupTypingIndicators() {
        const messageInput = document.getElementById('chat-message-input');
        if (!messageInput) return;

        messageInput.addEventListener('input', () => {
            this.sendTypingIndicator();
        });

        messageInput.addEventListener('blur', () => {
            this.stopTypingIndicator();
        });
    }

    async openGroupChat(groupId) {
        if (!this.currentUser) {
            alert('Please log in to access group chat');
            return;
        }

        try {
            // Get group data
            const groupDoc = await this.db.collection('groups').doc(groupId).get();
            if (!groupDoc.exists) {
                alert('Group not found');
                return;
            }

            const groupData = groupDoc.data();
            
            // Check if user is a member
            if (!groupData.participants?.includes(this.currentUser.uid)) {
                alert('You must be a member to access this group chat');
                return;
            }

            // Check if chat is enabled
            if (!groupData.chatEnabled) {
                alert('Chat is not enabled for this group');
                return;
            }

            this.activeGroupId = groupId;
            this.updateChatHeader(groupData);
            this.loadMessages(groupId);
            this.setupMessageListener(groupId);
            this.setupTypingListener(groupId);
            
            // Show chat interface
            document.getElementById('group-chat-container').classList.remove('hidden');
            
            // Focus on message input
            setTimeout(() => {
                document.getElementById('chat-message-input')?.focus();
            }, 100);

        } catch (error) {
            console.error('Error opening group chat:', error);
            alert('Failed to open group chat');
        }
    }

    updateChatHeader(groupData) {
        const groupNameEl = document.getElementById('chat-group-name');
        const groupMembersEl = document.getElementById('chat-group-members');

        if (groupNameEl) {
            groupNameEl.textContent = groupData.name;
        }

        if (groupMembersEl) {
            const memberCount = groupData.participantCount || 0;
            groupMembersEl.textContent = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
        }
    }

    async loadMessages(groupId, limit = 50) {
        try {
            const messagesRef = this.db.collection('groups').doc(groupId).collection('messages');
            const snapshot = await messagesRef
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            const messages = [];
            snapshot.forEach(doc => {
                messages.unshift({ id: doc.id, ...doc.data() });
            });

            this.displayMessages(messages);
            this.scrollToBottom();

        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    setupMessageListener(groupId) {
        if (this.messagesListener) {
            this.messagesListener();
        }

        const messagesRef = this.db.collection('groups').doc(groupId).collection('messages');
        
        this.messagesListener = messagesRef
            .orderBy('timestamp', 'desc')
            .limit(1)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const message = { id: change.doc.id, ...change.doc.data() };
                        this.addNewMessage(message);
                    }
                });
            });
    }

    setupTypingListener(groupId) {
        const typingRef = this.db.collection('groups').doc(groupId).collection('typing');
        
        typingRef.onSnapshot((snapshot) => {
            const typingUsers = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.userId !== this.currentUser.uid && 
                    Date.now() - data.timestamp.toMillis() < 3000) {
                    typingUsers.push(data.userName);
                }
            });
            
            this.updateTypingIndicators(typingUsers);
        });
    }

    displayMessages(messages) {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        container.innerHTML = '';

        if (messages.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 dark:text-gray-400">
                    <i class="fas fa-comments text-4xl mb-2"></i>
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `;
            return;
        }

        messages.forEach(message => {
            this.addMessageToDOM(message);
        });
    }

    addNewMessage(message) {
        // Avoid duplicates
        if (this.messageCache.has(message.id)) return;
        
        this.messageCache.set(message.id, message);
        this.addMessageToDOM(message);
        this.scrollToBottom();
    }

    addMessageToDOM(message) {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        const isOwnMessage = message.senderId === this.currentUser.uid;
        const timestamp = message.timestamp ? 
            new Date(message.timestamp.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
            'Now';

        const messageEl = document.createElement('div');
        messageEl.className = `flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;
        
        messageEl.innerHTML = `
            <div class="max-w-xs lg:max-w-md ${isOwnMessage ? 'order-1' : 'order-2'}">
                ${!isOwnMessage ? `
                    <div class="flex items-center space-x-2 mb-1">
                        <img src="${message.senderPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" 
                             class="w-6 h-6 rounded-full object-cover">
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${message.senderName}</span>
                    </div>
                ` : ''}
                
                <div class="px-4 py-2 rounded-lg ${isOwnMessage ? 
                    'bg-blue-600 text-white' : 
                    'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}">
                    
                    ${message.type === 'image' ? `
                        <img src="${message.content}" class="max-w-full rounded-lg mb-2" alt="Shared image">
                    ` : message.type === 'file' ? `
                        <div class="flex items-center space-x-2 p-2 bg-white bg-opacity-20 rounded">
                            <i class="fas fa-file"></i>
                            <a href="${message.content}" target="_blank" class="underline">${message.fileName || 'File'}</a>
                        </div>
                    ` : `
                        <p class="whitespace-pre-wrap">${this.escapeHtml(message.content)}</p>
                    `}
                    
                    <div class="text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}">
                        ${timestamp}
                    </div>
                </div>
            </div>
        `;

        container.appendChild(messageEl);
    }

    async sendMessage() {
        const messageInput = document.getElementById('chat-message-input');
        const sendBtn = document.getElementById('send-message-btn');
        
        if (!messageInput || !this.activeGroupId) return;

        const content = messageInput.value.trim();
        if (!content) return;

        if (content.length > 500) {
            alert('Message is too long (max 500 characters)');
            return;
        }

        try {
            sendBtn.disabled = true;
            
            const messageData = {
                senderId: this.currentUser.uid,
                senderName: this.currentUser.displayName,
                senderPhotoURL: this.currentUser.photoURL,
                content: content,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'text'
            };

            await this.db.collection('groups')
                .doc(this.activeGroupId)
                .collection('messages')
                .add(messageData);

            // Update group's last activity
            await this.db.collection('groups')
                .doc(this.activeGroupId)
                .update({
                    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
                });

            messageInput.value = '';
            this.updateMessageCounter();
            this.stopTypingIndicator();

        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        } finally {
            sendBtn.disabled = false;
        }
    }

    async handleFileUpload(file) {
        if (!file || !this.activeGroupId) return;

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert('File is too large (max 10MB)');
            return;
        }

        try {
            const sendBtn = document.getElementById('send-message-btn');
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // Upload file to Firebase Storage
            const filePath = `groups/${this.activeGroupId}/files/${Date.now()}_${file.name}`;
            const fileRef = firebase.storage().ref(filePath);
            const uploadTask = await fileRef.put(file);
            const downloadURL = await uploadTask.ref.getDownloadURL();

            // Send message with file
            const messageData = {
                senderId: this.currentUser.uid,
                senderName: this.currentUser.displayName,
                senderPhotoURL: this.currentUser.photoURL,
                content: downloadURL,
                fileName: file.name,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: file.type.startsWith('image/') ? 'image' : 'file'
            };

            await this.db.collection('groups')
                .doc(this.activeGroupId)
                .collection('messages')
                .add(messageData);

            // Update group's last activity
            await this.db.collection('groups')
                .doc(this.activeGroupId)
                .update({
                    lastActivity: firebase.firestore.FieldValue.serverTimestamp()
                });

        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Failed to upload file');
        } finally {
            const sendBtn = document.getElementById('send-message-btn');
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }

    async sendTypingIndicator() {
        if (!this.activeGroupId) return;

        clearTimeout(this.typingTimeout);
        
        try {
            await this.db.collection('groups')
                .doc(this.activeGroupId)
                .collection('typing')
                .doc(this.currentUser.uid)
                .set({
                    userId: this.currentUser.uid,
                    userName: this.currentUser.displayName,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

            this.typingTimeout = setTimeout(() => {
                this.stopTypingIndicator();
            }, 3000);

        } catch (error) {
            console.error('Error sending typing indicator:', error);
        }
    }

    async stopTypingIndicator() {
        if (!this.activeGroupId) return;

        try {
            await this.db.collection('groups')
                .doc(this.activeGroupId)
                .collection('typing')
                .doc(this.currentUser.uid)
                .delete();
        } catch (error) {
            console.error('Error stopping typing indicator:', error);
        }
    }

    updateTypingIndicators(typingUsers) {
        const typingEl = document.getElementById('typing-indicators');
        const typingTextEl = document.getElementById('typing-text');
        
        if (!typingEl || !typingTextEl) return;

        if (typingUsers.length === 0) {
            typingEl.classList.add('hidden');
        } else {
            typingEl.classList.remove('hidden');
            if (typingUsers.length === 1) {
                typingTextEl.textContent = `${typingUsers[0]} is typing...`;
            } else if (typingUsers.length === 2) {
                typingTextEl.textContent = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
            } else {
                typingTextEl.textContent = `${typingUsers.length} people are typing...`;
            }
        }
    }

    updateMessageCounter() {
        const messageInput = document.getElementById('chat-message-input');
        const counter = document.getElementById('message-counter');
        
        if (messageInput && counter) {
            const length = messageInput.value.length;
            counter.textContent = `${length}/500`;
            counter.className = length > 450 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400';
        }
    }

    scrollToBottom() {
        const container = document.getElementById('chat-messages-container');
        if (container) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
        }
    }

    closeChat() {
        if (this.messagesListener) {
            this.messagesListener();
            this.messagesListener = null;
        }

        this.stopTypingIndicator();
        this.activeGroupId = null;
        this.messageCache.clear();
        
        document.getElementById('group-chat-container')?.classList.add('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is loaded and user is authenticated
document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const db = firebase.firestore();
    
    if (currentUser) {
        window.groupChatManager = new GroupChatManager(db, currentUser);
        
        // Add chat functionality to existing group buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('open-group-chat-btn')) {
                const groupId = e.target.dataset.groupId;
                if (groupId) {
                    window.groupChatManager.openGroupChat(groupId);
                }
            }
        });
    }
});
