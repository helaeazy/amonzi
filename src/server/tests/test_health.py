import pytest
from rest_framework.test import APIClient


def test_health_check() -> None:
    response = APIClient().get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "amonzi-server"}


@pytest.mark.django_db
def test_overview_returns_seeded_data() -> None:
    response = APIClient().get("/api/overview/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["stats"]["members"] >= 4
    assert len(payload["featured_listings"]) >= 4
    assert len(payload["top_members"]) >= 2
