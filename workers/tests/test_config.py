"""Scaffold tests for the workers area: pytest + hypothesis runner check."""

from __future__ import annotations

import pytest
from hypothesis import given, strategies as st

from src.config import load_config, parse_config


def test_load_default_config() -> None:
    # Req 13.4 / 14.5: default config selects local storage and file queue.
    config = load_config()
    assert config.storage.backend == "local"
    assert config.queue.backend == "file"


def test_rejects_unknown_storage_backend() -> None:
    with pytest.raises(ValueError):
        parse_config(
            {
                "storage": {"backend": "s3", "rootDir": "x"},
                "queue": {"backend": "file", "dir": "y"},
            }
        )


@given(st.one_of(st.integers(), st.text(), st.booleans(), st.none()))
def test_rejects_non_object_config(value: object) -> None:
    with pytest.raises(ValueError):
        parse_config(value)
