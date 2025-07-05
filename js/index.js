/**
 * HatakeSocial - Index Page (Feed) Script
 *
 * This script waits for the 'authReady' event from auth.js before running.
 * It handles all logic for the main feed on index.html.
 * This version includes a fix for the comment creation error.
 */
document.addEventListener('authReady', (e) => {
    const user = e.detail.user;
    const postsContainer = document.getElementById('postsContainer');
    if (!postsContainer) return;

    const postContentInput = document.getElementById('postContent');
    const submitPostBtn = document.getElementById('submitPostBtn');
    const postStatusMessage = document.getElementById('postStatusMessage');
    const postImageUpload = document.getElementById('postImageUpload');
    let selectedFile = null;

    const renderComments = (commentsListEl, comments) => {
        commentsListEl.innerHTML = !comments || comments.length === 0 ? '<p class="text-gray-500 text-sm">No comments yet.</p>' : '';
        comments?.sort((a, b) => a.timestamp.seconds - b.timestamp.seconds).forEach(comment => {
            commentsListEl.innerHTML += `<div class="pt-2 border-t mt-2"><p><strong>${comment.author || 'Anonymous'}:</strong> ${comment.content}</p></div>`;
        });
    };

    const renderPosts = async () => {
        const postsSnapshot = await db.collection('posts').orderBy('timestamp', 'desc').limit(50).get();
        postsContainer.innerHTML = '';

        const userPromises = {};
        postsSnapshot.docs.forEach(doc => {
            const post = doc.data();
            if (post.authorId && !userPromises[post.authorId]) {
                userPromises[post.authorId] = db.collection('users').doc(post.authorId).get();
            }
        });

        const userDocs = await Promise.all(Object.values(userPromises));
        const usersData = {};
        userDocs.forEach(userDoc => {
            if (userDoc.exists) {
                usersData[userDoc.id] = userDoc.data();
            }
        });

        postsSnapshot.forEach(doc => {
            const post = doc.data();
            const authorData = usersData[post.authorId];
            const profileLink = authorData?.handle ? `profile.html?user=${authorData.handle}` : `profile.html?uid=${post.authorId}`;
            const authorName = post.author || 'Anonymous';
            const authorPhoto = post.authorPhotoURL || 'https://i.imgur.com/B06rBhI.png';

            const postElement = document.createElement('div');
            postElement.className = 'bg-white p-4 rounded-lg shadow-md post-container';
            postElement.dataset.id = doc.id;

            let content = post.content || '';
            content = content.replace(/\[deck:([^:]+):([^\]]+)\]/g, `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 hover:underline">[Deck: $2]</a>`);
            content = content.replace(/\[([^\]:]+)\]/g, `<a href="#" class="text-blue-500 card-link" data-card-name="$1">$1</a>`);

            postElement.innerHTML = `
                <div class="flex items-center mb-4">
                    <a href="${profileLink}"><img src="${authorPhoto}" alt="${authorName}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
                    <div>
                        <a href="${profileLink}" class="font-bold hover:underline">${authorName}</a>
                        <p class="text-sm text-gray-500">${new Date(post.timestamp?.toDate()).toLocaleString()}</p>
                    </div>
                </div>
                <p class="mb-4 whitespace-pre-wrap">${content}</p>
                ${post.mediaUrl ? (post.mediaType.startsWith('image/') ? `<img src="${post.mediaUrl}" class="w-full rounded-lg">` : `<video src="${post.mediaUrl}" controls class="w-full rounded-lg"></video>`) : ''}
                <div class="flex justify-between items-center mt-4 text-gray-600">
                    <button class="like-btn flex items-center hover:text-red-500"><i class="far fa-heart mr-1"></i> <span class="likes-count">${post.likes?.length || 0}</span></button>
                    <button class="comment-btn flex items-center hover:text-blue-500"><i class="far fa-comment mr-1"></i> <span class="comments-count">${post.comments?.length || 0}</span></button>
                </div>
                <div class="comments-section hidden mt-4">
                    <div class="comments-list"></div>
                    <form class="comment-form flex mt-4"><input type="text" class="w-full border rounded-l-lg p-2" placeholder="Write a comment..."><button type="submit" class="bg-blue-500 text-white px-4 rounded-r-lg">Post</button></form>
                </div>`;
            postsContainer.appendChild(postElement);
        });
    };
    
    if (user) {
        renderPosts();
    } else {
        postsContainer.innerHTML = '<p class="text-center text-gray-500">Please log in to see the feed.</p>';
    }

    submitPostBtn.addEventListener('click', async () => {
        if (!user) { postStatusMessage.textContent = 'You must be logged in.'; return; }
        const content = postContentInput.value;
        if (!content.trim() && !selectedFile) { postStatusMessage.textContent = 'Please write something.'; return; }
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
                await fileRef.put(selectedFile);
                mediaUrl = await fileRef.getDownloadURL();
                mediaType = selectedFile.type;
            }
            await db.collection('posts').add({
                author: userData.displayName || 'Anonymous', authorId: user.uid, authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
                content, timestamp: firebase.firestore.FieldValue.serverTimestamp(), likes: [], comments: [], mediaUrl, mediaType
            });
            postContentInput.value = ''; postImageUpload.value = ''; selectedFile = null;
            postStatusMessage.textContent = 'Posted!';
            setTimeout(() => postStatusMessage.textContent = '', 2000);
            renderPosts();
        } catch (error) { 
            postStatusMessage.textContent = `Error: ${error.message}`; 
        } finally {
            submitPostBtn.disabled = false;
        }
    });

    postsContainer.addEventListener('click', async (e) => {
        if (!user) { alert("Please log in to interact."); return; }
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
            db.runTransaction(async t => {
                const doc = await t.get(postRef);
                const likes = doc.data().likes || [];
                const index = likes.indexOf(user.uid);
                index === -1 ? likes.push(user.uid) : likes.splice(index, 1);
                t.update(postRef, { likes });
                return likes;
            }).then(likes => postElement.querySelector('.likes-count').textContent = likes.length);
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
            
            // **THE FIX IS HERE**
            // Use a client-side new Date() instead of the server timestamp for arrayUnion.
            const newComment = { 
                author: user.displayName || 'Anonymous', 
                authorId: user.uid, 
                content, 
                timestamp: new Date() 
            };

            await postRef.update({ comments: firebase.firestore.FieldValue.arrayUnion(newComment) });
            input.value = '';
            const postDoc = await postRef.get();
            renderComments(postElement.querySelector('.comments-list'), postDoc.data().comments);
            postElement.querySelector('.comments-count').textContent = postDoc.data().comments.length;
        }
    });

    document.getElementById('uploadImageBtn')?.addEventListener('click', () => postImageUpload.click());
    document.getElementById('uploadVideoBtn')?.addEventListener('click', () => postImageUpload.click());
    if (postImageUpload) postImageUpload.addEventListener('change', e => selectedFile = e.target.files[0]);
});
