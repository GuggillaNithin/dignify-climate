"""Tests for system health and root metadata endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_metadata_endpoint():
    """Verify that root endpoint returns service metadata and Open-Meteo attribution."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["project"] == "Dygnify"
    assert "version" in data
    assert "attribution" in data
    assert "Open-Meteo" in data["attribution"]
    assert data["health_check"] == "/api/v1/health"


def test_api_v1_health_endpoint():
    """Verify that /api/v1/health returns healthy status and service subcomponents."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["project"] == "Dygnify"
    assert data["uptime_seconds"] >= 0
    assert "services" in data
    assert data["services"]["api"] == "healthy"
    assert "database" in data["services"]
    assert "weather_provider" in data["services"]


def test_top_level_health_shortcut():
    """Verify that /health shortcut for cloud platforms returns 200."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_structured_error_on_nonexistent_route():
    """Verify that 404 returns structured ErrorResponse without leaking internals."""
    response = client.get("/api/v1/nonexistent-route")
    assert response.status_code == 404
    data = response.json()
    assert data["error"] == "HTTP_ERROR"
    assert data["status_code"] == 404
    assert "timestamp" in data
