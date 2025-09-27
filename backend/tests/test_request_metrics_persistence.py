import importlib
import sys
from datetime import timedelta


def clear_request_metrics(main_module):
    main_module.metrics_store.clear_request_metrics()
    main_module._reload_metrics_from_persistence()


def test_request_metrics_persist_across_module_reload(api_client):
    client, main_module, _ = api_client

    clear_request_metrics(main_module)

    now = main_module._utcnow()
    old_timestamp = now - timedelta(seconds=main_module.REQUEST_METRICS_WINDOW_SECONDS + 5)
    main_module._record_request_metric(50.0, False, timestamp=old_timestamp)
    main_module._record_request_metric(100.0, False, timestamp=now - timedelta(seconds=30))
    main_module._record_request_metric(200.0, True, timestamp=now - timedelta(seconds=5))

    summary_before = main_module.get_request_metrics()
    assert summary_before["latency"]["sampleSize"] == 2

    client.close()

    if "main" in sys.modules:
        del sys.modules["main"]

    reloaded_main = importlib.import_module("main")
    summary_after = reloaded_main.get_request_metrics()

    assert summary_after["latency"]["sampleSize"] == 2
    assert summary_after["latency"]["averageMs"] == 150.0
    assert summary_after["errorRate"]["requests"] == 2
    assert summary_after["errorRate"]["errors"] == 1
    assert summary_after["errorRate"]["ratio"] == 0.5
