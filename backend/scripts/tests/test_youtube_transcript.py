import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig

from youtube_transcript import build_proxy_config


def test_no_proxy_when_env_is_empty():
    assert build_proxy_config({}) is None
    assert build_proxy_config({"YOUTUBE_PROXY_URL": "  "}) is None


def test_generic_proxy_from_url():
    config = build_proxy_config({"YOUTUBE_PROXY_URL": "http://user:pass@host:8080"})

    assert isinstance(config, GenericProxyConfig)
    assert config.to_requests_dict() == {
        "http": "http://user:pass@host:8080",
        "https": "http://user:pass@host:8080",
    }


def test_webshare_proxy_takes_precedence():
    config = build_proxy_config({
        "WEBSHARE_PROXY_USERNAME": "user",
        "WEBSHARE_PROXY_PASSWORD": "pass",
        "YOUTUBE_PROXY_URL": "http://host:8080",
    })

    assert isinstance(config, WebshareProxyConfig)
