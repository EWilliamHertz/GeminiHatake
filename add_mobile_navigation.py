#!/usr/bin/env python3
"""
Script to add mobile-navigation.js to all HTML files that include auth.js
This ensures the hamburger menu functionality is available on all pages
"""

import os
import re
import glob

def add_mobile_navigation_to_file(file_path):
    """Add mobile-navigation.js script to an HTML file after auth.js"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if auth.js is included
        if 'js/auth.js' not in content:
            print(f"Skipping {file_path} - no auth.js found")
            return False
        
        # Check if mobile-navigation.js is already included
        if 'js/mobile-navigation.js' in content:
            print(f"Skipping {file_path} - mobile-navigation.js already included")
            return False
        
        # Pattern to match auth.js script tag and add mobile-navigation.js after it
        pattern = r'(<script src="js/auth\.js">\s*</script>)'
        replacement = r'\1\n  <script src="js/mobile-navigation.js">\n  </script>'
        
        new_content = re.sub(pattern, replacement, content)
        
        if new_content != content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {file_path}")
            return True
        else:
            print(f"No changes needed for {file_path}")
            return False
            
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def main():
    """Main function to process all HTML files"""
    # Find all HTML files in the public directory
    html_files = glob.glob('public/*.html')
    
    updated_count = 0
    total_count = len(html_files)
    
    print(f"Found {total_count} HTML files to process")
    print("-" * 50)
    
    for html_file in html_files:
        if add_mobile_navigation_to_file(html_file):
            updated_count += 1
    
    print("-" * 50)
    print(f"Updated {updated_count} out of {total_count} files")
    
    if updated_count > 0:
        print("\nMobile navigation has been added to the following functionality:")
        print("- Hamburger menu toggle on mobile devices")
        print("- Sidebar overlay and proper mobile navigation")
        print("- Responsive behavior for mobile/desktop transitions")
        print("- Touch-friendly navigation controls")

if __name__ == "__main__":
    main()
