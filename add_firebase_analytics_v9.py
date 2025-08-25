#!/usr/bin/env python3
"""
Script to add Firebase Analytics script to all HTML files (v9 compat version).
"""

import os
import re
from pathlib import Path

def add_firebase_analytics(filepath):
    """Add Firebase Analytics script to an HTML file if not already present."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if Firebase Analytics script is already present
        if 'firebase-analytics' in content:
            return False  # Already has Analytics
        
        # Look for Firebase v9 compat scripts
        functions_pattern = r'(<script src="https://www\.gstatic\.com/firebasejs/9\.6\.0/firebase-functions-compat\.js"></script>)'
        
        if re.search(functions_pattern, content):
            # Add Analytics script after Functions script
            analytics_script = '    <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-analytics-compat.js"></script>'
            content = re.sub(
                functions_pattern,
                r'\1\n' + analytics_script,
                content
            )
            
            # Write the modified content back to the file
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
        
        # Also check for v8.10.1 scripts (for messages.html and others)
        functions_pattern_v8 = r'(<script src="https://www\.gstatic\.com/firebasejs/8\.10\.1/firebase-functions\.js"></script>)'
        
        if re.search(functions_pattern_v8, content):
            # Add Analytics script after Functions script
            analytics_script = '    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-analytics.js"></script>'
            content = re.sub(
                functions_pattern_v8,
                r'\1\n' + analytics_script,
                content
            )
            
            # Write the modified content back to the file
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
        
        # If no Functions script found, look for any Firebase script and add after the last one
        firebase_scripts = re.findall(r'<script src="https://www\.gstatic\.com/firebasejs/[^"]+"></script>', content)
        if firebase_scripts:
            last_firebase_script = firebase_scripts[-1]
            if '9.6.0' in last_firebase_script:
                analytics_script = '    <script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-analytics-compat.js"></script>'
            else:
                analytics_script = '    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-analytics.js"></script>'
            
            content = content.replace(last_firebase_script, last_firebase_script + '\n' + analytics_script)
            
            # Write the modified content back to the file
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True
        
        return False
        
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Add Firebase Analytics script to all HTML files."""
    html_files = list(Path('.').glob('*.html'))
    # Exclude the backup file
    html_files = [f for f in html_files if f.name != 'messages_original.html']
    
    print(f"Found {len(html_files)} HTML files to update:")
    for file in html_files:
        print(f"  - {file}")
    
    print("\nAdding Firebase Analytics script...")
    print("=" * 60)
    
    success_count = 0
    for html_file in html_files:
        if add_firebase_analytics(html_file):
            print(f"✓ Added Firebase Analytics to {html_file}")
            success_count += 1
        else:
            print(f"- Skipped {html_file} (already has Analytics or no Firebase scripts found)")
    
    print("=" * 60)
    print(f"Successfully updated {success_count} out of {len(html_files)} files.")

if __name__ == "__main__":
    main()

