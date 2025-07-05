/**
 * HatakeSocial - Index Page (Feed) Script (v5 - Comments Fixed)
 *
 * This script handles all logic for the main feed on index.html.
 * - Includes the missing renderComments function to fix the comments feature.
 * - Adds admin delete functionality.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const postsContainer = document.getElementById('postsContainer');
    if (!postsContainer) return;

    let currentUserIsAdmin = false;

    // --- Helper function to render comments ---
    const renderComments = (container, comments) => {
        container.innerHTML = '';
        if (!comments || comments.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400 px-2">No comments yet.</p>';
            return;
        }
        
        // Sort comments by timestamp before rendering
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

    const renderPosts = async () => {
        await checkAdminStatus();

        postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">Loading posts...</p>';
        try {
            const postsSnapshot = await db.collection('posts').orderBy('timestamp', 'desc').limit(50).get();
            if (postsSnapshot.empty) {
                postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">No posts yet. Be the first to share something!</p>';
                return;
            }
            postsContainer.innerHTML = '';
            for (const doc of postsSnapshot.docs) {
                const post = doc.data();
                const postElement = document.createElement('div');
                postElement.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md post-container';
                postElement.dataset.id = doc.id;
                
                let content = post.content || '';
                content = content.replace(/\[deck:([^:]+):([^\]]+)\]/g, `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">[Deck: $2]</a>`);
                content = content.replace(/\[([^\]\[:]+)\]/g, `<a href="card-view.html?name=$1" class="text-blue-500 dark:text-blue-400 card-link" data-card-name="$1">$1</a>`);
                
                const isLiked = user && Array.isArray(post.likes) && post.likes.includes(user.uid);
                const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;
                const canDelete = user && (post.authorId === user.uid || currentUserIsAdmin);

                const deleteButtonHTML = canDelete ? `
                    <button class="delete-post-btn text-gray-400 hover:text-red-500" title="Delete Post">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : '';

                postElement.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex items-center mb-4">
                            <a href="profile.html?uid=${post.authorId}"><img src="${post.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${post.author}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
                            <div>
                                <a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white hover:underline">${post.author}</a>
                                <p class="text-sm text-gray-500 dark:text-gray-400">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                            </div>
                        </div>
                        ${deleteButtonHTML}
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
    
    const showLikesModal = async (postId) => {
        const likesListEl = document.getElementById('likesList');
        likesListEl.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Loading...</p>';
        openModal(document.getElementById('likesModal'));

        try {
            const postDoc = await db.collection('posts').doc(postId).get();
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

    const setupEventListeners = () => {
        const postContentInput = document.getElementById('postContent');
        const submitPostBtn = document.getElementById('submitPostBtn');
        const postStatusMessage = document.getElementById('postStatusMessage');
        const postImageUpload = document.getElementById('postImageUpload');
        const uploadImageBtn = document.getElementById('uploadImageBtn');
        const uploadVideoBtn = document.getElementById('uploadVideoBtn');
        let selectedFile = null;

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
                    await db.collection('posts').add({
                        author: userData.displayName || 'Anonymous', authorId: user.uid, authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                        content: content, timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        likes: [], comments: [], mediaUrl: mediaUrl, mediaType: mediaType
                    });
                    postContentInput.value = '';
                    postImageUpload.value = '';
                    selectedFile = null;
                    postStatusMessage.textContent = 'Posted successfully!';
                    setTimeout(() => postStatusMessage.textContent = '', 3000);
                    renderPosts();
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
            const postRef = db.collection('posts').doc(postId);

            if (!user) {
                if (e.target.closest('.like-btn') || e.target.closest('.comment-btn')) {
                    alert("Please log in to interact with posts.");
                }
                return;
            }

            if (e.target.closest('.delete-post-btn')) {
                if (confirm('Are you sure you want to delete this post?')) {
                    try {
                        await postRef.delete();
                        renderPosts();
                    } catch (error) {
                        console.error("Error deleting post: ", error);
                        alert("Could not delete post.");
                    }
                }
            } else if (e.target.closest('.like-btn')) {
                await db.runTransaction(async t => {
                    const doc = await t.get(postRef);
                    const data = doc.data();
                    const likes = Array.isArray(data.likes) ? data.likes : [];
                    const userIndex = likes.indexOf(user.uid);
                    if (userIndex === -1) likes.push(user.uid);
                    else likes.splice(userIndex, 1);
                    t.update(postRef, { likes });
                });
                renderPosts();
            } else if (e.target.closest('.comment-btn')) {
                const commentsSection = postElement.querySelector('.comments-section');
                const wasHidden = commentsSection.classList.toggle('hidden');
                if (!wasHidden) {
                    const postDoc = await postRef.get();
                    renderComments(commentsSection.querySelector('.comments-list'), postDoc.data().comments);
                }
            } else if (e.target.closest('.likes-count-display')) {
                showLikesModal(postId);
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
                const postRef = db.collection('posts').doc(postId);
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                const newComment = { 
                    author: userData.displayName || 'Anonymous', 
                    authorId: user.uid, 
                    authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                    content: content, 
                    timestamp: new Date()
                };
                await postRef.update({ comments: firebase.firestore.FieldValue.arrayUnion(newComment) });
                input.value = '';
                const updatedPostDoc = await postRef.get();
                renderComments(postElement.querySelector('.comments-list'), updatedPostDoc.data().comments);
                postElement.querySelector('.comments-count').textContent = updatedPostDoc.data().comments.length;
            }
        });

        document.getElementById('closeLikesModal')?.addEventListener('click', () => closeModal(document.getElementById('likesModal')));
    };

    // --- Initial Load ---
    renderPosts();
    setupEventListeners();
});
