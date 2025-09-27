import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from metrics_store import MetricsStore, RequestMetricRecord  # noqa: E402  pylint: disable=wrong-import-position


def test_system_stats_append_prune_and_reload(tmp_path):
    db_path = tmp_path / "metrics.db"
    store = MetricsStore(db_path)

    base_time = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
    old_timestamp = base_time - timedelta(hours=3)
    recent_timestamp = base_time - timedelta(minutes=10)

    store.append_system_stat(old_timestamp, {"cpu": 10})
    store.append_system_stat(recent_timestamp, {"cpu": 20})

    store.prune_system_stats(base_time - timedelta(hours=2))

    results = store.fetch_system_stats_since(base_time - timedelta(hours=4))
    assert len(results) == 1
    assert results[0].stats == {"cpu": 20}
    assert results[0].timestamp == recent_timestamp

    store.close()

    reopened = MetricsStore(db_path)
    try:
        reloaded = reopened.fetch_system_stats_since(base_time - timedelta(hours=4))
        assert len(reloaded) == 1
        assert reloaded[0].stats == {"cpu": 20}
        assert reloaded[0].timestamp == recent_timestamp
    finally:
        reopened.close()


def test_request_metrics_append_prune_and_reload(tmp_path):
    db_path = tmp_path / "request_metrics.db"
    store = MetricsStore(db_path)

    base_time = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
    old_record = RequestMetricRecord(
        timestamp=base_time - timedelta(hours=1),
        duration_ms=250.0,
        is_error=True,
    )
    recent_record = RequestMetricRecord(
        timestamp=base_time - timedelta(minutes=5),
        duration_ms=75.5,
        is_error=False,
    )

    store.append_request_metric(old_record)
    store.append_request_metric(recent_record)

    store.prune_request_metrics(base_time - timedelta(minutes=30))

    results = store.fetch_request_metrics_since(base_time - timedelta(hours=2))
    assert len(results) == 1
    assert results[0].duration_ms == pytest.approx(75.5)
    assert results[0].is_error is False
    assert results[0].timestamp == recent_record.timestamp

    store.close()

    reopened = MetricsStore(db_path)
    try:
        reloaded = reopened.fetch_request_metrics_since(base_time - timedelta(hours=2))
        assert len(reloaded) == 1
        assert reloaded[0].duration_ms == pytest.approx(75.5)
        assert reloaded[0].is_error is False
        assert reloaded[0].timestamp == recent_record.timestamp
    finally:
        reopened.close()
