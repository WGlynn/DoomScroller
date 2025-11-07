"""Utility functions for Skill Seeker CLI tools."""

import os
import sys
import subprocess
import platform
from pathlib import Path
from typing import Optional, List


def open_folder(folder_path: str) -> None:
    """Open a folder in the system file browser."""
    system = platform.system()
    try:
        if system == "Linux":
            subprocess.run(["xdg-open", folder_path], check=True)
        elif system == "Darwin":  # macOS
            subprocess.run(["open", folder_path], check=True)
        elif system == "Windows":
            subprocess.run(["explorer", folder_path], check=True)
        else:
            print(f"Cannot auto-open folder on {system}. Path: {folder_path}")
    except Exception as e:
        print(f"Error opening folder: {e}")


def has_api_key() -> bool:
    """Check if ANTHROPIC_API_KEY is set."""
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def get_api_key() -> Optional[str]:
    """Get the ANTHROPIC_API_KEY from environment."""
    return os.getenv("ANTHROPIC_API_KEY")


def get_upload_url() -> str:
    """Return the Claude skills upload endpoint."""
    return "https://claude.ai/skills/upload"


def print_upload_instructions(skill_path: str) -> None:
    """Display formatted guidance for manual skill uploads."""
    print("\n" + "="*60)
    print("SKILL READY FOR UPLOAD")
    print("="*60)
    print(f"\nSkill location: {skill_path}")
    print(f"\nUpload at: {get_upload_url()}")
    print("\nInstructions:")
    print("1. Go to the URL above")
    print("2. Drag and drop the skill folder or zip file")
    print("3. The skill will be available in Claude")
    print("="*60 + "\n")


def format_file_size(size_bytes: int) -> str:
    """Convert byte values into human-readable formats."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"


def validate_skill_directory(directory: str) -> bool:
    """Verify a directory contains required SKILL.md file."""
    skill_path = Path(directory)
    if not skill_path.exists():
        print(f"Error: Directory does not exist: {directory}")
        return False

    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        print(f"Error: SKILL.md not found in {directory}")
        return False

    return True


def validate_zip_file(file_path: str) -> bool:
    """Check that a file is a valid .zip archive."""
    path = Path(file_path)
    if not path.exists():
        print(f"Error: File does not exist: {file_path}")
        return False

    if path.suffix.lower() != '.zip':
        print(f"Error: File is not a .zip archive: {file_path}")
        return False

    return True


def read_reference_files(skill_dir: str, per_file_limit: int = 10000, total_limit: int = 50000) -> List[dict]:
    """
    Read markdown files from the references/ subdirectory of a skill.

    Args:
        skill_dir: Path to the skill directory
        per_file_limit: Maximum characters per file
        total_limit: Maximum total characters across all files

    Returns:
        List of dicts with 'name' and 'content' keys
    """
    references_dir = Path(skill_dir) / "references"
    if not references_dir.exists():
        return []

    files = []
    total_chars = 0

    for md_file in sorted(references_dir.glob("*.md")):
        if total_chars >= total_limit:
            break

        try:
            content = md_file.read_text(encoding='utf-8')
            if len(content) > per_file_limit:
                content = content[:per_file_limit] + "\n\n[Content truncated...]"

            files.append({
                'name': md_file.name,
                'content': content
            })
            total_chars += len(content)
        except Exception as e:
            print(f"Warning: Could not read {md_file}: {e}")

    return files


def detect_code_language(code: str) -> str:
    """Detect programming language from code snippet."""
    # Simple heuristics for common languages
    if 'def ' in code and ':' in code:
        return 'python'
    elif 'function' in code or 'const ' in code or 'let ' in code:
        return 'javascript'
    elif 'class ' in code and '{' in code:
        if 'public ' in code or 'private ' in code:
            return 'java'
        return 'cpp'
    elif 'func ' in code and '{' in code:
        return 'go'
    elif '<?php' in code:
        return 'php'
    elif 'fn ' in code and '->' in code:
        return 'rust'
    else:
        return 'code'
