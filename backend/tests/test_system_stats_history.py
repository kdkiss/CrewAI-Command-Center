import importlib
import sys
from datetime import timedelta


def clear_history(main_module):
    main_module.metrics_store.clear_system_stats()
    with main_module.system_stats_history_lock:
        main_module.system_stats_history.clear()


def test_history_endpoint_returns_recent_samples(api_client):
    client, main_module, _ = api_client

    clear_history(main_module)
    now = main_module._utcnow()

    main_module.add_stats_to_history(
        {"cpu": {"usage": 25, "cores": 4}, "memory": {"percent": 40}},
        timestamp=now - timedelta(minutes=30),
    )
    main_module.add_stats_to_history(
        {"cpu": {"usage": 50, "cores": 4}, "memory": {"percent": 65}},
        timestamp=now - timedelta(minutes=5),
    )

    response = client.get("/api/system/stats/history", params={"window": "1h"})
    assert response.status_code == 200

    payload = response.json()
    assert payload["status"] == "success"
    assert payload["window"] == "1h"
    assert payload["sample_count"] >= 2

    metrics = payload.get("metrics", {})
    assert "cpu.usage" in metrics
    assert "memory.percent" in metrics
    assert metrics["cpu.usage"][-1]["value"] == 50.0
    assert metrics["memory.percent"][-1]["value"] == 65.0


def test_history_endpoint_rejects_invalid_window(api_client):
    client, _, _ = api_client

    response = client.get("/api/system/stats/history", params={"window": "invalid"})
    assert response.status_code == 400
    assert "Unsupported window" in response.json()["detail"]


def test_history_prunes_entries_outside_retention(api_client, monkeypatch):
    client, main_module, _ = api_client

    clear_history(main_module)
    monkeypatch.setattr(main_module, "SYSTEM_STATS_RETENTION_SECONDS", 60)

    now = main_module._utcnow()

    main_module.add_stats_to_history(
        {"cpu": {"usage": 10}, "memory": {"percent": 20}},
        timestamp=now - timedelta(minutes=5),
    )
    main_module.add_stats_to_history(
        {"cpu": {"usage": 35}, "memory": {"percent": 55}},
        timestamp=now,
    )

    with main_module.system_stats_history_lock:
        assert len(main_module.system_stats_history) == 1

    response = client.get("/api/system/stats/history", params={"window": "24h"})
    assert response.status_code == 200

    payload = response.json()
    cpu_samples = payload["metrics"].get("cpu.usage", [])
    assert len(cpu_samples) == 1
    assert cpu_samples[0]["value"] == 35.0


def test_history_persists_across_module_reload(api_client):
    client, main_module, _ = api_client

    clear_history(main_module)
    now = main_module._utcnow()

    main_module.add_stats_to_history(
        {"cpu": {"usage": 42}, "memory": {"percent": 55}},
        timestamp=now - timedelta(minutes=10),
    )

    client.close()

    if "main" in sys.modules:
        del sys.modules["main"]

    reloaded_main = importlib.import_module("main")
    payload = reloaded_main.build_history_payload("24h")

    assert payload["sample_count"] >= 1
    cpu_samples = payload["metrics"].get("cpu.usage", [])
    assert any(sample["value"] == 42.0 for sample in cpu_samples)
