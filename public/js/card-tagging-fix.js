/**
 * Card Tagging Fix for Posts
 * This module fixes the card tagging system in posts by ensuring proper data flow
 * from autocomplete selection to post storage and display
 */

// Import the card hover functionality
import { initCardHover } from './card-hover.js';

/**
 * Enhanced formatContent function that properly handles card data
 * @param {Object} data - Post data object or content string
 * @returns {string} Formatted HTML content
 */
export function formatPostContent(data) {
    const isPostObject = typeof data === 'object' && data !== null && data.content;
    const postContent = isPostObject ? data.content : data;
    
    if (!postContent) return '';
    
    // Sanitize the content first
    const sanitized = sanitizeHTML(postContent);
    
    return sanitized
        .replace(/@(\w+)/g, `<a href="profile.html?user=$1" class="font-semibold text-blue-500 hover:underline">@$1</a>`)
        .replace(/#(\w+)/g, `<a href="search.html?query=%23$1" class="font-semibold text-indigo-500 hover:underline">#$1</a>`)
        .replace(/\[deck:([^:]+):([^\]]+)\]/g, `<a href="deck.html?deckId=$1" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">[Deck: $2]</a>`)
        .replace(/\[([^\]\[:]+)\]/g, (match, cardNameInBrackets) => {
            // Check if we have a full post object with the specific card data
            if (isPostObject && data.cardName && data.cardSet && cardNameInBrackets.toLowerCase() === data.cardName.toLowerCase()) {
                // Build the rich link with complete metadata
                return `<a href="card-view.html?name=${encodeURIComponent(data.cardName)}&set=${encodeURIComponent(data.cardSet)}&game=${encodeURIComponent(data.cardGame || '')}" 
                           class="text-blue-500 dark:text-blue-400 card-link hover:underline font-semibold" 
                           data-card-name="${sanitizeHTML(data.cardName)}"
                           data-card-set="${sanitizeHTML(data.cardSet)}"
                           data-card-image-url="${sanitizeHTML(data.cardImageUrl || '')}"
                           data-card-game="${sanitizeHTML(data.cardGame || '')}"
                           data-card-id="${sanitizeHTML(data.cardId || '')}"
                           title="View ${sanitizeHTML(data.cardName)} from ${sanitizeHTML(data.cardSet)}">[${cardNameInBrackets}]</a>`;
            } else {
                // Fallback for comments or old posts: build a simple link but still searchable
                return `<a href="card-view.html?name=${encodeURIComponent(cardNameInBrackets)}" 
                           class="text-blue-500 dark:text-blue-400 card-link hover:underline font-semibold" 
                           data-card-name="${sanitizeHTML(cardNameInBrackets)}"
                           title="Search for ${cardNameInBrackets}">[${cardNameInBrackets}]</a>`;
            }
        });
}

/**
 * Sanitize HTML content
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

/**
 * Enhanced post creation that ensures card data is properly stored
 * @param {Object} postData - Base post data
 * @param {Object} selectedCard - Selected card from autocomplete
 * @param {string} content - Post content
 * @returns {Object} Enhanced post data with card metadata
 */
export function enhancePostWithCardData(postData, selectedCard, content) {
    if (!selectedCard || !content.includes(`[${selectedCard.name}]`)) {
        return postData;
    }
    
    console.log('[CardTagging] Adding card data to post:', {
        name: selectedCard.name,
        set: selectedCard.set_name || selectedCard.expansion?.name,
        game: selectedCard.game
    });
    
    // Enhanced card data extraction with better fallbacks
    const cardSet = selectedCard.set_name || 
                   selectedCard.expansion?.name || 
                   selectedCard.setName || 
                   'Unknown Set';
    
    const cardImageUrl = selectedCard.image_url ||
                        selectedCard.image ||
                        selectedCard.imageUrl ||
                        selectedCard.images?.[0]?.large ||
                        selectedCard.images?.[0]?.normal ||
                        selectedCard.image_uris?.normal ||
                        selectedCard.image_uris?.large ||
                        '';
    
    // Add comprehensive card metadata
    postData.cardName = selectedCard.name;
    postData.cardSet = cardSet;
    postData.cardImageUrl = cardImageUrl;
    postData.cardGame = selectedCard.game || 'unknown';
    postData.cardId = selectedCard.id || '';
    postData.cardType = selectedCard.type || '';
    postData.cardRarity = selectedCard.rarity || '';
    postData.setCode = selectedCard.set_code || selectedCard.setCode || '';
    
    // Add validation flag
    postData.cardDataComplete = !!(selectedCard.name && cardSet && selectedCard.game);
    postData.cardLastValidated = new Date();
    
    console.log('[CardTagging] Final card data added to post:', {
        cardName: postData.cardName,
        cardSet: postData.cardSet,
        cardGame: postData.cardGame,
        cardImageUrl: postData.cardImageUrl ? 'Present' : 'Missing',
        cardDataComplete: postData.cardDataComplete
    });
    
    return postData;
}

/**
 * Initialize card hover functionality for newly rendered posts
 */
export function initializeCardHoverForPosts() {
    // Initialize the card hover system
    if (typeof initCardHover === 'function') {
        initCardHover();
    }
    
    // Also ensure any existing card links are properly initialized
    const cardLinks = document.querySelectorAll('.card-link');
    console.log(`[CardTagging] Found ${cardLinks.length} card links to initialize`);
    
    // Force re-initialization of hover events
    setTimeout(() => {
        if (typeof initCardHover === 'function') {
            initCardHover();
        }
    }, 100);
}

/**
 * Validate card data in a post
 * @param {Object} post - Post object
 * @returns {boolean} True if card data is valid and complete
 */
export function validatePostCardData(post) {
    if (!post.cardName) return false;
    
    const requiredFields = ['cardName', 'cardSet', 'cardGame'];
    const hasRequiredFields = requiredFields.every(field => 
        post[field] && post[field] !== 'Unknown Set' && post[field] !== 'unknown'
    );
    
    if (!hasRequiredFields) {
        console.warn('[CardTagging] Post has incomplete card data:', {
            cardName: post.cardName,
            cardSet: post.cardSet,
            cardGame: post.cardGame
        });
    }
    
    return hasRequiredFields;
}

/**
 * Enhanced autocomplete handler that ensures proper card selection
 * @param {HTMLElement} textarea - Textarea element
 * @param {HTMLElement} suggestionsContainer - Suggestions container
 * @param {Function} onCardSelected - Callback when card is selected
 */
export async function handleCardAutocomplete(textarea, suggestionsContainer, onCardSelected) {
    const text = textarea.value;
    const cursorPos = textarea.selectionStart;
    
    // Check for card bracket syntax
    const cardMatch = /\[([^\]]*)$/.exec(text.substring(0, cursorPos));
    if (!cardMatch) {
        suggestionsContainer.classList.add('hidden');
        return;
    }
    
    const query = cardMatch[1];
    if (query.length < 2) {
        suggestionsContainer.classList.add('hidden');
        return;
    }
    
    try {
        console.log(`[CardTagging] Searching for cards: "${query}"`);
        
        // Import the card search function dynamically
        const { createCardAutocomplete } = await import('./card-search.js');
        
        await createCardAutocomplete(query, suggestionsContainer, (card) => {
            console.log('[CardTagging] Card selected from autocomplete:', card);
            
            // Validate the selected card has required data
            if (!card.name || !card.game) {
                console.warn('[CardTagging] Selected card missing required data:', card);
                return;
            }
            
            // Store the complete card object for use when creating the post
            if (onCardSelected) {
                onCardSelected(card);
            }
            
            const displayName = card.name;
            const newText = text.substring(0, text.lastIndexOf('[')) + `[${displayName}] ` + text.substring(cursorPos);
            textarea.value = newText;
            suggestionsContainer.classList.add('hidden');
            textarea.focus();
            
            // Set cursor position after the inserted card name
            const newCursorPos = text.lastIndexOf('[') + displayName.length + 3;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
        
    } catch (error) {
        console.error('[CardTagging] Error in card autocomplete:', error);
        suggestionsContainer.classList.add('hidden');
    }
}

/**
 * Fix existing posts that may have incomplete card data
 * @param {Object[]} posts - Array of post objects
 * @returns {Object[]} Posts with enhanced card data where possible
 */
export function fixExistingPostsCardData(posts) {
    return posts.map(post => {
        // Skip posts that already have complete card data
        if (post.cardDataComplete) {
            return post;
        }
        
        // Check if post content has card references
        const cardMatches = post.content?.match(/\[([^\]\[:]+)\]/g);
        if (!cardMatches || cardMatches.length === 0) {
            return post;
        }
        
        // If we have partial card data, try to complete it
        if (post.cardName && !post.cardDataComplete) {
            console.log(`[CardTagging] Found post with incomplete card data: ${post.cardName}`);
            
            // Mark for potential re-validation
            post.needsCardValidation = true;
        }
        
        return post;
    });
}

// Export the enhanced format function to replace the original
export { formatPostContent as formatContent };

// Auto-initialize when this module is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('[CardTagging] Card tagging fix module loaded');
    
    // Initialize card hover functionality
    initializeCardHoverForPosts();
    
    // Set up a mutation observer to handle dynamically added posts
    const observer = new MutationObserver((mutations) => {
        let hasNewCardLinks = false;
        
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const cardLinks = node.querySelectorAll ? node.querySelectorAll('.card-link') : [];
                    if (cardLinks.length > 0) {
                        hasNewCardLinks = true;
                    }
                }
            });
        });
        
        if (hasNewCardLinks) {
            console.log('[CardTagging] New card links detected, reinitializing hover');
            initializeCardHoverForPosts();
        }
    });
    
    // Observe the feed container for changes
    const feedContainer = document.getElementById('feed-container');
    if (feedContainer) {
        observer.observe(feedContainer, {
            childList: true,
            subtree: true
        });
    }
});
