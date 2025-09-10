import os
from bs4 import BeautifulSoup

def rewrite_messages_for_mobile_optimization(output_path):
    """
    Completely rewrites the messages.html file to remove duplicate navigation
    and adopt the standard, mobile-friendly application layout.
    """
    # The original, problematic HTML content provided by the user.
    original_html_content = """
    <!DOCTYPE html>
    <html class="dark" lang="en">
    <head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>
    Messages - HatakeSocial
    </title>
    <script src="https://cdn.tailwindcss.com">
    </script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet"/>
    <link href="css/style.css" rel="stylesheet"/>
    </head>
    <body class="bg-gray-100 dark:bg-gray-900 font-sans">

    <div class="flex h-screen"><div class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden lg:hidden" id="sidebar-overlay"></div>
    <aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 -translate-x-full transition-transform duration-300 ease-in-out" id="sidebar">
        </aside>
    <main class="flex-1 flex flex-col overflow-y-auto">
    <header class="h-28 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        </header>
    <div class="flex-1 flex overflow-hidden">
    <div class="w-full md:w-1/3 lg:w-1/4 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col" id="conversations-list">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-wrap gap-2">
    <button class="flex-grow bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center" id="new-conversation-btn">
    <i class="fas fa-plus mr-2"></i>
    <span>New Message</span>
    </button>
    </div>
    <div class="flex-1 overflow-y-auto" id="conversations-container">
    <p class="p-4 text-center text-gray-500">
            Loading conversations...
        </p>
    </div>
    </div>
    <div class="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900" id="chat-window">
    <div class="flex-1 flex flex-col items-center justify-center text-center p-4" id="chat-placeholder">
    <i class="fas fa-comments text-6xl text-gray-300 dark:text-gray-600">
    </i>
    <h2 class="mt-4 text-2xl font-semibold">
            Select a conversation
        </h2>
    <p class="text-gray-500 dark:text-gray-400">
            Choose from your existing conversations or start a new one.
        </p>
    </div>
    <div class="hidden flex-1 flex flex-col overflow-hidden" id="active-chat-container">
    <div class="flex items-center p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" id="chat-header">
    </div>
    <div class="flex-1 p-4 overflow-y-auto space-y-2" id="messages-container">
    </div>
    <div class="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
    <form class="flex items-center space-x-3" id="message-form">
    <input autocomplete="off" class="flex-1 p-2 border rounded-full bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" id="message-input" placeholder="Type a message..." type="text"/>
    <button class="bg-blue-600 text-white rounded-full h-10 w-10 flex items-center justify-center hover:bg-blue-700 flex-shrink-0" type="submit">
    <i class="fas fa-paper-plane">
    </i>
    </button>
    </form>
    </div>
    </div>
    </div>
    </div>
    </main>
    </div>
    </body>
    </html>
    """

    # --- Step 1: Parse the original HTML to extract the core content ---
    print("Parsing original HTML to find the chat component...")
    soup = BeautifulSoup(original_html_content, 'html.parser')
    chat_component = soup.find('div', class_='flex-1 flex overflow-hidden')
    if not chat_component:
        print("Error: Could not find the main chat component in the source HTML.")
        return
    chat_component.extract() # Detach it from the old document

    # --- Step 2: Define the new, clean page structure ---
    print("Building the new page structure from the standard template...")
    new_page_template = """
    <!DOCTYPE html>
    <html class="dark" lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Messages - HatakeSocial</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="css/style.css">
    </head>
    <body class="bg-gray-100 dark:bg-gray-900 font-sans">
        <div id="app-container">
            <div id="sidebar-container"></div>
            
            <div class="lg:pl-64">
                <div id="header-container" class="sticky top-0 z-10"></div>
                
                <main class="h-[calc(100vh-7rem)]">
                    </main>
            </div>
        </div>

        <div id="modal-container"></div>
        <div id="toast-container"></div>

        <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
        <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script>
        <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
        <script src="js/auth.js" defer></script>
        <script src="js/app.js" defer></script>
        <script src="js/darkmode.js" defer></script>
        <script src="js/messages.js" defer></script>
    </body>
    </html>
    """
    new_soup = BeautifulSoup(new_page_template, 'html.parser')

    # --- Step 3: Insert the chat component into the new structure ---
    main_tag = new_soup.find('main')
    
    # Adjust the extracted component's class to fill its new parent
    chat_component['class'] = "flex h-full w-full bg-gray-50 dark:bg-gray-900"
    main_tag.append(chat_component)
    print("Successfully inserted the chat component into the new layout.")

    # --- Step 4: Write the new file ---
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(str(new_soup))
    
    print(f"\nSuccess! '{output_path}' has been completely rewritten and is now mobile-optimized.")
    print("It no longer contains a duplicate navbar and follows the site's standard layout.")

# --- Execute the rewrite ---
output_file = 'public/messages.html'
rewrite_messages_for_mobile_optimization(output_file)
