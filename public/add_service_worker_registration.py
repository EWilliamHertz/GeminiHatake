#!/usr/bin/env python3
"""
Script to add service worker registration to all HTML files in the current directory.
Checks for existing service worker registration and adds it if missing.
"""

import os
import re
from pathlib import Path

def check_and_add_service_worker_registration(file_path):
    """
    Check if HTML file has service worker registration and add it if missing.
    
    Args:
        file_path (str): Path to the HTML file
        
    Returns:
        bool: True if file was modified, False otherwise
    """
    try:
        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if service worker registration already exists
        sw_patterns = [
            r'navigator\.serviceWorker\.register',
            r'serviceWorker\.register',
            r'sw\.js',
            r'service-worker\.js'
        ]
        
        has_sw_registration = any(re.search(pattern, content, re.IGNORECASE) for pattern in sw_patterns)
        
        if has_sw_registration:
            print(f"✅ {file_path} - Service worker registration already exists")
            return False
        
        # Find the </body> tag to insert before it (preferred location)
        body_end_pattern = r'</body>'
        body_match = re.search(body_end_pattern, content, re.IGNORECASE)
        
        if not body_match:
            # If no </body> tag, try </html>
            html_end_pattern = r'</html>'
            html_match = re.search(html_end_pattern, content, re.IGNORECASE)
            
            if not html_match:
                print(f"❌ {file_path} - No </body> or </html> tag found, skipping")
                return False
            
            insert_point = html_match.start()
            print(f"⚠️  {file_path} - No </body> tag, inserting before </html>")
        else:
            insert_point = body_match.start()
        
        # Create the service worker registration script
        sw_registration_script = '''    <script>
        // Service Worker Registration
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                        console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(function(err) {
                        console.log('ServiceWorker registration failed: ', err);
                    });
            });
        }
    </script>
'''
        
        # Insert the service worker registration script
        new_content = content[:insert_point] + sw_registration_script + content[insert_point:]
        
        # Write the modified content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"✅ {file_path} - Added service worker registration")
        return True
        
    except Exception as e:
        print(f"❌ {file_path} - Error: {e}")
        return False

def main():
    """
    Main function to process all HTML files in current directory.
    """
    print("🔍 Scanning for HTML files to add service worker registration...")
    
    # Get current directory
    current_dir = Path('.')
    
    # Find all HTML files
    html_files = list(current_dir.glob('*.html'))
    
    if not html_files:
        print("❌ No HTML files found in current directory")
        return
    
    print(f"📁 Found {len(html_files)} HTML files")
    print("-" * 60)
    
    modified_count = 0
    
    # Process each HTML file
    for html_file in html_files:
        if check_and_add_service_worker_registration(html_file):
            modified_count += 1
    
    print("-" * 60)
    print(f"✅ Processing complete!")
    print(f"📊 Files modified: {modified_count}")
    print(f"📊 Files checked: {len(html_files)}")
    
    if modified_count > 0:
        print("\n🚀 Next steps:")
        print("1. Deploy your changes: firebase deploy")
        print("2. Test PWABuilder again with your URL")
        print("3. Service worker should now be detected!")
        print("4. Your PWA will have offline functionality!")
    else:
        print("\n✅ All files already have service worker registration!")

if __name__ == "__main__":
    main()

