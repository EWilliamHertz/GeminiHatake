#!/usr/bin/env python3
"""
Fix hamburger menu buttons across all HTML files to be mobile-friendly
"""

import os
import re

def fix_hamburger_button(content):
    """Replace the old hamburger button with mobile-friendly version"""
    old_pattern = r'<button class="lg:hidden mr-4 text-gray-600 dark:text-gray-300" id="sidebar-toggle">\s*<i class="fas fa-bars text-xl">\s*</i>\s*</button>'
    
    new_button = '''<button class="lg:hidden mr-4 text-gray-600 dark:text-gray-300 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation" id="sidebar-toggle" style="min-width: 44px; min-height: 44px;">
       <i class="fas fa-bars text-xl">
       </i>
      </button>'''
    
    # Replace the pattern
    updated_content = re.sub(old_pattern, new_button, content, flags=re.MULTILINE | re.DOTALL)
    
    return updated_content

def main():
    public_dir = '/home/ubuntu/GeminiHatake/public'
    
    # Get all HTML files that contain sidebar-toggle
    html_files = []
    for filename in os.listdir(public_dir):
        if filename.endswith('.html'):
            filepath = os.path.join(public_dir, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                if 'sidebar-toggle' in content:
                    html_files.append(filename)
    
    print(f"Found {len(html_files)} HTML files with hamburger buttons to fix:")
    
    updated_files = []
    
    for filename in html_files:
        filepath = os.path.join(public_dir, filename)
        
        # Read the file
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix the hamburger button
        updated_content = fix_hamburger_button(content)
        
        # Check if changes were made
        if updated_content != content:
            # Write the updated content back
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            updated_files.append(filename)
            print(f"✅ Updated: {filename}")
        else:
            print(f"⏭️  Skipped: {filename} (already updated or no match)")
    
    print(f"\n🎉 Successfully updated {len(updated_files)} files!")
    print("Hamburger buttons now have:")
    print("- Proper touch targets (44x44px minimum)")
    print("- Better hover and focus states")
    print("- Touch-manipulation CSS for better mobile response")
    print("- Improved accessibility")

if __name__ == "__main__":
    main()
