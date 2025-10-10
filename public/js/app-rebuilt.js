// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBzOhYwgLNLhZjKCKhKNYBdKKZWNJGQJhY",
    authDomain: "hatakesocial-a8e5e.firebaseapp.com",
    projectId: "hatakesocial-a8e5e",
    storageBucket: "hatakesocial-a8e5e.appspot.com",
    messagingSenderId: "1082233303750",
    appId: "1:1082233303750:web:4e6b2e8e8e8e8e8e8e8e8e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Global variables
let currentUser = null;
let selectedCardForPost = null;

// Utility functions
const sanitizeHTML = (str) => {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
};

// Wait for card system to be ready
let cardSystemReady = false;
let formatContent = null;
let handleCardAutocomplete = null;
let enhancePostWithCardData = null;
let initializeCardHoverForPosts = null;

// Check if card system functions are available
const checkCardSystem = () => {
    if (window.cardSystemFormatContent && 
        window.cardSystemHandleAutocomplete && 
        window.cardSystemEnhancePost && 
        window.cardSystemInitializeHover) {
        
        formatContent = window.cardSystemFormatContent;
        handleCardAutocomplete = window.cardSystemHandleAutocomplete;
        enhancePostWithCardData = window.cardSystemEnhancePost;
        initializeCardHoverForPosts = window.cardSystemInitializeHover;
        cardSystemReady = true;
        
        console.log('[App] Card system integration complete');
        return true;
    }
    return false;
};

// Try to connect to card system immediately
if (!checkCardSystem()) {
    // Wait for card system to load
    const cardSystemInterval = setInterval(() => {
        if (checkCardSystem()) {
            clearInterval(cardSystemInterval);
        }
    }, 100);
    
    // Fallback after 5 seconds
    setTimeout(() => {
        if (!cardSystemReady) {
            console.warn('[App] Card system not available, using fallback');
            clearInterval(cardSystemInterval);
            setupFallbackFunctions();
        }
    }, 5000);
}

// Fallback functions if card system fails to load
const setupFallbackFunctions = () => {
    formatContent = (data) => {
        const isPostObject = typeof data === 'object' && data !== null && data.content;
        const postContent = isPostObject ? data.content : data;
        
        if (!postContent) return '';
        const sanitized = sanitizeHTML(postContent);

        return sanitized
        .replace(/@(\w+)/g, `<a href="profile.html?user=$1" class="font-semibold text-blue-500 hover:underline">@$1</a>`)
        .replace(/#(\w+)/g, `<a href="search.html?query=%23$1" class="font-semibold text-indigo-500 hover:underline">#$1</a>`)
        .replace(/\[deck:([^:]+):([^\]]+)\]/g, `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">[Deck: $2]</a>`)
        .replace(/\[([^\]\[:]+)\]/g, (match, cardNameInBrackets) => {
            return `<a href="card-view.html?name=${encodeURIComponent(cardNameInBrackets)}" 
                       class="text-blue-500 dark:text-blue-400 card-link hover:underline" 
                       data-card-name="${sanitizeHTML(cardNameInBrackets)}"
                       title="View ${cardNameInBrackets}">[${cardNameInBrackets}]</a>`;
        });
    };
    
    handleCardAutocomplete = async (textarea, suggestionsContainer, onCardSelect) => {
        // Basic fallback - just hide suggestions
        suggestionsContainer.classList.add('hidden');
    };
    
    enhancePostWithCardData = (postData, selectedCard, content) => {
        return postData;
    };
    
    initializeCardHoverForPosts = () => {
        // No-op fallback
    };
};

// --- Firestore Index Error Helpers ---
const generateIndexCreationLink = (collection, fields) => {
    const baseUrl = `https://console.firebase.google.com/project/hatakesocial-a8e5e/firestore/indexes`;
    const fieldParams = fields.map(field => `field.${field.name}=${field.direction || 'ASCENDING'}`).join('&');
    return `${baseUrl}?create_composite=true&collection=${collection}&${fieldParams}`;
};

const handleFirestoreError = (error, operation) => {
    console.error(`Firestore error in ${operation}:`, error);
    
    if (error.code === 'failed-precondition' && error.message.includes('index')) {
        const indexMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
        if (indexMatch) {
            console.log(`Please create the required index: ${indexMatch[0]}`);
            return `Database index required. Please contact administrator.`;
        }
    }
    
    return `Error in ${operation}. Please try again.`;
};

// --- Authentication State Management ---
auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        console.log('User signed in:', user.email);
        loadUserProfile();
        loadPosts();
        loadTrendingHashtags();
        loadWhoToFollow();
    } else {
        console.log('User signed out');
        window.location.href = 'index.html';
    }
});

const loadUserProfile = async () => {
    if (!currentUser) return;
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            updateUIWithUserData(userData);
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
};

const updateUIWithUserData = (userData) => {
    const avatarElements = document.querySelectorAll('[data-user-avatar]');
    const nameElements = document.querySelectorAll('[data-user-name]');
    
    avatarElements.forEach(el => {
        if (userData.profilePicture) {
            el.src = userData.profilePicture;
        }
    });
    
    nameElements.forEach(el => {
        el.textContent = userData.displayName || userData.handle || 'User';
    });
};

// --- Post Management ---
const loadPosts = async (filter = 'all') => {
    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) return;

    try {
        postsContainer.innerHTML = '<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div><p class="mt-2 text-gray-600 dark:text-gray-400">Loading posts...</p></div>';

        let query = db.collection('posts').orderBy('timestamp', 'desc').limit(20);
        
        if (filter === 'friends' && currentUser) {
            // Load friend posts (implement friend system as needed)
            query = query.where('userId', '==', currentUser.uid);
        }

        const snapshot = await query.get();
        const posts = [];
        
        snapshot.forEach(doc => {
            posts.push({ id: doc.id, ...doc.data() });
        });

        renderPosts(posts);
    } catch (error) {
        console.error("Error loading posts:", error);
        const errorMessage = handleFirestoreError(error, 'loading posts');
        postsContainer.innerHTML = `<div class="text-center py-8 text-red-500">${errorMessage}</div>`;
    }
};

const renderPosts = (posts) => {
    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) return;

    if (posts.length === 0) {
        postsContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">No posts yet. Be the first to share something!</div>';
        return;
    }

    postsContainer.innerHTML = '';
    posts.forEach(post => {
        postsContainer.appendChild(createPostElement(post));
    });

    // Re-initialize hover for newly added posts
    if (initializeCardHoverForPosts) {
        initializeCardHoverForPosts();
    }
};

const createPostElement = (post) => {
    const postEl = document.createElement('div');
    postEl.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4';
    
    const timestamp = post.timestamp ? post.timestamp.toDate().toLocaleDateString() : 'Unknown date';
    const userHandle = post.userHandle || 'Unknown user';
    const userAvatar = post.userAvatar || 'https://via.placeholder.com/40';
    
    // Format content using the card system
    const formattedContent = formatContent ? formatContent(post) : sanitizeHTML(post.content || '');
    
    postEl.innerHTML = `
        <div class="flex items-start space-x-3">
            <img src="${userAvatar}" alt="${userHandle}" class="w-10 h-10 rounded-full">
            <div class="flex-1">
                <div class="flex items-center space-x-2">
                    <a href="profile.html?user=${userHandle}" class="font-semibold text-gray-800 dark:text-gray-200 hover:underline">
                        ${userHandle}
                    </a>
                    <span class="text-gray-500 dark:text-gray-400 text-sm">${timestamp}</span>
                    ${post.userId === currentUser?.uid ? `
                        <div class="ml-auto flex space-x-1">
                            <button onclick="editPost('${post.id}')" class="text-gray-400 hover:text-blue-500" title="Edit Post">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                                </svg>
                            </button>
                            <button onclick="deletePost('${post.id}')" class="text-gray-400 hover:text-red-500" title="Delete Post">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                </svg>
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div class="mt-2 text-gray-800 dark:text-gray-200">
                    ${formattedContent}
                </div>
                ${post.mediaUrl ? `
                    <div class="mt-3">
                        ${post.mediaType === 'image' ? 
                            `<img src="${post.mediaUrl}" alt="Post media" class="rounded-lg max-w-full h-auto">` :
                            `<video src="${post.mediaUrl}" controls class="rounded-lg max-w-full h-auto"></video>`
                        }
                    </div>
                ` : ''}
                <div class="flex items-center space-x-4 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button onclick="toggleLike('${post.id}')" class="flex items-center space-x-1 text-gray-500 hover:text-red-500">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                        </svg>
                        <span>${post.likes ? post.likes.length : 0}</span>
                    </button>
                    <button onclick="toggleComments('${post.id}')" class="flex items-center space-x-1 text-gray-500 hover:text-blue-500">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                        <span>${post.comments ? post.comments.length : 0}</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return postEl;
};

// --- Post Creation ---
const handleAutocomplete = async (textarea, suggestionsContainer) => {
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Handle mentions
    const mentionMatch = /@(\w*)$/.exec(text.substring(0, cursorPos));
    if (mentionMatch) {
        const query = mentionMatch[1];
        if (query.length > 0) {
            try {
                const usersSnapshot = await db.collection('users')
                    .where('handle', '>=', query)
                    .where('handle', '<=', query + '\uf8ff')
                    .limit(5)
                    .get();
                
                suggestionsContainer.innerHTML = '';
                if (!usersSnapshot.empty) {
                    suggestionsContainer.classList.remove('hidden');
                    usersSnapshot.forEach(doc => {
                        const userData = doc.data();
                        const suggestionEl = document.createElement('div');
                        suggestionEl.className = 'p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 text-gray-800 dark:text-gray-200';
                        suggestionEl.textContent = `@${userData.handle}`;
                        suggestionEl.addEventListener('click', () => {
                            const newText = text.substring(0, text.lastIndexOf('@')) + `@${userData.handle} ` + text.substring(cursorPos);
                            textarea.value = newText;
                            suggestionsContainer.classList.add('hidden');
                            textarea.focus();
                        });
                        suggestionsContainer.appendChild(suggestionEl);
                    });
                } else {
                    suggestionsContainer.classList.add('hidden');
                }
            } catch (error) {
                console.error('Error loading user suggestions:', error);
                suggestionsContainer.classList.add('hidden');
            }
        }
        return;
    }

    // Handle card autocomplete
    if (handleCardAutocomplete) {
        await handleCardAutocomplete(textarea, suggestionsContainer, (card) => {
            selectedCardForPost = card;
            if (window.cardSystemSetSelectedCard) {
                window.cardSystemSetSelectedCard(card);
            }
        });
        return;
    }

    suggestionsContainer.classList.add('hidden');
};

const createPost = async () => {
    const textarea = document.getElementById('post-content');
    const content = textarea.value.trim();
    
    if (!content) {
        alert('Please enter some content for your post.');
        return;
    }

    if (!currentUser) {
        alert('You must be logged in to create a post.');
        return;
    }

    try {
        // Get user data
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};

        // Extract hashtags
        const hashtags = content.match(/#\w+/g) || [];

        // Base post data
        let postData = {
            userId: currentUser.uid,
            userHandle: userData.handle || currentUser.email.split('@')[0],
            userAvatar: userData.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.displayName || currentUser.email)}&background=random`,
            content: content,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            likes: [],
            comments: [],
            hashtags: hashtags
        };

        // Add card data if available
        if (selectedCardForPost && enhancePostWithCardData) {
            postData = enhancePostWithCardData(postData, selectedCardForPost, content);
            console.log('[App] Enhanced post with card data:', postData);
        }

        // Create post
        const postRef = await db.collection('posts').add(postData);
        console.log('Post created with ID:', postRef.id);

        // Clear form
        textarea.value = '';
        selectedCardForPost = null;
        if (window.cardSystemSetSelectedCard) {
            window.cardSystemSetSelectedCard(null);
        }

        // Reload posts
        loadPosts();

    } catch (error) {
        console.error('Error creating post:', error);
        const errorMessage = handleFirestoreError(error, 'creating post');
        alert(errorMessage);
    }
};

// --- Post Interactions ---
const toggleLike = async (postId) => {
    if (!currentUser) return;

    try {
        const postRef = db.collection('posts').doc(postId);
        const postDoc = await postRef.get();
        
        if (!postDoc.exists) return;
        
        const postData = postDoc.data();
        const likes = postData.likes || [];
        const userIndex = likes.indexOf(currentUser.uid);
        
        if (userIndex > -1) {
            likes.splice(userIndex, 1);
        } else {
            likes.push(currentUser.uid);
        }
        
        await postRef.update({ likes });
        loadPosts(); // Refresh to show updated likes
        
    } catch (error) {
        console.error('Error toggling like:', error);
    }
};

const toggleComments = (postId) => {
    // Implement comment system as needed
    console.log('Toggle comments for post:', postId);
};

const editPost = (postId) => {
    // Implement post editing as needed
    console.log('Edit post:', postId);
};

const deletePost = async (postId) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
        await db.collection('posts').doc(postId).delete();
        loadPosts(); // Refresh posts
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Error deleting post. Please try again.');
    }
};

// --- Trending and Suggestions ---
const loadTrendingHashtags = async () => {
    const container = document.getElementById('trending-hashtags-container');
    if (!container) return;

    try {
        // This would need a more sophisticated implementation with aggregation
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">No trending tags yet.</p>';
    } catch (error) {
        console.error('Error loading trending hashtags:', error);
    }
};

const loadWhoToFollow = async () => {
    const container = document.getElementById('who-to-follow-container');
    if (!container) return;

    try {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">Could not load suggestions.</p>';
    } catch (error) {
        console.error('Error loading who to follow:', error);
    }
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Post creation
    const postButton = document.getElementById('post-button');
    const postTextarea = document.getElementById('post-content');
    const suggestionsContainer = document.getElementById('suggestions-container');

    if (postButton) {
        postButton.addEventListener('click', createPost);
    }

    if (postTextarea && suggestionsContainer) {
        postTextarea.addEventListener('input', () => {
            handleAutocomplete(postTextarea, suggestionsContainer);
        });

        postTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                createPost();
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!postTextarea.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                suggestionsContainer.classList.add('hidden');
            }
        });
    }

    // Feed filter buttons
    const feedButtons = document.querySelectorAll('[data-feed-filter]');
    feedButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.getAttribute('data-feed-filter');
            
            // Update active state
            feedButtons.forEach(b => b.classList.remove('bg-blue-500', 'text-white'));
            button.classList.add('bg-blue-500', 'text-white');
            
            // Load filtered posts
            loadPosts(filter);
        });
    });

    // Logout button
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut();
        });
    }
});

// Make functions globally available for onclick handlers
window.toggleLike = toggleLike;
window.toggleComments = toggleComments;
window.editPost = editPost;
window.deletePost = deletePost;
