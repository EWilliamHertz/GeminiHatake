/**
 * HatakeSocial - Index Page (Feed) Script (v14 - Autocomplete Mentions)
 *
 * This script handles all logic for the main feed on index.html.
 * - NEW: Implements autocomplete suggestions for @mentions.
 * - Implements dynamic trending hashtags.
 * - FIX: Correctly handles all interactions on posts from all feeds.
 * - FIX: Improves UI responsiveness by updating the like button immediately.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const postsContainer = document.getElementById('postsContainer');
    if (!postsContainer) return;

    let currentUserIsAdmin = false;
    let activeFeedType = 'for-you'; // Default feed

    // --- Helper function to render comments ---
    const renderComments = (container, comments) => {
        container.innerHTML = '';
        if (!comments || comments.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400 px-2">No comments yet.</p>';
            return;
        }
        
        comments.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'flex items-start space-x-3 py-2 border-t border-gray-100 dark:border-gray-700';
            commentEl.innerHTML = `
                <a href="profile.html?uid=${comment.authorId}">
                    <img src="${comment.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${comment.author}" class="h-8 w-8 rounded-full object-cover">
                </a>
                <div class="flex-1">
                    <div class="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                        <a href="profile.html?uid=${comment.authorId}" class="font-semibold text-sm text-gray-800 dark:text-white hover:underline">${comment.author}</a>
                        <p class="text-sm text-gray-700 dark:text-gray-300">${comment.content}</p>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1">${new Date(comment.timestamp.toDate()).toLocaleString()}</div>
                </div>
            `;
            container.appendChild(commentEl);
        });
    };

    const checkAdminStatus = async () => {
        if (!user) {
            currentUserIsAdmin = false;
            return;
        }
        const userDoc = await db.collection('users').doc(user.uid).get();
        currentUserIsAdmin = userDoc.exists && userDoc.data().isAdmin === true;
    };

    // --- Feed Fetching Logic ---
    const fetchForYouFeed = async () => {
        const postsSnapshot = await db.collection('posts').orderBy('timestamp', 'desc').limit(50).get();
        return postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const fetchFriendsFeed = async () => {
        if (!user) {
            postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">Please log in to see your friends feed.</p>';
            return [];
        }
        const userDoc = await db.collection('users').doc(user.uid).get();
        const friendIds = userDoc.data()?.friends || [];
        if (friendIds.length === 0) {
            postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">Add some friends to see their posts here!</p>';
            return [];
        }
        const postsSnapshot = await db.collection('posts').where('authorId', 'in', friendIds).orderBy('timestamp', 'desc').limit(50).get();
        return postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const fetchGroupsFeed = async () => {
        if (!user) {
            postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">Please log in to see your groups feed.</p>';
            return [];
        }
        const groupsSnapshot = await db.collection('groups').where('participants', 'array-contains', user.uid).get();
        const groupIds = groupsSnapshot.docs.map(doc => doc.id);

        if (groupIds.length === 0) {
            postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">Join some groups to see their posts here!</p>';
            return [];
        }

        let groupPosts = [];
        for (const groupId of groupIds) {
            const postsSnapshot = await db.collection('groups').doc(groupId).collection('posts').orderBy('timestamp', 'desc').limit(10).get();
            postsSnapshot.forEach(doc => {
                // Add groupId to each post object to identify its origin
                groupPosts.push({ id: doc.id, groupId: groupId, ...doc.data() });
            });
        }

        groupPosts.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
        return groupPosts;
    };

    const renderPosts = async (feedType) => {
        await checkAdminStatus();
        postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">Loading posts...</p>';
        
        let posts = [];
        try {
            switch (feedType) {
                case 'friends':
                    posts = await fetchFriendsFeed();
                    break;
                case 'groups':
                    posts = await fetchGroupsFeed();
                    break;
                case 'for-you':
                default:
                    posts = await fetchForYouFeed();
                    break;
            }

            if (posts.length === 0 && feedType === 'for-you') {
                 postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">No posts yet. Be the first to share something!</p>';
                 return;
            } else if (posts.length === 0) {
                return;
            }

            postsContainer.innerHTML = '';
            for (const post of posts) {
                const postElement = document.createElement('div');
                postElement.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md post-container';
                postElement.dataset.id = post.id;
                if (post.groupId) {
                    postElement.dataset.groupId = post.groupId;
                }
                
                let content = post.content || '';
                content = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                content = content.replace(/@(\w+)/g, `<a href="profile.html?user=$1" class="font-semibold text-blue-500 hover:underline">@$1</a>`);
                content = content.replace(/#(\w+)/g, `<a href="search.html?query=%23$1" class="font-semibold text-indigo-500 hover:underline">#$1</a>`);
                content = content.replace(/\[deck:([^:]+):([^\]]+)\]/g, `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">[Deck: $2]</a>`);
                content = content.replace(/\[([^\]\[:]+)\]/g, `<a href="card-view.html?name=$1" class="text-blue-500 dark:text-blue-400 card-link" data-card-name="$1">$1</a>`);

                const isLiked = user && Array.isArray(post.likes) && post.likes.includes(user.uid);
                const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;
                const canDelete = user && (post.authorId === user.uid || currentUserIsAdmin);

                const deleteButtonHTML = canDelete ? `<button class="delete-post-btn text-gray-400 hover:text-red-500" title="Delete Post"><i class="fas fa-trash"></i></button>` : '';
                const reportButtonHTML = (user && !canDelete) ? `<button class="report-post-btn text-gray-400 hover:text-yellow-500 ml-2" title="Report Post"><i class="fas fa-flag"></i></button>` : '';

                postElement.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex items-center mb-4">
                            <a href="profile.html?uid=${post.authorId}"><img src="${post.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${post.author}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
                            <div>
                                <a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white hover:underline">${post.author}</a>
                                <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                            </div>
                        </div>
                        <div class="flex">${deleteButtonHTML}${reportButtonHTML}</div>
                    </div>
                    <p class="mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200">${content}</p>
                    ${post.mediaUrl ? (post.mediaType.startsWith('image/') ? `<img src="${post.mediaUrl}" class="w-full rounded-lg my-2">` : `<video src="${post.mediaUrl}" controls class="w-full rounded-lg my-2"></video>`) : ''}
                    <div class="flex justify-between items-center mt-4 text-gray-600 dark:text-gray-400">
                        <button class="like-btn flex items-center hover:text-red-500 ${isLiked ? 'text-red-500' : ''}">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart mr-1"></i> 
                            <span class="likes-count-display cursor-pointer hover:underline">${likesCount}</span>
                        </button>
                        <button class="comment-btn flex items-center hover:text-blue-500">
                            <i class="far fa-comment mr-1"></i> 
                            <span class="comments-count">${Array.isArray(post.comments) ? post.comments.length : 0}</span>
                        </button>
                    </div>
                    <div class="comments-section hidden mt-4 pt-2">
                        <div class="comments-list space-y-2"></div>
                        <form class="comment-form flex mt-4">
                            <input type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-l-lg p-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Write a comment..." required>
                            <button type="submit" class="bg-blue-500 text-white px-4 rounded-r-lg font-semibold hover:bg-blue-600">Post</button>
                        </form>
                    </div>`;
                postsContainer.appendChild(postElement);
            }
        } catch (error) {
            console.error("Error loading posts:", error);
            postsContainer.innerHTML = `<p class="text-center text-red-500 p-4">Error: Could not load posts. ${error.message}</p>`;
        }
    };

    const showLikesModal = async (postId, groupId) => {
        const likesListEl = document.getElementById('likesList');
        likesListEl.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Loading...</p>';
        openModal(document.getElementById('likesModal'));

        try {
            const postRef = groupId 
                ? db.collection('groups').doc(groupId).collection('posts').doc(postId)
                : db.collection('posts').doc(postId);
            const postDoc = await postRef.get();

            if (!postDoc.exists) {
                likesListEl.innerHTML = '<p class="text-center text-red-500">Post not found.</p>';
                return;
            }
            const likerIds = postDoc.data().likes;
            if (!likerIds || likerIds.length === 0) {
                likesListEl.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">No likes yet.</p>';
                return;
            }

            likesListEl.innerHTML = '';
            for (const userId of likerIds) {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const userEl = document.createElement('a');
                    userEl.href = `profile.html?uid=${userId}`;
                    userEl.className = 'flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md';
                    userEl.innerHTML = `
                        <img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="h-10 w-10 rounded-full object-cover">
                        <div>
                            <p class="font-semibold text-gray-800 dark:text-white">${userData.displayName}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">@${userData.handle}</p>
                        </div>
                    `;
                    likesListEl.appendChild(userEl);
                }
            }
        } catch (error) {
            console.error("Error fetching likes:", error);
            likesListEl.innerHTML = '<p class="text-center text-red-500">Could not load likes.</p>';
        }
    };

    const handleAutocomplete = async (textarea, suggestionsContainer) => {
        const text = textarea.value;
        const cursorPos = textarea.selectionStart;

        // Check for @mention
        const mentionMatch = /@(\w*)$/.exec(text.substring(0, cursorPos));
        if (mentionMatch) {
            const query = mentionMatch[1];
            if (query.length > 0) {
                const usersSnapshot = await db.collection('users').where('handle', '>=', query).where('handle', '<=', query + '\uf8ff').limit(5).get();
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
            }
            return;
        }

        // Check for [card]
        const cardMatch = /\[([^\]]*)$/.exec(text.substring(0, cursorPos));
        if (cardMatch) {
            const query = cardMatch[1];
            if (query.length > 2) {
                const response = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
                const result = await response.json();
                suggestionsContainer.innerHTML = '';
                if (result.data && result.data.length > 0) {
                    suggestionsContainer.classList.remove('hidden');
                    result.data.slice(0, 7).forEach(cardName => {
                        const suggestionEl = document.createElement('div');
                        suggestionEl.className = 'p-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-800 text-gray-800 dark:text-gray-200';
                        suggestionEl.textContent = cardName;
                        suggestionEl.addEventListener('click', () => {
                            const newText = text.substring(0, text.lastIndexOf('[')) + `[${cardName}] ` + text.substring(cursorPos);
                            textarea.value = newText;
                            suggestionsContainer.classList.add('hidden');
                            textarea.focus();
                        });
                        suggestionsContainer.appendChild(suggestionEl);
                    });
                } else {
                    suggestionsContainer.classList.add('hidden');
                }
            }
            return;
        }

        suggestionsContainer.classList.add('hidden');
    };
    
    const loadTrendingHashtags = async () => {
        const trendingHashtagsList = document.getElementById('trending-hashtags-list');
        trendingHashtagsList.innerHTML = '';

        const hashtagCounts = {};
        const postsSnapshot = await db.collection('posts').orderBy('timestamp', 'desc').limit(100).get();

        postsSnapshot.forEach(doc => {
            const hashtags = doc.data().hashtags || [];
            hashtags.forEach(tag => {
                hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
            });
        });

        const sortedHashtags = Object.entries(hashtagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

        if(sortedHashtags.length === 0){
            trendingHashtagsList.innerHTML = '<p class="text-sm text-gray-500">No trending tags yet.</p>';
            return;
        }

        sortedHashtags.forEach(([tag, count]) => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="search.html?query=%23${tag}" class="block text-blue-600 dark:text-blue-400 hover:underline font-medium">#${tag}</a> <span class="text-gray-500 dark:text-gray-400 text-sm">${count} posts</span>`;
            trendingHashtagsList.appendChild(li);
        });
    };

    const setupEventListeners = () => {
        const feedTabs = document.getElementById('feed-tabs');
        const postContentInput = document.getElementById('postContent');
        const suggestionsContainer = document.getElementById('autocomplete-suggestions');
        const submitPostBtn = document.getElementById('submitPostBtn');
        const postStatusMessage = document.getElementById('postStatusMessage');
        const postImageUpload = document.getElementById('postImageUpload');
        const uploadImageBtn = document.getElementById('uploadImageBtn');
        const uploadVideoBtn = document.getElementById('uploadVideoBtn');
        let selectedFile = null;

        feedTabs.addEventListener('click', (e) => {
            const button = e.target.closest('.feed-tab-button');
            if (button) {
                document.querySelectorAll('.feed-tab-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                activeFeedType = button.dataset.feedType;
                renderPosts(activeFeedType);
            }
        });

        postContentInput?.addEventListener('input', () => handleAutocomplete(postContentInput, suggestionsContainer));
        postContentInput?.addEventListener('blur', () => setTimeout(() => suggestionsContainer.classList.add('hidden'), 200));

        if (user) {
            submitPostBtn?.addEventListener('click', async () => {
                const content = postContentInput.value;
                if (!content.trim() && !selectedFile) {
                    postStatusMessage.textContent = 'Please write something or select a file.';
                    return;
                }
                submitPostBtn.disabled = true;
                postStatusMessage.textContent = 'Posting...';
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (!userDoc.exists) throw new Error("User profile not found.");
                    const userData = userDoc.data();
                    let mediaUrl = null, mediaType = null;
                    if (selectedFile) {
                        const filePath = `posts/${user.uid}/${Date.now()}_${selectedFile.name}`;
                        const fileRef = storage.ref(filePath);
                        const uploadTask = await fileRef.put(selectedFile);
                        mediaUrl = await uploadTask.ref.getDownloadURL();
                        mediaType = selectedFile.type;
                    }

                    const hashtags = (content.match(/#(\w+)/g) || []).map(tag => tag.substring(1));
                    const mentions = (content.match(/@(\w+)/g) || []).map(mention => mention.substring(1));
                    
                    const postData = {
                        author: userData.displayName || 'Anonymous', authorId: user.uid, authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                        content: content, timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        likes: [], comments: [], mediaUrl: mediaUrl, mediaType: mediaType, hashtags
                    };

                    const postRef = await db.collection('posts').add(postData);

                    // Send notifications for mentions
                    for (const handle of mentions) {
                        const userQuery = await db.collection('users').where('handle', '==', handle).limit(1).get();
                        if (!userQuery.empty) {
                            const mentionedUser = userQuery.docs[0];
                            if (mentionedUser.id !== user.uid) { // Don't notify self
                                await db.collection('users').doc(mentionedUser.id).collection('notifications').add({
                                    message: `${userData.displayName} mentioned you in a post.`,
                                    link: `index.html#post-${postRef.id}`, // Link to the post
                                    isRead: false,
                                    timestamp: new Date()
                                });
                            }
                        }
                    }

                    postContentInput.value = '';
                    postImageUpload.value = '';
                    selectedFile = null;
                    postStatusMessage.textContent = 'Posted successfully!';
                    setTimeout(() => postStatusMessage.textContent = '', 3000);
                    renderPosts(activeFeedType);
                    loadTrendingHashtags();
                } catch (error) { 
                    console.error("Error creating post:", error);
                    postStatusMessage.textContent = `Error: ${error.message}`; 
                } finally {
                    submitPostBtn.disabled = false;
                }
            });
            uploadImageBtn?.addEventListener('click', () => postImageUpload.click());
            uploadVideoBtn?.addEventListener('click', () => postImageUpload.click());
            postImageUpload?.addEventListener('change', e => {
                selectedFile = e.target.files[0];
                if (selectedFile) {
                    postStatusMessage.textContent = `Selected: ${selectedFile.name}`;
                }
            });
        }

        postsContainer.addEventListener('click', async (e) => {
            const postElement = e.target.closest('.post-container');
            if (!postElement) return;
            const postId = postElement.dataset.id;
            const groupId = postElement.dataset.groupId;

            const postRef = groupId 
                ? db.collection('groups').doc(groupId).collection('posts').doc(postId)
                : db.collection('posts').doc(postId);

            if (!user) {
                if (e.target.closest('.like-btn') || e.target.closest('.comment-btn') || e.target.closest('.report-post-btn')) {
                    alert("Please log in to interact with posts.");
                }
                return;
            }

            if (e.target.closest('.delete-post-btn')) {
                if (confirm('Are you sure you want to delete this post?')) {
                    try {
                        await postRef.delete();
                        postElement.remove(); // Remove from UI immediately
                    } catch (error) {
                        console.error("Error deleting post: ", error);
                        alert("Could not delete post.");
                    }
                }
            } else if (e.target.closest('.like-btn')) {
                const likeBtn = e.target.closest('.like-btn');
                const icon = likeBtn.querySelector('i');
                const countSpan = likeBtn.querySelector('.likes-count-display');
                const currentLikes = parseInt(countSpan.textContent, 10);
                const isCurrentlyLiked = icon.classList.contains('fas');

                // Optimistically update UI
                likeBtn.classList.toggle('text-red-500', !isCurrentlyLiked);
                icon.classList.toggle('fas', !isCurrentlyLiked);
                icon.classList.toggle('far', isCurrentlyLiked);
                countSpan.textContent = isCurrentlyLiked ? currentLikes - 1 : currentLikes + 1;

                try {
                    await db.runTransaction(async t => {
                        const doc = await t.get(postRef);
                        if (!doc.exists) throw new Error("Post not found.");
                        const likes = doc.data().likes || [];
                        const userIndex = likes.indexOf(user.uid);
                        if (userIndex === -1) {
                            likes.push(user.uid);
                        } else {
                            likes.splice(userIndex, 1);
                        }
                        t.update(postRef, { likes });
                    });
                } catch (error) {
                    // Revert UI on failure
                    console.error("Error updating like:", error);
                    likeBtn.classList.toggle('text-red-500', isCurrentlyLiked);
                    icon.classList.toggle('fas', isCurrentlyLiked);
                    icon.classList.toggle('far', !isCurrentlyLiked);
                    countSpan.textContent = currentLikes;
                    alert("Failed to update like. Please try again.");
                }

            } else if (e.target.closest('.comment-btn')) {
                const commentsSection = postElement.querySelector('.comments-section');
                const wasHidden = commentsSection.classList.toggle('hidden');
                if (!wasHidden) {
                    const postDoc = await postRef.get();
                    renderComments(commentsSection.querySelector('.comments-list'), postDoc.data().comments);
                }
            } else if (e.target.closest('.likes-count-display')) {
                showLikesModal(postId, groupId);
            } else if (e.target.closest('.report-post-btn')) {
                const reportModal = document.getElementById('reportPostModal');
                document.getElementById('report-post-id').value = postId;
                openModal(reportModal);
            }
        });

        postsContainer.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (e.target.classList.contains('comment-form')) {
                if (!user) return;
                const input = e.target.querySelector('input');
                const content = input.value.trim();
                if (!content) return;

                const postElement = e.target.closest('.post-container');
                const postId = postElement.dataset.id;
                const groupId = postElement.dataset.groupId;

                const postRef = groupId 
                    ? db.collection('groups').doc(groupId).collection('posts').doc(postId)
                    : db.collection('posts').doc(postId);
                    
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                const newComment = { 
                    author: userData.displayName || 'Anonymous', 
                    authorId: user.uid, 
                    authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                    content: content, 
                    timestamp: new Date()
                };

                input.value = ''; // Clear input immediately
                try {
                    await postRef.update({ comments: firebase.firestore.FieldValue.arrayUnion(newComment) });
                    const updatedPostDoc = await postRef.get();
                    renderComments(postElement.querySelector('.comments-list'), updatedPostDoc.data().comments);
                    postElement.querySelector('.comments-count').textContent = updatedPostDoc.data().comments.length;
                } catch(error) {
                    console.error("Error submitting comment:", error);
                    alert("Could not post comment.");
                    input.value = content; // Restore content on failure
                }
            }
        });

        document.getElementById('closeLikesModal')?.addEventListener('click', () => closeModal(document.getElementById('likesModal')));

        const reportPostModal = document.getElementById('reportPostModal');
        document.getElementById('closeReportModal')?.addEventListener('click', () => closeModal(reportPostModal));
        document.getElementById('reportPostForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const postId = document.getElementById('report-post-id').value;
            const reason = document.getElementById('report-reason').value;
            const details = document.getElementById('report-details').value;
            
            if (!user || !postId) {
                alert("Cannot submit report. Missing user or post information.");
                return;
            }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                await db.collection('reports').add({
                    postId: postId,
                    reportedBy: user.uid,
                    reason: reason,
                    details: details,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'pending'
                });
                alert('Thank you for your report. Our moderators will review it shortly.');
                closeModal(reportPostModal);
                e.target.reset();
            } catch (error) {
                console.error("Error submitting report:", error);
                alert("Could not submit report. Please try again.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Report';
            }
        });
    };

    // --- Initial Load ---
    renderPosts(activeFeedType);
    loadTrendingHashtags();
    setupEventListeners();
});
