#!/usr/bin/env python3
"""
Script to add the header with search, notifications, and profile to all HTML files
that have been converted to sidebar navigation.
"""

import os
import re
from pathlib import Path

# The header HTML to add inside the main section
HEADER_HTML = '''<header class="bg-white dark:bg-gray-800 shadow-sm py-3 z-40 border-b border-gray-200 dark:border-gray-700">
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
</header>'''

def add_header_to_file(filepath):
    """Add the header with profile and notifications to an HTML file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the main tag and add the header right after it
        main_pattern = r'(<main class="flex-1 flex flex-col">)'
        main_match = re.search(main_pattern, content)
        
        if main_match:
            # Insert the header right after the main tag opening
            main_tag = main_match.group(1)
            new_main_section = main_tag + '\n            ' + HEADER_HTML
            content = content.replace(main_tag, new_main_section)
            
            # Also need to add overflow-y-auto to the main tag for proper scrolling
            content = content.replace(
                '<main class="flex-1 flex flex-col">',
                '<main class="flex-1 flex flex-col overflow-y-auto">'
            )
            
            # Write the modified content back to the file
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
        else:
            print(f"Could not find main tag in {filepath}")
            return False
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Add header to all HTML files in the current directory."""
    html_files = list(Path('.').glob('*.html'))
    
    print(f"Found {len(html_files)} HTML files to update:")
    for file in html_files:
        print(f"  - {file}")
    
    print("\nAdding headers with profile and notifications...")
    print("=" * 60)
    
    success_count = 0
    for html_file in html_files:
        if add_header_to_file(html_file):
            print(f"✓ Added header to {html_file}")
            success_count += 1
        else:
            print(f"✗ Failed to add header to {html_file}")
    
    print("=" * 60)
    print(f"Successfully updated {success_count} out of {len(html_files)} files.")

if __name__ == "__main__":
    main()

