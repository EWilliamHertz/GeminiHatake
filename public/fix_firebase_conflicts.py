#!/usr/bin/env python3
"""
Fix Firebase Version Conflicts
Standardizes Firebase versions and removes conflicts
"""

import os
import shutil
from bs4 import BeautifulSoup
import re

def fix_firebase_conflicts(filepath):
    """Fix Firebase version conflicts in an HTML file"""
    print(f"Processing {filepath}...")
    
    # Create backup
    backup_path = f"{filepath}.backup"
    if not os.path.exists(backup_path):
        shutil.copy2(filepath, backup_path)
        print(f"Created backup: {backup_path}")
    
    # Read file
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse HTML
    soup = BeautifulSoup(content, 'html.parser')
    
    # Target Firebase version (use the most common/stable one)
    target_version = "9.6.1"
    target_base_url = "/__/firebase/9.6.1/"
    
    # Find all Firebase script tags
    firebase_scripts = soup.find_all('script', src=lambda x: x and 'firebase' in x)
    
    removed_count = 0
    updated_count = 0
    
    # Track which modules we've seen
    seen_modules = set()
    
    for script in firebase_scripts:
        src = script.get('src')
        
        # Determine module type
        if 'firebase-app' in src:
            module = 'app'
        elif 'firebase-auth' in src:
            module = 'auth'
        elif 'firebase-firestore' in src:
            module = 'firestore'
        elif 'firebase-storage' in src:
            module = 'storage'
        elif 'firebase-functions' in src:
            module = 'functions'
        elif 'firebase-analytics' in src:
            module = 'analytics'
        elif 'init.js' in src:
            module = 'init'
        else:
            continue
        
        # Check if we've already seen this module
        if module in seen_modules:
            # Remove duplicate
            print(f"  Removing duplicate Firebase {module} script: {src}")
            script.decompose()
            removed_count += 1
        else:
            # Update to target version if needed
            if target_version not in src and 'init.js' not in src:
                if module == 'init':
                    new_src = "/__/firebase/init.js"
                else:
                    new_src = f"{target_base_url}firebase-{module}-compat.js"
                
                print(f"  Updating Firebase {module}: {src} -> {new_src}")
                script['src'] = new_src
                updated_count += 1
            
            seen_modules.add(module)
    
    if removed_count > 0 or updated_count > 0:
        # Write fixed file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(str(soup))
        print(f"  Fixed {filepath} - removed {removed_count}, updated {updated_count}")
        return True
    else:
        print(f"  No changes needed for {filepath}")
        return False

def main():
    """Main function to fix all HTML files"""
    html_files = [
        'app.html',
        'articles.html', 
        'trades.html',
        'profile.html',
        'events.html',
        'settings.html'
    ]
    
    fixed_count = 0
    for filename in html_files:
        if os.path.exists(filename):
            if fix_firebase_conflicts(filename):
                fixed_count += 1
        else:
            print(f"File not found: {filename}")
    
    print(f"\nFixed {fixed_count} files")
    print("\nAfter applying fixes:")
    print("1. All files should use Firebase 9.6.1 consistently")
    print("2. No duplicate Firebase modules should remain")
    print("3. The 'formatTimestamp already declared' error should be resolved")
    print("4. Messenger widget should become clickable")

if __name__ == "__main__":
    main()
