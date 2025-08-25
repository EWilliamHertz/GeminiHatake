#!/usr/bin/env python3
"""
Script to completely fix the layout issues:
1. Remove duplicate small sidebars from all pages
2. Add proper login/register buttons to headers
3. Ensure consistent layout across all pages
"""

import os
import re
from pathlib import Path

def fix_html_file(filepath):
    """Fix layout issues in an HTML file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 1. Remove the duplicate small sidebar navigation (the one inside main content)
        # Look for the small sidebar pattern and remove it
        small_sidebar_patterns = [
            r'<aside class="md:col-span-1 bg-white dark:bg-gray-800[^>]*" id="left-sidebar">.*?</aside>',
            r'<aside[^>]*id="left-sidebar"[^>]*>.*?</aside>',
            r'<div[^>]*class="[^"]*sidebar[^"]*"[^>]*>.*?</div>',
        ]
        
        for pattern in small_sidebar_patterns:
            content = re.sub(pattern, '', content, flags=re.DOTALL)
        
        # 2. Update the header to include login/register buttons
        # Find the header and replace the user dropdown section with proper auth buttons
        header_pattern = r'(<div class="flex items-center space-x-4">)(.*?)(</div>\s*</div>\s*</div>\s*</header>)'
        header_match = re.search(header_pattern, content, re.DOTALL)
        
        if header_match:
            new_header_content = '''
                <!-- Guest/Logged-out buttons -->
                <div id="logged-out-links" class="flex items-center space-x-4">
                    <a href="auth.html" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400">Login</a>
                    <a href="auth.html#register" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Register</a>
                </div>

                <!-- Logged-in user elements -->
                <div id="logged-in-links" class="hidden flex items-center space-x-4">
                    <div id="notification-container" class="relative">
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
            '''
            
            content = re.sub(header_pattern, header_match.group(1) + new_header_content + header_match.group(3), content, flags=re.DOTALL)
        
        # 3. Remove any remaining duplicate navigation elements
        # Remove any remaining small navigation menus
        nav_patterns = [
            r'<nav>\s*<ul class="space-y-4">.*?</ul>\s*</nav>',
            r'<ul class="space-y-4">.*?</ul>',
        ]
        
        for pattern in nav_patterns:
            # Only remove if it's inside the main content area, not the main sidebar
            if '<aside class="w-64 bg-white dark:bg-gray-800' not in content[:content.find(pattern) if pattern in content else 0]:
                content = re.sub(pattern, '', content, flags=re.DOTALL)
        
        # 4. Clean up any leftover grid layouts that were meant for the old sidebar
        content = re.sub(r'class="[^"]*grid[^"]*grid-cols-1[^"]*md:grid-cols-4[^"]*"', 'class="container mx-auto px-4 py-8"', content)
        
        # Write the fixed content back to the file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return True
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Fix layout issues in all HTML files."""
    html_files = list(Path('.').glob('*.html'))
    # Exclude backup files
    html_files = [f for f in html_files if 'original' not in f.name]
    
    print(f"Found {len(html_files)} HTML files to fix:")
    for file in html_files:
        print(f"  - {file}")
    
    print("\nFixing layout issues...")
    print("=" * 60)
    
    success_count = 0
    for html_file in html_files:
        if fix_html_file(html_file):
            print(f"✓ Fixed layout in {html_file}")
            success_count += 1
        else:
            print(f"✗ Failed to fix {html_file}")
    
    print("=" * 60)
    print(f"Successfully fixed {success_count} out of {len(html_files)} files.")
    print("\nChanges made:")
    print("- Removed duplicate small sidebar navigations")
    print("- Added proper Login/Register buttons to headers")
    print("- Cleaned up grid layouts")
    print("- Ensured consistent layout across all pages")

if __name__ == "__main__":
    main()

