"""Utility helpers for calling Azure OpenAI chat completions."""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Iterable, Mapping, Sequence

from dotenv import load_dotenv
from openai import AzureOpenAI

ChatMessage = Mapping[str, str]


def _load_env() -> None:
    """Load environment variables from a .env file if present."""

    # ``load_dotenv`` is idempotent, so repeated calls are safe.
    load_dotenv()


@lru_cache(maxsize=1)
def _get_client() -> AzureOpenAI:
    """Return a memoized AzureOpenAI client instance."""

    _load_env()

    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("AZURE_OPENAI_API_KEY is not set")

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT",
                         "https://sorryimissedthis.openai.azure.com/")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

    return AzureOpenAI(
        api_key=api_key,
        api_version=api_version,
        azure_endpoint=endpoint,
    )


def generate_chat_completion(
    messages: Sequence[ChatMessage],
    *,
    deployment: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 256,
) -> str:
    """Generate a chat completion using Azure OpenAI.

    Args:
        messages: An ordered sequence of chat messages following the OpenAI
            chat API schema (each item must define ``role`` and ``content``).
        deployment: Optional override for the Azure deployment name. Defaults to
            ``AZURE_OPENAI_DEPLOYMENT`` or ``gpt-4o-mini`` when unset.
        temperature: Sampling temperature for the model.
        max_tokens: Maximum number of tokens to generate in the reply.

    Returns:
        The content string of the first choice returned by the API.

    Raises:
        RuntimeError: If the Azure OpenAI client is not configured correctly or
            a response cannot be produced.
        openai.OpenAIError: Propagated for API failures.
    """

    if not messages:
        raise ValueError("messages must contain at least one entry")

    client = _get_client()

    deployment_name = deployment or os.getenv(
        "AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")

    response = client.chat.completions.create(
        model=deployment_name,
        messages=list(messages),
        temperature=temperature,
        max_tokens=max_tokens,
    )

    if not response.choices:
        raise RuntimeError("No choices returned from Azure OpenAI")

    message = response.choices[0].message
    if not message or not message.content:
        raise RuntimeError("Azure OpenAI returned an empty message")

    return message.content


__all__ = ["generate_chat_completion"]
