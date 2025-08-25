#!/usr/bin/env python3
"""
Script to convert HTML files from top header navigation to sidebar navigation.
Based on the guide provided by the user.
"""

import os
import re
from pathlib import Path

# The reusable sidebar HTML from the guide
SIDEBAR_HTML = '''<aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 hidden lg:flex flex-col">
    <div class="h-24 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 px-4">
        <a href="index.html" class="flex flex-col items-center space-y-1">
            <img src="https://i.imgur.com/B06rBhI.png" alt="HatakeSocial Logo" class="h-12" onerror="this.onerror=null; this.src='https://placehold.co/150x40?text=HatakeSocial';">
            <span class="font-bold text-lg text-blue-600 dark:text-blue-400">HatakeSocial</span>
        </a>
    </div>
    <nav class="flex-1 px-4 py-6 space-y-2">
        <a href="index.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-home w-6 text-center"></i><span class="ml-3">Feed</span></a>
        <a href="messages.html" class="flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><i class="fas fa-comments w-6 text-center"></i><span class="ml-3">Messages</span></a>
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
    </div>
</aside>'''

def convert_html_file(filepath):
    """Convert a single HTML file from header navigation to sidebar navigation."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Step 1: Remove the entire header section
        header_pattern = r'<header[^>]*>.*?</header>'
        content = re.sub(header_pattern, '', content, flags=re.DOTALL)
        
        # Step 2: Change the body tag and structure
        # Find the current body tag
        body_pattern = r'<body[^>]*class="([^"]*)"[^>]*>'
        body_match = re.search(body_pattern, content)
        
        if body_match:
            # Replace the body tag
            new_body_tag = '<body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200 font-sans">'
            content = re.sub(body_pattern, new_body_tag, content)
            
            # Find everything between <body> and </body>
            body_content_pattern = r'(<body[^>]*>)(.*?)(</body>)'
            body_content_match = re.search(body_content_pattern, content, flags=re.DOTALL)
            
            if body_content_match:
                body_start = body_content_match.group(1)
                body_content = body_content_match.group(2)
                body_end = body_content_match.group(3)
                
                # Remove any mobile menu sections that might be left over
                mobile_menu_pattern = r'<div id="mobile-menu"[^>]*>.*?</div>'
                body_content = re.sub(mobile_menu_pattern, '', body_content, flags=re.DOTALL)
                
                # Create the new structure
                new_body_content = f'''
    <div class="flex h-screen">
        {SIDEBAR_HTML}
        <main class="flex-1 flex flex-col">
            {body_content.strip()}
        </main>
    </div>'''
                
                # Reconstruct the full content
                content = content.replace(body_content_match.group(0), 
                                        body_start + new_body_content + body_end)
        
        # Write the modified content back to the file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return True
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Convert all HTML files in the current directory."""
    html_files = list(Path('.').glob('*.html'))
    
    print(f"Found {len(html_files)} HTML files to convert:")
    for file in html_files:
        print(f"  - {file}")
    
    print("\nConverting files...")
    print("=" * 60)
    
    success_count = 0
    for html_file in html_files:
        if convert_html_file(html_file):
            print(f"✓ Converted {html_file}")
            success_count += 1
        else:
            print(f"✗ Failed to convert {html_file}")
    
    print("=" * 60)
    print(f"Successfully converted {success_count} out of {len(html_files)} files.")

if __name__ == "__main__":
    main()

