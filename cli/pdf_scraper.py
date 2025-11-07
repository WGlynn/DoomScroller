#!/usr/bin/env python3
"""PDF scraper for extracting text and images from PDF documents."""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Optional

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Error: PyMuPDF not installed. Run: pip install PyMuPDF")
    sys.exit(1)


class PDFScraper:
    """Extract content from PDF documents."""

    def __init__(self, pdf_path: str):
        """Initialize PDF scraper."""
        self.pdf_path = pdf_path
        self.doc = None
        self.pages_data = []

    def open_pdf(self) -> bool:
        """Open PDF document."""
        try:
            self.doc = fitz.open(self.pdf_path)
            print(f"Opened PDF: {self.pdf_path}")
            print(f"Pages: {len(self.doc)}")
            return True
        except Exception as e:
            print(f"Error opening PDF: {e}")
            return False

    def extract_text(self, page_num: int) -> str:
        """Extract text from a page."""
        try:
            page = self.doc[page_num]
            text = page.get_text()
            return text.strip()
        except Exception as e:
            print(f"Error extracting text from page {page_num}: {e}")
            return ""

    def extract_images(self, page_num: int, output_dir: Path) -> List[str]:
        """Extract images from a page."""
        images = []
        try:
            page = self.doc[page_num]
            image_list = page.get_images()

            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = self.doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]

                # Save image
                image_name = f"page_{page_num + 1}_img_{img_index + 1}.{image_ext}"
                image_path = output_dir / image_name

                with open(image_path, "wb") as img_file:
                    img_file.write(image_bytes)

                images.append(image_name)

        except Exception as e:
            print(f"Error extracting images from page {page_num}: {e}")

        return images

    def get_metadata(self) -> Dict:
        """Get PDF metadata."""
        if not self.doc:
            return {}

        metadata = self.doc.metadata
        return {
            'title': metadata.get('title', 'Unknown'),
            'author': metadata.get('author', 'Unknown'),
            'subject': metadata.get('subject', ''),
            'creator': metadata.get('creator', ''),
            'producer': metadata.get('producer', ''),
            'total_pages': len(self.doc),
        }

    def scrape(self, max_pages: Optional[int] = None) -> List[Dict]:
        """Scrape all pages from PDF."""
        if not self.doc:
            if not self.open_pdf():
                return []

        total_pages = len(self.doc)
        if max_pages:
            total_pages = min(total_pages, max_pages)

        for page_num in range(total_pages):
            print(f"Processing page {page_num + 1}/{total_pages}")

            text = self.extract_text(page_num)

            page_data = {
                'page_number': page_num + 1,
                'text': text,
                'char_count': len(text),
            }

            self.pages_data.append(page_data)

        return self.pages_data

    def save_to_skill(self, output_dir: str, extract_images: bool = False) -> None:
        """Save PDF data as a Claude skill."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Create references directory
        references_dir = output_path / 'references'
        references_dir.mkdir(exist_ok=True)

        # Create images directory if needed
        if extract_images:
            images_dir = output_path / 'images'
            images_dir.mkdir(exist_ok=True)

        # Save PDF content
        pdf_md = references_dir / 'content.md'
        with open(pdf_md, 'w', encoding='utf-8') as f:
            metadata = self.get_metadata()
            f.write(f"# {metadata['title']}\n\n")
            if metadata['author'] != 'Unknown':
                f.write(f"**Author**: {metadata['author']}\n\n")

            f.write(f"## Content\n\n")

            for page_data in self.pages_data:
                f.write(f"### Page {page_data['page_number']}\n\n")
                f.write(f"{page_data['text']}\n\n")

                # Extract images if requested
                if extract_images:
                    images = self.extract_images(page_data['page_number'] - 1, images_dir)
                    if images:
                        f.write("**Images:**\n\n")
                        for img in images:
                            f.write(f"- `images/{img}`\n")
                        f.write("\n")

                f.write("---\n\n")

        # Create SKILL.md
        metadata = self.get_metadata()
        skill_md = output_path / 'SKILL.md'
        with open(skill_md, 'w', encoding='utf-8') as f:
            f.write(f"# {metadata['title']}\n\n")
            f.write(f"PDF document skill\n\n")

            if metadata['author'] != 'Unknown':
                f.write(f"**Author**: {metadata['author']}\n\n")

            f.write(f"**Pages**: {metadata['total_pages']}\n\n")

            if metadata['subject']:
                f.write(f"**Subject**: {metadata['subject']}\n\n")

            f.write(f"## Contents\n\n")
            f.write(f"This skill contains the full text extracted from the PDF document.\n\n")
            f.write(f"See `references/content.md` for the complete content.\n")

        # Save summary
        summary = {
            'title': metadata['title'],
            'author': metadata['author'],
            'total_pages': metadata['total_pages'],
            'pages_processed': len(self.pages_data),
            'total_chars': sum(p['char_count'] for p in self.pages_data),
        }

        summary_file = output_path / 'summary.json'
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        print(f"\nSkill saved to: {output_path}")

    def close(self):
        """Close PDF document."""
        if self.doc:
            self.doc.close()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Extract PDF into Claude skill')
    parser.add_argument('pdf', help='Path to PDF file')
    parser.add_argument('--max-pages', type=int, help='Maximum pages to process')
    parser.add_argument('--extract-images', action='store_true', help='Extract images from PDF')
    parser.add_argument('--output', default='output', help='Output directory')

    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        print(f"Error: PDF file not found: {args.pdf}")
        sys.exit(1)

    # Create scraper
    scraper = PDFScraper(args.pdf)
    scraper.scrape(max_pages=args.max_pages)

    # Save output
    pdf_name = Path(args.pdf).stem
    output_dir = os.path.join(args.output, pdf_name)
    scraper.save_to_skill(output_dir, extract_images=args.extract_images)

    scraper.close()

    print(f"\n✓ PDF skill created successfully!")


if __name__ == '__main__':
    main()
