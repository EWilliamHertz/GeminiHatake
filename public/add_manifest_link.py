#!/usr/bin/env python3
"""
Script to add manifest link to all HTML files in the current directory.
Checks for existing manifest link and adds it if missing.
"""

import os
import re
from pathlib import Path

def check_and_add_manifest_link(file_path):
    """
    Check if HTML file has manifest link and add it if missing.
    
    Args:
        file_path (str): Path to the HTML file
        
    Returns:
        bool: True if file was modified, False otherwise
    """
    try:
        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if manifest link already exists
        manifest_patterns = [
            r'<link[^>]*rel=["\']manifest["\'][^>]*>',
            r'<link[^>]*href=["\'][^"\']*manifest\.json["\'][^>]*>'
        ]
        
        has_manifest = any(re.search(pattern, content, re.IGNORECASE) for pattern in manifest_patterns)
        
        if has_manifest:
            print(f"✅ {file_path} - Manifest link already exists")
            return False
        
        # Find the </head> tag to insert before it
        head_end_pattern = r'</head>'
        head_match = re.search(head_end_pattern, content, re.IGNORECASE)
        
        if not head_match:
            print(f"❌ {file_path} - No </head> tag found, skipping")
            return False
        
        # Create the manifest link
        manifest_link = '    <link rel="manifest" href="/manifest.json">\n'
        
        # Insert the manifest link before </head>
        new_content = content[:head_match.start()] + manifest_link + content[head_match.start():]
        
        # Write the modified content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ {file_path} - Added manifest link")
        return True
        
    except Exception as e:
        print(f"❌ {file_path} - Error: {e}")
        return False

def main():
    """
    Main function to process all HTML files in current directory.
    """
    print("🔍 Scanning for HTML files in current directory...")
    
    # Get current directory
    current_dir = Path('.')
    
    # Find all HTML files
    html_files = list(current_dir.glob('*.html'))
    
    if not html_files:
        print("❌ No HTML files found in current directory")
        return
    
    print(f"📁 Found {len(html_files)} HTML files")
    print("-" * 50)
    
    modified_count = 0
    
    # Process each HTML file
    for html_file in html_files:
        if check_and_add_manifest_link(html_file):
            modified_count += 1
    
    print("-" * 50)
    print(f"✅ Processing complete!")
    print(f"📊 Files modified: {modified_count}")
    print(f"📊 Files checked: {len(html_files)}")
    
    if modified_count > 0:
        print("\n🚀 Next steps:")
        print("1. Deploy your changes: firebase deploy")
        print("2. Test PWABuilder again with your URL")
        print("3. The manifest should now be detected!")

if __name__ == "__main__":
    main()

