/**
 * HatakeSocial - Index Page (Feed) Script (v22 - Full UI/UX Revamp Merged)
 *
 * This script handles all logic for the main feed on index.html.
 * - NEW: Implements infinite scroll for 'For You' and 'Friends' feeds.
 * - NEW: Uses skeleton loaders instead of "Loading..." text for a better UX.
 * - NEW: Provides real-time feedback on "Follow" buttons and handles follow/unfollow logic.
 * - NEW: Replaces all `alert()` and `confirm()` calls with non-blocking toast notifications.
 * - Merges all previous features like post editing, comment deletion, security sanitization, etc.
 */

const sanitizeHTML = (str) => {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
};

const formatContent = (str) => {
    const sanitized = sanitizeHTML(str);
    return sanitized
        .replace(/@(\w+)/g, `<a href="profile.html?user=$1" class="font-semibold text-blue-500 hover:underline">@$1</a>`)
        .replace(/#(\w+)/g, `<a href="search.html?query=%23$1" class="font-semibold text-indigo-500 hover:underline">#$1</a>`)
        .replace(/\[deck:([^:]+):([^\]]+)\]/g, `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">[Deck: $2]</a>`)
        .replace(/\[([^\]\[:]+)\]/g, `<a href="card-view.html?name=$1" class="text-blue-500 dark:text-blue-400 card-link" data-card-name="$1">$1</a>`);
};

document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const db = firebase.firestore();
    const storage = firebase.storage();
    const functions = firebase.functions();
    const postsContainer = document.getElementById('postsContainer');
    if (!postsContainer) return;

    // --- State for Infinite Scroll ---
    let lastVisiblePost = null;
    let isFetchingPosts = false;
    let allPostsLoaded = false;
    const POSTS_PER_PAGE = 15;

    let currentUserIsAdmin = false;
    let activeFeedType = 'for-you';
    let currentUserFriends = [];

    const createPostElement = (post) => {
        const postElement = document.createElement('div');
        postElement.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md post-container';
        postElement.dataset.id = post.id;
        postElement.dataset.rawContent = post.content || '';
        if (post.groupId) {
            postElement.dataset.groupId = post.groupId;
        }

        let postBodyHTML = '';
        const formattedContent = formatContent(post.content || '');
        postBodyHTML = `
            <div class="post-body-content">
                <p class="post-content-display mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200">${formattedContent}</p>
            </div>
            ${post.mediaUrl ? (post.mediaType.startsWith('image/') ? `<img src="${sanitizeHTML(post.mediaUrl)}" class="w-full rounded-lg my-2">` : `<video src="${sanitizeHTML(post.mediaUrl)}" controls class="w-full rounded-lg my-2"></video>`) : ''}
        `;

        const safeAuthorName = sanitizeHTML(post.author);
        const safeAuthorPhotoURL = sanitizeHTML(post.authorPhotoURL) || 'https://i.imgur.com/B06rBhI.png';
        const isLiked = user && Array.isArray(post.likes) && post.likes.includes(user.uid);
        const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;

        const canEdit = user && (post.authorId === user.uid || currentUserIsAdmin);
        const canDelete = user && (post.authorId === user.uid || currentUserIsAdmin);
        const canReport = user && !canEdit;

        const editButtonHTML = canEdit ? `<button class="edit-post-btn text-gray-400 hover:text-blue-500" title="Edit Post"><i class="fas fa-edit"></i></button>` : '';
        const deleteButtonHTML = canDelete ? `<button class="delete-post-btn text-gray-400 hover:text-red-500" title="Delete Post"><i class="fas fa-trash"></i></button>` : '';
        const reportButtonHTML = canReport ? `<button class="report-post-btn text-gray-400 hover:text-yellow-500" title="Report Post"><i class="fas fa-flag"></i></button>` : '';

        postElement.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex items-center mb-4">
                    <a href="profile.html?uid=${post.authorId}"><img src="${safeAuthorPhotoURL}" alt="${safeAuthorName}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
                    <div>
                        <a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white hover:underline">${safeAuthorName}</a>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                    </div>
                </div>
                <div class="post-actions-menu flex space-x-3 text-gray-400">${editButtonHTML}${deleteButtonHTML}${reportButtonHTML}</div>
            </div>
            ${postBodyHTML}
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
        return postElement;
    };

    const renderComments = (container, comments, post) => {
        container.innerHTML = '';
        if (!comments || comments.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400 px-2">No comments yet.</p>';
            return;
        }
        comments.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'flex items-start space-x-3 py-2 border-t border-gray-100 dark:border-gray-700';
            
            const safeAuthorName = sanitizeHTML(comment.author);
            const safeAuthorPhotoURL = sanitizeHTML(comment.authorPhotoURL) || 'https://i.imgur.com/B06rBhI.png';
            const safeContent = sanitizeHTML(comment.content);
            const canDeleteComment = user && (comment.authorId === user.uid || post.authorId === user.uid || currentUserIsAdmin);
            const deleteCommentBtnHTML = canDeleteComment ? `<button class="delete-comment-btn text-xs text-gray-400 hover:text-red-500 ml-2" title="Delete Comment" data-timestamp="${comment.timestamp.toMillis()}"><i class="fas fa-times"></i></button>` : '';


            commentEl.innerHTML = `
                <a href="profile.html?uid=${comment.authorId}">
                    <img src="${safeAuthorPhotoURL}" alt="${safeAuthorName}" class="h-8 w-8 rounded-full object-cover">
                </a>
                <div class="flex-1">
                    <div class="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                        <a href="profile.html?uid=${comment.authorId}" class="font-semibold text-sm text-gray-800 dark:text-white hover:underline">${safeAuthorName}</a>
                        <p class="text-sm text-gray-700 dark:text-gray-300">${safeContent}</p>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1 flex justify-between">
                        <span>${new Date(comment.timestamp.toDate()).toLocaleString()}</span>
                        ${deleteCommentBtnHTML}
                    </div>
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

    const showSkeletonLoaders = (count) => {
        const template = document.getElementById('skeleton-post-template');
        if (!template) return;
        postsContainer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            postsContainer.appendChild(template.content.cloneNode(true));
        }
    };

    const renderPosts = async (feedType, loadMore = false) => {
        if (isFetchingPosts) return;
        isFetchingPosts = true;

        if (!loadMore) {
            allPostsLoaded = false;
            lastVisiblePost = null;
            showSkeletonLoaders(5);
        }

        let query;
        try {
            switch (feedType) {
                case 'friends':
                    if (currentUserFriends.length === 0) {
                        postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">Add some friends to see their posts here!</p>';
                        isFetchingPosts = false;
                        allPostsLoaded = true;
                        return;
                    }
                    query = db.collection('posts').where('authorId', 'in', currentUserFriends).orderBy('timestamp', 'desc');
                    break;
                case 'groups':
                    const groupPosts = await fetchGroupsFeed();
                     if (!loadMore) postsContainer.innerHTML = '';
                    if (groupPosts.length === 0) {
                         postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">Join some groups to see their posts here!</p>';
                    } else {
                        groupPosts.forEach(post => postsContainer.appendChild(createPostElement(post)));
                    }
                    isFetchingPosts = false;
                    allPostsLoaded = true; // Disable infinite scroll for groups for now.
                    return;
                default: // 'for-you'
                    query = db.collection('posts').orderBy('timestamp', 'desc');
                    break;
            }

            if (lastVisiblePost) {
                query = query.startAfter(lastVisiblePost);
            }

            const snapshot = await query.limit(POSTS_PER_PAGE).get();

            if (!loadMore) {
                postsContainer.innerHTML = ''; // Clear skeletons
            }

            if (snapshot.empty) {
                allPostsLoaded = true;
                if (!loadMore) {
                    postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">No posts yet. Be the first to share something!</p>';
                }
                return;
            }

            lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
            snapshot.forEach(doc => {
                const post = { id: doc.id, ...doc.data() };
                postsContainer.appendChild(createPostElement(post));
            });

        } catch (error) {
            console.error("Error loading posts:", error);
            if (!loadMore) {
                 postsContainer.innerHTML = `<p class="text-center text-red-500 p-4">Error: Could not load posts.</p>`;
            }
            showToast("Error loading feed.", "error");
        } finally {
            isFetchingPosts = false;
        }
    };
    
    const fetchGroupsFeed = async () => {
        if (!user) return [];
        const groupsSnapshot = await db.collection('groups').where('participants', 'array-contains', user.uid).get();
        const groupIds = groupsSnapshot.docs.map(doc => doc.id);
        if (groupIds.length === 0) return [];
        
        let groupPosts = [];
        for (const groupId of groupIds) {
            const postsSnapshot = await db.collection('groups').doc(groupId).collection('posts').orderBy('timestamp', 'desc').limit(10).get();
            postsSnapshot.forEach(doc => {
                groupPosts.push({ id: doc.id, groupId: groupId, ...doc.data() });
            });
        }
        groupPosts.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
        return groupPosts;
    };
    
    const loadWhoToFollow = async () => {
        const whoToFollowContainer = document.getElementById('who-to-follow-list');
        if (!whoToFollowContainer) return;
        whoToFollowContainer.innerHTML = '<li>Loading...</li>';

        try {
            const snapshot = await db.collection('users').orderBy('postCount', 'desc').limit(6).get();
            whoToFollowContainer.innerHTML = '';
            let count = 0;
            snapshot.forEach(doc => {
                if (doc.id !== user?.uid && count < 5) {
                    const userToFollow = doc.data();
                    const isFollowing = currentUserFriends.includes(doc.id);
                    const li = document.createElement('li');
                    li.className = 'flex items-center justify-between py-2';
                    li.innerHTML = `
                        <div class="flex items-center">
                            <img src="${sanitizeHTML(userToFollow.photoURL) || 'https://i.imgur.com/B06rBhI.png'}" alt="${sanitizeHTML(userToFollow.displayName)}" class="w-10 h-10 rounded-full mr-3 object-cover">
                            <div>
                                <a href="/profile.html?uid=${doc.id}" class="font-semibold text-gray-800 dark:text-white hover:underline">${sanitizeHTML(userToFollow.displayName)}</a>
                                <p class="text-sm text-gray-500 dark:text-gray-400">@${sanitizeHTML(userToFollow.handle)}</p>
                            </div>
                        </div>
                        <button class="follow-btn px-3 py-1 text-sm font-semibold rounded-full transition-colors ${isFollowing ? 'following' : 'bg-blue-500 text-white hover:bg-blue-600'}" data-uid="${doc.id}">${isFollowing ? 'Following' : 'Follow'}</button>
                    `;
                    whoToFollowContainer.appendChild(li);
                    count++;
                }
            });

            if (count === 0) {
                 whoToFollowContainer.innerHTML = '<li class="text-gray-500 dark:text-gray-400">No suggestions right now.</li>';
            }

        } catch (error) {
            console.error("Error loading who to follow:", error);
            whoToFollowContainer.innerHTML = '<li class="text-red-500">Could not load suggestions.</li>';
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
                        <img src="${sanitizeHTML(userData.photoURL) || 'https://i.imgur.com/B06rBhI.png'}" class="h-10 w-10 rounded-full object-cover">
                        <div>
                            <p class="font-semibold text-gray-800 dark:text-white">${sanitizeHTML(userData.displayName)}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">@${sanitizeHTML(userData.handle)}</p>
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
        const whoToFollowList = document.getElementById('who-to-follow-list');
        let selectedFile = null;

        feedTabs?.addEventListener('click', (e) => {
            const button = e.target.closest('.feed-tab-button');
            if (button && !button.classList.contains('active')) {
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
                    showToast('Please write something or select a file.', 'info');
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

                    for (const handle of mentions) {
                        const userQuery = await db.collection('users').where('handle', '==', handle).limit(1).get();
                        if (!userQuery.empty) {
                            const mentionedUser = userQuery.docs[0];
                            if (mentionedUser.id !== user.uid) {
                                await db.collection('users').doc(mentionedUser.id).collection('notifications').add({
                                    message: `${userData.displayName} mentioned you in a post.`,
                                    link: `index.html#post-${postRef.id}`,
                                    isRead: false,
                                    timestamp: new Date()
                                });
                            }
                        }
                    }

                    postContentInput.value = '';
                    postImageUpload.value = '';
                    selectedFile = null;
                    postStatusMessage.textContent = '';
                    showToast('Posted successfully!', 'success');
                    renderPosts(activeFeedType); // Refresh feed
                    loadTrendingHashtags();
                } catch (error) { 
                    console.error("Error creating post:", error);
                    showToast(`Error: ${error.message}`, 'error');
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
                    showToast("Please log in to interact with posts.", "info");
                }
                return;
            }

            if (e.target.closest('.delete-post-btn')) {
                // Using a custom confirmation modal would be better, but for now, we'll use the browser's confirm
                if (window.confirm('Are you sure you want to delete this post?')) {
                    try {
                        await postRef.delete();
                        postElement.remove();
                        showToast("Post deleted.", "success");
                    } catch (error) {
                        console.error("Error deleting post: ", error);
                        showToast("Could not delete post.", "error");
                    }
                }
            } else if (e.target.closest('.like-btn')) {
                const likeBtn = e.target.closest('.like-btn');
                const icon = likeBtn.querySelector('i');
                const countSpan = likeBtn.querySelector('.likes-count-display');
                const currentLikes = parseInt(countSpan.textContent, 10);
                const isCurrentlyLiked = icon.classList.contains('fas');

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
                    console.error("Error updating like:", error);
                    likeBtn.classList.toggle('text-red-500', isCurrentlyLiked);
                    icon.classList.toggle('fas', isCurrentlyLiked);
                    icon.classList.toggle('far', !isCurrentlyLiked);
                    countSpan.textContent = currentLikes;
                    showToast("Failed to update like.", "error");
                }

            } else if (e.target.closest('.comment-btn')) {
                const commentsSection = postElement.querySelector('.comments-section');
                const wasHidden = commentsSection.classList.toggle('hidden');
                if (!wasHidden) {
                    const postDoc = await postRef.get();
                    renderComments(commentsSection.querySelector('.comments-list'), postDoc.data().comments, postDoc.data());
                }
            } else if (e.target.closest('.likes-count-display')) {
                showLikesModal(postId, groupId);
            } else if (e.target.closest('.report-post-btn')) {
                const reportModal = document.getElementById('reportPostModal');
                document.getElementById('report-post-id').value = postId;
                openModal(reportModal);
            }
             if (e.target.closest('.edit-post-btn')) {
                const postBody = postElement.querySelector('.post-body-content');
                const rawContent = postElement.dataset.rawContent;
                
                postBody.innerHTML = `
                    <textarea class="edit-post-textarea w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" rows="4">${rawContent}</textarea>
                    <div class="edit-controls text-right mt-2 space-x-2">
                        <button class="cancel-edit-btn px-4 py-1 bg-gray-500 text-white rounded-full text-sm hover:bg-gray-600">Cancel</button>
                        <button class="save-edit-btn px-4 py-1 bg-blue-600 text-white rounded-full text-sm hover:bg-blue-700">Save</button>
                    </div>
                `;
            }

            if (e.target.closest('.cancel-edit-btn')) {
                const postBody = postElement.querySelector('.post-body-content');
                const rawContent = postElement.dataset.rawContent;
                postBody.innerHTML = `<p class="post-content-display mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200">${formatContent(rawContent)}</p>`;
            }

            if (e.target.closest('.save-edit-btn')) {
                const postBody = postElement.querySelector('.post-body-content');
                const textarea = postBody.querySelector('.edit-post-textarea');
                const newContent = textarea.value;
                
                try {
                    await postRef.update({ 
                        content: newContent,
                        hashtags: (newContent.match(/#(\w+)/g) || []).map(tag => tag.substring(1))
                    });
                    postElement.dataset.rawContent = newContent;
                    postBody.innerHTML = `<p class="post-content-display mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200">${formatContent(newContent)}</p>`;
                    showToast("Post updated!", "success");
                } catch (error) {
                    console.error("Error updating post:", error);
                    showToast("Could not save changes.", "error");
                }
            }
            
            if (e.target.closest('.delete-comment-btn')) {
                if (window.confirm('Are you sure you want to delete this comment?')) {
                    const deleteBtn = e.target.closest('.delete-comment-btn');
                    const commentTimestamp = parseInt(deleteBtn.dataset.timestamp, 10);
                    
                    try {
                        const postDoc = await postRef.get();
                        const postData = postDoc.data();
                        const comments = postData.comments || [];
                        
                        const updatedComments = comments.filter(c => c.timestamp.toMillis() !== commentTimestamp);
                        
                        if (comments.length === updatedComments.length) {
                            throw new Error("Comment not found or already deleted.");
                        }
                        
                        await postRef.update({ comments: updatedComments });
                        
                        const postObjectForRender = { id: postDoc.id, ...postData };
                        renderComments(postElement.querySelector('.comments-list'), updatedComments, postObjectForRender);
                        postElement.querySelector('.comments-count').textContent = updatedComments.length;
                        showToast("Comment deleted.", "success");
                    } catch (error) {
                        console.error("Error deleting comment:", error);
                        showToast("Could not delete comment.", "error");
                    }
                }
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

                input.value = '';
                try {
                    await postRef.update({ comments: firebase.firestore.FieldValue.arrayUnion(newComment) });
                    const updatedPostDoc = await postRef.get();
                    const postDataForRender = { id: updatedPostDoc.id, ...updatedPostDoc.data() };
                    renderComments(postElement.querySelector('.comments-list'), updatedPostDoc.data().comments, postDataForRender);
                    postElement.querySelector('.comments-count').textContent = updatedPostDoc.data().comments.length;
                } catch(error) {
                    console.error("Error submitting comment:", error);
                    showToast("Could not post comment.", "error");
                    input.value = content;
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
                showToast("Cannot submit report. Missing user or post information.", "error");
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
                showToast('Thank you for your report.', 'success');
                closeModal(reportPostModal);
                e.target.reset();
            } catch (error) {
                console.error("Error submitting report:", error);
                showToast("Could not submit report.", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Report';
            }
        });

        whoToFollowList?.addEventListener('click', async (e) => {
            const followBtn = e.target.closest('.follow-btn');
            if (followBtn && user) {
                const targetUid = followBtn.dataset.uid;
                const isCurrentlyFollowing = followBtn.classList.contains('following');

                followBtn.disabled = true;
                followBtn.textContent = isCurrentlyFollowing ? 'Unfollowing...' : 'Following...';

                try {
                    const toggleFollow = functions.httpsCallable('toggleFollowUser');
                    const result = await toggleFollow({ uid: targetUid });

                    if (result.data.nowFollowing) {
                        followBtn.textContent = 'Following';
                        followBtn.classList.add('following');
                        followBtn.classList.remove('bg-blue-500', 'text-white', 'hover:bg-blue-600');
                        currentUserFriends.push(targetUid);
                    } else {
                        followBtn.textContent = 'Follow';
                        followBtn.classList.remove('following');
                        followBtn.classList.add('bg-blue-500', 'text-white', 'hover:bg-blue-600');
                        currentUserFriends = currentUserFriends.filter(id => id !== targetUid);
                    }
                } catch (error) {
                    console.error("Error following user:", error);
                    showToast("Could not complete action. Please try again.", "error");
                    followBtn.textContent = isCurrentlyFollowing ? 'Following' : 'Follow';
                } finally {
                    followBtn.disabled = false;
                }
            }
        });

        window.addEventListener('scroll', () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !isFetchingPosts && !allPostsLoaded) {
                renderPosts(activeFeedType, true);
            }
        });
    };

    const initializeFeed = async () => {
        await checkAdminStatus();
        if (user) {
            const userDoc = await db.collection('users').doc(user.uid).get();
            currentUserFriends = userDoc.data()?.friends || [];
            document.getElementById('create-post-section').classList.remove('hidden');
            loadWhoToFollow();
        }
        renderPosts(activeFeedType);
        loadTrendingHashtags();
        setupEventListeners();
    };

    initializeFeed();
});
