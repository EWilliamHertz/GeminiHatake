#!/usr/bin/env python3
"""
Script to replace messenger widget code across all HTML files.
Uses the working implementation from articles.html (or the best available implementation).
"""

import os
import re
import shutil
from pathlib import Path
from datetime import datetime

class MessengerWidgetReplacer:
    def __init__(self, source_file=None, target_directory="."):
        self.source_file = source_file
        self.target_directory = Path(target_directory)
        self.backup_directory = self.target_directory / "backup_before_messenger_fix"
        
        # Messenger widget components
        self.messenger_container = None
        self.messenger_modal = None
        self.messenger_js_includes = []
        
    def create_backup(self):
        """Create backup of all HTML files before modification."""
        if not self.backup_directory.exists():
            self.backup_directory.mkdir(parents=True)
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = self.backup_directory / f"backup_{timestamp}"
        backup_dir.mkdir(parents=True)
        
        html_files = list(self.target_directory.glob("*.html"))
        for html_file in html_files:
            if html_file.parent != self.backup_directory:  # Don't backup backup files
                shutil.copy2(html_file, backup_dir / html_file.name)
                
        print(f"Created backup in: {backup_dir}")
        return backup_dir
        
    def extract_messenger_components(self, html_content):
        """Extract messenger widget components from HTML content."""
        components = {}
        
        # Extract messenger widget container
        container_pattern = r'<div[^>]*id="messenger-widget-container"[^>]*>.*?</div>\s*(?=<script|</body|</html|<!--)'
        container_match = re.search(container_pattern, html_content, re.DOTALL | re.IGNORECASE)
        if container_match:
            components['container'] = container_match.group(0)
            
        # Extract messenger modal
        modal_pattern = r'<div[^>]*id="new-conversation-modal"[^>]*>.*?</div>\s*(?=<script|</body|</html|<!--)'
        modal_match = re.search(modal_pattern, html_content, re.DOTALL | re.IGNORECASE)
        if modal_match:
            components['modal'] = modal_match.group(0)
            
        # Extract messenger JavaScript includes
        js_patterns = [
            r'<script[^>]*src="js/messenger\.js"[^>]*></script>',
        ]
        
        js_includes = []
        for pattern in js_patterns:
            matches = re.findall(pattern, html_content, re.IGNORECASE)
            js_includes.extend(matches)
            
        if js_includes:
            components['javascript'] = js_includes
            
        return components
        
    def load_source_components(self):
        """Load messenger components from the source file."""
        if not self.source_file or not Path(self.source_file).exists():
            print(f"Source file not found: {self.source_file}")
            return False
            
        with open(self.source_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        components = self.extract_messenger_components(content)
        
        self.messenger_container = components.get('container', '')
        self.messenger_modal = components.get('modal', '')
        self.messenger_js_includes = components.get('javascript', [])
        
        print(f"Loaded components from {self.source_file}:")
        print(f"  - Container: {len(self.messenger_container)} chars")
        print(f"  - Modal: {len(self.messenger_modal)} chars")
        print(f"  - JS includes: {len(self.messenger_js_includes)} items")
        
        return bool(self.messenger_container or self.messenger_modal or self.messenger_js_includes)
        
    def replace_messenger_in_file(self, html_file):
        """Replace messenger widget components in a single HTML file."""
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original_content = content
        changes_made = []
        
        # Replace messenger widget container
        if self.messenger_container:
            container_pattern = r'<div[^>]*id="messenger-widget-container"[^>]*>.*?</div>\s*(?=<script|</body|</html|<!--)'
            if re.search(container_pattern, content, re.DOTALL | re.IGNORECASE):
                content = re.sub(container_pattern, self.messenger_container, content, flags=re.DOTALL | re.IGNORECASE)
                changes_made.append("container")
            else:
                # Add container before closing body tag if not found
                body_end_pattern = r'(</body>)'
                if re.search(body_end_pattern, content, re.IGNORECASE):
                    content = re.sub(body_end_pattern, f'{self.messenger_container}\n\\1', content, flags=re.IGNORECASE)
                    changes_made.append("container (added)")
                    
        # Replace messenger modal
        if self.messenger_modal:
            modal_pattern = r'<div[^>]*id="new-conversation-modal"[^>]*>.*?</div>\s*(?=<script|</body|</html|<!--)'
            if re.search(modal_pattern, content, re.DOTALL | re.IGNORECASE):
                content = re.sub(modal_pattern, self.messenger_modal, content, flags=re.DOTALL | re.IGNORECASE)
                changes_made.append("modal")
            else:
                # Add modal before messenger container if not found
                if self.messenger_container and self.messenger_container in content:
                    content = content.replace(self.messenger_container, f'{self.messenger_modal}\n{self.messenger_container}')
                    changes_made.append("modal (added)")
                    
        # Replace/add messenger JavaScript includes
        if self.messenger_js_includes:
            # Remove existing messenger.js includes
            existing_js_pattern = r'<script[^>]*src="js/messenger\.js"[^>]*></script>\s*'
            content = re.sub(existing_js_pattern, '', content, flags=re.IGNORECASE)
            
            # Add new messenger.js include before closing body tag
            for js_include in self.messenger_js_includes:
                if js_include not in content:
                    body_end_pattern = r'(</body>)'
                    if re.search(body_end_pattern, content, re.IGNORECASE):
                        content = re.sub(body_end_pattern, f'{js_include}\n\\1', content, flags=re.IGNORECASE)
                        changes_made.append("javascript")
                        
        # Write back if changes were made
        if content != original_content:
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(content)
            return changes_made
        else:
            return []
            
    def process_all_files(self):
        """Process all HTML files in the target directory."""
        if not self.load_source_components():
            print("Failed to load source components!")
            return False
            
        # Create backup
        backup_dir = self.create_backup()
        
        # Find all HTML files
        html_files = list(self.target_directory.glob("*.html"))
        if not html_files:
            print("No HTML files found in target directory!")
            return False
            
        print(f"\nProcessing {len(html_files)} HTML files...")
        
        results = {}
        for html_file in html_files:
            if html_file.parent == self.backup_directory:
                continue  # Skip backup files
                
            changes = self.replace_messenger_in_file(html_file)
            results[html_file.name] = changes
            
            if changes:
                print(f"  ✓ {html_file.name}: {', '.join(changes)}")
            else:
                print(f"  - {html_file.name}: no changes needed")
                
        print(f"\nCompleted! Backup created in: {backup_dir}")
        return True

def main():
    """Main function to run the messenger widget replacement."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Replace messenger widgets in HTML files')
    parser.add_argument('--source', '-s', 
                       help='Source HTML file with working messenger widget (default: articles.html)')
    parser.add_argument('--directory', '-d', default='.',
                       help='Directory containing HTML files to process (default: current directory)')
    parser.add_argument('--auto', '-a', action='store_true',
                       help='Auto-detect best messenger implementation from available files')
    
    args = parser.parse_args()
    
    # Determine source file
    source_file = args.source
    if not source_file:
        # Default to articles.html if it exists
        if Path('articles.html').exists():
            source_file = 'articles.html'
        elif args.auto:
            # Auto-detect best implementation
            print("Auto-detecting best messenger implementation...")
            # This would use the analysis script logic
            source_file = 'articles.html'  # Fallback
        else:
            print("No source file specified and articles.html not found!")
            return False
            
    print(f"Using source file: {source_file}")
    print(f"Target directory: {args.directory}")
    
    replacer = MessengerWidgetReplacer(source_file, args.directory)
    return replacer.process_all_files()

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)

