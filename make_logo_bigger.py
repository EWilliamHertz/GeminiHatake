#!/usr/bin/env python3
"""
Script to make the logo bigger in the sidebar navigation across all HTML files.
"""

import os
import re
from pathlib import Path

def make_logo_bigger(filepath):
    """Make the logo bigger in the sidebar navigation."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace the current logo size (h-12) with a bigger size (h-16)
        # Also increase the container height from h-24 to h-28 to accommodate the bigger logo
        content = content.replace(
            'class="h-24 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 px-4"',
            'class="h-28 flex items-center justify-center border-b border-gray-200 dark:border-gray-700 px-4"'
        )
        
        # Make the logo image bigger
        content = content.replace(
            'class="h-12"',
            'class="h-16"'
        )
        
        # Write the modified content back to the file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return True
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Make logo bigger in all HTML files."""
    html_files = list(Path('.').glob('*.html'))
    
    print(f"Found {len(html_files)} HTML files to update:")
    for file in html_files:
        print(f"  - {file}")
    
    print("\nMaking logos bigger...")
    print("=" * 60)
    
    success_count = 0
    for html_file in html_files:
        if make_logo_bigger(html_file):
            print(f"✓ Updated logo size in {html_file}")
            success_count += 1
        else:
            print(f"✗ Failed to update {html_file}")
    
    print("=" * 60)
    print(f"Successfully updated {success_count} out of {len(html_files)} files.")

if __name__ == "__main__":
    main()

