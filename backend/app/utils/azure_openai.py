"""Utility helpers for calling OpenAI chat completions (supports both regular OpenAI and Azure OpenAI)."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Iterable, Mapping, Sequence, Union

from dotenv import load_dotenv
from openai import AzureOpenAI, OpenAI

ChatMessage = Mapping[str, str]


def _load_env() -> None:
    """Load environment variables from a .env file if present."""

    # ``load_dotenv`` is idempotent, so repeated calls are safe.
    load_dotenv()


def _is_azure_openai() -> bool:
    """Check if we should use Azure OpenAI based on environment variables."""
    _load_env()
    # If AZURE_OPENAI_ENDPOINT is explicitly set, use Azure OpenAI
    if os.getenv("AZURE_OPENAI_ENDPOINT"):
        return True
    # If AZURE_OPENAI_API_KEY is set (but not OPENAI_API_KEY), use Azure OpenAI
    if os.getenv("AZURE_OPENAI_API_KEY") and not os.getenv("OPENAI_API_KEY"):
        return True
    # Otherwise, default to regular OpenAI
    return False


@lru_cache(maxsize=1)
def _get_client() -> Union[AzureOpenAI, OpenAI]:
    """Return a memoized OpenAI client instance (Azure or regular)."""

    _load_env()

    # Support both OPENAI_API_KEY and AZURE_OPENAI_API_KEY for compatibility
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY or AZURE_OPENAI_API_KEY must be set")

    # Check if we should use Azure OpenAI
    if _is_azure_openai():
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT",
                             "https://sorryimissedthis.openai.azure.com/")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

        return AzureOpenAI(
            api_key=api_key,
            api_version=api_version,
            azure_endpoint=endpoint,
        )
    else:
        # Use regular OpenAI
        return OpenAI(api_key=api_key)


def generate_chat_completion(
    messages: Sequence[ChatMessage],
    *,
    deployment: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 256,
) -> str:
    """Generate a chat completion using OpenAI (Azure or regular).

    Args:
        messages: An ordered sequence of chat messages following the OpenAI
            chat API schema (each item must define ``role`` and ``content``).
        deployment: Optional override for the model/deployment name. For Azure OpenAI,
            defaults to ``AZURE_OPENAI_DEPLOYMENT`` or ``gpt-4o-mini``. For regular OpenAI,
            defaults to ``OPENAI_MODEL`` or ``gpt-4o-mini``.
        temperature: Sampling temperature for the model.
        max_tokens: Maximum number of tokens to generate in the reply.

    Returns:
        The content string of the first choice returned by the API.

    Raises:
        RuntimeError: If the OpenAI client is not configured correctly or
            a response cannot be produced.
        openai.OpenAIError: Propagated for API failures.
    """

    if not messages:
        raise ValueError("messages must contain at least one entry")

    client = _get_client()
    is_azure = isinstance(client, AzureOpenAI)

    # Determine model/deployment name
    if is_azure:
        model_name = deployment or os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
    else:
        model_name = deployment or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    response = client.chat.completions.create(
        model=model_name,
        messages=list(messages),
        temperature=temperature,
        max_tokens=max_tokens,
    )

    if not response.choices:
        raise RuntimeError("No choices returned from OpenAI")

    message = response.choices[0].message
    if not message or not message.content:
        raise RuntimeError("OpenAI returned an empty message")

    return message.content


__all__ = ["generate_chat_completion"]
