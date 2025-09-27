import time
from types import SimpleNamespace

import sys
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main  # noqa: E402  pylint: disable=wrong-import-position


@pytest.mark.asyncio
async def test_system_stats_handler_returns_quickly(mocker):
    """System stats endpoint should avoid blocking on CPU usage collection."""

    def fake_cpu_percent(*, interval=None):
        if interval is not None:
            raise AssertionError("cpu_percent should be called without blocking interval")
        return 12.3

    mocker.patch("main.psutil.cpu_percent", side_effect=fake_cpu_percent)
    mocker.patch("main.psutil.cpu_count", return_value=8)
    mocker.patch("main.psutil.cpu_freq", return_value=SimpleNamespace(current=2400000.0))
    mocker.patch(
        "main.psutil.virtual_memory",
        return_value=SimpleNamespace(
            used=4 * 1024 ** 3,
            total=8 * 1024 ** 3,
            percent=50.0,
            available=4 * 1024 ** 3,
        ),
    )
    mocker.patch(
        "main.psutil.swap_memory",
        return_value=SimpleNamespace(
            used=1024 ** 3,
            total=2 * 1024 ** 3,
        ),
    )
    boot_time = time.time() - 123
    mocker.patch("main.psutil.boot_time", return_value=boot_time)
    mocker.patch("main.platform.processor", return_value="Test CPU")
    mocker.patch("main.platform.system", return_value="TestOS")
    mocker.patch("main.platform.release", return_value="1.0")
    mocker.patch("main.platform.version", return_value="1.0.0")
    mocker.patch("main.platform.python_version", return_value="3.x")

    # Avoid touching the real metrics store during the test.
    mocker.patch.object(main.metrics_store, "append_system_stat")
    mocker.patch.object(main.metrics_store, "prune_system_stats")

    transport = ASGITransport(app=main.app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Warm up the endpoint to avoid startup costs skewing the measurement.
        warmup_response = await client.get("/api/system/stats")
        assert warmup_response.status_code == 200

        start = time.perf_counter()
        response = await client.get("/api/system/stats")
        duration_ms = (time.perf_counter() - start) * 1000

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert duration_ms < 100, f"Request took too long: {duration_ms:.2f}ms"
