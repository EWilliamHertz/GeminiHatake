#!/usr/bin/env python3
"""
Script to identify and remove login/register forms outside of proper pop-up modals.

This script will:
1. Parse HTML files to find login/register forms
2. Keep forms that are properly commented modals (<!-- Login Modal --> or <!-- Register Modal -->)
3. Remove forms that match the authModal pattern from the user's example
4. Preserve the overall HTML structure and formatting
"""

import os
import re
import argparse
from pathlib import Path
from typing import List, Tuple
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FormRemover:
    def __init__(self):
        pass
    
    def find_complete_modal_block(self, content: str, start_pos: int) -> int:
        """
        Find the complete modal block starting from a given position.
        This handles nested divs properly.
        """
        # Find the opening <div tag
        div_start = content.find('<div', start_pos)
        if div_start == -1:
            return -1
        
        # Find the end of the opening tag
        tag_end = content.find('>', div_start)
        if tag_end == -1:
            return -1
        
        # Count nested divs to find the matching closing tag
        div_count = 1
        pos = tag_end + 1
        
        while pos < len(content) and div_count > 0:
            # Look for the next div tag (opening or closing)
            next_open_pos = content.find('<div', pos)
            next_close_pos = content.find('</div>', pos)
            
            # If no more closing tags, we have a problem
            if next_close_pos == -1:
                logger.warning("Could not find matching closing div tag")
                return -1
            
            # Determine which comes first
            if next_open_pos != -1 and next_open_pos < next_close_pos:
                # Opening div comes first
                div_count += 1
                pos = next_open_pos + 4
            else:
                # Closing div comes first
                div_count -= 1
                if div_count == 0:
                    # Found our matching closing tag
                    return next_close_pos + 6  # Include the </div>
                pos = next_close_pos + 6
        
        return -1
    
    def remove_forms(self, content: str) -> Tuple[str, int]:
        """
        Remove unwanted forms from the HTML content.
        Returns the modified content and the number of forms removed.
        """
        modified_content = content
        removed_count = 0
        
        # Pattern to match the specific authModal structure from user's example
        # This matches: <div class="modal" id="authModal">
        auth_modal_pattern = r'<div\s+class="modal"\s+id="authModal"[^>]*>'
        
        # Find all matches (we'll process them in reverse order to avoid position shifts)
        matches = list(re.finditer(auth_modal_pattern, content, re.IGNORECASE))
        
        # Process matches in reverse order (from end to beginning)
        for match in reversed(matches):
            start_pos = match.start()
            
            # Find the complete modal block
            end_pos = self.find_complete_modal_block(content, start_pos)
            
            if end_pos == -1:
                logger.warning(f"Could not find complete modal block starting at position {start_pos}")
                continue
            
            # Check if this modal is within a properly commented section
            # Look backwards for modal comments
            preceding_text = modified_content[:start_pos]
            
            # Check for Login Modal or Register Modal comments in the preceding 500 characters
            recent_text = preceding_text[-500:] if len(preceding_text) > 500 else preceding_text
            
            if re.search(r'<!--\s*(?:Login|Register)\s+Modal\s*-->', recent_text, re.IGNORECASE):
                logger.info(f"Skipping authModal at position {start_pos} - it's within a properly commented modal section")
                continue
            
            # Extract the content to be removed for logging
            modal_content = modified_content[start_pos:end_pos]
            logger.info(f"Removing authModal from position {start_pos} to {end_pos}")
            logger.debug(f"Modal content preview: {modal_content[:200]}...")
            
            # Remove the modal
            modified_content = modified_content[:start_pos] + modified_content[end_pos:]
            removed_count += 1
        
        return modified_content, removed_count
    
    def process_file(self, file_path: Path, backup: bool = True) -> bool:
        """
        Process a single HTML file to remove unwanted forms.
        Returns True if the file was modified, False otherwise.
        """
        try:
            # Read the file
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            # Process the content
            modified_content, removed_count = self.remove_forms(original_content)
            
            if removed_count == 0:
                logger.info(f"No unwanted authModal forms found in {file_path}")
                return False
            
            # Create backup if requested
            if backup:
                backup_path = file_path.with_suffix(file_path.suffix + '.backup')
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(original_content)
                logger.info(f"Backup created: {backup_path}")
            
            # Write the modified content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(modified_content)
            
            logger.info(f"Successfully removed {removed_count} authModal forms from {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing {file_path}: {str(e)}")
            return False
    
    def process_directory(self, directory: Path, backup: bool = True) -> dict:
        """
        Process all HTML files in a directory.
        Returns a summary of the processing results.
        """
        results = {
            'processed': 0,
            'modified': 0,
            'errors': 0,
            'files': []
        }
        
        # Find all HTML files
        html_files = list(directory.glob('*.html'))
        
        if not html_files:
            logger.warning(f"No HTML files found in {directory}")
            return results
        
        logger.info(f"Found {len(html_files)} HTML files to process")
        
        for html_file in html_files:
            results['processed'] += 1
            
            try:
                if self.process_file(html_file, backup):
                    results['modified'] += 1
                    results['files'].append(str(html_file))
            except Exception as e:
                results['errors'] += 1
                logger.error(f"Failed to process {html_file}: {str(e)}")
        
        return results

def main():
    parser = argparse.ArgumentParser(
        description="Remove unwanted authModal forms from HTML files while preserving properly commented modals"
    )
    parser.add_argument(
        'path',
        help='Path to HTML file or directory containing HTML files'
    )
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help='Do not create backup files'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    path = Path(args.path)
    backup = not args.no_backup
    
    if not path.exists():
        logger.error(f"Path does not exist: {path}")
        return 1
    
    form_remover = FormRemover()
    
    if path.is_file():
        if path.suffix.lower() != '.html':
            logger.error("File must have .html extension")
            return 1
        
        success = form_remover.process_file(path, backup)
        return 0 if success else 1
    
    elif path.is_dir():
        results = form_remover.process_directory(path, backup)
        
        logger.info(f"Processing complete:")
        logger.info(f"  Files processed: {results['processed']}")
        logger.info(f"  Files modified: {results['modified']}")
        logger.info(f"  Errors: {results['errors']}")
        
        if results['files']:
            logger.info("Modified files:")
            for file in results['files']:
                logger.info(f"  - {file}")
        
        return 0 if results['errors'] == 0 else 1
    
    else:
        logger.error(f"Path is neither a file nor a directory: {path}")
        return 1

if __name__ == '__main__':
    exit(main())
