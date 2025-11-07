#!/usr/bin/env python3
"""Documentation scraper for converting websites into Claude skills."""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse
import re

import requests
from bs4 import BeautifulSoup

from constants import (
    DEFAULT_RATE_LIMIT,
    DEFAULT_MAX_PAGES,
    DEFAULT_CONTENT_SELECTORS,
    USER_AGENT,
    MAX_CODE_BLOCKS_PER_PAGE,
)
from utils import detect_code_language


class DocumentationScraper:
    """Scrape documentation websites and convert to Claude skills."""

    def __init__(self, config: Dict):
        """Initialize scraper with configuration."""
        self.config = config
        self.name = config.get('name', 'skill')
        self.base_url = config.get('url', '')
        self.max_pages = config.get('max_pages', DEFAULT_MAX_PAGES)
        self.rate_limit = config.get('rate_limit', DEFAULT_RATE_LIMIT)
        self.content_selectors = config.get('content_selectors', DEFAULT_CONTENT_SELECTORS)
        self.categories = config.get('categories', {})

        self.visited_urls: Set[str] = set()
        self.pages: List[Dict] = []
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT})

    def normalize_url(self, url: str) -> str:
        """Normalize URL for comparison."""
        # Remove fragment
        url = url.split('#')[0]
        # Remove trailing slash
        url = url.rstrip('/')
        return url

    def is_valid_url(self, url: str) -> bool:
        """Check if URL should be scraped."""
        if not url.startswith(('http://', 'https://')):
            return False

        # Must be within base domain
        base_domain = urlparse(self.base_url).netloc
        url_domain = urlparse(url).netloc
        if url_domain != base_domain:
            return False

        # Check exclude patterns
        exclude_patterns = self.config.get('exclude_patterns', [])
        for pattern in exclude_patterns:
            if re.search(pattern, url):
                return False

        # Check include patterns if specified
        include_patterns = self.config.get('include_patterns', [])
        if include_patterns:
            for pattern in include_patterns:
                if re.search(pattern, url):
                    return True
            return False

        return True

    def extract_content(self, soup: BeautifulSoup) -> str:
        """Extract main content from page."""
        # Try each content selector
        for selector in self.content_selectors:
            content_elem = soup.select_one(selector)
            if content_elem:
                return content_elem.get_text(separator='\n', strip=True)

        # Fallback to body
        body = soup.find('body')
        if body:
            return body.get_text(separator='\n', strip=True)

        return ""

    def extract_code_blocks(self, soup: BeautifulSoup) -> List[Dict]:
        """Extract code blocks from page."""
        code_blocks = []

        # Find all code blocks
        for i, code_elem in enumerate(soup.find_all(['pre', 'code'])):
            if i >= MAX_CODE_BLOCKS_PER_PAGE:
                break

            code = code_elem.get_text(strip=True)
            if len(code) < 10:  # Skip tiny snippets
                continue

            # Detect language
            lang = 'code'
            if code_elem.get('class'):
                classes = ' '.join(code_elem.get('class', []))
                # Look for language-* or lang-* classes
                lang_match = re.search(r'lang(?:uage)?-(\w+)', classes)
                if lang_match:
                    lang = lang_match.group(1)

            if lang == 'code':
                lang = detect_code_language(code)

            code_blocks.append({
                'language': lang,
                'code': code
            })

        return code_blocks

    def categorize_page(self, url: str, title: str, content: str) -> str:
        """Determine page category based on keywords."""
        url_lower = url.lower()
        title_lower = title.lower()
        content_lower = content[:1000].lower()  # First 1000 chars

        best_category = 'general'
        best_score = 0

        for category, keywords in self.categories.items():
            score = 0
            for keyword in keywords:
                keyword_lower = keyword.lower()
                if keyword_lower in url_lower:
                    score += 3
                if keyword_lower in title_lower:
                    score += 2
                if keyword_lower in content_lower:
                    score += 1

            if score > best_score:
                best_score = score
                best_category = category

        return best_category

    def scrape_page(self, url: str) -> Optional[Dict]:
        """Scrape a single page."""
        try:
            print(f"Scraping: {url}")
            response = self.session.get(url, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Extract title
            title = soup.find('title')
            title = title.get_text(strip=True) if title else url

            # Extract content
            content = self.extract_content(soup)

            # Extract code blocks
            code_blocks = self.extract_code_blocks(soup)

            # Categorize
            category = self.categorize_page(url, title, content)

            # Find links
            links = []
            for a in soup.find_all('a', href=True):
                link_url = urljoin(url, a['href'])
                link_url = self.normalize_url(link_url)
                if self.is_valid_url(link_url) and link_url not in self.visited_urls:
                    links.append(link_url)

            page_data = {
                'url': url,
                'title': title,
                'content': content,
                'code_blocks': code_blocks,
                'category': category,
                'links': links
            }

            return page_data

        except Exception as e:
            print(f"Error scraping {url}: {e}")
            return None

    def scrape(self, start_url: Optional[str] = None) -> List[Dict]:
        """Scrape documentation starting from URL."""
        if start_url is None:
            start_url = self.base_url

        start_url = self.normalize_url(start_url)
        to_visit = [start_url]

        while to_visit and len(self.pages) < self.max_pages:
            url = to_visit.pop(0)

            if url in self.visited_urls:
                continue

            self.visited_urls.add(url)

            page_data = self.scrape_page(url)
            if page_data:
                self.pages.append(page_data)

                # Add new links to queue
                for link in page_data['links']:
                    if link not in self.visited_urls and link not in to_visit:
                        to_visit.append(link)

            # Rate limiting
            if self.rate_limit > 0:
                time.sleep(self.rate_limit)

            # Progress update
            if len(self.pages) % 10 == 0:
                print(f"Progress: {len(self.pages)} pages scraped, {len(to_visit)} in queue")

        print(f"\nScraping complete! Total pages: {len(self.pages)}")
        return self.pages

    def save_to_skill(self, output_dir: str) -> None:
        """Save scraped data as a Claude skill."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Create references directory
        references_dir = output_path / 'references'
        references_dir.mkdir(exist_ok=True)

        # Group pages by category
        categories = {}
        for page in self.pages:
            category = page['category']
            if category not in categories:
                categories[category] = []
            categories[category].append(page)

        # Save reference files by category
        for category, pages in categories.items():
            ref_file = references_dir / f"{category}.md"
            with open(ref_file, 'w', encoding='utf-8') as f:
                f.write(f"# {category.replace('_', ' ').title()}\n\n")

                for page in pages:
                    f.write(f"## {page['title']}\n\n")
                    f.write(f"Source: {page['url']}\n\n")
                    f.write(f"{page['content'][:2000]}\n\n")  # Limit content

                    if page['code_blocks']:
                        f.write("### Code Examples\n\n")
                        for cb in page['code_blocks'][:3]:  # Max 3 per page
                            f.write(f"```{cb['language']}\n{cb['code'][:500]}\n```\n\n")

                    f.write("---\n\n")

        # Create SKILL.md
        skill_md = output_path / 'SKILL.md'
        with open(skill_md, 'w', encoding='utf-8') as f:
            f.write(f"# {self.name}\n\n")
            f.write(f"Documentation skill for {self.name}\n\n")
            f.write(f"Source: {self.base_url}\n\n")
            f.write(f"Total pages: {len(self.pages)}\n\n")
            f.write(f"## Categories\n\n")

            for category, pages in categories.items():
                f.write(f"- **{category}**: {len(pages)} pages\n")

            f.write(f"\n## Quick Reference\n\n")
            f.write("See the `references/` directory for detailed documentation.\n")

        # Save summary
        summary = {
            'name': self.name,
            'base_url': self.base_url,
            'total_pages': len(self.pages),
            'categories': {cat: len(pages) for cat, pages in categories.items()}
        }

        summary_file = output_path / 'summary.json'
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        print(f"\nSkill saved to: {output_path}")
        print(f"- SKILL.md: Main skill file")
        print(f"- references/: {len(categories)} category files")
        print(f"- summary.json: Metadata")


def load_config(config_path: str) -> Dict:
    """Load configuration from JSON file."""
    with open(config_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def interactive_config() -> Dict:
    """Create configuration interactively."""
    print("\n=== Interactive Configuration ===\n")

    name = input("Skill name: ").strip()
    url = input("Documentation URL: ").strip()
    max_pages = input("Max pages to scrape (default 100): ").strip()
    max_pages = int(max_pages) if max_pages else 100

    return {
        'name': name,
        'url': url,
        'max_pages': max_pages,
        'categories': {
            'guides': ['guide', 'tutorial', 'getting started'],
            'api': ['api', 'reference', 'method', 'function'],
            'examples': ['example', 'demo', 'sample'],
        }
    }


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Scrape documentation into Claude skills')
    parser.add_argument('--config', help='Path to config JSON file')
    parser.add_argument('--interactive', action='store_true', help='Interactive configuration')
    parser.add_argument('--name', help='Skill name')
    parser.add_argument('--url', help='Documentation URL')
    parser.add_argument('--max-pages', type=int, default=100, help='Maximum pages to scrape')
    parser.add_argument('--output', default='output', help='Output directory')

    args = parser.parse_args()

    # Load configuration
    if args.config:
        config = load_config(args.config)
    elif args.interactive:
        config = interactive_config()
    elif args.name and args.url:
        config = {
            'name': args.name,
            'url': args.url,
            'max_pages': args.max_pages,
            'categories': {
                'guides': ['guide', 'tutorial', 'getting started'],
                'api': ['api', 'reference', 'method', 'function'],
                'examples': ['example', 'demo', 'sample'],
            }
        }
    else:
        print("Error: Must provide --config, --interactive, or --name and --url")
        sys.exit(1)

    # Create scraper and run
    scraper = DocumentationScraper(config)
    scraper.scrape()

    # Save output
    output_dir = os.path.join(args.output, config['name'])
    scraper.save_to_skill(output_dir)

    print(f"\n✓ Skill created successfully!")
    print(f"  Location: {output_dir}")


if __name__ == '__main__':
    main()
