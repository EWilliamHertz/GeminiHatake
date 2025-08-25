#!/usr/bin/env python3
"""
Script to fix the duplicate sidebar issue in messages.html
"""

import re

def fix_messages_html():
    """Remove the duplicate inner sidebar from messages.html."""
    try:
        with open('messages.html', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find and remove the duplicate div and sidebar section
        # The duplicate starts with the toast container and includes the second flex h-screen div
        duplicate_pattern = r'<!-- Toast Notification Container -->\s*<div id="toast-container"></div>\s*<div class="flex h-screen">.*?</aside>'
        
        # Remove the duplicate section
        content = re.sub(duplicate_pattern, '', content, flags=re.DOTALL)
        
        # Also need to remove any remaining duplicate main section that might be left
        # Look for duplicate main tag after the first one
        main_sections = re.findall(r'<main class="flex-1 flex flex-col[^"]*">', content)
        if len(main_sections) > 1:
            # Find the second main section and remove it along with its content
            second_main_pattern = r'<!-- Main Content -->\s*<main class="flex-1 flex flex-col[^"]*">.*?</main>'
            content = re.sub(second_main_pattern, '', content, flags=re.DOTALL)
        
        # Write the fixed content back
        with open('messages.html', 'w', encoding='utf-8') as f:
            f.write(content)
        
        print("✓ Fixed duplicate sidebar in messages.html")
        return True
        
    except Exception as e:
        print(f"Error fixing messages.html: {e}")
        return False

if __name__ == "__main__":
    fix_messages_html()

