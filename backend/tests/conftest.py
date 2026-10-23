import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app  # noqa: E402


@pytest.fixture
def app(tmp_path):
    return create_app({"DATABASE": str(tmp_path / "test.db"), "SECRET_KEY": "test", "TESTING": True})


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def eingeloggt(client):
    r = client.post("/api/registrieren", json={"name": "anna", "passwort": "geheim123"})
    assert r.status_code == 201
    return client
