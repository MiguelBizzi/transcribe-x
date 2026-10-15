import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from text_processor import maybe_spellcheck


class _CountingChecker:
    """Stand-in for pyspellchecker that records every correction lookup."""

    calls: list = []

    def __init__(self, language="en"):
        pass

    def __contains__(self, word):
        return word in {"the", "was", "very", "big"}

    def correction(self, word):
        type(self).calls.append(word)
        return word


def _install_fake_spellchecker(monkeypatch):
    _CountingChecker.calls = []
    module = types.ModuleType("spellchecker")
    module.SpellChecker = _CountingChecker
    monkeypatch.setitem(sys.modules, "spellchecker", module)


def test_spellcheck_looks_up_each_unknown_word_once(monkeypatch):
    _install_fake_spellchecker(monkeypatch)
    text = " ".join(["the quilombo was very big quilombo Quilombo"] * 20)

    maybe_spellcheck(text, "en", True)

    assert sorted(_CountingChecker.calls) == ["quilombo"]


def test_spellcheck_cache_does_not_change_output(monkeypatch):
    _install_fake_spellchecker(monkeypatch)
    text = "The quilombo was very big. Quilombo grew."

    assert maybe_spellcheck(text, "en", True) == text
