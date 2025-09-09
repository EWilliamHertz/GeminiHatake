#!/usr/bin/env python3
"""
Legal Documents Linker Script for GeminiHatake Project

This script automatically finds and updates references to Privacy Policy and Terms of Service
in HTML, JavaScript, and Python files throughout the project, ensuring consistent linking
to the legal documents.

Usage:
    python link_legal_documents.py [project_directory]

Features:
- Scans HTML, JS, and PY files for privacy policy and terms of service mentions
- Updates links to point to the correct legal document pages
- Creates backup files before making changes
- Provides detailed logging of all changes made
- Supports both relative and absolute URL linking
"""

import os
import re
import shutil
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Dict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('legal_documents_linker.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class LegalDocumentsLinker:
    """
    A class to automatically link Privacy Policy and Terms of Service documents
    in code files throughout a project.
    """
    
    def __init__(self, project_dir: str, base_url: str = ""):
        """
        Initialize the linker with project directory and base URL.
        
        Args:
            project_dir (str): Path to the project directory
            base_url (str): Base URL for absolute links (optional)
        """
        self.project_dir = Path(project_dir)
        self.base_url = base_url.rstrip('/')
        self.backup_dir = self.project_dir / "backups" / f"legal_links_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.changes_made = []
        
        # File extensions to process
        self.file_extensions = ['.html', '.js', '.py', '.jsx', '.ts', '.tsx']
        
        # Patterns to match privacy policy references
        self.privacy_patterns = [
            r'privacy[_\s-]?policy',
            r'privacy[_\s-]?statement',
            r'data[_\s-]?protection',
            r'privacy[_\s-]?notice'
        ]
        
        # Patterns to match terms of service references
        self.terms_patterns = [
            r'terms[_\s-]?of[_\s-]?service',
            r'terms[_\s-]?of[_\s-]?use',
            r'terms[_\s-]?and[_\s-]?conditions',
            r'user[_\s-]?agreement',
            r'service[_\s-]?agreement'
        ]
        
        # URL patterns for legal documents
        self.privacy_url = f"{self.base_url}/privacy.html" if self.base_url else "privacy.html"
        self.terms_url = f"{self.base_url}/terms.html" if self.base_url else "terms.html"
    
    def create_backup(self, file_path: Path) -> Path:
        """
        Create a backup of the file before modification.
        
        Args:
            file_path (Path): Path to the file to backup
            
        Returns:
            Path: Path to the backup file
        """
        # Create backup directory if it doesn't exist
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Create relative path for backup
        relative_path = file_path.relative_to(self.project_dir)
        backup_path = self.backup_dir / relative_path
        
        # Create parent directories for backup
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Copy file to backup location
        shutil.copy2(file_path, backup_path)
        logger.info(f"Created backup: {backup_path}")
        
        return backup_path
    
    def find_files_to_process(self) -> List[Path]:
        """
        Find all files in the project that should be processed.
        
        Returns:
            List[Path]: List of file paths to process
        """
        files_to_process = []
        
        for root, dirs, files in os.walk(self.project_dir):
            # Skip backup directories and common ignore patterns
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['node_modules', '__pycache__', 'backups']]
            
            for file in files:
                file_path = Path(root) / file
                if file_path.suffix.lower() in self.file_extensions:
                    files_to_process.append(file_path)
        
        logger.info(f"Found {len(files_to_process)} files to process")
        return files_to_process
    
    def detect_legal_references(self, content: str, file_path: Path) -> Dict[str, List[Tuple[int, str]]]:
        """
        Detect references to privacy policy and terms of service in file content.
        
        Args:
            content (str): File content to analyze
            file_path (Path): Path to the file being analyzed
            
        Returns:
            Dict[str, List[Tuple[int, str]]]: Dictionary with 'privacy' and 'terms' keys,
                                           each containing list of (line_number, line_content) tuples
        """
        references = {'privacy': [], 'terms': []}
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            line_lower = line.lower()
            
            # Check for privacy policy references
            for pattern in self.privacy_patterns:
                if re.search(pattern, line_lower):
                    references['privacy'].append((line_num, line.strip()))
                    break
            
            # Check for terms of service references
            for pattern in self.terms_patterns:
                if re.search(pattern, line_lower):
                    references['terms'].append((line_num, line.strip()))
                    break
        
        return references
    
    def update_html_links(self, content: str, file_path: Path) -> str:
        """
        Update HTML links to privacy policy and terms of service.
        
        Args:
            content (str): HTML content to update
            file_path (Path): Path to the HTML file
            
        Returns:
            str: Updated HTML content
        """
        updated_content = content
        changes_count = 0
        
        # Skip navbar/sidebar navigation sections to avoid modifying main navigation
        # Split content into sections and only process main content areas
        lines = content.split('\n')
        in_nav_section = False
        processed_lines = []
        
        for line in lines:
            line_lower = line.lower()
            
            # Detect start of navigation sections (navbar, sidebar, nav elements)
            if any(nav_indicator in line_lower for nav_indicator in ['<nav', '<aside', 'class="nav', 'id="sidebar"', 'class="sidebar']):
                in_nav_section = True
            
            # Detect end of navigation sections
            if in_nav_section and any(end_indicator in line_lower for end_indicator in ['</nav>', '</aside>']):
                in_nav_section = False
                processed_lines.append(line)
                continue
            
            # Skip processing if we're in a navigation section
            if in_nav_section:
                processed_lines.append(line)
                continue
            
            # Process the line for legal document links
            processed_line = line
            
            # Update privacy policy links (only outside navigation)
            privacy_link_pattern = r'<a[^>]*href=["\']([^"\']*)["\'][^>]*>([^<]*(?:privacy[_\s-]?policy|privacy[_\s-]?statement)[^<]*)</a>'
            
            def replace_privacy_link(match):
                nonlocal changes_count
                old_href = match.group(1)
                link_text = match.group(2)
                new_link = f'<a href="{self.privacy_url}">{link_text}</a>'
                changes_count += 1
                logger.info(f"Updated privacy link in {file_path}: {old_href} -> {self.privacy_url}")
                return new_link
            
            processed_line = re.sub(privacy_link_pattern, replace_privacy_link, processed_line, flags=re.IGNORECASE)
            
            # Update terms of service links (only outside navigation)
            terms_link_pattern = r'<a[^>]*href=["\']([^"\']*)["\'][^>]*>([^<]*(?:terms[_\s-]?of[_\s-]?service|terms[_\s-]?of[_\s-]?use|terms[_\s-]?and[_\s-]?conditions)[^<]*)</a>'
            
            def replace_terms_link(match):
                nonlocal changes_count
                old_href = match.group(1)
                link_text = match.group(2)
                new_link = f'<a href="{self.terms_url}">{link_text}</a>'
                changes_count += 1
                logger.info(f"Updated terms link in {file_path}: {old_href} -> {self.terms_url}")
                return new_link
            
            processed_line = re.sub(terms_link_pattern, replace_terms_link, processed_line, flags=re.IGNORECASE)
            
            processed_lines.append(processed_line)
        
        updated_content = '\n'.join(processed_lines)
        
        # Add missing links for text references without links (only in main content areas, not navigation)
        # Only add links if the text appears to be in footer, main content, or similar areas
        if '<body' in updated_content.lower() and not in_nav_section:
            # Privacy policy text without links (excluding navigation areas)
            privacy_text_pattern = r'(?<!<nav[^>]*>)(?<!<aside[^>]*>)(?<!class="nav)(?<!id="sidebar")(\b(?:privacy[_\s-]?policy|privacy[_\s-]?statement)\b)(?![^<]*</a>)(?![^<]*</nav>)(?![^<]*</aside>)'
            
            def add_privacy_link(match):
                nonlocal changes_count
                text = match.group(1)
                # Check if we're in a navigation context by looking at surrounding content
                start_pos = updated_content.find(match.group(0))
                context_before = updated_content[max(0, start_pos-200):start_pos].lower()
                context_after = updated_content[start_pos:start_pos+200].lower()
                
                # Skip if in navigation context
                if any(nav_word in context_before or nav_word in context_after 
                       for nav_word in ['<nav', '<aside', 'class="nav', 'id="sidebar"', 'class="sidebar']):
                    return text
                
                new_link = f'<a href="{self.privacy_url}">{text}</a>'
                changes_count += 1
                logger.info(f"Added privacy link in {file_path}: {text}")
                return new_link
            
            # Apply with careful context checking
            updated_content = re.sub(privacy_text_pattern, add_privacy_link, updated_content, flags=re.IGNORECASE)
        
        if changes_count > 0:
            self.changes_made.append(f"{file_path}: {changes_count} HTML links updated")
        
        return updated_content
    
    def update_javascript_references(self, content: str, file_path: Path) -> str:
        """
        Update JavaScript references to privacy policy and terms of service.
        
        Args:
            content (str): JavaScript content to update
            file_path (Path): Path to the JavaScript file
            
        Returns:
            str: Updated JavaScript content
        """
        updated_content = content
        changes_count = 0
        
        # Update URL assignments and redirects
        url_patterns = [
            (r'(window\.location\.href\s*=\s*["\'])([^"\']*privacy[^"\']*)', f'\\1{self.privacy_url}'),
            (r'(window\.location\.href\s*=\s*["\'])([^"\']*terms[^"\']*)', f'\\1{self.terms_url}'),
            (r'(location\.href\s*=\s*["\'])([^"\']*privacy[^"\']*)', f'\\1{self.privacy_url}'),
            (r'(location\.href\s*=\s*["\'])([^"\']*terms[^"\']*)', f'\\1{self.terms_url}'),
        ]
        
        for pattern, replacement in url_patterns:
            matches = re.findall(pattern, updated_content, flags=re.IGNORECASE)
            if matches:
                updated_content = re.sub(pattern, replacement, updated_content, flags=re.IGNORECASE)
                changes_count += len(matches)
                logger.info(f"Updated {len(matches)} JavaScript URL references in {file_path}")
        
        # Update string constants
        const_patterns = [
            (r'(["\'])([^"\']*privacy[_\s-]?policy[^"\']*)\1', f'\\1{self.privacy_url}\\1'),
            (r'(["\'])([^"\']*terms[_\s-]?of[_\s-]?service[^"\']*)\1', f'\\1{self.terms_url}\\1'),
        ]
        
        for pattern, replacement in const_patterns:
            # Only replace if it looks like a URL (contains .html or starts with /)
            def replace_if_url(match):
                nonlocal changes_count
                full_match = match.group(0)
                url_content = match.group(2)
                if '.html' in url_content or url_content.startswith('/'):
                    changes_count += 1
                    logger.info(f"Updated JavaScript constant in {file_path}: {url_content}")
                    return re.sub(pattern, replacement, full_match, flags=re.IGNORECASE)
                return full_match
            
            updated_content = re.sub(pattern, replace_if_url, updated_content, flags=re.IGNORECASE)
        
        if changes_count > 0:
            self.changes_made.append(f"{file_path}: {changes_count} JavaScript references updated")
        
        return updated_content
    
    def update_python_references(self, content: str, file_path: Path) -> str:
        """
        Update Python references to privacy policy and terms of service.
        
        Args:
            content (str): Python content to update
            file_path (Path): Path to the Python file
            
        Returns:
            str: Updated Python content
        """
        updated_content = content
        changes_count = 0
        
        # Update URL string assignments
        url_patterns = [
            (r'(["\'])([^"\']*privacy[_\s-]?policy[^"\']*\.html?[^"\']*)\1', f'\\1{self.privacy_url}\\1'),
            (r'(["\'])([^"\']*terms[_\s-]?of[_\s-]?service[^"\']*\.html?[^"\']*)\1', f'\\1{self.terms_url}\\1'),
            (r'(["\'])([^"\']*terms[_\s-]?of[_\s-]?use[^"\']*\.html?[^"\']*)\1', f'\\1{self.terms_url}\\1'),
        ]
        
        for pattern, replacement in url_patterns:
            matches = re.findall(pattern, updated_content, flags=re.IGNORECASE)
            if matches:
                updated_content = re.sub(pattern, replacement, updated_content, flags=re.IGNORECASE)
                changes_count += len(matches)
                logger.info(f"Updated {len(matches)} Python URL references in {file_path}")
        
        # Update dictionary/config values
        config_patterns = [
            (r'(["\']privacy[_\s-]?policy[_\s-]?url["\']:\s*["\'])([^"\']*)', f'\\1{self.privacy_url}'),
            (r'(["\']terms[_\s-]?of[_\s-]?service[_\s-]?url["\']:\s*["\'])([^"\']*)', f'\\1{self.terms_url}'),
            (r'(["\']terms[_\s-]?url["\']:\s*["\'])([^"\']*)', f'\\1{self.terms_url}'),
        ]
        
        for pattern, replacement in config_patterns:
            matches = re.findall(pattern, updated_content, flags=re.IGNORECASE)
            if matches:
                updated_content = re.sub(pattern, replacement, updated_content, flags=re.IGNORECASE)
                changes_count += len(matches)
                logger.info(f"Updated {len(matches)} Python config values in {file_path}")
        
        if changes_count > 0:
            self.changes_made.append(f"{file_path}: {changes_count} Python references updated")
        
        return updated_content
    
    def process_file(self, file_path: Path) -> bool:
        """
        Process a single file to update legal document references.
        
        Args:
            file_path (Path): Path to the file to process
            
        Returns:
            bool: True if file was modified, False otherwise
        """
        try:
            # Read file content
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                original_content = f.read()
            
            # Detect references
            references = self.detect_legal_references(original_content, file_path)
            
            if not any(references.values()):
                return False  # No references found
            
            logger.info(f"Processing {file_path} - Found {len(references['privacy'])} privacy and {len(references['terms'])} terms references")
            
            # Create backup
            self.create_backup(file_path)
            
            # Update content based on file type
            updated_content = original_content
            
            if file_path.suffix.lower() in ['.html', '.htm']:
                updated_content = self.update_html_links(updated_content, file_path)
            elif file_path.suffix.lower() in ['.js', '.jsx', '.ts', '.tsx']:
                updated_content = self.update_javascript_references(updated_content, file_path)
            elif file_path.suffix.lower() in ['.py']:
                updated_content = self.update_python_references(updated_content, file_path)
            
            # Write updated content if changes were made
            if updated_content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(updated_content)
                logger.info(f"Updated {file_path}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error processing {file_path}: {str(e)}")
            return False
    
    def run(self) -> Dict[str, int]:
        """
        Run the legal documents linker on the entire project.
        
        Returns:
            Dict[str, int]: Statistics about the linking process
        """
        logger.info(f"Starting legal documents linking for project: {self.project_dir}")
        logger.info(f"Privacy Policy URL: {self.privacy_url}")
        logger.info(f"Terms of Service URL: {self.terms_url}")
        
        files_to_process = self.find_files_to_process()
        files_modified = 0
        files_processed = 0
        
        for file_path in files_to_process:
            files_processed += 1
            if self.process_file(file_path):
                files_modified += 1
        
        # Generate summary
        stats = {
            'files_processed': files_processed,
            'files_modified': files_modified,
            'total_changes': len(self.changes_made)
        }
        
        logger.info(f"Linking complete!")
        logger.info(f"Files processed: {stats['files_processed']}")
        logger.info(f"Files modified: {stats['files_modified']}")
        logger.info(f"Total changes made: {stats['total_changes']}")
        
        if self.changes_made:
            logger.info("Summary of changes:")
            for change in self.changes_made:
                logger.info(f"  - {change}")
        
        return stats

def main():
    """Main function to run the legal documents linker."""
    parser = argparse.ArgumentParser(
        description="Automatically link Privacy Policy and Terms of Service in code files"
    )
    parser.add_argument(
        'project_dir',
        nargs='?',
        default='.',
        help='Path to the project directory (default: current directory)'
    )
    parser.add_argument(
        '--base-url',
        default='',
        help='Base URL for absolute links (optional)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be changed without making actual changes'
    )
    
    args = parser.parse_args()
    
    # Validate project directory
    project_path = Path(args.project_dir).resolve()
    if not project_path.exists():
        logger.error(f"Project directory does not exist: {project_path}")
        return 1
    
    if not project_path.is_dir():
        logger.error(f"Project path is not a directory: {project_path}")
        return 1
    
    # Create and run linker
    linker = LegalDocumentsLinker(str(project_path), args.base_url)
    
    if args.dry_run:
        logger.info("DRY RUN MODE - No files will be modified")
        # TODO: Implement dry run functionality
        return 0
    
    try:
        stats = linker.run()
        
        if stats['files_modified'] > 0:
            logger.info(f"Backup files created in: {linker.backup_dir}")
        
        return 0
        
    except Exception as e:
        logger.error(f"Error running legal documents linker: {str(e)}")
        return 1

if __name__ == "__main__":
    exit(main())

