#!/usr/bin/env python3
"""
Script to properly reconstruct messages.html with the correct sidebar and messages content.
"""

import re

def fix_messages_html():
    """Reconstruct messages.html with proper structure."""
    
    # Read the original messages content
    with open('messages_original.html', 'r', encoding='utf-8') as f:
        original_content = f.read()
    
    # Extract the messages-specific content (everything inside the main content area)
    # Look for the chat layout section
    chat_layout_match = re.search(r'<!-- Chat Layout -->(.*?)(?=<script|</body)', original_content, re.DOTALL)
    
    if not chat_layout_match:
        print("Could not find chat layout in original file")
        return False
    
    chat_layout_content = chat_layout_match.group(1).strip()
    
    # Create the new messages.html with proper structure
    new_messages_content = '''<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Messages - HatakeSocial</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/style.css">
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-functions.js"></script>
</head>
<body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200 font-sans">
    <!-- Toast Notification Container -->
    <div id="toast-container"></div>

    <div class="flex h-screen">
        <aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 hidden lg:flex flex-col">
            <div class="h-28 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 px-4">
                <a href="index.html" class="flex flex-col items-center space-y-1">
                    <img src="https://i.imgur.com/B06rBhI.png" alt="HatakeSocial Logo" class="h-16" onerror="this.onerror=null; this.src='https://placehold.co/150x40?text=HatakeSocial';">
                    <span class="font-bold text-lg text-blue-600 dark:text-blue-400">HatakeSocial</span>
                </a>
            </div>
            <nav class="flex-1 px-4 py-6 space-y-2">
                <a href="index.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-home w-6 text-center"></i><span class="ml-3">Feed</span></a>
                <a href="messages.html" class="flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md"><i class="fas fa-comments w-6 text-center"></i><span class="ml-3">Messages</span></a>
                <a href="community.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-users w-6 text-center"></i><span class="ml-3">Community</span></a>
                <a href="articles.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-newspaper w-6 text-center"></i><span class="ml-3">Articles</span></a>
                <a href="events.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-calendar-alt w-6 text-center"></i><span class="ml-3">Events</span></a>
                <a href="my_collection.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-layer-group w-6 text-center"></i><span class="ml-3">My Collection</span></a>
                <a href="deck.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-book-open w-6 text-center"></i><span class="ml-3">Deck Builder</span></a>
                <a href="shop.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-shopping-cart w-6 text-center"></i><span class="ml-3">Shop</span></a>
                <a href="marketplace.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-store w-6 text-center"></i><span class="ml-3">Marketplace</span></a>
                <a href="trades.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-exchange-alt w-6 text-center"></i><span class="ml-3">Trades</span></a>
                <a href="profile.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-user w-6 text-center"></i><span class="ml-3">Profile</span></a>
                <a href="settings.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-cog w-6 text-center"></i><span class="ml-3">Settings</span></a>
                <a href="about.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-info-circle w-6 text-center"></i><span class="ml-3">About Us</span></a>
            </nav>
            <div id="sidebar-user-info" class="p-4 border-t border-gray-200 dark:border-gray-700 hidden">
                <!-- User info will be populated by auth.js -->
            </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 flex flex-col overflow-y-auto">
            <header class="bg-white dark:bg-gray-800 shadow-sm py-3 z-40 border-b border-gray-200 dark:border-gray-700">
                <div class="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex items-center justify-between">
                        <div class="flex-1 max-w-xs">
                            <div class="relative">
                                <span class="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <i class="fas fa-search text-gray-400"></i>
                                </span>
                                <input id="search-input" type="text" placeholder="Search..." class="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>

                        <div class="flex items-center space-x-4">
                            <div id="notification-container" class="relative hidden">
                                <button id="notification-bell" class="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-blue-500">
                                    <i class="fas fa-bell"></i>
                                    <span id="notification-count" class="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"></span>
                                </button>
                                <div id="notification-dropdown" class="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 hidden">
                                </div>
                            </div>
                            
                            <div id="user-dropdown-container" class="relative">
                                <button id="user-dropdown-button" class="flex items-center space-x-2 focus:outline-none">
                                    <img id="user-avatar" class="h-10 w-10 rounded-full object-cover" src="https://via.placeholder.com/40" alt="User Avatar">
                                    <span id="user-name" class="hidden sm:inline font-medium"></span>
                                </button>
                                <div id="user-dropdown-menu" class="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 hidden">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            
            <!-- Chat Layout -->
''' + chat_layout_content + '''
        </main>
    </div>

    <!-- New Conversation Modal -->
    <div id="new-conversation-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 class="text-2xl font-bold mb-4">Start a new conversation</h2>
            <input type="text" id="user-search-input" placeholder="Search for a user by handle..." class="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 mb-4">
            <div id="user-search-results" class="max-h-60 overflow-y-auto"></div>
            <button id="close-modal-btn" class="mt-4 w-full bg-gray-200 dark:bg-gray-700 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
        </div>
    </div>

    <script src="js/auth.js"></script>
    <script src="js/messages.js"></script>
    <script src="js/darkmode.js"></script>
</body>
</html>'''
    
    # Write the new messages.html
    with open('messages.html', 'w', encoding='utf-8') as f:
        f.write(new_messages_content)
    
    print("✓ Successfully reconstructed messages.html with proper structure")
    return True

if __name__ == "__main__":
    fix_messages_html()

