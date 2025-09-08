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
whoToFollowContainer.innerHTML = '<p class="text-sm text-gray-500">Loading...</p>';

try {
const snapshot = await db.collection('users').orderBy('postCount', 'desc').limit(6).get();
whoToFollowContainer.innerHTML = '';
let count = 0;
snapshot.forEach(doc => {
if (doc.id !== user?.uid && count < 5) {
const userToFollow = doc.data();
const isFollowing = user ? currentUserFriends.includes(doc.id) : false;
const div = document.createElement('div');
div.className = 'flex items-center justify-between';
div.innerHTML = `
<div class="flex items-center">
<img src="${sanitizeHTML(userToFollow.photoURL) || 'https://i.imgur.com/B06rBhI.png'}" alt="${sanitizeHTML(userToFollow.displayName)}" class="w-10 h-10 rounded-full mr-3 object-cover">
<div>
<a href="/profile.html?uid=${doc.id}" class="font-semibold text-gray-800 dark:text-white hover:underline">${sanitizeHTML(userToFollow.displayName)}</a>
<p class="text-sm text-gray-500 dark:text-gray-400">@${sanitizeHTML(userToFollow.handle)}</p>
</div>
</div>
<button class="follow-btn px-3 py-1 text-sm font-semibold rounded-full transition-colors ${isFollowing ? 'following' : 'bg-blue-500 text-white hover:bg-blue-600'}" data-uid="${doc.id}">${isFollowing ? 'Following' : 'Follow'}</button>
`;
whoToFollowContainer.appendChild(div);
count++;
}
});

if (count === 0) {
whoToFollowContainer.innerHTML = '<p class="text-sm text-gray-500">No suggestions right now.</p>';
}

} catch (error) {
console.error("Error loading who to follow:", error);
whoToFollowContainer.innerHTML = '<p class="text-sm text-red-500">Could not load suggestions.</p>';
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
        renderPosts(activeFeedType);
    } catch (error) {
        console.error("Error creating poll post:", error);
        showToast(`Error: ${error.message}`, 'error');
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

if (e.target.closest('.post-clickable-area') && !e.target.closest('a, button, input, .poll-option, video')) {
    openPostModal(postId, groupId);
    return;
}
if (e.target.closest('.reply-btn')) {
    const replyBtn = e.target.closest('.reply-btn');
    const parentCommentEl = replyBtn.closest('.flex-1');
    const parentTimestamp = replyBtn.dataset.parentTimestamp;
    
    const existingForm = parentCommentEl.querySelector('.reply-form');
    if (existingForm) {
        existingForm.remove();
        return;
    }
    const replyForm = document.createElement('form');
    replyForm.className = 'reply-form flex mt-2';
    replyForm.dataset.replyTo = parentTimestamp;
    replyForm.innerHTML = `
        <input type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-l-lg p-2 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Write a reply..." required>
        <button type="submit" class="bg-blue-500 text-white px-3 rounded-r-lg text-sm font-semibold hover:bg-blue-600">Reply</button>
    `;
    parentCommentEl.appendChild(replyForm);
    replyForm.querySelector('input').focus();
    return;
}

if (!user) {
if (e.target.closest('.like-btn, .comment-btn, .report-post-btn, .poll-option')) {
showToast("Please log in to interact with posts.", "info");
}
return;
}

const pollOption = e.target.closest('.poll-option');
if(pollOption){
    const optionIndex = parseInt(pollOption.dataset.optionIndex, 10);
    try {
        await db.runTransaction(async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if(!postDoc.exists) throw "Post not found";
            const postData = postDoc.data();
            const poll = postData.poll;
            if(poll.voters && poll.voters[user.uid] !== undefined){
                showToast("You have already voted in this poll.", "info");
                return;
            }
            poll.options[optionIndex].votes += 1;
            poll.voters[user.uid] = optionIndex;
            transaction.update(postRef, { poll: poll });
        });
        const updatedPostDoc = await postRef.get();
        const newPostElement = createPostElement({id: updatedPostDoc.id, ...updatedPostDoc.data()});
        postElement.replaceWith(newPostElement);
    } catch(error) {
        console.error("Error voting on poll:", error);
        showToast("Could not register your vote.", "error");
    }
}
if (e.target.closest('.delete-post-btn')) {
if (confirm('Are you sure you want to delete this post?')) {
try { await postRef.delete(); postElement.remove(); showToast("Post deleted.", "success"); } catch (error) { console.error("Error deleting post: ", error); showToast("Could not delete post.", "error"); }
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
if (userIndex === -1) { likes.push(user.uid); } else { likes.splice(userIndex, 1); }
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
</div>`;
}
if (e.target.closest('.cancel-edit-btn')) {
const postBody = postElement.querySelector('.post-body-content');
const rawContent = postElement.dataset.rawContent;
const mediaHTML = postElement.querySelector('.post-clickable-area img, .post-clickable-area video')?.outerHTML || '';
postBody.innerHTML = `<p class="post-content-display mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200">${formatContent(rawContent)}</p>${mediaHTML}`;
}
if (e.target.closest('.save-edit-btn')) {
const postBody = postElement.querySelector('.post-body-content');
const textarea = postBody.querySelector('.edit-post-textarea');
const newContent = textarea.value;
try {
await postRef.update({ content: newContent, hashtags: (newContent.match(/#(\w+)/g) || []).map(tag => tag.substring(1)) });
postElement.dataset.rawContent = newContent;
const mediaHTML = postElement.querySelector('.post-clickable-area img, .post-clickable-area video')?.outerHTML || '';
postBody.innerHTML = `<p class="post-content-display mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200">${formatContent(newContent)}</p>${mediaHTML}`;
showToast("Post updated!", "success");
} catch (error) { console.error("Error updating post:", error); showToast("Could not save changes.", "error"); }
}
if (e.target.closest('.delete-comment-btn')) {
if (confirm('Are you sure you want to delete this comment and all its replies?')) {
const deleteBtn = e.target.closest('.delete-comment-btn');
const commentTimestamp = parseInt(deleteBtn.dataset.timestamp, 10);
try {
    await db.runTransaction(async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists) throw new Error("Post not found.");
        const comments = postDoc.data().comments || [];
        const idsToDelete = [commentTimestamp];
        const findReplies = (parentId) => {
            comments.forEach(c => {
                if (c.replyTo === parentId) {
                    const ts = c.timestamp.toMillis();
                    idsToDelete.push(ts);
                    findReplies(ts);
                }
            });
        };
        findReplies(commentTimestamp);
        const updatedComments = comments.filter(c => !idsToDelete.includes(c.timestamp.toMillis()));
        if (comments.length === updatedComments.length) return;
        transaction.update(postRef, { comments: updatedComments });
    });
    
    const finalPostDoc = await postRef.get();
    const postDataForRender = { id: finalPostDoc.id, ...finalPostDoc.data() };
    renderComments(postElement.querySelector('.comments-list'), finalPostDoc.data().comments, postDataForRender);
    postElement.querySelector('.comments-count').textContent = finalPostDoc.data().comments.length;
    showToast("Comment deleted.", "success");
} catch (error) { console.error("Error deleting comment:", error); showToast("Could not delete comment.", "error"); }
}
}
});

postsContainer.addEventListener('submit', async (e) => {
e.preventDefault();
if (e.target.classList.contains('comment-form') || e.target.classList.contains('reply-form')) {
const postElement = e.target.closest('.post-container');
handleCommentSubmit(e.target, postElement.dataset.id, postElement.dataset.groupId);
}
});

const postDetailModal = document.getElementById('postDetailModal');
postDetailModal?.addEventListener('click', (e) => {
    if (e.target.closest('.reply-btn')) {
        const replyBtn = e.target.closest('.reply-btn');
        const parentCommentEl = replyBtn.closest('.flex-1');
        const parentTimestamp = replyBtn.dataset.parentTimestamp;
        
        const existingForm = parentCommentEl.querySelector('.reply-form');
        if (existingForm) {
            existingForm.remove();
            return;
        }
        const replyForm = document.createElement('form');
        replyForm.className = 'reply-form flex mt-2';
        replyForm.dataset.replyTo = parentTimestamp;
        replyForm.innerHTML = `
            <input type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-l-lg p-2 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Write a reply..." required>
            <button type="submit" class="bg-blue-500 text-white px-3 rounded-r-lg text-sm font-semibold hover:bg-blue-600">Reply</button>`;
        parentCommentEl.appendChild(replyForm);
        replyForm.querySelector('input').focus();
    }
});
postDetailModal?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.classList.contains('modal-comment-form') || e.target.classList.contains('reply-form')) {
        handleCommentSubmit(e.target, postDetailModal.dataset.postId, postDetailModal.dataset.groupId);
    }
});
document.getElementById('closePostDetailModal')?.addEventListener('click', () => closeModal(postDetailModal));
document.getElementById('closeLikesModal')?.addEventListener('click', () => closeModal(document.getElementById('likesModal')));

const reportPostModal = document.getElementById('reportPostModal');
document.getElementById('closeReportModal')?.addEventListener('click', () => closeModal(reportPostModal));
document.getElementById('reportPostForm')?.addEventListener('submit', async (e) => {
e.preventDefault();
const postId = document.getElementById('report-post-id').value;
const reason = document.getElementById('report-reason').value;
const details = document.getElementById('report-details').value;
if (!user || !postId) {
showToast("Cannot submit report.", "error");
return;
}
const submitBtn = e.target.querySelector('button[type="submit"]');
submitBtn.disabled = true;
submitBtn.textContent = 'Submitting...';
try {
await db.collection('reports').add({ postId, reportedBy: user.uid, reason, details, timestamp: firebase.firestore.FieldValue.serverTimestamp(), status: 'pending' });
showToast('Thank you for your report.', 'success');
closeModal(reportPostModal);
e.target.reset();
} catch (error) { console.error("Error submitting report:", error); showToast("Could not submit report.", "error"); } finally { submitBtn.disabled = false; submitBtn.textContent = 'Submit Report'; }
});

whoToFollowContainer?.addEventListener('click', async (e) => {
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
} catch (error) { console.error("Error following user:", error); showToast("Could not complete action.", "error"); followBtn.textContent = isCurrentlyFollowing ? 'Following' : 'Follow'; } finally { followBtn.disabled = false; }
}
});

window.addEventListener('scroll', () => {
if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500 && !isFetchingPosts && !allPostsLoaded) {
renderPosts(activeFeedType, true);
}
});
};

const initializeApp = async () => {
const createPostSection = document.getElementById('create-post-section');
if (user) {
createPostSection?.classList.remove('hidden');
await checkAdminStatus();
const userDoc = await db.collection('users').doc(user.uid).get();
if (userDoc.exists) {
    const userData = userDoc.data();
    currentUserFriends = userData?.friends || [];
    localStorage.setItem('userDateFormat', userData.dateFormat || 'dmy');
}
renderPosts(activeFeedType);
loadTrendingHashtags();
loadWhoToFollow();
} else {
createPostSection?.classList.add('hidden');
localStorage.setItem('userDateFormat', 'dmy');
postsContainer.innerHTML = `
<div class="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
<h2 class="text-2xl font-bold text-gray-800 dark:text-white">Welcome to HatakeSocial!</h2>
<p class="mt-2 text-gray-600 dark:text-gray-400">Please log in or register to view the feed and join the community.</p>
</div>
`;
loadWhoToFollow();
}
setupEventListeners();
};

initializeApp();
});