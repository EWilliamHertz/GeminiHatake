#!/usr/bin/env python3
"""
Fix inline JavaScript sidebar toggle functionality in HTML files
"""

import os
import re

def fix_inline_toggle(content):
    """Replace the inline toggle functionality with improved version"""
    # Pattern to match the old toggle function
    old_pattern = r'sidebar\.classList\.toggle\(\'-translate-x-full\'\);\s*sidebarOverlay\.classList\.toggle\(\'hidden\'\);'
    
    # New improved toggle logic
    new_logic = '''if (sidebar.classList.contains('-translate-x-full')) {
                    sidebar.classList.remove('-translate-x-full');
                    sidebar.classList.add('translate-x-0');
                    sidebarOverlay.classList.remove('hidden');
                } else {
                    sidebar.classList.add('-translate-x-full');
                    sidebar.classList.remove('translate-x-0');
                    sidebarOverlay.classList.add('hidden');
                }'''
    
    # Replace the pattern
    updated_content = re.sub(old_pattern, new_logic, content, flags=re.MULTILINE | re.DOTALL)
    
    return updated_content

def main():
    public_dir = '/home/ubuntu/GeminiHatake/public'
    
    # Get all HTML files that contain the old toggle pattern
    html_files = []
    for filename in os.listdir(public_dir):
        if filename.endswith('.html'):
            filepath = os.path.join(public_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'sidebar.classList.toggle' in content:
                    html_files.append(filename)
    
    print(f"Found {len(html_files)} HTML files with inline toggle to fix:")
    
    updated_files = []
    
    for filename in html_files:
        filepath = os.path.join(public_dir, filename)
        
        # Read the file
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix the inline toggle
        updated_content = fix_inline_toggle(content)
        
        # Check if changes were made
        if updated_content != content:
            # Write the updated content back
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            updated_files.append(filename)
            print(f"✅ Updated: {filename}")
        else:
            print(f"⏭️  Skipped: {filename} (no changes needed)")
    
    print(f"\n🎉 Successfully updated {len(updated_files)} files!")
    print("Inline JavaScript toggle now:")
    print("- Properly handles responsive CSS classes")
    print("- Removes conflicting translate classes")
    print("- Should work correctly on all screen sizes")

if __name__ == "__main__":
    main()
