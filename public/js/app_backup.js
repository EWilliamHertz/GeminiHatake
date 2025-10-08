/**
* HatakeSocial - App Page (Feed) Script (v28 - Post Modal and Comment Replies)
*
* This script handles all logic for the main feed on app.html.
* - NEW: Adds a detailed modal view for posts, triggered by clicking on a post card.
* - NEW: Implements a comment reply system, allowing for threaded conversations.
* - NEW: Comment and reply forms are now dynamically added.
* - UPDATE: Post media is resized to fit better in the card layout.
* - UPDATE: Comment rendering logic is completely rewritten to support nested replies.
* - UPDATE: Comment submission and deletion now use Firestore transactions for data integrity and handle replies.
*/

// --- Date Formatting Helper ---
const formatTimestamp = (timestamp) => {
    if (!timestamp || !timestamp.toDate) {
        return 'Just now';
    }
    const date = timestamp.toDate();
    const userDateFormat = localStorage.getItem('userDateFormat') || 'dmy'; // Default to D/M/Y

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (userDateFormat === 'mdy') {
        return `${month}/${day}/${year}`;
    }
    return `${day}/${month}/${year}`;
};


// Helper functions for modals
const openModal = (modal) => {
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

const closeModal = (modal) => {
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

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

// --- Firestore Index Error Helpers ---
const generateIndexCreationLink = (collection, fields) => {
const projectId = firebase.app().options.projectId;
let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`;
fields.forEach(field => {
url += `&fields=${field.name},${field.order.toUpperCase()}`;
});
return url;
};

const displayIndexError = (container, link) => {
const errorMessage = `
<div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg">
<p class="font-bold text-red-700 dark:text-red-300">Database Query Error</p>
<p class="text-red-600 dark:text-red-400 mt-2">The feed could not be loaded because a required database index is missing.</p>
<a href="${link}" target="_blank" rel="noopener noreferrer"
class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">
Click Here to Create the Index
</a>
<p class="text-xs text-gray-500 mt-2">This will open the Firebase console. Click "Save" to create the index. It may take a few minutes to build.</p>
</div>
`;
container.innerHTML = errorMessage;
};


document.addEventListener('authReady', (e) => {
const user = e.detail.user;
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();
const postsContainer = document.getElementById('feed-container');
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
if (post.poll) {
    const totalVotes = post.poll.options.reduce((sum, option) => sum + option.votes, 0);
    const pollOptionsHTML = post.poll.options.map((option, index) => {
        const percentage = totalVotes > 0 ? ((option.votes / totalVotes) * 100).toFixed(1) : 0;
        return `
            <div class="poll-option relative mt-2 p-2 border dark:border-gray-600 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" data-option-index="${index}">
                <div class="absolute top-0 left-0 h-full bg-blue-200 dark:bg-blue-800 rounded-md" style="width: ${percentage}%;"></div>
                <div class="relative flex justify-between">
                    <span>${sanitizeHTML(option.text)}</span>
                    <span>${percentage}% (${option.votes})</span>
                </div>
            </div>
        `;
    }).join('');

    const mediaHTML = post.mediaUrl
            ? (post.mediaType.startsWith('image/')
                ? `<img src="${sanitizeHTML(post.mediaUrl)}" alt="Poll media" class="max-h-96 w-full object-cover rounded-lg my-2">`
                : `<video src="${sanitizeHTML(post.mediaUrl)}" controls class="max-h-96 w-full object-cover rounded-lg my-2"></video>`)
            : '';

    postBodyHTML = `
        <div class="post-body-content post-clickable-area cursor-pointer">
            ${mediaHTML}
            <p class="post-content-display mb-2 font-semibold text-gray-800 dark:text-gray-200">${sanitizeHTML(post.poll.question)}</p>
        </div>
        <div class="poll-container">${pollOptionsHTML}</div>
    `;

} else {
    const formattedContent = formatContent(post.content || '');
    const mediaHTML = post.mediaUrl ? (post.mediaType.startsWith('image/') ? `<img src="${sanitizeHTML(post.mediaUrl)}" alt="Post media" class="max-h-96 w-full object-cover rounded-lg my-2">` : `<video src="${sanitizeHTML(post.mediaUrl)}" controls class="max-h-96 w-full object-cover rounded-lg my-2"></video>`) : '';
    postBodyHTML = `
        <div class="post-body-content post-clickable-area cursor-pointer">
            <p class="post-content-display mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200">${formattedContent}</p>
            ${mediaHTML}
        </div>
    `;
}


const safeAuthorName = sanitizeHTML(post.author);
const safeAuthorPhotoURL = sanitizeHTML(post.authorPhotoURL) || 'https://i.imgur.com/B06rBhI.png';
const isLiked = user && Array.isArray(post.likes) && post.likes.includes(user.uid);
const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;

const canEdit = user && (post.authorId === user.uid || currentUserIsAdmin);
const canDelete = user && (post.authorId === user.uid || currentUserIsAdmin);
const canReport = user && !canEdit;

const editButtonHTML = canEdit && !post.poll ? `<button class="edit-post-btn text-gray-400 hover:text-blue-500" title="Edit Post"><i class="fas fa-edit"></i></button>` : '';
const deleteButtonHTML = canDelete ? `<button class="delete-post-btn text-gray-400 hover:text-red-500" title="Delete Post"><i class="fas fa-trash"></i></button>` : '';
const reportButtonHTML = canReport ? `<button class="report-post-btn text-gray-400 hover:text-yellow-500" title="Report Post"><i class="fas fa-flag"></i></button>` : '';

postElement.innerHTML = `
<div class="flex justify-between items-start">
<div class="flex items-center mb-4">
<a href="profile.html?uid=${post.authorId}"><img src="${safeAuthorPhotoURL}" alt="${safeAuthorName}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
<div>
<a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white hover:underline">${safeAuthorName}</a>
<p class="text-sm text-gray-500 dark:text-gray-400">${formatTimestamp(post.timestamp)}</p>
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

    const commentsMap = new Map();
    const topLevelComments = [];

    comments.forEach(comment => {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment-wrapper';
        const canDeleteComment = user && (comment.authorId === user.uid || post.authorId === user.uid || currentUserIsAdmin);
        const commentTimestampMillis = comment.timestamp.toMillis();

        const deleteCommentBtnHTML = canDeleteComment ? `<button class="delete-comment-btn text-xs text-gray-400 hover:text-red-500" title="Delete Comment" data-timestamp="${commentTimestampMillis}"><i class="fas fa-trash"></i></button>` : '';
        const replyBtnHTML = user ? `<button class="reply-btn text-xs font-semibold text-blue-500 hover:underline" data-parent-timestamp="${commentTimestampMillis}">Reply</button>` : '';

        commentEl.innerHTML = `
            <div class="flex items-start space-x-3">
                <a href="profile.html?uid=${comment.authorId}">
                    <img src="${sanitizeHTML(comment.authorPhotoURL) || 'https://i.imgur.com/B06rBhI.png'}" alt="${sanitizeHTML(comment.author)}" class="h-8 w-8 rounded-full object-cover">
                </a>
                <div class="flex-1">
                    <div class="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                        <a href="profile.html?uid=${comment.authorId}" class="font-semibold text-sm text-gray-800 dark:text-white hover:underline">${sanitizeHTML(comment.author)}</a>
                        <p class="text-sm text-gray-700 dark:text-gray-300">${formatContent(comment.content)}</p>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1 flex items-center space-x-3">
                        <span>${formatTimestamp(comment.timestamp)}</span>
                        ${replyBtnHTML}
                        ${deleteCommentBtnHTML}
                    </div>
                    <div class="replies-container pl-6 mt-2 space-y-2 border-l-2 border-gray-200 dark:border-gray-700"></div>
                </div>
            </div>`;
        
        commentsMap.set(commentTimestampMillis, commentEl);

        if (comment.replyTo && commentsMap.has(comment.replyTo)) {
            const parentEl = commentsMap.get(comment.replyTo);
            parentEl.querySelector('.replies-container').appendChild(commentEl);
        } else {
            topLevelComments.push(commentEl);
        }
    });

    topLevelComments.forEach(el => container.appendChild(el));
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
postsContainer.innerHTML = '';
for (let i = 0; i < count; i++) {
const skeleton = document.createElement('div');
skeleton.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md';
skeleton.innerHTML = `
<div class="flex items-center mb-4">
<div class="h-10 w-10 rounded-full skeleton"></div>
<div class="ml-4 flex-grow">
<div class="h-4 w-1/3 skeleton"></div>
<div class="h-3 w-1/4 skeleton mt-2"></div>
</div>
</div>
<div class="h-4 w-full skeleton mb-2"></div>
<div class="h-4 w-5/6 skeleton"></div>
`;
postsContainer.appendChild(skeleton);
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
query = db.collection('posts').where('authorId', 'in', currentUserFriends);
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
allPostsLoaded = true;
return;
default:
query = db.collection('posts').orderBy('timestamp', 'desc');
break;
}

if (lastVisiblePost && feedType !== 'friends') {
query = query.startAfter(lastVisiblePost);
}

const snapshot = await query.limit(POSTS_PER_PAGE).get();

if (!loadMore) {
postsContainer.innerHTML = '';
}
let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

if (feedType === 'friends') {
posts.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
}

if (posts.length === 0) {
allPostsLoaded = true;
if (!loadMore) {
postsContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-8">No posts yet. Be the first to share something!</p>';
}
return;
}

lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
posts.forEach(post => {
postsContainer.appendChild(createPostElement(post));
});

} catch (error) {
console.error("Error loading posts:", error);
if (error.code === 'failed-precondition') {
let indexLink;
if (activeFeedType === 'friends') {
indexLink = generateIndexCreationLink('posts', [{ name: 'authorId', order: 'asc' }, { name: 'timestamp', order: 'desc' }]);
} else {
indexLink = generateIndexCreationLink('posts', [{ name: 'timestamp', order: 'desc' }]);
}
displayIndexError(postsContainer, indexLink);
} else {
if (!loadMore) {
postsContainer.innerHTML = `<p class="text-center text-red-500 p-4">Error: Could not load posts.</p>`;
}
showToast("Error loading feed.", "error");
}
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
const whoToFollowContainer = document.getElementById('who-to-follow-container');
if (!whoToFollowContainer) return;
whoToFollowContainer.innerHTML = '<p class="text-sm text-gray-500">Loading suggestions...</p>';
try {
const usersSnapshot = await db.collection('users').limit(5).get();
whoToFollowContainer.innerHTML = '';
if (usersSnapshot.empty) {
whoToFollowContainer.innerHTML = '<p class="text-sm text-gray-500">No suggestions available.</p>';
return;
}
usersSnapshot.forEach(doc => {
const userData = doc.data();
if (doc.id === user?.uid) return;
const userEl = document.createElement('div');
userEl.className = 'flex items-center justify-between';
userEl.innerHTML = `
<div class="flex items-center">
<a href="profile.html?uid=${doc.id}"><img src="${userData.photoURL || 'https://i.imgur.com/B06rBhI.png'}" alt="${userData.displayName}" class="h-8 w-8 rounded-full mr-3 object-cover"></a>
<div>
<a href="profile.html?uid=${doc.id}" class="font-semibold text-sm hover:underline">${userData.displayName || 'Anonymous'}</a>
<p class="text-xs text-gray-500">@${userData.handle || 'user'}</p>
</div>
</div>
<button class="follow-btn text-xs bg-blue-500 text-white px-3 py-1 rounded-full hover:bg-blue-600" data-user-id="${doc.id}">Follow</button>
`;
whoToFollowContainer.appendChild(userEl);
});
} catch (error) {
console.error("Error loading who to follow:", error);
whoToFollowContainer.innerHTML = '<p class="text-sm text-red-500">Error loading suggestions.</p>';
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
const trendingHashtagsContainer = document.getElementById('trending-hashtags-container');
if(!trendingHashtagsContainer) return;
trendingHashtagsContainer.innerHTML = '';

try {
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
trendingHashtagsContainer.innerHTML = '<p class="text-sm text-gray-500">No trending tags yet.</p>';
return;
}

sortedHashtags.forEach(([tag, count]) => {
const tagEl = document.createElement('a');
tagEl.href=`search.html?query=%23${tag}`;
tagEl.className = "block text-blue-500 hover:underline";
tagEl.innerHTML = `#${tag} <span class="text-gray-500 dark:text-gray-400 text-sm">(${count} posts)</span>`;
trendingHashtagsContainer.appendChild(tagEl);
});
} catch(error) {
console.log("Could not load trending hashtags, likely due to permissions for logged out user.");
trendingHashtagsContainer.innerHTML = '<p class="text-sm text-gray-500">Log in to see trending tags.</p>';
}
};

const openPostModal = async (postId, groupId) => {
    const modal = document.getElementById('postDetailModal');
    if (!modal) return;

    modal.dataset.postId = postId;
    modal.dataset.groupId = groupId || '';

    // Clear previous content and show loading state
    modal.querySelector('#modal-post-author').innerHTML = '<div class="flex items-center"><div class="h-10 w-10 rounded-full skeleton"></div><div class="ml-4 flex-grow"><div class="h-4 w-1/3 skeleton"></div><div class="h-3 w-1/4 skeleton mt-2"></div></div></div>';
    modal.querySelector('#modal-post-content').innerHTML = '<div class="h-4 w-full skeleton mb-2"></div><div class="h-4 w-5/6 skeleton"></div>';
    modal.querySelector('#modal-post-media-container').innerHTML = '';
    modal.querySelector('#modal-post-comments-list').innerHTML = '<p class="text-center text-gray-500">Loading comments...</p>';
    
    openModal(modal);

    try {
        const postRef = groupId
            ? db.collection('groups').doc(groupId).collection('posts').doc(postId)
            : db.collection('posts').doc(postId);
        const postDoc = await postRef.get();
        if (!postDoc.exists) throw new Error("Post not found.");

        const post = postDoc.data();
        const safeAuthorName = sanitizeHTML(post.author);
        const safeAuthorPhotoURL = sanitizeHTML(post.authorPhotoURL) || 'https://i.imgur.com/B06rBhI.png';
        const isLiked = user && Array.isArray(post.likes) && post.likes.includes(user.uid);
        const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;
        const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0;

        modal.querySelector('#modal-post-author').innerHTML = `
            <a href="profile.html?uid=${post.authorId}"><img src="${safeAuthorPhotoURL}" alt="${safeAuthorName}" class="h-10 w-10 rounded-full mr-4 object-cover"></a>
            <div>
                <a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white hover:underline">${safeAuthorName}</a>
                <p class="text-sm text-gray-500 dark:text-gray-400">${formatTimestamp(post.timestamp)}</p>
            </div>`;

        let contentHTML = post.poll ? `<p class="font-semibold">${sanitizeHTML(post.poll.question)}</p>` : formatContent(post.content || '');
        modal.querySelector('#modal-post-content').innerHTML = contentHTML;

        const mediaContainer = modal.querySelector('#modal-post-media-container');
        const gridContainer = document.getElementById('modal-grid-container');
        if (post.mediaUrl) {
            mediaContainer.innerHTML = post.mediaType.startsWith('image/')
                ? `<img src="${sanitizeHTML(post.mediaUrl)}" alt="Post media" class="max-w-full max-h-full object-contain">`
                : `<video src="${sanitizeHTML(post.mediaUrl)}" controls class="max-w-full max-h-full object-contain"></video>`;
            mediaContainer.classList.remove('hidden');
            gridContainer.classList.add('md:grid-cols-2');
        } else {
            mediaContainer.classList.add('hidden');
            gridContainer.classList.remove('md:grid-cols-2');
        }

        modal.querySelector('#modal-post-actions').innerHTML = `
            <button class="like-btn flex items-center hover:text-red-500 ${isLiked ? 'text-red-500' : ''}">
                <i class="${isLiked ? 'fas' : 'far'} fa-heart mr-1"></i>
                <span class="likes-count-display cursor-pointer hover:underline">${likesCount}</span>
            </button>
            <span class="ml-4"><i class="far fa-comment mr-1"></i> ${commentsCount}</span>`;

        renderComments(modal.querySelector('#modal-post-comments-list'), post.comments, post);
    } catch (error) {
        console.error("Error loading post for modal:", error);
        modal.querySelector('#modal-post-content').innerHTML = `<p class="text-red-500">Could not load post details.</p>`;
    }
};

const handleCommentSubmit = async (form, postId, groupId) => {
    if (!user) {
        showToast("Please log in to comment.", "info");
        return;
    }
    const input = form.querySelector('input');
    const content = input.value.trim();
    if (!content) return;

    const postRef = groupId && groupId !== 'undefined'
        ? db.collection('groups').doc(groupId).collection('posts').doc(postId)
        : db.collection('posts').doc(postId);

    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    const newComment = {
        author: userData.displayName || 'Anonymous',
        authorId: user.uid,
        authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png',
        content: content,
        timestamp: new Date(),
        replyTo: form.dataset.replyTo ? parseInt(form.dataset.replyTo, 10) : null,
    };

    const originalContent = input.value;
    input.value = 'Posting...';
    input.disabled = true;

    try {
        await db.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists) throw new Error("Post not found");
            const comments = postDoc.data().comments || [];
            comments.push(newComment);
            transaction.update(postRef, { comments: comments });
        });

        if (form.classList.contains('reply-form')) {
            form.remove();
        } else {
            form.reset();
        }

        const updatedPostDoc = await postRef.get();
        const postDataForRender = { id: updatedPostDoc.id, ...updatedPostDoc.data() };
        const updatedComments = updatedPostDoc.data().comments || [];
        
        const postElement = document.querySelector(`.post-container[data-id="${postId}"]`);
        if (postElement) {
            const commentsSection = postElement.querySelector('.comments-section');
            if (!commentsSection.classList.contains('hidden')) {
                renderComments(commentsSection.querySelector('.comments-list'), updatedComments, postDataForRender);
            }
            postElement.querySelector('.comments-count').textContent = updatedComments.length;
        }

        const modal = document.getElementById('postDetailModal');
        if (modal.classList.contains('flex') && modal.dataset.postId === postId) {
            renderComments(modal.querySelector('#modal-post-comments-list'), updatedComments, postDataForRender);
            modal.querySelector('#modal-post-actions span:last-child').innerHTML = `<i class="far fa-comment mr-1"></i> ${updatedComments.length}`;
        }
    } catch (error) {
        console.error("Error submitting comment/reply:", error);
        showToast("Could not post your message.", "error");
        input.value = originalContent;
    } finally {
        input.disabled = false;
        if (!form.classList.contains('reply-form')) input.value = '';
    }
};

const setupEventListeners = () => {
const feedTabs = document.getElementById('feed-tabs');
const postContentInput = document.getElementById('postContent');
const suggestionsContainer = document.getElementById('autocomplete-suggestions');
const submitPostBtn = document.getElementById('submitPostBtn');
const postStatusMessage = document.getElementById('postStatusMessage');
const postMediaUpload = document.getElementById('postMediaUpload');
const uploadMediaBtn = document.getElementById('uploadMediaBtn');
const whoToFollowContainer = document.getElementById('who-to-follow-container');
const createPollBtn = document.getElementById('createPollBtn');
const pollModal = document.getElementById('pollModal');
const closePollModalBtn = document.getElementById('closePollModal');
const pollForm = document.getElementById('pollForm');
const addPollOptionBtn = document.getElementById('addPollOptionBtn');
const pollOptionsContainer = document.getElementById('pollOptionsContainer');
const attachPollMediaBtn = document.getElementById('attachPollMediaBtn');
const pollMediaUpload = document.getElementById('pollMediaUpload');
const pollMediaFileName = document.getElementById('pollMediaFileName');

let selectedFile = null;
let selectedPollMediaFile = null;

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
postMediaUpload.value = '';
selectedFile = null;
postStatusMessage.textContent = '';
showToast('Posted successfully!', 'success');
if (activeFeedType === 'for-you') {
renderPosts(activeFeedType);
}
} catch (error) {
console.error("Error creating post:", error);
showToast(`Error: ${error.message}`, 'error');
postStatusMessage.textContent = `Error: ${error.message}`;
} finally {
submitPostBtn.disabled = false;
}
});
uploadMediaBtn?.addEventListener('click', () => postMediaUpload.click());
postMediaUpload?.addEventListener('change', e => {
selectedFile = e.target.files[0];
if (selectedFile) {
postStatusMessage.textContent = `Selected: ${selectedFile.name}`;
}
});

createPollBtn?.addEventListener('click', () => openModal(pollModal));
closePollModalBtn?.addEventListener('click', () => closeModal(pollModal));
addPollOptionBtn?.addEventListener('click', () => {
const optionCount = pollOptionsContainer.children.length;
if (optionCount < 10) {
const newOption = document.createElement('div');
newOption.innerHTML = `
<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Option ${optionCount + 1}</label>
<input class="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm p-2 dark:bg-gray-700 poll-option" required="" type="text"/>
`;
pollOptionsContainer.appendChild(newOption);
} else {
showToast("You can have a maximum of 10 options.", "info");
}
});
attachPollMediaBtn?.addEventListener('click', () => pollMediaUpload.click());
pollMediaUpload?.addEventListener('change', (e) => {
    selectedPollMediaFile = e.target.files[0];
    pollMediaFileName.textContent = selectedPollMediaFile ? selectedPollMediaFile.name : '';
});
pollForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = document.getElementById('pollQuestion').value.trim();
    const options = Array.from(document.querySelectorAll('.poll-option')).map(input => input.value.trim()).filter(text => text.length > 0);
    if (!question || options.length < 2) {
        showToast("A poll must have a question and at least two options.", "error");
        return;
    }
    const pollData = { question: question, options: options.map(optionText => ({ text: optionText, votes: 0 })), voters: {} };
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) throw new Error("User profile not found.");
        const userData = userDoc.data();
        let mediaUrl = null, mediaType = null;
        if (selectedPollMediaFile) {
            const filePath = `polls/${user.uid}/${Date.now()}_${selectedPollMediaFile.name}`;
            const fileRef = storage.ref(filePath);
            const uploadTask = await fileRef.put(selectedPollMediaFile);
            mediaUrl = await uploadTask.ref.getDownloadURL();
            mediaType = selectedPollMediaFile.type;
        }
        const postData = { author: userData.displayName || 'Anonymous', authorId: user.uid, authorPhotoURL: userData.photoURL || 'https://i.imgur.com/B06rBhI.png', content: '', timestamp: firebase.firestore.FieldValue.serverTimestamp(), likes: [], comments: [], poll: pollData, mediaUrl: mediaUrl, mediaType: mediaType };
        await db.collection('posts').add(postData);
        closeModal(pollModal);
        pollForm.reset();
        pollMediaFileName.textContent = '';
        selectedPollMediaFile = null;
        showToast('Poll created successfully!', 'success');
        if (activeFeedType === 'for-you') {
            renderPosts(activeFeedType);
        }
    } catch (error) {
        console.error("Error creating poll:", error);
        showToast(`Error creating poll: ${error.message}`, 'error');
    }
});
}

whoToFollowContainer?.addEventListener('click', async (e) => {
if (e.target.classList.contains('follow-btn')) {
const targetUserId = e.target.dataset.userId;
if (!user || !targetUserId) return;
try {
const userRef = db.collection('users').doc(user.uid);
const targetUserRef = db.collection('users').doc(targetUserId);
await db.runTransaction(async (transaction) => {
const userDoc = await transaction.get(userRef);
const targetUserDoc = await transaction.get(targetUserRef);
if (!userDoc.exists || !targetUserDoc.exists) {
throw new Error("User not found");
}
const userData = userDoc.data();
const targetUserData = targetUserDoc.data();
const following = userData.following || [];
const followers = targetUserData.followers || [];
if (!following.includes(targetUserId)) {
following.push(targetUserId);
followers.push(user.uid);
transaction.update(userRef, { following: following });
transaction.update(targetUserRef, { followers: followers });
}
});
e.target.textContent = 'Following';
e.target.disabled = true;
e.target.classList.remove('bg-blue-500', 'hover:bg-blue-600');
e.target.classList.add('bg-gray-400');
showToast('Now following!', 'success');
} catch (error) {
console.error("Error following user:", error);
showToast('Error following user.', 'error');
}
}
});

postsContainer?.addEventListener('click', async (e) => {
const postContainer = e.target.closest('.post-container');
if (!postContainer) return;
const postId = postContainer.dataset.id;
const groupId = postContainer.dataset.groupId;

if (e.target.closest('.like-btn')) {
e.preventDefault();
if (!user) {
showToast("Please log in to like posts.", "info");
return;
}
const likeBtn = e.target.closest('.like-btn');
const likesCountDisplay = likeBtn.querySelector('.likes-count-display');
const heartIcon = likeBtn.querySelector('i');
const postRef = groupId && groupId !== 'undefined'
? db.collection('groups').doc(groupId).collection('posts').doc(postId)
: db.collection('posts').doc(postId);
try {
await db.runTransaction(async (transaction) => {
const postDoc = await transaction.get(postRef);
if (!postDoc.exists) throw new Error("Post not found");
const post = postDoc.data();
const likes = post.likes || [];
const userIndex = likes.indexOf(user.uid);
if (userIndex > -1) {
likes.splice(userIndex, 1);
likeBtn.classList.remove('text-red-500');
heartIcon.classList.remove('fas');
heartIcon.classList.add('far');
} else {
likes.push(user.uid);
likeBtn.classList.add('text-red-500');
heartIcon.classList.remove('far');
heartIcon.classList.add('fas');
}
transaction.update(postRef, { likes: likes });
likesCountDisplay.textContent = likes.length;
});
} catch (error) {
console.error("Error updating like:", error);
showToast("Could not update like.", "error");
}
return;
}

if (e.target.closest('.comment-btn')) {
e.preventDefault();
const commentsSection = postContainer.querySelector('.comments-section');
if (commentsSection.classList.contains('hidden')) {
commentsSection.classList.remove('hidden');
const postRef = groupId && groupId !== 'undefined'
? db.collection('groups').doc(groupId).collection('posts').doc(postId)
: db.collection('posts').doc(postId);
try {
const postDoc = await postRef.get();
if (postDoc.exists) {
const post = postDoc.data();
renderComments(commentsSection.querySelector('.comments-list'), post.comments, { id: postId, ...post });
}
} catch (error) {
console.error("Error loading comments:", error);
}
} else {
commentsSection.classList.add('hidden');
}
return;
}

if (e.target.closest('.edit-post-btn')) {
e.preventDefault();
const postContentDisplay = postContainer.querySelector('.post-content-display');
const currentContent = postContainer.dataset.rawContent || '';
const editForm = document.createElement('form');
editForm.className = 'edit-post-form';
editForm.innerHTML = `
<textarea class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">${currentContent}</textarea>
<div class="flex justify-end space-x-2 mt-2">
<button type="button" class="cancel-edit-btn px-3 py-1 text-gray-600 hover:text-gray-800">Cancel</button>
<button type="submit" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
</div>
`;
postContentDisplay.replaceWith(editForm);
editForm.addEventListener('submit', async (event) => {
event.preventDefault();
const newContent = editForm.querySelector('textarea').value.trim();
if (!newContent) return;
const postRef = groupId && groupId !== 'undefined'
? db.collection('groups').doc(groupId).collection('posts').doc(postId)
: db.collection('posts').doc(postId);
try {
await postRef.update({ content: newContent });
const newPostContentDisplay = document.createElement('p');
newPostContentDisplay.className = 'post-content-display mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200';
newPostContentDisplay.innerHTML = formatContent(newContent);
editForm.replaceWith(newPostContentDisplay);
postContainer.dataset.rawContent = newContent;
showToast('Post updated successfully!', 'success');
} catch (error) {
console.error("Error updating post:", error);
showToast('Could not update post.', 'error');
}
});
editForm.querySelector('.cancel-edit-btn').addEventListener('click', () => {
const originalPostContentDisplay = document.createElement('p');
originalPostContentDisplay.className = 'post-content-display mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200';
originalPostContentDisplay.innerHTML = formatContent(currentContent);
editForm.replaceWith(originalPostContentDisplay);
});
return;
}

if (e.target.closest('.delete-post-btn')) {
e.preventDefault();
if (confirm('Are you sure you want to delete this post?')) {
const postRef = groupId && groupId !== 'undefined'
? db.collection('groups').doc(groupId).collection('posts').doc(postId)
: db.collection('posts').doc(postId);
try {
await postRef.delete();
postContainer.remove();
showToast('Post deleted successfully!', 'success');
} catch (error) {
console.error("Error deleting post:", error);
showToast('Could not delete post.', 'error');
}
}
return;
}

if (e.target.closest('.report-post-btn')) {
e.preventDefault();
const reason = prompt('Please provide a reason for reporting this post:');
if (reason && reason.trim()) {
try {
await db.collection('reports').add({
postId: postId,
groupId: groupId || null,
reportedBy: user.uid,
reason: reason.trim(),
timestamp: firebase.firestore.FieldValue.serverTimestamp(),
status: 'pending'
});
showToast('Post reported successfully. Thank you for helping keep our community safe.', 'success');
} catch (error) {
console.error("Error reporting post:", error);
showToast('Could not submit report.', 'error');
}
}
return;
}

if (e.target.closest('.poll-option')) {
e.preventDefault();
if (!user) {
showToast("Please log in to vote.", "info");
return;
}
const pollOption = e.target.closest('.poll-option');
const optionIndex = parseInt(pollOption.dataset.optionIndex, 10);
const postRef = groupId && groupId !== 'undefined'
? db.collection('groups').doc(groupId).collection('posts').doc(postId)
: db.collection('posts').doc(postId);
try {
await db.runTransaction(async (transaction) => {
const postDoc = await transaction.get(postRef);
if (!postDoc.exists) throw new Error("Post not found");
const post = postDoc.data();
const poll = post.poll;
if (poll.voters[user.uid] !== undefined) {
showToast("You have already voted in this poll.", "info");
return;
}
poll.options[optionIndex].votes += 1;
poll.voters[user.uid] = optionIndex;
transaction.update(postRef, { poll: poll });
});
const updatedPostDoc = await postRef.get();
const updatedPost = updatedPostDoc.data();
const pollContainer = postContainer.querySelector('.poll-container');
const totalVotes = updatedPost.poll.options.reduce((sum, option) => sum + option.votes, 0);
updatedPost.poll.options.forEach((option, index) => {
const percentage = totalVotes > 0 ? ((option.votes / totalVotes) * 100).toFixed(1) : 0;
const optionEl = pollContainer.children[index];
optionEl.querySelector('.relative span:last-child').textContent = `${percentage}% (${option.votes})`;
optionEl.querySelector('.absolute').style.width = `${percentage}%`;
});
showToast('Vote recorded!', 'success');
} catch (error) {
console.error("Error voting in poll:", error);
showToast("Could not record vote.", "error");
}
return;
}

if (e.target.closest('.post-clickable-area')) {
e.preventDefault();
openPostModal(postId, groupId);
return;
}
});

postsContainer?.addEventListener('submit', async (e) => {
if (e.target.classList.contains('comment-form')) {
e.preventDefault();
const form = e.target;
const postContainer = form.closest('.post-container');
const postId = postContainer.dataset.id;
const groupId = postContainer.dataset.groupId;
await handleCommentSubmit(form, postId, groupId);
}
});

postsContainer?.addEventListener('click', async (e) => {
if (e.target.closest('.reply-btn')) {
e.preventDefault();
const replyBtn = e.target.closest('.reply-btn');
const parentTimestamp = replyBtn.dataset.parentTimestamp;
const commentWrapper = replyBtn.closest('.comment-wrapper');
const existingReplyForm = commentWrapper.querySelector('.reply-form');
if (existingReplyForm) {
existingReplyForm.remove();
return;
}
const replyForm = document.createElement('form');
replyForm.className = 'reply-form flex mt-2';
replyForm.dataset.replyTo = parentTimestamp;
replyForm.innerHTML = `
<input type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-l-lg p-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Write a reply..." required>
<button type="submit" class="bg-blue-500 text-white px-4 rounded-r-lg font-semibold hover:bg-blue-600">Reply</button>
`;
commentWrapper.appendChild(replyForm);
replyForm.querySelector('input').focus();
replyForm.addEventListener('submit', async (event) => {
event.preventDefault();
const postContainer = replyForm.closest('.post-container');
const postId = postContainer.dataset.id;
const groupId = postContainer.dataset.groupId;
await handleCommentSubmit(replyForm, postId, groupId);
});
}

if (e.target.closest('.delete-comment-btn')) {
e.preventDefault();
if (confirm('Are you sure you want to delete this comment?')) {
const deleteBtn = e.target.closest('.delete-comment-btn');
const commentTimestamp = parseInt(deleteBtn.dataset.timestamp, 10);
const postContainer = deleteBtn.closest('.post-container');
const postId = postContainer.dataset.id;
const groupId = postContainer.dataset.groupId;
const postRef = groupId && groupId !== 'undefined'
? db.collection('groups').doc(groupId).collection('posts').doc(postId)
: db.collection('posts').doc(postId);
try {
await db.runTransaction(async (transaction) => {
const postDoc = await transaction.get(postRef);
if (!postDoc.exists) throw new Error("Post not found");
const comments = postDoc.data().comments || [];
const filteredComments = comments.filter(comment => comment.timestamp.toMillis() !== commentTimestamp);
transaction.update(postRef, { comments: filteredComments });
});
const updatedPostDoc = await postRef.get();
const postDataForRender = { id: updatedPostDoc.id, ...updatedPostDoc.data() };
const updatedComments = updatedPostDoc.data().comments || [];
const commentsSection = postContainer.querySelector('.comments-section');
if (!commentsSection.classList.contains('hidden')) {
renderComments(commentsSection.querySelector('.comments-list'), updatedComments, postDataForRender);
}
postContainer.querySelector('.comments-count').textContent = updatedComments.length;
const modal = document.getElementById('postDetailModal');
if (modal.classList.contains('flex') && modal.dataset.postId === postId) {
renderComments(modal.querySelector('#modal-post-comments-list'), updatedComments, postDataForRender);
modal.querySelector('#modal-post-actions span:last-child').innerHTML = `<i class="far fa-comment mr-1"></i> ${updatedComments.length}`;
}
showToast('Comment deleted successfully!', 'success');
} catch (error) {
console.error("Error deleting comment:", error);
showToast('Could not delete comment.', 'error');
}
}
}
});

const modal = document.getElementById('postDetailModal');
const closeModalBtn = document.getElementById('closePostDetailModal');
closeModalBtn?.addEventListener('click', () => closeModal(modal));
modal?.addEventListener('click', (e) => {
if (e.target === modal) {
closeModal(modal);
}
});

modal?.addEventListener('click', async (e) => {
const postId = modal.dataset.postId;
const groupId = modal.dataset.groupId;

if (e.target.closest('.like-btn')) {
e.preventDefault();
if (!user) {
showToast("Please log in to like posts.", "info");
return;
}
const likeBtn = e.target.closest('.like-btn');
const likesCountDisplay = likeBtn.querySelector('.likes-count-display');
const heartIcon = likeBtn.querySelector('i');
const postRef = groupId && groupId !== 'undefined'
? db.collection('groups').doc(groupId).collection('posts').doc(postId)
: db.collection('posts').doc(postId);
try {
await db.runTransaction(async (transaction) => {
const postDoc = await transaction.get(postRef);
if (!postDoc.exists) throw new Error("Post not found");
const post = postDoc.data();
const likes = post.likes || [];
const userIndex = likes.indexOf(user.uid);
if (userIndex > -1) {
likes.splice(userIndex, 1);
likeBtn.classList.remove('text-red-500');
heartIcon.classList.remove('fas');
heartIcon.classList.add('far');
} else {
likes.push(user.uid);
likeBtn.classList.add('text-red-500');
heartIcon.classList.remove('far');
heartIcon.classList.add('fas');
}
transaction.update(postRef, { likes: likes });
likesCountDisplay.textContent = likes.length;
});
const postElement = document.querySelector(`.post-container[data-id="${postId}"]`);
if (postElement) {
const postLikeBtn = postElement.querySelector('.like-btn');
const postLikesCountDisplay = postLikeBtn.querySelector('.likes-count-display');
const postHeartIcon = postLikeBtn.querySelector('i');
postLikesCountDisplay.textContent = likesCountDisplay.textContent;
if (likeBtn.classList.contains('text-red-500')) {
postLikeBtn.classList.add('text-red-500');
postHeartIcon.classList.remove('far');
postHeartIcon.classList.add('fas');
} else {
postLikeBtn.classList.remove('text-red-500');
postHeartIcon.classList.remove('fas');
postHeartIcon.classList.add('far');
}
}
} catch (error) {
console.error("Error updating like:", error);
showToast("Could not update like.", "error");
}
return;
}
});

modal?.addEventListener('submit', async (e) => {
if (e.target.classList.contains('modal-comment-form')) {
e.preventDefault();
const form = e.target;
const postId = modal.dataset.postId;
const groupId = modal.dataset.groupId;
await handleCommentSubmit(form, postId, groupId);
}
});

window.addEventListener('scroll', () => {
if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000 && !isFetchingPosts && !allPostsLoaded) {
renderPosts(activeFeedType, true);
}
});
};

checkAdminStatus();
loadWhoToFollow();
loadTrendingHashtags();
renderPosts(activeFeedType);
setupEventListeners();

if (user) {
const createPostSection = document.getElementById('create-post-section');
if (createPostSection) {
createPostSection.classList.remove('hidden');
}
const userDoc = await db.collection('users').doc(user.uid).get();
if (userDoc.exists) {
const userData = userDoc.data();
currentUserFriends = userData.following || [];
}
}
});

const showToast = (message, type = 'info') => {
const toastContainer = document.getElementById('toast-container');
if (!toastContainer) return;
const toast = document.createElement('div');
toast.className = `toast p-4 rounded-lg shadow-lg text-white mb-2 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
toast.textContent = message;
toastContainer.appendChild(toast);
setTimeout(() => {
toast.remove();
}, 5000);
};
