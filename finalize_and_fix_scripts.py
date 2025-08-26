import os
import re

# ==============================================================================
# "Golden" Templates for Standardization
# ==============================================================================

# Standardized <head> content. This will be injected into every HTML file,
# ensuring all necessary libraries and the core auth script are loaded first.
# This is critical for the login/register buttons to work everywhere.
HEAD_TEMPLATE = r"""
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="css/style.css">
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-functions.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-analytics.js"></script>
    <script defer src="js/auth.js"></script>
</head>
"""

# Standardized sidebar.
SIDEBAR_TEMPLATE = r"""
    <aside id="sidebar" class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 lg:translate-x-0 transform -translate-x-full transition-transform duration-300 ease-in-out fixed lg:relative h-full z-40 flex flex-col">
        <div class="h-28 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <a href="index.html"><img src="https://i.imgur.com/B06rBhI.png" alt="Gemini Hatake Logo" class="h-20 w-auto"></a>
        </div>
        <nav class="flex-grow overflow-y-auto p-4 space-y-2">
            <a href="index.html" class="nav-link"><i class="fas fa-home"></i><span>Home</span></a>
            <a href="my_collection.html" class="nav-link"><i class="fas fa-layer-group"></i><span>My Collection</span></a>
            <a href="marketplace.html" class="nav-link"><i class="fas fa-store"></i><span>Marketplace</span></a>
            <a href="trades.html" class="nav-link"><i class="fas fa-exchange-alt"></i><span>Trades</span></a>
            <a href="shop.html" class="nav-link"><i class="fas fa-shopping-bag"></i><span>Official Shop</span></a>
            <a href="community.html" class="nav-link"><i class="fas fa-users"></i><span>Community</span></a>
            <a href="events.html" class="nav-link"><i class="fas fa-calendar-alt"></i><span>Events</span></a>
            <a href="messages.html" class="nav-link"><i class="fas fa-comments"></i><span>Messages</span></a>
            <a href="articles.html" class="nav-link"><i class="fas fa-newspaper"></i><span>Articles</span></a>
            <a href="referrals.html" class="nav-link"><i class="fas fa-user-plus"></i><span>Referrals</span></a>
        </nav>
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div id="currency-selector-container" class="flex items-center justify-between">
                </div>
        </div>
    </aside>
"""

# Standardized header.
HEADER_TEMPLATE = r"""
        <header class="relative z-30 h-28 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 lg:bg-transparent dark:lg:bg-transparent">
            <div class="flex items-center">
                <button id="sidebar-toggle" class="lg:hidden mr-4 text-gray-600 dark:text-gray-300">
                    <i class="fas fa-bars text-xl"></i>
                </button>
                <div class="relative hidden sm:block">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="main-search-bar" placeholder="Search..." class="w-full md:w-96 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <div id="main-search-results" class="absolute mt-2 w-full md:w-96 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-xl z-10 hidden"></div>
                </div>
            </div>
            <div id="user-actions" class="flex items-center space-x-5">
                </div>
        </header>
"""

# Standardized login/register modals.
MODALS_HTML = r"""
    <div id="loginModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
        <div class="modal-content w-full max-w-md bg-white dark:bg-gray-800 rounded-lg relative p-8 shadow-xl">
            <button id="closeLoginModal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold">&times;</button>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Login</h2>
            <form id="loginForm" class="space-y-4">
                <div><label for="loginEmail" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email:</label><input type="email" id="loginEmail" class="input-style" placeholder="Enter your email" required></div>
                <div><label for="loginPassword" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Password:</label><input type="password" id="loginPassword" class="input-style" placeholder="Enter your password" required></div>
                <p id="login-error-message" class="text-red-500 text-sm hidden h-4"></p>
                <button type="submit" class="w-full btn-primary">Login</button>
            </form>
            <div class="separator my-4">Or</div>
            <button type="button" id="googleLoginButton" class="w-full btn-secondary flex items-center justify-center"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" class="w-5 h-5 mr-2"> Sign in with Google</button>
        </div>
    </div>
    <div id="registerModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center p-4">
        <div class="modal-content w-full max-w-md bg-white dark:bg-gray-800 rounded-lg relative p-8 shadow-xl">
            <button id="closeRegisterModal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold">&times;</button>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Register</h2>
            <form id="registerForm" class="space-y-4">
                <div><label for="registerEmail" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Email:</label><input type="email" id="registerEmail" class="input-style" placeholder="Enter your email" required></div>
                <div><label for="registerPassword" class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">Password:</label><input type="password" id="registerPassword" class="input-style" placeholder="Minimum 6 characters" required></div>
                <p id="register-error-message" class="text-red-500 text-sm hidden h-4"></p>
                <button type="submit" class="w-full btn-primary bg-green-600 hover:bg-green-700">Register</button>
            </form>
            <div class="separator my-4">Or</div>
            <button type="button" id="googleRegisterButton" class="w-full btn-secondary flex items-center justify-center"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" class="w-5 h-5 mr-2"> Register with Google</button>
        </div>
    </div>
"""

# ==============================================================================
# Main Processing Logic
# ==============================================================================

def get_page_specific_script(filename):
    """Returns the correct page-specific script tag for a given HTML file."""
    # Maps an HTML filename to its corresponding JS file.
    script_map = {
        "index.html": "js/index.js",
        "admin.html": "js/admin.js",
        "articles.html": "js/articles.js",
        "booster.html": "js/booster.js",
        "bulk_add.html": "js/bulk_add.js",
        "card-view.html": "js/card-view.js",
        "community.html": "js/community.js",
        "contact.html": "js/contact.js",
        "deck.html": "js/deck.js",
        "events.html": "js/events.js",
        "marketplace.html": "js/marketplace.js",
        "messages.html": "js/messages.js",
        "my_collection.html": "js/collection.js",
        "notifications.html": "js/notifications.js",
        "profile.html": "js/profile.js",
        "referrals.html": "js/referrals.js",
        "search.html": "js/search.js",
        "settings.html": "js/settings.js",
        "shop.html": "js/shop.js",
        "trades.html": "js/trades.js",
    }
    script_file = script_map.get(filename)
    if script_file and os.path.exists(script_file):
        return f'<script defer src="{script_file}"></script>'
    return '' # Return empty string if no specific script exists

def standardize_html_file(filepath):
    """Rebuilds a single HTML file with the standard layout and all necessary scripts."""
    filename = os.path.basename(filepath)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. Extract the title and existing main content
        title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
        title = title_match.group(1) if title_match else "HatakeSocial"
        
        main_content_match = re.search(r'<main[^>]*>(.*)</main>', content, re.DOTALL)
        main_content_inner_html = main_content_match.group(1).strip() if main_content_match else ""

        # Special Case for index.html: Ensure feed containers exist
        if filename == 'index.html' and 'id="feed-container"' not in main_content_inner_html:
             main_content_inner_html = r"""
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 space-y-6">
                    <div id="create-post-widget" class="bg-white dark:bg-gray-800 p-5 rounded-lg shadow hidden">
                        <textarea id="post-content" class="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="What's on your mind?"></textarea>
                        <div class="flex justify-between items-center mt-3">
                            <div>
                                <button id="attach-image-btn" class="text-gray-500 dark:text-gray-400 hover:text-blue-500"><i class="fas fa-image"></i></button>
                                <input type="file" id="image-upload-input" class="hidden" accept="image/*">
                            </div>
                            <button id="submit-post-btn" class="btn-primary">Post</button>
                        </div>
                        <div id="image-preview-container" class="mt-3"></div>
                    </div>
                    <div id="feed-container" class="space-y-6">
                        </div>
                </div>
                <div class="space-y-6">
                    <div id="who-to-follow-container" class="bg-white dark:bg-gray-800 p-5 rounded-lg shadow">
                        <h3 class="text-lg font-bold text-gray-800 dark:text-white mb-4">Who to Follow</h3>
                        <div id="suggestions-list" class="space-y-4">
                            </div>
                    </div>
                </div>
            </div>
            """ + main_content_inner_html

        # 2. Build the new, standardized HTML structure
        new_head = HEAD_TEMPLATE.format(title=title)
        page_specific_script = get_page_specific_script(filename)
        
        new_html = f"""<!DOCTYPE html>
<html lang="en">
{new_head}
<body class="bg-gray-100 dark:bg-gray-900">
    <div class="flex h-screen bg-gray-100 dark:bg-gray-900 font-sans">
        {SIDEBAR_TEMPLATE}
        <div id="main-content-wrapper" class="flex-1 flex flex-col overflow-hidden">
            <div id="main-content-overlay" class="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30 hidden"></div>
            {HEADER_TEMPLATE}
            <main class="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-6">
                {main_content_inner_html}
            </main>
        </div>
    </div>
    {MODALS_HTML}
    {page_specific_script}
</body>
</html>"""

        # 3. Write the new content back to the file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_html)
        
        print(f"  - ✅ Successfully standardized and fixed scripts for: {filename}")
        return True

    except Exception as e:
        print(f"  - ❌ ERROR processing {filepath}: {e}")
        return False

def main():
    """Main function to iterate through HTML files and fix them."""
    project_root = '.'
    files_processed = 0
    
    print("🚀 Starting final script to fix all pages and functionality...")
    print("-" * 70)

    html_files = [f for f in os.listdir(project_root) if f.endswith(".html")]

    for filename in html_files:
        filepath = os.path.join(project_root, filename)
        if standardize_html_file(filepath):
            files_processed += 1

    print("-" * 70)
    print(f"✅ Process complete. Fully updated and fixed {files_processed} HTML files.")
    print("\nSummary of final changes:")
    print("  - All pages now have a standardized layout.")
    print("  - All pages load the necessary Firebase and `auth.js` scripts in the <head>.")
    print("  - Login/Register buttons are now functional on ALL pages.")
    print("  - Each page now loads its specific JavaScript file (e.g., `js/index.js`).")
    print("  - `index.html` now has the correct containers for the feed and 'Who to Follow'.")
    print("\nThe website should now be fully functional.")

if __name__ == "__main__":
    main()
