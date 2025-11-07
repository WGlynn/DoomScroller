"""Configuration constants for Skill Seeker CLI tools."""

# Scraping settings
DEFAULT_RATE_LIMIT = 0.5  # seconds between requests
DEFAULT_MAX_PAGES = 500
CHECKPOINT_INTERVAL = 1000  # pages between checkpoints
PREVIEW_LENGTH = 500  # chars for categorization preview

# Scoring thresholds
MIN_CATEGORY_SCORE = 2
URL_MATCH_SCORE = 3
TITLE_MATCH_SCORE = 2
CONTENT_MATCH_SCORE = 1

# Enhancement limits
API_CONTENT_LIMIT = 100_000  # chars for API-based enhancement
LOCAL_CONTENT_LIMIT = 50_000  # chars for local enhancement
API_PREVIEW_LIMIT = 40_000  # chars for API preview
LOCAL_PREVIEW_LIMIT = 20_000  # chars for local preview

# Output limits
MAX_REFERENCE_FILES = 100
MAX_CODE_BLOCKS_PER_PAGE = 5

# Default selectors for common documentation sites
DEFAULT_CONTENT_SELECTORS = [
    "article",
    "main",
    ".content",
    ".documentation",
    ".markdown-body",
    "#content",
]

# User agent for web scraping
USER_AGENT = "Mozilla/5.0 (compatible; SkillSeeker/2.0; +https://github.com/skill-seeker)"

__all__ = [
    "DEFAULT_RATE_LIMIT",
    "DEFAULT_MAX_PAGES",
    "CHECKPOINT_INTERVAL",
    "PREVIEW_LENGTH",
    "MIN_CATEGORY_SCORE",
    "URL_MATCH_SCORE",
    "TITLE_MATCH_SCORE",
    "CONTENT_MATCH_SCORE",
    "API_CONTENT_LIMIT",
    "LOCAL_CONTENT_LIMIT",
    "API_PREVIEW_LIMIT",
    "LOCAL_PREVIEW_LIMIT",
    "MAX_REFERENCE_FILES",
    "MAX_CODE_BLOCKS_PER_PAGE",
    "DEFAULT_CONTENT_SELECTORS",
    "USER_AGENT",
]
