#!/usr/bin/env python3
"""GitHub repository scraper for extracting code and documentation."""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Optional
import re

try:
    from github import Github, GithubException
except ImportError:
    print("Error: PyGithub not installed. Run: pip install PyGithub")
    sys.exit(1)


class GitHubScraper:
    """Scrape GitHub repositories for code analysis."""

    def __init__(self, repo_name: str, token: Optional[str] = None):
        """Initialize GitHub scraper."""
        self.repo_name = repo_name
        self.token = token or os.getenv('GITHUB_TOKEN')

        if self.token:
            self.github = Github(self.token)
        else:
            self.github = Github()  # Anonymous access (rate limited)

        try:
            self.repo = self.github.get_repo(repo_name)
        except GithubException as e:
            print(f"Error accessing repository: {e}")
            sys.exit(1)

        self.files_data = []
        self.api_data = []

    def get_repo_info(self) -> Dict:
        """Get basic repository information."""
        return {
            'name': self.repo.full_name,
            'description': self.repo.description,
            'stars': self.repo.stargazers_count,
            'forks': self.repo.forks_count,
            'language': self.repo.language,
            'url': self.repo.html_url,
            'topics': self.repo.get_topics(),
        }

    def get_readme(self) -> str:
        """Get README content."""
        try:
            readme = self.repo.get_readme()
            return readme.decoded_content.decode('utf-8')
        except:
            return ""

    def extract_functions_python(self, content: str) -> List[Dict]:
        """Extract Python function definitions."""
        functions = []

        # Find function definitions
        pattern = r'^\s*def\s+(\w+)\s*\((.*?)\):'
        for match in re.finditer(pattern, content, re.MULTILINE):
            name = match.group(1)
            params = match.group(2)

            functions.append({
                'name': name,
                'params': params,
                'language': 'python'
            })

        return functions

    def extract_functions_javascript(self, content: str) -> List[Dict]:
        """Extract JavaScript function definitions."""
        functions = []

        # Function declarations
        pattern1 = r'function\s+(\w+)\s*\((.*?)\)'
        for match in re.finditer(pattern1, content):
            functions.append({
                'name': match.group(1),
                'params': match.group(2),
                'language': 'javascript'
            })

        # Arrow functions
        pattern2 = r'const\s+(\w+)\s*=\s*\((.*?)\)\s*=>'
        for match in re.finditer(pattern2, content):
            functions.append({
                'name': match.group(1),
                'params': match.group(2),
                'language': 'javascript'
            })

        return functions

    def extract_api_info(self, file_path: str, content: str) -> List[Dict]:
        """Extract API information from source code."""
        extension = Path(file_path).suffix

        if extension == '.py':
            return self.extract_functions_python(content)
        elif extension in ['.js', '.jsx', '.ts', '.tsx']:
            return self.extract_functions_javascript(content)
        else:
            return []

    def scrape_files(self, path: str = "", max_files: int = 100) -> None:
        """Scrape files from repository."""
        try:
            contents = self.repo.get_contents(path)

            while contents:
                file_content = contents.pop(0)

                if file_content.type == "dir":
                    # Add directory contents to queue
                    contents.extend(self.repo.get_contents(file_content.path))
                else:
                    # Process file
                    if len(self.files_data) >= max_files:
                        break

                    # Only process code files
                    extensions = ['.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.go', '.rs', '.cpp', '.c', '.h']
                    if any(file_content.path.endswith(ext) for ext in extensions):
                        try:
                            content = file_content.decoded_content.decode('utf-8')

                            # Extract API info
                            api_info = self.extract_api_info(file_content.path, content)
                            if api_info:
                                self.api_data.extend(api_info)

                            self.files_data.append({
                                'path': file_content.path,
                                'size': file_content.size,
                                'content': content[:5000]  # Limit content
                            })

                            print(f"Processed: {file_content.path}")

                        except Exception as e:
                            print(f"Error reading {file_content.path}: {e}")

        except GithubException as e:
            print(f"Error accessing repository contents: {e}")

    def get_issues(self, max_issues: int = 20) -> List[Dict]:
        """Get recent issues."""
        issues = []
        try:
            for issue in self.repo.get_issues(state='all')[:max_issues]:
                issues.append({
                    'number': issue.number,
                    'title': issue.title,
                    'state': issue.state,
                    'labels': [label.name for label in issue.labels],
                    'created_at': issue.created_at.isoformat(),
                })
        except Exception as e:
            print(f"Error fetching issues: {e}")

        return issues

    def save_to_skill(self, output_dir: str) -> None:
        """Save GitHub data as a Claude skill."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Create references directory
        references_dir = output_path / 'references'
        references_dir.mkdir(exist_ok=True)

        # Save README
        readme = self.get_readme()
        if readme:
            readme_file = references_dir / 'README.md'
            with open(readme_file, 'w', encoding='utf-8') as f:
                f.write(readme)

        # Save API reference
        if self.api_data:
            api_file = references_dir / 'api.md'
            with open(api_file, 'w', encoding='utf-8') as f:
                f.write(f"# API Reference\n\n")

                # Group by language
                by_lang = {}
                for api in self.api_data:
                    lang = api['language']
                    if lang not in by_lang:
                        by_lang[lang] = []
                    by_lang[lang].append(api)

                for lang, funcs in by_lang.items():
                    f.write(f"## {lang.title()}\n\n")
                    for func in funcs:
                        f.write(f"### `{func['name']}({func['params']})`\n\n")

        # Save repository info
        repo_info = self.get_repo_info()
        info_file = references_dir / 'repository_info.md'
        with open(info_file, 'w', encoding='utf-8') as f:
            f.write(f"# {repo_info['name']}\n\n")
            f.write(f"{repo_info['description']}\n\n")
            f.write(f"- **Language**: {repo_info['language']}\n")
            f.write(f"- **Stars**: {repo_info['stars']}\n")
            f.write(f"- **Forks**: {repo_info['forks']}\n")
            f.write(f"- **URL**: {repo_info['url']}\n\n")

            if repo_info['topics']:
                f.write(f"**Topics**: {', '.join(repo_info['topics'])}\n\n")

        # Save issues
        issues = self.get_issues()
        if issues:
            issues_file = references_dir / 'issues.md'
            with open(issues_file, 'w', encoding='utf-8') as f:
                f.write("# Recent Issues\n\n")
                for issue in issues:
                    f.write(f"## #{issue['number']}: {issue['title']}\n\n")
                    f.write(f"- **State**: {issue['state']}\n")
                    if issue['labels']:
                        f.write(f"- **Labels**: {', '.join(issue['labels'])}\n")
                    f.write(f"- **Created**: {issue['created_at']}\n\n")

        # Create SKILL.md
        skill_md = output_path / 'SKILL.md'
        with open(skill_md, 'w', encoding='utf-8') as f:
            f.write(f"# {repo_info['name']}\n\n")
            f.write(f"{repo_info['description']}\n\n")
            f.write(f"GitHub repository skill\n\n")
            f.write(f"## Contents\n\n")
            f.write(f"- Repository information\n")
            f.write(f"- README documentation\n")
            f.write(f"- API reference ({len(self.api_data)} functions)\n")
            f.write(f"- Recent issues ({len(issues)})\n")
            f.write(f"- Source files ({len(self.files_data)})\n\n")

        # Save summary
        summary = {
            'repository': repo_info['name'],
            'files_processed': len(self.files_data),
            'api_functions': len(self.api_data),
            'issues': len(issues),
        }

        summary_file = output_path / 'summary.json'
        with open(summary_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        print(f"\nSkill saved to: {output_path}")


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Scrape GitHub repository into Claude skill')
    parser.add_argument('repo', help='Repository name (owner/repo)')
    parser.add_argument('--token', help='GitHub token (or use GITHUB_TOKEN env var)')
    parser.add_argument('--max-files', type=int, default=100, help='Maximum files to process')
    parser.add_argument('--output', default='output', help='Output directory')

    args = parser.parse_args()

    # Create scraper
    scraper = GitHubScraper(args.repo, args.token)

    print(f"Scraping repository: {args.repo}")
    scraper.scrape_files(max_files=args.max_files)

    # Save output
    repo_name = args.repo.replace('/', '_')
    output_dir = os.path.join(args.output, repo_name)
    scraper.save_to_skill(output_dir)

    print(f"\n✓ GitHub skill created successfully!")


if __name__ == '__main__':
    main()
