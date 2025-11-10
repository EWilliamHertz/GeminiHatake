/**
 * HatakeSocial - Profile Page Script (v29 - Privacy Implemented & Fully Merged)
 *
 * - UPDATE: Integrated privacy settings for profile and collection visibility.
 * - The script now checks the `privacy` field on a user's document before loading their data.
 * - If a profile is 'Private' or 'Friends Only' (and the viewer is not a friend), a privacy message is displayed instead of the full profile.
 * - The collection, wishlist, and trade binder tabs will also show a privacy message if the user's settings restrict access.
 * - All previous interactive feed, modal, and reply functionalities (v28) are retained and fully implemented.
 */

// --- Helper Functions ---
const formatTimestamp = (timestamp) => {
    if (!timestamp || !timestamp.seconds) {
        if (timestamp && timestamp.toDate) { // Handle Firestore Server Timestamp
             const date = timestamp.toDate();
             const day = String(date.getDate()).padStart(2, '0');
             const month = String(date.getMonth() + 1).padStart(2, '0');
             const year = date.getFullYear();
             return localStorage.getItem('userDateFormat') === 'mdy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
        }
        return 'Unknown date';
    }
    const date = new Date(timestamp.seconds * 1000);
    const userDateFormat = localStorage.getItem('userDateFormat') || 'dmy';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return userDateFormat === 'mdy' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
};

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

document.addEventListener('authReady', (e) => {
    const currentUser = e.detail.user;
    const profileContainer = document.getElementById('profile-container');
    if (!profileContainer) return;
    
    const db = firebase.firestore();
    let currentUserIsAdmin = false;

    // --- Geocoding and Badge Data ---
    const cityCoordinates = { "stockholm": [59.3293, 18.0686], "gothenburg": [57.7089, 11.9746], "malmö": [55.6050, 13.0038], "oslo": [59.9139, 10.7522], "copenhagen": [55.6761, 12.5683], "helsinki": [60.1699, 24.9384], "london": [51.5074, -0.1278], "paris": [48.8566, 2.3522], "berlin": [52.5200, 13.4050], "new york": [40.7128, -74.0060], "los angeles": [34.0522, -118.2437], "chicago": [41.8781, -87.6298], "tokyo": [35.6895, 139.6917], "sydney": [-33.8688, 151.2093] };
    const badgeDefinitions = { pioneer: { name: 'Pioneer', description: 'One of the first 100 users to join HatakeSocial!', icon: 'fa-rocket', color: 'text-purple-500', async check(userData, userId) { const pioneerDate = new Date('2025-07-01'); return userData.createdAt.toDate() < pioneerDate; } }, collector: { name: 'Collector', description: 'Has over 100 cards in their collection.', icon: 'fa-box-open', color: 'text-blue-500', async check(userData, userId) { const snapshot = await db.collection('users').doc(userId).collection('collection').limit(101).get(); return snapshot.size > 100; } }, deck_brewer: { name: 'Deck Brewer', description: 'Has created at least 5 decks.', icon: 'fa-layer-group', color: 'text-green-500', async check(userData, userId) { const snapshot = await db.collection('users').doc(userId).collection('decks').limit(5).get(); return snapshot.size >= 5; } }, socialite: { name: 'Socialite', description: 'Has more than 10 friends.', icon: 'fa-users', color: 'text-pink-500', async check(userData, userId) { return userData.friends && userData.friends.length > 10; } }, trusted_trader: { name: 'Trusted Trader', description: 'Completed 10 trades with positive feedback.', icon: 'fa-handshake', color: 'text-yellow-500', async check(userData, userId) { const avgRating = ((userData.averageAccuracy || 0) + (userData.averagePackaging || 0)) / 2; return (userData.ratingCount || 0) >= 10 && avgRating >= 4.5; } }, first_trade: { name: 'First Trade', description: 'Completed your first trade successfully!', icon: 'fa-medal', color: 'text-red-500', async check(userData, userId) { const tradeQuery = await db.collection('trades').where('participants', 'array-contains', userId).where('status', '==', 'completed').limit(1).get(); return !tradeQuery.empty; } }, top_reviewer: { name: 'Top Reviewer', description: 'Provided helpful feedback on at least 5 trades.', icon: 'fa-star', color: 'text-blue-400', async check(userData, userId) { const feedbackQuery = await db.collection('feedback').where('fromUserId', '==', userId).limit(5).get(); return feedbackQuery.size >= 5; } }, guild_founder: { name: 'Guild Founder', description: 'Founded your first Trading Guild.', icon: 'fa-shield-alt', color: 'text-indigo-500', async check(userData, userId) { const groupQuery = await db.collection('groups').where('creatorId', '==', userId).where('groupType', '==', 'trading_guild').limit(1).get(); return !groupQuery.empty; } } };
    
    const generateIndexCreationLink = (collection, fields) => { const projectId = db.app.options.projectId; let url = `https://console.firebase.google.com/project/${projectId}/firestore/indexes/composite/create?collectionId=${collection}`; fields.forEach(field => { url += `&fields=${field.name},${field.order.toUpperCase()}`; }); return url; };
    const displayIndexError = (container, link) => { container.innerHTML = `<div class="col-span-full text-center p-4 bg-red-100 dark:bg-red-900/50 rounded-lg"><p class="font-bold text-red-700 dark:text-red-300">Database Error</p><p class="text-red-600 dark:text-red-400 mt-2">A required database index is missing for this query.</p><a href="${link}" target="_blank" rel="noopener noreferrer" class="mt-4 inline-block px-6 py-2 bg-blue-600 text-white font-semibold rounded-full shadow-md hover:bg-blue-700">Click Here to Create the Index</a><p class="text-xs text-gray-500 mt-2">This will open the Firebase console. Click "Save" to create the index. It may take a few minutes to build.</p></div>`; };
    const checkAdminStatus = async () => { if (!currentUser) { currentUserIsAdmin = false; return; } const userDoc = await db.collection('users').doc(currentUser.uid).get(); currentUserIsAdmin = userDoc.exists && userDoc.data().isAdmin === true; };

    // --- FEED-RELATED FUNCTIONS ---
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
            const canDeleteComment = currentUser && (comment.authorId === currentUser.uid || post.authorId === currentUser.uid || currentUserIsAdmin);
            const commentTimestampMillis = comment.timestamp.toMillis();
            const deleteCommentBtnHTML = canDeleteComment ? `<button class="delete-comment-btn text-xs text-gray-400 hover:text-red-500" title="Delete Comment" data-timestamp="${commentTimestampMillis}"><i class="fas fa-trash"></i></button>` : '';
            const replyBtnHTML = currentUser ? `<button class="reply-btn text-xs font-semibold text-blue-500 hover:underline" data-parent-timestamp="${commentTimestampMillis}">Reply</button>` : '';
            commentEl.innerHTML = `<div class="flex items-start space-x-3"><a href="profile.html?uid=${comment.authorId}"><img src="${sanitizeHTML(comment.authorPhotoURL) || 'https://i.imgur.com/B06rBhI.png'}" alt="${sanitizeHTML(comment.author)}" class="h-8 w-8 rounded-full object-cover"></a><div class="flex-1"><div class="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2"><a href="profile.html?uid=${comment.authorId}" class="font-semibold text-sm text-gray-800 dark:text-white hover:underline">${sanitizeHTML(comment.author)}</a><p class="text-sm text-gray-700 dark:text-gray-300">${formatContent(comment.content)}</p></div><div class="text-xs text-gray-500 dark:text-gray-400 mt-1 px-1 flex items-center space-x-3"><span>${formatTimestamp(comment.timestamp)}</span>${replyBtnHTML}${deleteCommentBtnHTML}</div><div class="replies-container pl-6 mt-2 space-y-2 border-l-2 border-gray-200 dark:border-gray-700"></div></div></div>`;
            commentsMap.set(commentTimestampMillis, commentEl);
            if (comment.replyTo && commentsMap.has(comment.replyTo)) {
                commentsMap.get(comment.replyTo).querySelector('.replies-container').appendChild(commentEl);
            } else {
                topLevelComments.push(commentEl);
            }
        });
        topLevelComments.forEach(el => container.appendChild(el));
    };

    const createPostElementForProfile = (post) => {
        const postElement = document.createElement('div');
        postElement.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md post-container';
        postElement.dataset.id = post.id;
        postElement.dataset.rawContent = post.content || '';

        const formattedContent = formatContent(post.content || '');
        const mediaHTML = post.mediaUrl ? (post.mediaType.startsWith('image/') ? `<img src="${sanitizeHTML(post.mediaUrl)}" alt="Post media" class="max-h-96 w-full object-cover rounded-lg my-2">` : `<video src="${sanitizeHTML(post.mediaUrl)}" controls class="max-h-96 w-full object-cover rounded-lg my-2"></video>`) : '';
        const postBodyHTML = `<div class="post-body-content post-clickable-area cursor-pointer"><p class="post-content-display mb-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200">${formattedContent}</p>${mediaHTML}</div>`;

        const isLiked = currentUser && Array.isArray(post.likes) && post.likes.includes(currentUser.uid);
        const likesCount = Array.isArray(post.likes) ? post.likes.length : 0;
        const commentsCount = Array.isArray(post.comments) ? post.comments.length : 0;
        const canDelete = currentUser && (post.authorId === currentUser.uid || currentUserIsAdmin);
        const deleteButtonHTML = canDelete ? `<button class="delete-post-btn text-gray-400 hover:text-red-500" title="Delete Post"><i class="fas fa-trash"></i></button>` : '';

        postElement.innerHTML = `<div class="flex justify-between items-start"><div class="flex items-center mb-4"><a href="profile.html?uid=${post.authorId}"><img src="${sanitizeHTML(post.authorPhotoURL) || 'https://i.imgur.com/B06rBhI.png'}" alt="${sanitizeHTML(post.author)}" class="h-10 w-10 rounded-full mr-4 object-cover"></a><div><a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white hover:underline">${sanitizeHTML(post.author)}</a><p class="text-sm text-gray-500 dark:text-gray-400">${formatTimestamp(post.timestamp)}</p></div></div><div class="post-actions-menu flex space-x-3 text-gray-400">${deleteButtonHTML}</div></div>${postBodyHTML}<div class="flex justify-between items-center mt-4 text-gray-600 dark:text-gray-400"><button class="like-btn flex items-center hover:text-red-500 ${isLiked ? 'text-red-500' : ''}"><i class="${isLiked ? 'fas' : 'far'} fa-heart mr-1"></i><span class="likes-count-display">${likesCount}</span></button><button class="comment-btn flex items-center hover:text-blue-500"><i class="far fa-comment mr-1"></i><span class="comments-count">${commentsCount}</span></button></div><div class="comments-section hidden mt-4 pt-2"><div class="comments-list space-y-2"></div><form class="comment-form flex mt-4"><input type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-l-lg p-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Write a comment..." required=""><button type="submit" class="bg-blue-500 text-white px-4 rounded-r-lg font-semibold hover:bg-blue-600">Post</button></form></div>`;
        return postElement;
    };

    const openPostModalForProfile = async (postId) => {
        const modal = document.getElementById('postDetailModal');
        if (!modal) return;
        modal.dataset.postId = postId;
        modal.querySelector('#modal-post-author').innerHTML = '<div class="h-10 w-10 rounded-full skeleton"></div>';
        modal.querySelector('#modal-post-content').innerHTML = '<div class="h-4 w-full skeleton"></div>';
        openModal(modal);

        try {
            const postDoc = await db.collection('posts').doc(postId).get();
            if (!postDoc.exists) throw new Error("Post not found.");
            const post = postDoc.data();
            const isLiked = currentUser && post.likes?.includes(currentUser.uid);

            modal.querySelector('#modal-post-author').innerHTML = `<a href="profile.html?uid=${post.authorId}"><img src="${sanitizeHTML(post.authorPhotoURL)}" alt="${sanitizeHTML(post.author)}" class="h-10 w-10 rounded-full mr-4 object-cover"></a><div><a href="profile.html?uid=${post.authorId}" class="font-bold text-gray-800 dark:text-white hover:underline">${sanitizeHTML(post.author)}</a><p class="text-sm text-gray-500 dark:text-gray-400">${formatTimestamp(post.timestamp)}</p></div>`;
            modal.querySelector('#modal-post-content').innerHTML = formatContent(post.content || '');
            const mediaContainer = modal.querySelector('#modal-post-media-container');
            if (post.mediaUrl) {
                mediaContainer.innerHTML = post.mediaType.startsWith('image/') ? `<img src="${sanitizeHTML(post.mediaUrl)}" class="max-w-full max-h-full object-contain">` : `<video src="${sanitizeHTML(post.mediaUrl)}" controls class="max-w-full max-h-full object-contain"></video>`;
                mediaContainer.classList.remove('hidden');
                modal.querySelector('#modal-grid-container').classList.add('md:grid-cols-2');
            } else {
                mediaContainer.classList.add('hidden');
                modal.querySelector('#modal-grid-container').classList.remove('md:grid-cols-2');
            }
            modal.querySelector('#modal-post-actions').innerHTML = `<button class="like-btn flex items-center hover:text-red-500 ${isLiked ? 'text-red-500' : ''}"><i class="${isLiked ? 'fas' : 'far'} fa-heart mr-1"></i><span>${post.likes?.length || 0}</span></button><span class="ml-4"><i class="far fa-comment mr-1"></i> ${post.comments?.length || 0}</span>`;
            renderComments(modal.querySelector('#modal-post-comments-list'), post.comments, post);
        } catch (error) {
            console.error("Error loading post modal:", error);
            modal.querySelector('#modal-post-content').innerHTML = `<p class="text-red-500">Could not load post.</p>`;
        }
    };
    
    const handleCommentSubmitForProfile = async (form, postId) => {
        if (!currentUser) {
            alert("Please log in to comment.");
            return;
        }
        const input = form.querySelector('input');
        const content = input.value.trim();
        if (!content) return;
        const postRef = db.collection('posts').doc(postId);
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const newComment = { author: userDoc.data().displayName, authorId: currentUser.uid, authorPhotoURL: userDoc.data().photoURL, content: content, timestamp: new Date(), replyTo: form.dataset.replyTo ? parseInt(form.dataset.replyTo, 10) : null };
        input.disabled = true;
        try {
            await db.runTransaction(async (t) => {
                const doc = await t.get(postRef);
                const comments = doc.data().comments || [];
                comments.push(newComment);
                t.update(postRef, { comments });
            });
            if (form.classList.contains('reply-form')) form.remove();
            else form.reset();
            const updatedDoc = await postRef.get();
            const comments = updatedDoc.data().comments;
            const postElement = document.querySelector(`.post-container[data-id="${postId}"]`);
            if(postElement) {
                renderComments(postElement.querySelector('.comments-list'), comments, updatedDoc.data());
                postElement.querySelector('.comments-count').textContent = comments.length;
            }
            const modal = document.getElementById('postDetailModal');
            if(modal.classList.contains('flex') && modal.dataset.postId === postId) {
                renderComments(modal.querySelector('#modal-post-comments-list'), comments, updatedDoc.data());
                modal.querySelector('#modal-post-actions span:last-child').innerHTML = `<i class="far fa-comment mr-1"></i> ${comments.length}`;
            }
        } catch (error) { console.error("Error submitting comment:", error); } finally { input.disabled = false; }
    };
    
    // --- PROFILE DATA LOADING FUNCTIONS ---
    
    const displayPrivacyMessage = (message) => {
        profileContainer.innerHTML = `
            <div class="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-2xl mx-auto mt-10">
                <i class="fas fa-lock text-4xl text-gray-400 mb-4"></i>
                <h1 class="text-2xl font-bold">${message}</h1>
                <p class="mt-2 text-gray-500">You do not have permission to view this content.</p>
            </div>
        `;
    };
    
    const loadProfileFeed = async (userId) => {
        const container = document.getElementById('tab-content-feed');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading feed...</p>';
        try {
            const snapshot = await db.collection('posts').where('authorId', '==', userId).orderBy('timestamp', 'desc').get();
            if(snapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user hasn\'t posted anything yet.</p>';
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const post = { id: doc.id, ...doc.data() };
                container.appendChild(createPostElementForProfile(post));
            });
        } catch (error) {
            console.error("Error loading profile feed:", error);
            if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('posts', [{ name: 'authorId', order: 'asc' }, { name: 'timestamp', order: 'desc' }]);
                displayIndexError(container, indexLink);
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load feed.</p>`;
            }
        }
    };
    
    const evaluateAndAwardBadges = async (userId, userData) => {
        const userBadgesRef = db.collection('users').doc(userId).collection('badges');
        const existingBadgesSnapshot = await userBadgesRef.get();
        const existingBadgeIds = existingBadgesSnapshot.docs.map(doc => doc.id);

        for (const badgeId in badgeDefinitions) {
            if (!existingBadgeIds.includes(badgeId)) {
                const definition = badgeDefinitions[badgeId];
                try {
                    const hasBadge = await definition.check(userData, userId);
                    if (hasBadge) {
                        await userBadgesRef.doc(badgeId).set({
                            awardedAt: new Date(),
                            name: definition.name,
                            description: definition.description,
                            icon: definition.icon,
                            color: definition.color
                        });
                    }
                } catch (error) {
                    console.warn(`Could not check for badge "${badgeId}":`, error.message);
                }
            }
        }
    };

    const loadAndDisplayBadges = async (userId) => {
        const badgesListContainer = document.getElementById('badges-list');
        badgesListContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Loading achievements...</p>';
        try {
            // Get user's earned badges
            const userBadgesSnapshot = await db.collection('users').doc(userId).collection('badges').get();

            if (userBadgesSnapshot.empty) {
                badgesListContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No achievements yet.</p>';
                return;
            }

            // Get badge definitions from Firestore
            const badgeDefinitionsSnapshot = await db.collection('badgeDefinitions').get();
            const badgeDefinitionsMap = {};
            badgeDefinitionsSnapshot.forEach(doc => {
                badgeDefinitionsMap[doc.id] = doc.data();
            });

            badgesListContainer.innerHTML = '';

            // Display each earned badge with its definition
            userBadgesSnapshot.forEach(doc => {
                const earnedBadge = doc.data();
                const badgeId = earnedBadge.badgeId || doc.id;
                const badgeDefinition = badgeDefinitionsMap[badgeId];

                if (!badgeDefinition) {
                    console.warn(`Badge definition not found for: ${badgeId}`);
                    return;
                }

                const badgeEl = document.createElement('div');
                badgeEl.className = 'badge-item';
                badgeEl.title = badgeDefinition.description || 'No description';
                
                // Map rarity to color
                const rarityColors = {
                    'common': 'text-gray-500',
                    'uncommon': 'text-green-500',
                    'rare': 'text-blue-500',
                    'epic': 'text-purple-500',
                    'legendary': 'text-yellow-500'
                };
                const color = rarityColors[badgeDefinition.rarity] || 'text-gray-500';
                
                badgeEl.innerHTML = `
                    <i class="fas ${badgeDefinition.icon || 'fa-award'} ${color} badge-icon"></i>
                    <span class="badge-name">${badgeDefinition.name || 'Unknown Badge'}</span>
                `;
                badgesListContainer.appendChild(badgeEl);
            });
        } catch (error) {
            console.error("Error loading badges:", error);
            badgesListContainer.innerHTML = '<p class="text-sm text-red-500">Could not load achievements.</p>';
        }
    };
    
    const loadProfileDecks = async (userId, isOwnProfile) => {
        const container = document.getElementById('tab-content-decks');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading decks...</p>';
        try {
            const snapshot = await db.collection('users').doc(userId).collection('decks').orderBy('createdAt', 'desc').get();
            if (snapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user has no public decks.</p>';
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const deck = doc.data();
                const deckCard = document.createElement('div');
                deckCard.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex flex-col';
                
                let pinButtonHTML = '';
                if (isOwnProfile) {
                    pinButtonHTML = `<button class="pin-deck-btn text-xs text-blue-500 hover:underline mt-2" data-deck-id="${doc.id}">Pin to Profile</button>`;
                }
                
                deckCard.innerHTML = `
                    <a href="deck.html?deckId=${doc.id}" class="block hover:opacity-80 flex-grow">
                        <h3 class="text-xl font-bold truncate dark:text-white">${deck.name}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${deck.format || deck.tcg}</p>
                    </a>
                    ${pinButtonHTML}
                `;
                container.appendChild(deckCard);
            });
        } catch (error) {
            console.error("Error loading profile decks:", error);
            if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('decks', [{ name: 'createdAt', order: 'desc' }]);
                displayIndexError(container, indexLink);
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load decks.</p>`;
            }
        }
    };
    
    const loadProfileCollection = async (userId, listType, isOwnProfile, visibility, isFriend) => {
        const container = document.getElementById(`tab-content-${listType}`);
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading...</p>';

        if (!isOwnProfile && !currentUserIsAdmin) {
            if (visibility === 'Private') {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4"><i class="fas fa-lock mr-2"></i>This user's ${listType} is private.</p>`;
                return;
            }
            if (visibility === 'Friends Only' && !isFriend) {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4"><i class="fas fa-user-friends mr-2"></i>This user's ${listType} is only visible to friends.</p>`;
                return;
            }
        }
        
        try {
            const snapshot = await db.collection('users').doc(userId).collection(listType).orderBy('name').limit(32).get();
            if (snapshot.empty) {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user's ${listType} is empty.</p>`;
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const card = doc.data();
                const cardEl = document.createElement('div');
                cardEl.className = 'relative group';
                
                let pinButtonHTML = '';
                if (isOwnProfile && listType === 'collection') {
                     pinButtonHTML = `<button class="pin-card-btn text-white text-xs ml-1" title="Pin to Profile" data-card-id="${doc.id}"><i class="fas fa-thumbtack"></i></button>`;
                }

                cardEl.innerHTML = `
                    <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block">
                        <img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="rounded-lg shadow-md w-full ${card.forSale ? 'border-4 border-green-500' : ''}" onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                    </a>
                    <div class="absolute top-0 right-0 p-1 bg-black bg-opacity-50 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        ${pinButtonHTML}
                    </div>
                `;
                container.appendChild(cardEl);
            });
        } catch (error) {
            console.error(`Error loading ${listType}:`, error);
            if (error.code === 'permission-denied') {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4"><i class="fas fa-lock mr-2"></i>You do not have permission to view this ${listType}.</p>`;
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load this section.</p>`;
            }
        }
    };

    const loadTradeBinder = async (userId, userData, visibility, isFriend) => {
        const container = document.getElementById('tab-content-trade-binder');
        const isOwnProfile = currentUser && currentUser.uid === userId;
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading trade binder...</p>';

        if (!isOwnProfile && !currentUserIsAdmin) {
            if (visibility === 'Private') {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4"><i class="fas fa-lock mr-2"></i>This user's trade binder is private.</p>`;
                return;
            }
            if (visibility === 'Friends Only' && !isFriend) {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4"><i class="fas fa-user-friends mr-2"></i>This user's trade binder is only visible to friends.</p>`;
                return;
            }
        }

        try {
            const snapshot = await db.collection('users').doc(userId).collection('collection').where('forSale', '==', true).get();
            if (snapshot.empty) {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user has no cards listed for trade.</p>`;
                return;
            }
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const card = doc.data();
                const cardEl = document.createElement('div');
                cardEl.className = 'relative group';
                
                const priceUsd = parseFloat(card.isFoil ? card.priceUsdFoil : card.priceUsd) || 0;
                const formattedPrice = priceUsd > 0 && window.HatakeSocial?.convertAndFormatPrice ? window.HatakeSocial.convertAndFormatPrice(priceUsd, 'USD') : '';
                const priceTagHTML = formattedPrice 
                    ? `<div class="absolute top-1 left-1 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded-full pointer-events-none">${formattedPrice}</div>`
                    : '';

                let tradeButtonHTML = '';
                if (currentUser && !isOwnProfile) {
                    tradeButtonHTML = `<a href="trades.html?propose_to_card=${doc.id}" class="absolute bottom-0 left-0 right-0 block w-full text-center bg-green-600 text-white text-xs font-bold py-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">Start Trade</a>`;
                }

                cardEl.innerHTML = `
                    <a href="card-view.html?name=${encodeURIComponent(card.name)}" class="block">
                        <img src="${card.imageUrl || 'https://placehold.co/223x310'}" alt="${card.name}" class="rounded-lg shadow-md w-full" onerror="this.onerror=null;this.src='https://placehold.co/223x310';">
                    </a>
                    ${priceTagHTML}
                    ${tradeButtonHTML}
                `;
                container.appendChild(cardEl);
            });
        } catch (error) {
            console.error("Error loading trade binder: ", error);
             if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('collection', [{ name: 'forSale', order: 'asc' }]);
                displayIndexError(container, indexLink);
            } else if (error.code === 'permission-denied') {
                container.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 p-4"><i class="fas fa-lock mr-2"></i>You do not have permission to view this trade binder.</p>`;
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load trade binder.</p>`;
            }
        }
    };

    const loadFeaturedItems = async (userId, userData) => {
        const container = document.getElementById('featured-items-section');
        container.innerHTML = '';
        
        let contentHTML = '';

        if (userData.featuredDeck) {
            const deckDoc = await db.collection('users').doc(userId).collection('decks').doc(userData.featuredDeck).get();
            if (deckDoc.exists) {
                const deck = deckDoc.data();
                contentHTML += `
                    <div class="mb-4">
                        <h4 class="font-semibold text-gray-700 dark:text-gray-300">Featured Deck</h4>
                        <a href="deck.html?deckId=${deckDoc.id}" class="block bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg mt-1 hover:shadow-md">
                            <p class="font-bold text-lg text-blue-600 dark:text-blue-400">${deck.name}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400">${deck.format || deck.tcg}</p>
                        </a>
                    </div>
                `;
            }
        }

        if (userData.featuredCards && userData.featuredCards.length > 0) {
             contentHTML += `<h4 class="font-semibold text-gray-700 dark:text-gray-300 mt-4">Featured Cards</h4>`;
             contentHTML += `<div class="flex flex-wrap gap-2 mt-2">`;
             for (const cardId of userData.featuredCards) {
                const cardDoc = await db.collection('users').doc(userId).collection('collection').doc(cardId).get();
                if (cardDoc.exists) {
                    const card = cardDoc.data();
                    contentHTML += `<a href="card-view.html?name=${encodeURIComponent(card.name)}"><img src="${card.imageUrl}" alt="${card.name}" class="w-20 rounded-md hover:scale-105 transition-transform" onerror="this.onerror=null;this.src='https://placehold.co/80x112';"></a>`;
                }
             }
             contentHTML += `</div>`;
        }

        if (contentHTML) {
            container.innerHTML = `<h3 class="font-bold text-lg mb-2 dark:text-white">Featured Items</h3><div class="border-t dark:border-gray-700 pt-4">${contentHTML}</div>`;
        }
    };

    const loadMutualConnections = async (profileUserId, profileUserData) => {
        const container = document.getElementById('mutual-connections-section');
        if (!currentUser || !profileUserData.friends) return;

        try {
            const myDoc = await db.collection('users').doc(currentUser.uid).get();
            const myData = myDoc.data();
            
            const myFriends = new Set(myData.friends || []);
            const theirFriends = new Set(profileUserData.friends || []);
            const mutualFriends = [...myFriends].filter(friendId => theirFriends.has(friendId));

            if (mutualFriends.length > 0) {
                container.innerHTML += `<p><i class="fas fa-user-friends mr-2"></i>You have ${mutualFriends.length} mutual friend${mutualFriends.length > 1 ? 's' : ''}.</p>`;
            }
        } catch (error) {
            console.error("Error loading mutual connections:", error);
        }
    };

    const loadTradeHistoryAndMap = async (userId) => {
        const container = document.getElementById('tab-content-trade-history');
        if (!container) return;

        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4 text-center">Loading Trade Routes...</p>';

        try {
            const tradesSnapshot = await db.collection('trades')
                .where('participants', 'array-contains', userId)
                .where('status', '==', 'completed')
                .get();

            const tradeCount = tradesSnapshot.size;
            
            const tradeCountSpan = document.querySelector('span[title="Completed Trades"]');
            if (tradeCountSpan) tradeCountSpan.innerHTML = `<i class="fas fa-handshake text-green-500"></i> ${tradeCount}`;

            if (tradesSnapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user has no completed trades.</p>';
                return;
            }

            container.innerHTML = `
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md">
                    <h3 class="text-xl font-bold mb-2 dark:text-white">Trade Routes (${tradeCount} Completed)</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Visualizing all successful trades across the globe.</p>
                    <div id="trade-map" style="height: 450px; border-radius: 0.5rem; background-color: #374151;"></div>
                </div>
            `;

            const map = L.map('trade-map').setView([20, 0], 2);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 19
            }).addTo(map);

            const userIds = new Set();
            tradesSnapshot.docs.forEach(doc => {
                doc.data().participants.forEach(id => userIds.add(id));
            });

            const userPromises = Array.from(userIds).map(id => db.collection('users').doc(id).get());
            const userDocs = await Promise.all(userPromises);
            const usersData = new Map(userDocs.map(doc => [doc.id, doc.data()]));

            const locations = new Map();
            const tradeRoutes = [];

            tradesSnapshot.docs.forEach(doc => {
                const trade = doc.data();
                const proposer = usersData.get(trade.proposerId);
                const receiver = usersData.get(trade.receiverId);

                if (proposer?.city && receiver?.city) {
                    const proposerCity = proposer.city.toLowerCase();
                    const receiverCity = receiver.city.toLowerCase();

                    if (cityCoordinates[proposerCity] && cityCoordinates[receiverCity]) {
                        locations.set(proposerCity, { coords: cityCoordinates[proposerCity], name: proposer.city });
                        locations.set(receiverCity, { coords: cityCoordinates[receiverCity], name: receiver.city });
                        tradeRoutes.push([cityCoordinates[proposerCity], cityCoordinates[receiverCity]]);
                    }
                }
            });

            locations.forEach((loc, key) => {
                L.marker(loc.coords).addTo(map)
                    .bindPopup(`<b>${loc.name}</b>`);
            });

            tradeRoutes.forEach(route => {
                L.polyline(route, { color: '#2563eb', weight: 2, opacity: 0.7 }).addTo(map);
            });

        } catch(error) {
            console.error("Error loading trade history map:", error);
            container.innerHTML = '<p class="text-center text-red-500 p-4">Could not load Trade Routes.</p>';
        }
    };

    const loadProfileFeedback = async (userId) => {
        const container = document.getElementById('tab-content-feedback');
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading feedback...</p>';
        try {
            const feedbackSnapshot = await db.collection('feedback').where('forUserId', '==', userId).orderBy('createdAt', 'desc').get();

            if (feedbackSnapshot.empty) {
                container.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 p-4">This user has not received any feedback yet.</p>';
                return;
            }

            container.innerHTML = '';
            feedbackSnapshot.forEach(doc => {
                const feedback = doc.data();
                const ratings = feedback.ratings || {};
                const accuracyStars = '★'.repeat(ratings.accuracy || 0) + '☆'.repeat(5 - (ratings.accuracy || 0));
                const packagingStars = '★'.repeat(ratings.packaging || 0) + '☆'.repeat(5 - (ratings.packaging || 0));

                const feedbackCard = `
                    <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                        <div class="flex justify-between items-center mb-2">
                            <p class="font-semibold dark:text-gray-200">From: <a href="profile.html?uid=${feedback.fromUserId}" class="text-blue-600 hover:underline">${feedback.fromUserName}</a></p>
                            <div class="text-xs text-gray-400">${formatTimestamp(feedback.createdAt)}</div>
                        </div>
                        <div class="text-sm space-y-1 my-2 text-yellow-400">
                           <p><strong>Accuracy:</strong> ${accuracyStars}</p>
                           <p><strong>Packaging:</strong> ${packagingStars}</p>
                        </div>
                        <p class="text-gray-700 dark:text-gray-300 italic">"${feedback.comment || 'No comment left.'}"</p>
                    </div>`;
                container.innerHTML += feedbackCard;
            });
        } catch (error) {
            console.error("Error loading feedback:", error);
            if (error.code === 'failed-precondition') {
                const indexLink = generateIndexCreationLink('feedback', [{ name: 'forUserId', order: 'asc' }, { name: 'createdAt', order: 'desc' }]);
                displayIndexError(container, indexLink);
            } else {
                container.innerHTML = `<p class="text-center text-red-500 p-4">Could not load feedback.</p>`;
            }
        }
    };
    
    const loadProfileFriends = async (userId) => {
        const container = document.getElementById('tab-content-friends');
        if (!container) return;

        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 p-4">Loading friends...</p>';

        try {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            const friendIds = userData.friends || [];
            
            let friendsHTML = '';

            if (currentUser && currentUser.uid === userId) {
                 const friendRequests = await db.collection('friendRequests')
                                           .where('receiverId', '==', userId)
                                           .where('status', '==', 'pending')
                                           .get();
                if (!friendRequests.empty) {
                    friendsHTML += '<h3 class="text-xl font-bold mb-4 dark:text-white">Friend Requests</h3>';
                    friendsHTML += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">';
                    for (const doc of friendRequests.docs) {
                        const request = doc.data();
                        const senderDoc = await db.collection('users').doc(request.senderId).get();
                        if (senderDoc.exists) {
                            const sender = senderDoc.data();
                            friendsHTML += `
                                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center justify-between">
                                    <a href="profile.html?uid=${request.senderId}" class="flex items-center space-x-3">
                                        <img src="${sender.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-12 h-12 rounded-full object-cover">
                                        <div>
                                            <p class="font-semibold dark:text-white">${sender.displayName}</p>
                                            <p class="text-sm text-gray-500">@${sender.handle}</p>
                                        </div>
                                    </a>
                                    <div class="flex space-x-2">
                                        <button class="accept-friend-btn bg-green-500 text-white w-8 h-8 rounded-full" data-request-id="${doc.id}" data-sender-id="${request.senderId}"><i class="fas fa-check"></i></button>
                                        <button class="reject-friend-btn bg-red-500 text-white w-8 h-8 rounded-full" data-request-id="${doc.id}"><i class="fas fa-times"></i></button>
                                    </div>
                                </div>
                            `;
                        }
                    }
                    friendsHTML += '</div>';
                }
            }

            friendsHTML += `<h3 class="text-xl font-bold mb-4 dark:text-white">All Friends (${friendIds.length})</h3>`;
            if (friendIds.length === 0) {
                friendsHTML += '<p class="text-gray-500 dark:text-gray-400 p-4">No friends to display.</p>';
            } else {
                friendsHTML += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
                for (const friendId of friendIds) {
                    const friendDoc = await db.collection('users').doc(friendId).get();
                    if (friendDoc.exists) {
                        const friend = friendDoc.data();
                        friendsHTML += `
                            <a href="profile.html?uid=${friendId}" class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex items-center space-x-3 hover:shadow-lg">
                                <img src="${friend.photoURL || 'https://i.imgur.com/B06rBhI.png'}" class="w-12 h-12 rounded-full object-cover">
                                <div>
                                    <p class="font-semibold dark:text-white">${friend.displayName}</p>
                                    <p class="text-sm text-gray-500">@${friend.handle}</p>
                                </div>
                            </a>
                        `;
                    }
                }
                friendsHTML += '</div>';
            }
            container.innerHTML = friendsHTML;

        } catch (error) {
            console.error("Error loading friends:", error);
            container.innerHTML = '<p class="text-red-500 p-4">Could not load friends list.</p>';
        }
    };
    
    // --- MAIN INITIALIZATION AND EVENT LISTENERS ---
    const initializeProfile = async () => {
        await checkAdminStatus();
        
        profileContainer.innerHTML = '<div class="text-center p-10"><i class="fas fa-spinner fa-spin text-4xl text-blue-500"></i><p class="mt-4">Loading Profile...</p></div>';
        try {
            const params = new URLSearchParams(window.location.search);
            let userDoc;
            const username = params.get('user');
            const userIdParam = params.get('uid');

            if (username) { 
                // First try as user ID, then as handle
                try {
                    userDoc = await db.collection('users').doc(username).get();
                    if (!userDoc.exists) {
                        const userQuery = await db.collection('users').where('handle', '==', username).limit(1).get(); 
                        if (!userQuery.empty) userDoc = userQuery.docs[0];
                    }
                } catch (error) {
                    const userQuery = await db.collection('users').where('handle', '==', username).limit(1).get(); 
                    if (!userQuery.empty) userDoc = userQuery.docs[0];
                }
            } 
            else if (userIdParam) { userDoc = await db.collection('users').doc(userIdParam).get(); } 
            else if (currentUser) { userDoc = await db.collection('users').doc(currentUser.uid).get(); }
            else { profileContainer.innerHTML = `<div class="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md"><h1 class="text-2xl font-bold">No Profile to Display</h1><p class="mt-2">Please log in to see your profile or specify a user in the URL.</p></div>`; return; }

            if (!userDoc || !userDoc.exists) {
                // Check if it failed because of permissions
                if (currentUser) {
                     displayPrivacyMessage('This profile is private or does not exist.');
                } else {
                     throw new Error("User not found.");
                }
                return;
            }

            const profileUserId = userDoc.id;
            const profileUserData = userDoc.data();
            const isOwnProfile = currentUser && currentUser.uid === profileUserId;

            const privacy = profileUserData.privacy || { profileVisibility: 'Public', collectionVisibility: 'Public' };
            const isFriend = currentUser && Array.isArray(profileUserData.friends) && profileUserData.friends.includes(currentUser.uid);

            if (!isOwnProfile && !currentUserIsAdmin) {
                if (privacy.profileVisibility === 'Private') {
                    displayPrivacyMessage('This profile is private.');
                    return;
                }
                if (privacy.profileVisibility === 'Friends Only' && !isFriend) {
                    displayPrivacyMessage('This profile is only visible to friends.');
                    return;
                }
            }

            let friendStatus = 'none';
            if (currentUser && !isOwnProfile) {
                if (isFriend) { friendStatus = 'friends'; } 
                else {
                    const requestQuery1 = await db.collection('friendRequests').where('senderId', '==', currentUser.uid).where('receiverId', '==', profileUserId).where('status', '==', 'pending').get();
                    const requestQuery2 = await db.collection('friendRequests').where('senderId', '==', profileUserId).where('receiverId', '==', currentUser.uid).where('status', '==', 'pending').get();
                    if (!requestQuery1.empty) friendStatus = 'request_sent';
                    else if (!requestQuery2.empty) friendStatus = 'request_received';
                }
            }
            
            let actionButtonHTML = '';
            if (!isOwnProfile && currentUser) {
                actionButtonHTML += `<button id="start-trade-btn" class="px-4 py-2 bg-green-600 text-white rounded-full text-sm" data-uid="${profileUserId}">Start Trade</button><button id="message-btn" class="px-4 py-2 bg-gray-500 text-white rounded-full text-sm" data-uid="${profileUserId}">Message</button>`;
                switch (friendStatus) {
                    case 'none': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-blue-500 text-white rounded-full text-sm">Add Friend</button>`; break;
                    case 'request_sent': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-gray-400 text-white rounded-full text-sm" disabled>Request Sent</button>`; break;
                    case 'friends': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-green-500 text-white rounded-full text-sm" disabled><i class="fas fa-check mr-2"></i>Friends</button>`; break;
                    case 'request_received': actionButtonHTML += `<button id="add-friend-btn" class="px-4 py-2 bg-yellow-500 text-white rounded-full text-sm">Respond to Request</button>`; break;
                }
            }
            
            const ratingCount = profileUserData.ratingCount || 0, completedTrades = profileUserData.completedTrades || 0, avgAccuracy = profileUserData.averageAccuracy || 0, avgPackaging = profileUserData.averagePackaging || 0, overallAvg = ratingCount > 0 ? (avgAccuracy + avgPackaging) / 2 : 0;
            let starsHTML = Array.from({length: 5}, (_, i) => i + 1 <= overallAvg ? '<i class="fas fa-star text-yellow-400"></i>' : (i + 0.5 <= overallAvg ? '<i class="fas fa-star-half-alt text-yellow-400"></i>' : '<i class="far fa-star text-gray-300"></i>')).join('');
            const reputationHTML = `<div class="flex items-center space-x-2 text-sm mt-1"><span class="flex">${starsHTML}</span><span class="font-semibold">${overallAvg.toFixed(1)}</span><span>(${ratingCount} ratings)</span><span class="font-bold">|</span><span title="Completed Trades"><i class="fas fa-handshake text-green-500"></i> ${completedTrades}</span></div><div class="text-xs space-x-3 mt-1"><span>Accuracy: <strong>${avgAccuracy.toFixed(1)}</strong></span><span>Packaging: <strong>${avgPackaging.toFixed(1)}</strong></span></div>`;

            let personalityHTML = '';
            if (profileUserData.playstyle || profileUserData.favoriteFormat || profileUserData.petCard || profileUserData.nemesisCard) { personalityHTML += '<div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">'; if (profileUserData.playstyle) personalityHTML += `<div><p class="font-semibold">Playstyle</p><p>${profileUserData.playstyle}</p></div>`; if (profileUserData.favoriteFormat) personalityHTML += `<div><p class="font-semibold">Favorite Format</p><p>${profileUserData.favoriteFormat}</p></div>`; if (profileUserData.petCard) personalityHTML += `<div><p class="font-semibold">Pet Card</p><a href="card-view.html?name=${encodeURIComponent(profileUserData.petCard)}" class="text-blue-600 hover:underline">${profileUserData.petCard}</a></div>`; if (profileUserData.nemesisCard) personalityHTML += `<div><p class="font-semibold">Nemesis Card</p><a href="card-view.html?name=${encodeURIComponent(profileUserData.nemesisCard)}" class="text-red-500 hover:underline">${profileUserData.nemesisCard}</a></div>`; personalityHTML += '</div>'; }
            
            const referralsTabHTML = isOwnProfile ? `<a href="referrals.html" class="profile-tab-button">Referrals</a>` : '';

            profileContainer.innerHTML = `<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden"><div class="relative"><img id="profile-banner" class="w-full h-48 object-cover" src="${profileUserData.bannerURL || 'https://placehold.co/1200x300'}" alt="Profile banner">${isOwnProfile ? `<div class="absolute top-4 right-4"><a href="settings.html" class="px-4 py-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-75 text-sm font-semibold">Edit Profile</a></div>` : ''}<div class="absolute bottom-0 left-6 transform translate-y-1/2 flex items-center"><img id="profile-avatar" class="w-32 h-32 rounded-full border-4 border-white dark:border-gray-800 object-cover" src="${profileUserData.photoURL || 'https://placehold.co/128x128'}" alt="User avatar"></div></div><div class="pt-20 px-6 pb-6"><div class="flex justify-between items-center"><div><h1 id="profile-displayName" class="text-3xl font-bold">${profileUserData.displayName}</h1><p id="profile-handle" class="text-gray-600 dark:text-gray-400">@${profileUserData.handle}</p>${reputationHTML}</div><div id="profile-action-buttons" class="flex space-x-2">${actionButtonHTML}</div></div><div class="mt-6 border-t dark:border-gray-700 pt-4"><p id="profile-bio" class="mt-2">${profileUserData.bio || 'No bio yet.'}</p><p class="text-sm text-gray-500 mt-2">Joined ${formatTimestamp(profileUserData.createdAt)}</p><div class="mt-2 text-sm"><strong>Favorite TCG:</strong> <span>${profileUserData.favoriteTcg || 'Not set'}</span></div>${personalityHTML}<div id="mutual-connections-section" class="mt-4 text-sm"></div><div id="featured-items-section" class="mt-6"></div><div id="profile-badges-container" class="mt-4"><h3 class="font-bold text-lg mb-2">Achievements</h3><div id="badges-list" class="flex flex-wrap gap-4"></div></div></div></div></div><div class="mt-6"><div class="border-b dark:border-gray-700"><nav id="profile-tabs" class="flex space-x-8" aria-label="Tabs"><button data-tab="feed" class="profile-tab-button active">Feed</button><button data-tab="decks" class="profile-tab-button">Decks</button><button data-tab="trade-binder" class="profile-tab-button">Trade Binder</button><button data-tab="collection" class="profile-tab-button">Collection</button><button data-tab="friends" class="profile-tab-button">Friends</button><button data-tab="wishlist" class="profile-tab-button">Wishlist</button><button data-tab="trade-history" class="profile-tab-button">Trade History</button><button data-tab="feedback" class="profile-tab-button">Feedback</button>${referralsTabHTML}</nav></div><div class="mt-6"><div id="tab-content-feed" class="profile-tab-content space-y-6"></div><div id="tab-content-decks" class="profile-tab-content hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div><div id="tab-content-trade-binder" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div><div id="tab-content-collection" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div><div id="tab-content-friends" class="profile-tab-content hidden"></div><div id="tab-content-wishlist" class="profile-tab-content hidden grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4"></div><div id="tab-content-trade-history" class="profile-tab-content hidden space-y-4"></div><div id="tab-content-feedback" class="profile-tab-content hidden space-y-4"></div></div></div>`;
            
            const functionsToRun = [
                () => loadProfileFeed(profileUserId),
                () => loadProfileDecks(profileUserId, isOwnProfile),
                () => loadProfileCollection(profileUserId, 'collection', isOwnProfile, privacy.collectionVisibility, isFriend),
                () => loadProfileCollection(profileUserId, 'wishlist', isOwnProfile, 'Private', isFriend),
                () => loadTradeBinder(profileUserId, profileUserData, privacy.collectionVisibility, isFriend),
                () => loadProfileFeedback(profileUserId),
                () => loadFeaturedItems(profileUserId, profileUserData),
                () => loadAndDisplayBadges(profileUserId),
            ];
            if (currentUser && !isOwnProfile) functionsToRun.push(() => loadMutualConnections(profileUserId, profileUserData));
            if (isOwnProfile) functionsToRun.push(() => evaluateAndAwardBadges(profileUserId, profileUserData));
            
            if(window.location.hash) {
                const targetTab = document.querySelector(`.profile-tab-button[data-tab="${window.location.hash.substring(1)}"]`);
                if(targetTab) {
                     if(targetTab.dataset.tab === 'friends') functionsToRun.push(() => loadProfileFriends(profileUserId));
                     if(targetTab.dataset.tab === 'trade-history') functionsToRun.push(() => loadTradeHistoryAndMap(profileUserId));
                     setTimeout(() => targetTab.click(), 100);
                }
            }
            
            await Promise.all(functionsToRun.map(f => f()));

        } catch (error) { 
            console.error("Error loading profile:", error); 
            profileContainer.innerHTML = `<div class="text-center p-8 bg-white dark:bg-gray-800 shadow-md"><h1 class="text-2xl font-bold text-red-600">Error</h1><p class="mt-2">${error.message}</p></div>`; 
        }
    };

    profileContainer.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.id === 'start-trade-btn') { window.location.href = `trades.html?with=${target.dataset.uid}`; return; }
        if (target.id === 'message-btn') { window.location.href = `messages.html?with=${target.dataset.uid}`; return; }
        
        const tab = target.closest('.profile-tab-button');
        if (tab && (tab.tagName === 'BUTTON' || tab.tagName === 'A')) {
            if(tab.tagName === 'A') return;
            event.preventDefault();
            document.querySelectorAll('.profile-tab-button').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.add('hidden'));
            const contentToShow = document.getElementById(`tab-content-${tab.dataset.tab}`);
            if(contentToShow) contentToShow.classList.remove('hidden');
            
            const profileUserId = document.querySelector('#profile-action-buttons [data-uid]')?.dataset.uid || currentUser.uid;
            
            if (tab.dataset.tab === 'friends' && !tab.dataset.loaded) { loadProfileFriends(profileUserId); tab.dataset.loaded = true; }
            if (tab.dataset.tab === 'trade-history' && !tab.dataset.loaded) { loadTradeHistoryAndMap(profileUserId); tab.dataset.loaded = true; }
            return;
        }

        const postElement = target.closest('.post-container');
        if (!postElement) return;
        const postId = postElement.dataset.id;
        const postRef = db.collection('posts').doc(postId);

        if (target.closest('.post-clickable-area')) { openPostModalForProfile(postId); }
        if (target.closest('.comment-btn')) { const commentsSection = postElement.querySelector('.comments-section'); const wasHidden = commentsSection.classList.toggle('hidden'); if (!wasHidden) { const doc = await postRef.get(); renderComments(commentsSection.querySelector('.comments-list'), doc.data().comments, doc.data()); }}
        if (target.closest('.like-btn')) { if(!currentUser) return; const likeBtn = target.closest('.like-btn'); const countSpan = likeBtn.querySelector('span'); const currentLikes = parseInt(countSpan.textContent, 10); const isLiked = likeBtn.classList.contains('text-red-500'); countSpan.textContent = isLiked ? currentLikes - 1 : currentLikes + 1; likeBtn.classList.toggle('text-red-500'); likeBtn.querySelector('i').classList.toggle('fas'); likeBtn.querySelector('i').classList.toggle('far'); await postRef.update({ likes: firebase.firestore.FieldValue.arrayToggle(currentUser.uid) }); }
        if (target.closest('.delete-post-btn')) { if (confirm('Delete this post?')) { await postRef.delete(); postElement.remove(); }}
        if (target.closest('.reply-btn')) { const parent = target.closest('.flex-1'); const existing = parent.querySelector('.reply-form'); if(existing) { existing.remove(); return; } const form = document.createElement('form'); form.className = 'reply-form flex mt-2'; form.dataset.replyTo = target.dataset.parentTimestamp; form.innerHTML = `<input type="text" class="w-full border rounded-l-lg p-2 text-sm" placeholder="Write a reply..." required><button type="submit" class="bg-blue-500 text-white px-3 text-sm">Reply</button>`; parent.appendChild(form).querySelector('input').focus(); }
        if (target.closest('.delete-comment-btn')) { if (!confirm('Delete this comment and all replies?')) return; const timestamp = parseInt(target.closest('[data-timestamp]').dataset.timestamp, 10); await db.runTransaction(async t => { const doc = await t.get(postRef); let comments = doc.data().comments || []; const toDelete = [timestamp]; const findReplies = (id) => comments.forEach(c => c.replyTo === id && (toDelete.push(c.timestamp.toMillis()), findReplies(c.timestamp.toMillis()))); findReplies(timestamp); const updated = comments.filter(c => !toDelete.includes(c.timestamp.toMillis())); t.update(postRef, { comments: updated });}); const finalDoc = await postRef.get(); renderComments(postElement.querySelector('.comments-list'), finalDoc.data().comments, finalDoc.data()); postElement.querySelector('.comments-count').textContent = finalDoc.data().comments.length; }
    });

    profileContainer.addEventListener('submit', (e) => { e.preventDefault(); if (e.target.matches('.comment-form, .reply-form')) { handleCommentSubmitForProfile(e.target, e.target.closest('.post-container').dataset.id); }});
    
    const postDetailModal = document.getElementById('postDetailModal');
    document.getElementById('closePostDetailModal')?.addEventListener('click', () => closeModal(postDetailModal));
    postDetailModal?.addEventListener('submit', (e) => { e.preventDefault(); if(e.target.matches('.modal-comment-form, .reply-form')) { handleCommentSubmitForProfile(e.target, postDetailModal.dataset.postId); }});
    document.body.addEventListener('click', async (event) => {
        const acceptButton = event.target.closest('.accept-friend-btn');
        const rejectButton = event.target.closest('.reject-friend-btn');
        const pinDeckBtn = event.target.closest('.pin-deck-btn');
        const pinCardBtn = event.target.closest('.pin-card-btn');
        const addFriendBtn = event.target.closest('#add-friend-btn');
        
        if (acceptButton) { const rId = acceptButton.dataset.requestId, sId = acceptButton.dataset.senderId, batch=db.batch(), uRef=db.collection('users').doc(currentUser.uid), sRef=db.collection('users').doc(sId), reqRef=db.collection('friendRequests').doc(rId); batch.update(uRef, {friends: firebase.firestore.FieldValue.arrayUnion(sId)}); batch.update(sRef, {friends: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)}); batch.delete(reqRef); const notifRef = db.collection('users').doc(sId).collection('notifications').doc(); batch.set(notifRef, {message: `${currentUser.displayName} accepted your friend request.`, link: `/profile.html?uid=${currentUser.uid}`, isRead: false, timestamp: new Date()}); await batch.commit(); loadProfileFriends(currentUser.uid); }
        if (rejectButton) { await db.collection('friendRequests').doc(rejectButton.dataset.requestId).delete(); loadProfileFriends(currentUser.uid); }
        if (pinDeckBtn) { await db.collection('users').doc(currentUser.uid).update({ featuredDeck: pinDeckBtn.dataset.deckId }); alert('Deck pinned!'); initializeProfile(); }
        if (pinCardBtn) { const cardId = pinCardBtn.dataset.cardId; await db.runTransaction(async t=>{ const doc = await t.get(db.collection('users').doc(currentUser.uid)); let f=doc.data().featuredCards||[]; f.includes(cardId)?f=f.filter(id=>id!==cardId):(f.push(cardId),f.length>4&&f.shift()); t.update(db.collection('users').doc(currentUser.uid),{featuredCards:f})}); alert('Featured cards updated!'); initializeProfile(); }
        if (addFriendBtn && !addFriendBtn.disabled) { const profileUserId = document.querySelector('#profile-action-buttons [data-uid]').dataset.uid; if(addFriendBtn.textContent.includes('Respond')) { window.location.href = '/friends.html'; return; } addFriendBtn.disabled = true; addFriendBtn.textContent = 'Sending...'; await db.collection('friendRequests').add({ senderId: currentUser.uid, receiverId: profileUserId, status: 'pending', createdAt: new Date() }); await db.collection('users').doc(profileUserId).collection('notifications').add({ message: `${currentUser.displayName} sent you a friend request.`, link: `/profile.html?uid=${currentUser.uid}#friends`, isRead: false, timestamp: new Date() }); addFriendBtn.textContent = 'Request Sent'; }
    });

    initializeProfile();
});