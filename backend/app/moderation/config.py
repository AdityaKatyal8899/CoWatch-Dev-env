"""
Moderation configuration and helpers.

Important design notes:
- The prohibited-word list here is a *starting point* for the Tier 2 chat filter,
  not an exhaustive solution. In production it should be externalized (config file
  or admin UI) and paired with context-aware classifiers. Severe profanity is
  included so the filter is demonstrably functional; hate-speech / slur terms
  should be supplied via a protected config source, not hardcoded here.
- We intentionally do NOT build or store any detection data for CSAM / terrorism.
  That detection is delegated to authority-provided hash lists (e.g., NCMEC /
  PhotoDNA) outside this module. This file only handles the *response* logic and
  the chat-abuse filter.
"""

import re
from datetime import date

# Tier 2 — chat abuse / prohibited speech (common profanity to make the filter
# functional). Slurs/hate-speech must be loaded from a protected config in prod.
PROFANITY_TERMS = {
    "badword", "profanity", "explicit", "curse", "swear",
    # TODO: replace placeholders with a curated, config-sourced list (incl. slurs)
    "damn", "hell", "crap",
}

# Chat-moderation thresholds (in-memory state; tune as needed).
CHAT_WARN_THRESHOLD = 3          # violations before a user is muted
CHAT_MUTE_SECONDS = 5 * 60       # mute duration: 5 minutes

# Normalization: lowercase, collapse leetspeak, strip separators used to evade filters.
_LEET_MAP = {
    '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 'b', '7': 't',
    '!': 'i', '@': 's', '$': 'i', '#': 's', '*': 'a',
}
_LEET = str.maketrans(_LEET_MAP)


def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.translate(_LEET)
    # remove whitespace / separators people insert between letters to dodge filters
    text = re.sub(r"[\s\-_.]*", "", text)
    return text


def moderate_message(text: str) -> tuple[bool, str | None]:
    """
    Returns (allowed, reason). If not allowed, `reason` explains the violation so
    the client can surface it to the sender.
    """
    if not text:
        return True, None
    normalized = normalize_text(text)
    for term in PROFANITY_TERMS:
        if term and term in normalized:
            return False, "Prohibited language is not allowed in chat."
    return True, None


def is_age_verified(user) -> bool:
    """
    True only when the user has a verified age >= 18.
    Relies on date_of_birth captured at onboarding + the age_verified flag.
    Guests (no account) are never verified.
    """
    if user is None:
        return False
    if not getattr(user, "age_verified", False):
        return False
    dob = getattr(user, "date_of_birth", None)
    if dob is None:
        return False
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age >= 18
