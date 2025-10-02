#!/usr/bin/env python3
"""
Fix hamburger menu button z-index issues across all HTML files
"""

import os
import re

def fix_hamburger_zindex(content):
    """Add z-index and positioning to hamburger buttons"""
    # Pattern to match the current hamburger button
    pattern = r'<button class="lg:hidden mr-4 text-gray-600 dark:text-gray-300 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation" id="sidebar-toggle" style="min-width: 44px; min-height: 44px;">'
    
    # Replacement with z-index and positioning
    replacement = '<button class="lg:hidden mr-4 text-gray-600 dark:text-gray-300 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation relative" id="sidebar-toggle" style="min-width: 44px; min-height: 44px; z-index: 1000; position: relative;">'
    
    # Replace the pattern
    updated_content = content.replace(pattern, replacement)
    
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
                if 'sidebar-toggle' in content and 'min-width: 44px; min-height: 44px;' in content:
                    html_files.append(filename)
    
    print(f"Found {len(html_files)} HTML files with hamburger buttons to fix z-index:")
    
    updated_files = []
    
    for filename in html_files:
        filepath = os.path.join(public_dir, filename)
        
        # Read the file
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Fix the hamburger button z-index
        updated_content = fix_hamburger_zindex(content)
        
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
    print("- Higher z-index (1000) to prevent overlap issues")
    print("- Relative positioning for proper layering")
    print("- Should now be clickable on mobile devices")

if __name__ == "__main__":
    main()
