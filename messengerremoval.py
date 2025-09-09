#!/usr/bin/env python3
"""
Script to remove messenger widget from HTML files.
This script finds and removes the messenger widget container from all HTML files
in a specified directory or a single HTML file.
"""

import os
import sys
import argparse
from pathlib import Path
from bs4 import BeautifulSoup
import shutil
from datetime import datetime


def backup_file(file_path):
    """Create a backup of the original file."""
    backup_path = f"{file_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(file_path, backup_path)
    return backup_path


def remove_messenger_widget(html_content):
    """
    Remove the messenger widget from HTML content.
    
    Args:
        html_content (str): The HTML content as a string
        
    Returns:
        tuple: (modified_html_content, widget_found)
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Find the messenger widget container
    messenger_container = soup.find('div', id='messenger-widget-container')
    
    if messenger_container:
        messenger_container.decompose()  # Remove the element completely
        return str(soup), True
    
    return html_content, False


def process_html_file(file_path, create_backup=True):
    """
    Process a single HTML file to remove the messenger widget.
    
    Args:
        file_path (str): Path to the HTML file
        create_backup (bool): Whether to create a backup before modification
        
    Returns:
        dict: Result information
    """
    result = {
        'file': file_path,
        'success': False,
        'widget_found': False,
        'backup_created': False,
        'error': None
    }
    
    try:
        # Read the HTML file
        with open(file_path, 'r', encoding='utf-8') as f:
            original_content = f.read()
        
        # Remove the messenger widget
        modified_content, widget_found = remove_messenger_widget(original_content)
        
        result['widget_found'] = widget_found
        
        if widget_found:
            # Create backup if requested
            if create_backup:
                backup_path = backup_file(file_path)
                result['backup_created'] = True
                result['backup_path'] = backup_path
            
            # Write the modified content back to the file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(modified_content)
            
            result['success'] = True
        else:
            result['success'] = True  # No error, just no widget found
            
    except Exception as e:
        result['error'] = str(e)
    
    return result


def find_html_files(directory):
    """
    Find all HTML files in a directory recursively.
    
    Args:
        directory (str): Directory path to search
        
    Returns:
        list: List of HTML file paths
    """
    html_files = []
    directory_path = Path(directory)
    
    if directory_path.is_file() and directory_path.suffix.lower() in ['.html', '.htm']:
        return [str(directory_path)]
    
    for file_path in directory_path.rglob('*'):
        if file_path.is_file() and file_path.suffix.lower() in ['.html', '.htm']:
            html_files.append(str(file_path))
    
    return html_files


def main():
    parser = argparse.ArgumentParser(
        description='Remove messenger widget from HTML files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python remove_messenger_widget.py /path/to/html/files
  python remove_messenger_widget.py /path/to/single/file.html
  python remove_messenger_widget.py /path/to/html/files --no-backup
        """
    )
    
    parser.add_argument(
        'path',
        help='Path to HTML file or directory containing HTML files'
    )
    
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help='Do not create backup files before modification'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    
    args = parser.parse_args()
    
    # Check if path exists
    if not os.path.exists(args.path):
        print(f"Error: Path '{args.path}' does not exist.")
        sys.exit(1)
    
    # Find HTML files
    html_files = find_html_files(args.path)
    
    if not html_files:
        print(f"No HTML files found in '{args.path}'")
        sys.exit(0)
    
    print(f"Found {len(html_files)} HTML file(s)")
    
    if args.dry_run:
        print("\nDRY RUN - No changes will be made:")
        for file_path in html_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                _, widget_found = remove_messenger_widget(content)
                status = "WIDGET FOUND" if widget_found else "no widget"
                print(f"  {file_path}: {status}")
            except Exception as e:
                print(f"  {file_path}: ERROR - {e}")
        return
    
    # Process files
    results = []
    widgets_removed = 0
    errors = 0
    
    for file_path in html_files:
        print(f"Processing: {file_path}")
        result = process_html_file(file_path, create_backup=not args.no_backup)
        results.append(result)
        
        if result['success']:
            if result['widget_found']:
                widgets_removed += 1
                print(f"  ✓ Messenger widget removed")
                if result.get('backup_created'):
                    print(f"  ✓ Backup created: {result['backup_path']}")
            else:
                print(f"  - No messenger widget found")
        else:
            errors += 1
            print(f"  ✗ Error: {result['error']}")
    
    # Summary
    print(f"\n=== SUMMARY ===")
    print(f"Files processed: {len(html_files)}")
    print(f"Widgets removed: {widgets_removed}")
    print(f"Errors: {errors}")
    
    if errors > 0:
        print(f"\nFiles with errors:")
        for result in results:
            if not result['success']:
                print(f"  {result['file']}: {result['error']}")


if __name__ == '__main__':
    main()

