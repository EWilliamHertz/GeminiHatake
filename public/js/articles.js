/**
 * HatakeSocial - Articles & Content Script (v3 - Commenting Update)
 *
 * - NEW: Adds a `formatTimestamp` helper function to display dates according to the user's preference (D/M/Y or M/D/Y).
 * - UPDATE: All date displays for articles now use the new `formatTimestamp` function.
 * - This version includes a robust fix for embedding all types of YouTube videos,
 * including Shorts, by converting them to the correct /embed/ format.
 * - NEW: Adds commenting functionality to the view-article.html page.
 */

// --- Date Formatting Helper ---
const formatTimestamp = (timestamp) => {
    if (!timestamp || !timestamp.seconds) {
        return 'Unknown date';
    }
    const date = new Date(timestamp.seconds * 1000);
    const userDateFormat = localStorage.getItem('userDateFormat') || 'dmy'; // Default to D/M/Y

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (userDateFormat === 'mdy') {
        return `${month}/${day}/${year}`;
    }
    return `${day}/${month}/${year}`;
};


document.addEventListener('authReady', (e) => {
    const user = e.detail.user;

    // --- Page specific logic ---
    if (document.getElementById('articles-list')) {
        initArticlesListPage(user);
    }
    if (document.getElementById('create-article-form')) {
        initCreateArticlePage(user);
    }
    if (document.getElementById('article-container')) {
        initViewArticlePage(user);
    }
    if (document.getElementById('edit-article-form')) {
        initEditArticlePage(user);
    }
});

// --- Articles List Page ---
function initArticlesListPage(user) {
    const articlesListContainer = document.getElementById('articles-list');
    const writeNewArticleBtn = document.getElementById('write-new-article-btn');
    const searchInput = document.getElementById('article-search');
    const categoryFilter = document.getElementById('article-category-filter');
    const pageTitle = document.getElementById('page-title');
    const filters = document.getElementById('filters');

    const params = new URLSearchParams(window.location.search);
    const pageType = params.get('type') || 'tcg';

    if (pageType === 'blog') {
        if(pageTitle) pageTitle.textContent = 'Hatake Blog';
        if(filters) filters.style.display = 'none';
    } else {
        if(pageTitle) pageTitle.textContent = 'TCG Articles';
    }

    if (user) {
        user.getIdTokenResult().then(idTokenResult => {
            if (idTokenResult.claims.admin && writeNewArticleBtn) {
                 writeNewArticleBtn.classList.remove('hidden');
            }
        });
    }

    let allArticles = [];

    const loadArticles = async () => {
        if(!articlesListContainer) return;
        articlesListContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">Loading posts...</p>';
        try {
            let query = db.collection('articles').where('status', '==', 'published');
            if (pageType === 'blog') {
                query = query.where('type', '==', 'blog_post');
            } else {
                query = query.where('type', '==', 'tcg_article');
            }
            const snapshot = await query.orderBy('createdAt', 'desc').get();

            if (snapshot.empty) {
                articlesListContainer.innerHTML = `<p class="text-center text-gray-500 dark:text-gray-400 col-span-full">No ${pageType === 'blog' ? 'blog posts' : 'articles'} published yet.</p>`;
                return;
            }
            allArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderArticles(allArticles);
        } catch (error) {
            console.error("Error loading articles:", error);
            articlesListContainer.innerHTML = '<p class="text-center text-red-500 col-span-full">Could not load posts.</p>';
        }
    };

    const renderArticles = (articles) => {
        if(!articlesListContainer) return;
        articlesListContainer.innerHTML = '';
        articles.forEach(article => {
            const articleCard = document.createElement('a');
            articleCard.href = `view-article.html?id=${article.id}`;
            articleCard.className = 'block bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow';
            
            const snippet = article.content ? article.content.substring(0, 150).replace(/<[^>]+>/g, '') + '...' : '';

            articleCard.innerHTML = `
                <span class="text-sm font-semibold text-blue-600 dark:text-blue-400">${article.category || 'Blog Post'}</span>
                <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-2">${article.title || 'Untitled Post'}</h3>
                <p class="text-gray-600 dark:text-gray-400 mt-2 text-sm">${snippet}</p>
                <div class="mt-4 pt-4 border-t dark:border-gray-700 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>By ${article.authorName || 'Anonymous'}</span>
                    <span>${formatTimestamp(article.createdAt)}</span>
                </div>
            `;
            articlesListContainer.appendChild(articleCard);
        });
    };
    
    const filterAndSearchArticles = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const category = categoryFilter.value;
        
        let filteredArticles = allArticles;

        if (category) {
            filteredArticles = filteredArticles.filter(a => a.category === category);
        }

        if (searchTerm) {
            filteredArticles = filteredArticles.filter(a => 
                (a.title && a.title.toLowerCase().includes(searchTerm)) || 
                (a.content && a.content.toLowerCase().includes(searchTerm))
            );
        }
        
        renderArticles(filteredArticles);
    };

    if(searchInput) searchInput.addEventListener('input', filterAndSearchArticles);
    if(categoryFilter) categoryFilter.addEventListener('change', filterAndSearchArticles);

    loadArticles();
}

// --- Create & Edit Article Helper ---
function createArticleImageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        const currentUser = firebase.auth().currentUser;

        if (!file) return;

        if (!currentUser) {
            alert("You must be logged in to upload an image.");
            return;
        }
        
        const quill = this.quill;
        const range = quill.getSelection(true);
        quill.insertText(range.index, ' [Uploading image...] ', 'user');
        
        try {
            const storageRef = storage.ref();
            const imageRef = storageRef.child(`articles/${currentUser.uid}/${Date.now()}_${file.name}`);
            const snapshot = await imageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();

            quill.deleteText(range.index, ' [Uploading image...] '.length);
            quill.insertEmbed(range.index, 'image', downloadURL);
            quill.setSelection(range.index + 1);
        } catch (error) {
            console.error("Image upload failed: ", error);
            quill.deleteText(range.index, ' [Uploading image...] '.length);
            alert("Image upload failed. Please check your Firebase Storage security rules.");
        }
    };
}

// Helper function to extract video ID from various YouTube URL formats
function getYoutubeVideoId(url) {
    let ID = '';
    url = url.replace(/(>|<)/gi, '').split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)/);
    if (url[2] !== undefined) {
        ID = url[2].split(/[^0-9a-z_\-]/i);
        ID = ID[0];
    } else {
        ID = url;
    }
    return ID;
}

// --- NEW MERGED FUNCTION: Initialize Quill with YouTube Shorts fix ---
function initQuillEditor(selector) {
    const toolbarOptions = [
        [{ 'font': [] }],
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'align': [] }],
        ['link', 'image', 'video'],
        ['clean']
    ];

    const quill = new Quill(selector, {
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    'image': createArticleImageHandler
                }
            }
        },
        theme: 'snow',
        placeholder: 'Write your masterpiece...',
    });

    // Custom video handler to fix YouTube links
    quill.getModule('toolbar').addHandler('video', () => {
        let url = prompt('Enter Video URL');
        if (url) {
            const videoId = getYoutubeVideoId(url);
            if (videoId) {
                // Use the /embed/ format to prevent X-Frame-Options errors
                const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'video', embedUrl, 'user');
            } else {
                // If it's not a recognizable YouTube link, insert it as is
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'video', url, 'user');
            }
        }
    });
    
    return quill;
}


// --- Create Article Page ---
function initCreateArticlePage(user) {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const form = document.getElementById('create-article-form');
    const articleTypeSelect = document.getElementById('article-type');
    const tcgCategorySection = document.getElementById('tcg-category-section');
    const deckPrimerInfo = document.getElementById('deck-primer-info');
    const deckNameDisplay = document.getElementById('deck-name-display');
    const articleCategorySelect = document.getElementById('article-category');
    const articleDeckIdInput = document.getElementById('article-deck-id');
    
    const quill = initQuillEditor('#editor');

    if(articleTypeSelect) {
        articleTypeSelect.addEventListener('change', () => {
            if (articleTypeSelect.value === 'blog_post') {
                if(tcgCategorySection) tcgCategorySection.style.display = 'none';
            } else {
                if(tcgCategorySection) tcgCategorySection.style.display = 'block';
            }
        });
    }

    const params = new URLSearchParams(window.location.search);
    const deckId = params.get('deckId');
    const deckName = params.get('deckName');

    if (deckId && deckName) {
        if(articleTypeSelect) articleTypeSelect.value = 'tcg_article';
        if(articleCategorySelect) articleCategorySelect.value = 'Deck Primer';
        if(articleCategorySelect) articleCategorySelect.disabled = true;
        if(articleDeckIdInput) articleDeckIdInput.value = deckId;
        if(deckNameDisplay) deckNameDisplay.textContent = decodeURIComponent(deckName);
        if(deckPrimerInfo) deckPrimerInfo.classList.remove('hidden');
    }

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('article-title').value;
            const type = articleTypeSelect.value;
            const category = (type === 'tcg_article') ? articleCategorySelect.value : 'Blog Post';
            const content = quill.root.innerHTML;

            if (!title.trim() || quill.getLength() < 10) {
                alert('Please provide a title and some content for your post.');
                return;
            }

            const articleData = {
                title,
                type,
                category,
                content,
                authorId: user.uid,
                authorName: user.displayName,
                status: 'published',
                createdAt: new Date(),
                deckId: articleDeckIdInput.value || null
            };

            try {
                const docRef = await db.collection('articles').add(articleData);
                alert('Post published successfully!');
                window.location.href = `view-article.html?id=${docRef.id}`;
            } catch (error) {
                console.error("Error publishing post:", error);
                alert('Failed to publish post.');
            }
        });
    }
}

// --- View Article Page ---
function initViewArticlePage(user) {
    const articleContainer = document.getElementById('article-container');
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    if (!articleId) {
        if(articleContainer) articleContainer.innerHTML = '<p class="text-center text-red-500">Post not found. No ID was provided.</p>';
        return;
    }

    const loadArticle = async () => {
        try {
            const doc = await db.collection('articles').doc(articleId).get();
            if (!doc.exists) {
                if(articleContainer) articleContainer.innerHTML = '<p class="text-center text-red-500">Post not found.</p>';
                return;
            }
            const article = doc.data();

            const title = article.title || "Untitled Post";
            const authorName = article.authorName || "Anonymous";
            const authorId = article.authorId;
            const category = article.category || "General";
            const content = article.content || "<p>This post has no content.</p>";
            const createdAt = formatTimestamp(article.createdAt);

            if(articleContainer) {
                const topControls = document.createElement('div');
                topControls.className = 'flex justify-between items-start mb-2';
                topControls.innerHTML = `
                    <h1 class="text-4xl font-extrabold text-gray-900 dark:text-white">${title}</h1>
                    <div id="edit-button-container" class="flex-shrink-0 ml-4"></div>
                `;
                
                if (user && authorId) {
                    user.getIdTokenResult().then((idTokenResult) => {
                         const isAuthor = user.uid === authorId;
                         const isAdmin = !!idTokenResult.claims.admin;

                         if (isAuthor || isAdmin) {
                            const editButtonContainer = topControls.querySelector('#edit-button-container');
                            const editButton = document.createElement('a');
                            editButton.href = `edit-article.html?id=${doc.id}`;
                            editButton.className = 'px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition';
                            editButton.textContent = 'Edit Post';
                            editButtonContainer.appendChild(editButton);
                         }
                    });
                }

                articleContainer.innerHTML = ''; 
                articleContainer.appendChild(topControls);

                const metaInfo = document.createElement('div');
                metaInfo.className = "text-sm text-gray-500 dark:text-gray-400 mb-6";
                metaInfo.innerHTML = `
                    <span>By <a href="profile.html?uid=${authorId}" class="text-blue-600 hover:underline">${authorName}</a></span>
                    <span class="mx-2">&bull;</span>
                    <span>Published on ${createdAt}</span>
                    <span class="mx-2">&bull;</span>
                    <span class="font-semibold">${category}</span>
                `;
                articleContainer.appendChild(metaInfo);

                const contentDiv = document.createElement('div');
                contentDiv.className = "prose dark:prose-invert max-w-none ql-snow";
                contentDiv.innerHTML = `<div class="ql-editor">${content}</div>`;
                articleContainer.appendChild(contentDiv);

                // Load comments and display comment form
                loadComments(articleId);
                displayCommentForm(articleId, user);
            }
        } catch (error) {
            console.error("Error loading article:", error);
            if(articleContainer) articleContainer.innerHTML = '<p class="text-center text-red-500">Could not load the article due to an error. Please check the console for details.</p>';
        }
    };
    loadArticle();
}

// --- Comment Functions ---
function displayCommentForm(articleId, user) {
    const commentFormContainer = document.getElementById('comment-form-container');
    if (!commentFormContainer) return;

    if (user) {
        commentFormContainer.innerHTML = `
            <form id="comment-form">
                <textarea id="comment-text" class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" placeholder="Write a comment..." required></textarea>
                <button type="submit" class="mt-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700">Post Comment</button>
            </form>
        `;
        document.getElementById('comment-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const commentText = document.getElementById('comment-text').value;
            postComment(articleId, user, commentText);
        });
    } else {
        commentFormContainer.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">You must be logged in to post a comment.</p>';
    }
}

async function postComment(articleId, user, text) {
    if (!text.trim()) {
        alert('Comment cannot be empty.');
        return;
    }

    try {
        await db.collection('articles').doc(articleId).collection('comments').add({
            text: text,
            authorId: user.uid,
            authorName: user.displayName,
            createdAt: new Date()
        });
        document.getElementById('comment-text').value = '';
        loadComments(articleId);
    } catch (error) {
        console.error("Error posting comment:", error);
        alert('Failed to post comment.');
    }
}

async function loadComments(articleId) {
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) return;

    commentsList.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">Loading comments...</p>';

    try {
        const snapshot = await db.collection('articles').doc(articleId).collection('comments').orderBy('createdAt', 'desc').get();

        if (snapshot.empty) {
            commentsList.innerHTML = '<p class="text-center text-gray-500 dark:text-gray-400">No comments yet.</p>';
            return;
        }

        commentsList.innerHTML = '';
        snapshot.forEach(doc => {
            const comment = doc.data();
            const commentEl = document.createElement('div');
            commentEl.className = 'p-4 border-b dark:border-gray-700';
            commentEl.innerHTML = `
                <div class="flex items-center mb-2">
                    <a href="profile.html?uid=${comment.authorId}" class="font-semibold text-blue-600 hover:underline">${comment.authorName}</a>
                    <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">${formatTimestamp(comment.createdAt)}</span>
                </div>
                <p class="text-gray-800 dark:text-gray-300">${comment.text}</p>
            `;
            commentsList.appendChild(commentEl);
        });
    } catch (error) {
        console.error("Error loading comments:", error);
        commentsList.innerHTML = '<p class="text-center text-red-500">Could not load comments.</p>';
    }
}


// --- Edit Article Page ---
function initEditArticlePage(user) {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    const form = document.getElementById('edit-article-form');
    const articleTypeSelect = document.getElementById('article-type');
    const tcgCategorySection = document.getElementById('tcg-category-section');
    const articleCategorySelect = document.getElementById('article-category');
    const articleTitleInput = document.getElementById('article-title');

    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');
    if (!articleId) {
        alert('No article specified for editing.');
        window.location.href = 'articles.html';
        return;
    }
    
    const quill = initQuillEditor('#editor');
    
    const articleRef = db.collection('articles').doc(articleId);
    articleRef.get().then(doc => {
        if (!doc.exists) {
            alert('Article not found.');
            window.location.href = 'articles.html';
            return;
        }

        const articleData = doc.data();

        user.getIdTokenResult().then((idTokenResult) => {
            const isAuthor = user.uid === articleData.authorId;
            const isAdmin = !!idTokenResult.claims.admin;
            if (!isAuthor && !isAdmin) {
                alert('You are not authorized to edit this post.');
                window.location.href = 'articles.html';
                return;
            }
        });

        articleTitleInput.value = articleData.title;
        articleTypeSelect.value = articleData.type;
        quill.root.innerHTML = articleData.content;

        if (articleData.type === 'blog_post') {
            if (tcgCategorySection) tcgCategorySection.style.display = 'none';
        } else {
            if (tcgCategorySection) tcgCategorySection.style.display = 'block';
            if (articleCategorySelect) articleCategorySelect.value = articleData.category;
        }

    }).catch(error => {
        console.error("Error fetching article for editing:", error);
        alert('Could not load article data.');
    });

    if(articleTypeSelect) {
        articleTypeSelect.addEventListener('change', () => {
            if (articleTypeSelect.value === 'blog_post') {
                if(tcgCategorySection) tcgCategorySection.style.display = 'none';
            } else {
                if(tcgCategorySection) tcgCategorySection.style.display = 'block';
            }
        });
    }

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = articleTitleInput.value;
            const type = articleTypeSelect.value;
            const category = (type === 'tcg_article') ? articleCategorySelect.value : 'Blog Post';
            const content = quill.root.innerHTML;

            if (!title.trim() || quill.getLength() < 10) {
                alert('Please provide a title and some content for your post.');
                return;
            }

            const updatedData = {
                title,
                type,
                category,
                content,
                updatedAt: new Date()
            };

            try {
                await articleRef.update(updatedData);
                alert('Post updated successfully!');
                window.location.href = `view-article.html?id=${articleId}`;
            } catch (error) {
                console.error("Error updating post:", error);
                alert('Failed to update post.');
            }
        });
    }
}