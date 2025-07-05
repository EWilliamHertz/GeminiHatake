/**
 * HatakeSocial - Index Page (Feed) Script (v3 - Image Upload Fix)
 *
 * This script handles all logic for the main feed on index.html.
 * - Fixes the bug where image uploads would cause the post button to get stuck.
 * - Adds the ability to see who has liked a post.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const postsContainer = document.getElementById('postsContainer');
    if (!postsContainer) return;

    // --- DOM Elements ---
    const postContentInput = document.getElementById('postContent');
    const submitPostBtn = document.getElementById('submitPostBtn');
    const postStatusMessage = document.getElementById('postStatusMessage');
    const postImageUpload = document.getElementById('postImageUpload');
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    const uploadVideoBtn = document.getElementById('uploadVideoBtn');
    const likesModal = document.getElementById('likesModal');
    const closeLikesModalBtn = document.getElementById('closeLikesModal');
    const likesListEl = document.getElementById('likesList');
    let selectedFile = null;

    // --- Functions ---
    const renderComments = (commentsListEl, comments) => {
        if (!Array.isArray(comments) || comments.length === 0) {
            commentsListEl.innerHTML = '<p class="text-gray-500 text-sm px-2">No comments yet.</p>';
            return;
        }
        commentsListEl.innerHTML = '';
        comments.sort((a, b) => (a.timestamp?.toDate() || 0) - (b.timestamp?.toDate() || 0)).forEach(comment => {
            const commentHTML = `
                <div class="pt-2 border-t mt-2 flex items-start space-x-2">
                    <img src="${comment.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" class="h-8 w-8 rounded-full object-cover">
                    <div class="flex-1 bg-gray-100 rounded-lg p-2">
                        <a href="profile.html?uid=${comment.authorId}" class="font-bold text-sm hover:underline">${comment.author || 'Anonymous'}</a>
                        <p class="text-sm">${comment.content}</p>
                    </div>
                </div>`;
            commentsListEl.innerHTML += commentHTML;
        });
    };

    const renderPosts = async () => {
        postsContainer.innerHTML = '<p class="text-center text-gray-500 p-4">Loading posts...</p>';
        try {
            const postsSnapshot = await db.collection('posts').orderBy('timestamp', 'desc').limit(50).get();
            if (postsSnapshot.empty) {
                postsContainer.innerHTML = '<p class="text-center text-gray-500 p-8">No posts yet. Be the first to share something!</p>';
                return;
            }
            postsContainer.innerHTML = '';
            for (const doc of postsSnapshot.docs) {
                const post = doc.data();
                const postElement = document.createElement('div');
                postElement.className = 'bg-white p-4 rounded-lg shadow-md post-container';
                postElement.dataset.id = doc.id;
                let content = post.content || '';
                content = content.replace(/\[deck:([^:]+):([^\]]+)\]/g, `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 hover:underline">[Deck: $2]</a>`);
                content = content.replace(/\[([^\]\[:]+)\]/g, `<a href="card-view.html?name=$1" class="text-blue-500 card-link" data-card-name="$1">$1</a>`);
                const isLiked = user && Array.isArray(post.likes) && post.likes.includes(user.uid);
                const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;

                postElement.innerHTML = `
                    <div class="flex items-center mb-4">
                        <a href="profile.html?uid=${post.authorId}"><img src="${post.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${post.author}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
                        <div>
                            <a href="profile.html?uid=${post.authorId}" class="font-bold hover:underline">${post.author}</a>
                            <p class="text-sm text-gray-500">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                        </div>
                    </div>
                    <p class="mb-4 whitespace-pre-wrap">${content}</p>
                    ${post.mediaUrl ? (post.mediaType.startsWith('image/') ? `<img src="${post.mediaUrl}" class="w-full rounded-lg my-2">` : `<video src="${post.mediaUrl}" controls class="w-full rounded-lg my-2"></video>`) : ''}
                    <div class="flex justify-between items-center mt-4 text-gray-600">
                        <button class="like-btn flex items-center hover:text-red-500 ${isLiked ? 'text-red-500' : ''}">
                            <i class="${isLiked ? 'fas' : 'far'} fa-heart mr-1"></i> 
                            <span class="likes-count-display cursor-pointer hover:underline">${likesCount}</span>
                        </button>
                        <button class="comment-btn flex items-center hover:text-blue-500">
                            <i class="far fa-comment mr-1"></i> 
                            <span class="comments-count">${Array.isArray(post.comments) ? post.comments.length : 0}</span>
                        </button>
                    </div>
                    <div class="comments-section hidden mt-4">
                        <div class="comments-list space-y-2"></div>
                        <form class="comment-form flex mt-4">
                            <input type="text" class="w-full border rounded-l-lg p-2 bg-gray-50" placeholder="Write a comment..." required>
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
        likesListEl.innerHTML = '<p class="text-center text-gray-500">Loading...</p>';
        openModal(likesModal);

        try {
            const postDoc = await db.collection('posts').doc(postId).get();
            if (!postDoc.exists) {
                likesListEl.innerHTML = '<p class="text-center text-red-500">Post not found.</p>';
                return;
            }
            const likerIds = postDoc.data().likes;
            if (!likerIds || likerIds.length === 0) {
                likesListEl.innerHTML = '<p class="text-center text-gray-500">No likes yet.</p>';
                return;
            }

            likesListEl.innerHTML = '';
            for (const userId of likerIds) {
                const userDoc = await db.collection('users').doc(userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const userEl = document.createElement('a');
                    userEl.href = `profile.html?uid=${userId}`;
                    userEl.className = 'flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-md';
                    userEl.innerHTML = `
                        <img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="h-10 w-10 rounded-full object-cover">
                        <div>
                            <p class="font-semibold text-gray-800">${userData.displayName}</p>
                            <p class="text-sm text-gray-500">@${userData.handle}</p>
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

    // --- Event Listeners ---
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
                
                let mediaUrl = null;
                let mediaType = null;
                
                // **THE FIX IS HERE**: Properly await the upload task
                if (selectedFile) {
                    const filePath = `posts/${user.uid}/${Date.now()}_${selectedFile.name}`;
                    const fileRef = storage.ref(filePath);
                    const uploadTask = await fileRef.put(selectedFile); // await the upload
                    mediaUrl = await uploadTask.ref.getDownloadURL(); // then get the URL
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
        if (!user) {
            alert("Please log in to interact with posts.");
            return;
        }
        const postElement = e.target.closest('.post-container');
        if (!postElement) return;
        const postId = postElement.dataset.id;
        const postRef = db.collection('posts').doc(postId);

        if (e.target.closest('.comment-btn')) {
            const commentsSection = postElement.querySelector('.comments-section');
            const wasHidden = commentsSection.classList.toggle('hidden');
            if (!wasHidden) {
                const postDoc = await postRef.get();
                renderComments(commentsSection.querySelector('.comments-list'), postDoc.data().comments);
            }
        } else if (e.target.closest('.like-btn')) {
            await db.runTransaction(async t => {
                const doc = await t.get(postRef);
                const data = doc.data();
                const likes = Array.isArray(data.likes) ? data.likes : [];
                const userIndex = likes.indexOf(user.uid);
                if (userIndex === -1) {
                    likes.push(user.uid);
                } else {
                    likes.splice(userIndex, 1);
                }
                t.update(postRef, { likes });
            });
            renderPosts();
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

    closeLikesModalBtn?.addEventListener('click', () => closeModal(likesModal));

    renderPosts();
});
