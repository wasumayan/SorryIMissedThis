#!/usr/bin/env python3
"""
Integration smoke tests for the Sorry I Missed This Flask API.

Usage:
    python backend/scripts/test_endpoints.py [optional_path_to_zip]

Environment overrides:
    SIMT_BASE_URL        Base URL for the backend (default: http://localhost:5002)
    SIMT_API_PREFIX      API prefix (default: /api)
    SIMT_TEST_USER_ID    User id to associate with uploads (default: test_user_123)
"""

from __future__ import annotations

import os
import sys
from typing import Any, Dict, List

import requests


# Configuration -----------------------------------------------------------------

BASE_URL = os.environ.get("SIMT_BASE_URL", "http://localhost:5002").rstrip("/")
API_PREFIX = os.environ.get("SIMT_API_PREFIX", "/api").strip()

RECOMMENDATIONS_ENDPOINT = f"{BASE_URL}{API_PREFIX}/recommendations"

TEST_USER_ID = os.environ.get("SIMT_TEST_USER_ID", "Bob")


# Helpers ------------------------------------------------------------------------

def _print_message_history(messages: List[Dict[str, Any]]) -> None:
    if not messages:
        print("  Message history: (none recorded)")
        return

    print("  Message history:")
    for message in messages:
        timestamp = message.get("timestamp", "unknown time")
        sender = message.get("sender", "Unknown")
        content = message.get("content") or message.get("text") or ""
        print(f"    {timestamp} | {sender}: {content}")


def _print_prompts(prompts: List[Dict[str, Any]]) -> None:
    if not prompts:
        print("  Conversation prompts: (none available)")
        return

    print("  Conversation prompts:")
    for index, prompt in enumerate(prompts, start=1):
        text = prompt.get("text") or prompt.get("prompt_text") or ""
        prompt_type = prompt.get("type") or prompt.get("prompt_type") or ""
        print(f"    {index}. {text} ({prompt_type})")


def show_recommendations() -> bool:
    try:
        print("PRINT 1: Making GET request to recommendations endpoint")
        response = requests.get(
            RECOMMENDATIONS_ENDPOINT,
            params={"user_id": TEST_USER_ID, "regenerate": "true"},
            timeout=15,
        )
        print("PRINT 2: Received response from recommendations endpoint")

        if response.status_code != 200:
            print(
                f"Request failed with status {response.status_code}: {response.text}"
            )
            return False

        payload = response.json()
        conversations = payload.get("conversations", [])

        user_id = payload.get("user_id", TEST_USER_ID)
        print(f"User: {user_id}")
        print(f"Total conversations returned: {len(conversations)}\n")

        for index, conversation in enumerate(conversations, start=1):
            partner = conversation.get("partner_name", "Unknown")
            metrics = conversation.get("metrics", {}) or {}
            messages = conversation.get("messages", []) or []
            prompts = conversation.get("prompts", []) or []

            print(f"Conversation {index}")
            print(f"  Chat with: {partner}")
            print(
                f"  Total messages: {metrics.get('total_messages') if isinstance(metrics, dict) else 'n/a'}"
            )
            print(
                f"  Days since contact: {metrics.get('days_since_contact') if isinstance(metrics, dict) else 'n/a'}"
            )

            _print_message_history(messages)
            _print_prompts(prompts)
            print("")

        return True

    except requests.exceptions.RequestException as exc:
        print(f"Error contacting API: {exc}")
        return False


# Main ----------------------------------------------------------------------------

def main() -> int:
    print(f"Fetching recommendations from {RECOMMENDATIONS_ENDPOINT}\n")
    success = show_recommendations()
    return 0 if success else 1


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    sys.exit(main())
