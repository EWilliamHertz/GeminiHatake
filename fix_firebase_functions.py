#!/usr/bin/env python3
"""
Script to add Firebase Functions script tag to HTML files that are missing it.
This fixes the "firebase.functions is not a function" error.
"""

import os
import re

# List of HTML files that need the Firebase Functions script tag
files_to_fix = [
    'about.html', 'articles.html', 'booster.html', 'bulk_add.html', 
    'card-view.html', 'community.html', 'contact.html', 'create-article.html',
    'deck.html', 'events.html', 'marketplace.html', 'messages.html',
    'my_collection.html', 'notifications.html', 'partner.html', 'referrals.html',
    'search.html', 'settings.html', 'view-article.html'
]

firebase_functions_script = '    <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-functions-compat.js"></script>'

def fix_html_file(filename):
    """Add Firebase Functions script tag to an HTML file if it's missing."""
    if not os.path.exists(filename):
        print(f"File {filename} not found, skipping...")
        return False
    
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if Firebase Functions script is already present
    if 'firebase-functions-compat.js' in content:
        print(f"{filename} already has Firebase Functions script, skipping...")
        return False
    
    # Look for the pattern where other Firebase scripts are loaded
    # We'll add the Functions script after the storage script
    storage_script_pattern = r'(\s*<script src="https://www\.gstatic\.com/firebasejs/9\.6\.0/firebase-storage-compat\.js"></script>)'
    
    if re.search(storage_script_pattern, content):
        # Add the Functions script after the storage script
        new_content = re.sub(
            storage_script_pattern,
            r'\1\n' + firebase_functions_script,
            content
        )
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✓ Added Firebase Functions script to {filename}")
        return True
    else:
        print(f"⚠ Could not find Firebase storage script pattern in {filename}")
        return False

def main():
    print("Fixing Firebase Functions script tags in HTML files...")
    print("=" * 60)
    
    fixed_count = 0
    for filename in files_to_fix:
        if fix_html_file(filename):
            fixed_count += 1
    
    print("=" * 60)
    print(f"Fixed {fixed_count} files out of {len(files_to_fix)} files.")

if __name__ == "__main__":
    main()

