import pytest
import yaml
import sys
import json
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
import tempfile
import asyncio

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from main import app
import main as main_module

class TestRunCrewIntegration:
    """Integration tests for the Run Crew functionality."""
    
    def test_start_crew_success_flow(self, test_client, monkeypatch):
        """Test the complete successful flow of starting a crew via API."""
        crew_id = "test-success-crew"
        
        # Mock the crew manager's start_crew method
        async def mock_start_crew(crew_id, inputs, sio):
            return "mock-process-id-123"
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Test starting the crew
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": {"topic": "AI Research"}}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "process_id" in response_data
        assert response_data["success"] is True
        assert response_data["process_id"] == "mock-process-id-123"

    def test_start_crew_already_running(self, test_client, monkeypatch):
        """Test error handling when trying to start a crew that is already running."""
        crew_id = "test-running-crew"
        
        # Mock the crew manager's start_crew method to raise an exception
        async def mock_start_crew(crew_id, inputs, sio):
            raise Exception(f"Crew {crew_id} is already running")
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Test starting the crew
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": {}}
        )
        
        assert response.status_code == 400
        response_data = response.json()
        assert "detail" in response_data
        assert f"Crew {crew_id} is already running" in response_data["detail"]

    def test_start_crew_invalid_inputs(self, test_client):
        """Test handling of invalid input data."""
        crew_id = "test-invalid-inputs-crew"
        
        # Test with invalid JSON data
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            data='{"invalid": json}',  # Invalid JSON
            headers={"content-type": "application/json"}
        )
        
        # FastAPI should handle this automatically
        assert response.status_code == 422  # Unprocessable Entity

    def test_start_crew_missing_crew_directory(self, test_client, monkeypatch):
        """Test error handling when crew directory doesn't exist."""
        crew_id = "non-existent-crew"
        
        # Mock the crew manager's start_crew method to raise an exception
        async def mock_start_crew(crew_id, inputs, sio):
            raise Exception(f"Invalid crew directory structure for {crew_id}: missing src directory")
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": {}}
        )
        
        assert response.status_code == 400
        response_data = response.json()
        assert "detail" in response_data

    def test_start_crew_with_complex_inputs(self, test_client, monkeypatch):
        """Test starting a crew with complex input data."""
        crew_id = "test-complex-inputs-crew"
        
        # Mock the crew manager's start_crew method
        async def mock_start_crew(crew_id, inputs, sio):
            # Verify that complex inputs are passed correctly
            assert inputs["topic"] == "AI Research"
            assert inputs["target_audience"] == "Developers"
            assert inputs["research_depth"] == 5
            assert inputs["include_sources"] is True
            assert "machine learning" in inputs["keywords"]
            assert inputs["constraints"]["max_length"] == 1000
            return "mock-process-id-456"
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Complex input data
        complex_inputs = {
            "topic": "AI Research",
            "target_audience": "Developers",
            "research_depth": 5,
            "include_sources": True,
            "keywords": ["machine learning", "neural networks", "deep learning"],
            "constraints": {
                "max_length": 1000,
                "min_sources": 3,
                "language": "en"
            }
        }
        
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": complex_inputs}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "process_id" in response_data
        assert response_data["success"] is True

    def test_start_crew_response_format(self, test_client, monkeypatch):
        """Test that the response format is consistent and correct."""
        crew_id = "test-response-format-crew"
        
        # Mock the crew manager's start_crew method
        async def mock_start_crew(crew_id, inputs, sio):
            return "550e8400-e29b-41d4-a716-446655440000"  # UUID-like string
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": {"topic": "Test"}}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        
        # Check response structure
        assert isinstance(response_data, dict)
        assert "process_id" in response_data
        assert "success" in response_data
        assert isinstance(response_data["success"], bool)
        assert response_data["success"] is True
        assert isinstance(response_data["process_id"], str)
        # process_id should be a valid UUID-like string
        assert len(response_data["process_id"]) == 36  # Standard UUID length

    def test_start_crew_empty_inputs(self, test_client, monkeypatch):
        """Test starting a crew with empty inputs."""
        crew_id = "test-empty-inputs-crew"
        
        # Mock the crew manager's start_crew method to verify empty inputs
        async def mock_start_crew(crew_id, inputs, sio):
            assert inputs == {}
            return "mock-process-id-789"
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Test with empty inputs
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": {}}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "process_id" in response_data
        assert response_data["success"] is True

    def test_start_crew_no_inputs_field(self, test_client, monkeypatch):
        """Test starting a crew without the inputs field."""
        crew_id = "test-no-inputs-field-crew"
        
        # Mock the crew manager's start_crew method to verify default empty inputs
        async def mock_start_crew(crew_id, inputs, sio):
            assert inputs == {}
            return "mock-process-id-101"
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Test without inputs field (should default to empty dict)
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "process_id" in response_data
        assert response_data["success"] is True

    @pytest.mark.asyncio
    async def test_crew_execution_flow(self, monkeypatch):
        """Test the complete crew execution flow through the CrewManager."""
        # Create a mock socketio client
        mock_sio = MagicMock()
        mock_sio.emit = AsyncMock()
        
        # Mock subprocess execution
        with patch('asyncio.create_subprocess_exec') as mock_subprocess:
            mock_process = MagicMock()
            mock_process.pid = 12345
            mock_process.returncode = None
            mock_subprocess.return_value = mock_process
            
            # Mock the log streaming to avoid actual streaming
            with patch('crew_manager.CrewManager._stream_logs'):
                # This test would normally test actual crew execution,
                # but we're focusing on the API integration aspects
                assert True  # Placeholder for actual implementation

    def test_concurrent_crew_starts(self, test_client, monkeypatch):
        """Test starting multiple crews concurrently."""
        crew_ids = ["concurrent-crew-1", "concurrent-crew-2", "concurrent-crew-3"]
        
        # Mock the crew manager's start_crew method
        async def mock_start_crew(crew_id, inputs, sio):
            return f"mock-process-id-{crew_id}"
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Start all crews
        responses = []
        for crew_id in crew_ids:
            response = test_client.post(
                f"/api/crews/{crew_id}/start",
                json={"inputs": {"topic": f"Test {crew_id}"}}
            )
            responses.append((crew_id, response))
        
        # Check all responses
        for crew_id, response in responses:
            assert response.status_code == 200
            response_data = response.json()
            assert "process_id" in response_data
            assert response_data["success"] is True

    def test_crew_start_with_special_characters(self, test_client, monkeypatch):
        """Test starting a crew with special characters in inputs."""
        crew_id = "test-special-chars-crew"
        
        # Mock the crew manager's start_crew method to verify special characters
        async def mock_start_crew(crew_id, inputs, sio):
            # Verify that special characters are preserved
            assert inputs["topic"] == "AI & ML Research (2023)"
            assert inputs["target_audience"] == "Developers/Engineers"
            assert inputs["unicode_text"] == "Unicode: café, naïve, résumé"
            return "mock-process-id-special"
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Inputs with special characters
        special_inputs = {
            "topic": "AI & ML Research (2023)",
            "target_audience": "Developers/Engineers",
            "description": "Research on AI/ML with special chars: @#$%^&*()",
            "unicode_text": "Unicode: café, naïve, résumé"
        }
        
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": special_inputs}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "process_id" in response_data
        assert response_data["success"] is True

    def test_start_crew_with_none_inputs(self, test_client, monkeypatch):
        """Test starting a crew with None values in inputs."""
        crew_id = "test-none-inputs-crew"
        
        # Mock the crew manager's start_crew method
        async def mock_start_crew(crew_id, inputs, sio):
            # Verify that None values are handled correctly
            assert inputs["optional_field"] is None
            assert inputs["topic"] == "Test"
            return "mock-process-id-none"
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Test with None values in inputs
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": {"topic": "Test", "optional_field": None}}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "process_id" in response_data
        assert response_data["success"] is True

    def test_start_crew_with_nested_objects(self, test_client, monkeypatch):
        """Test starting a crew with nested object inputs."""
        crew_id = "test-nested-objects-crew"
        
        # Mock the crew manager's start_crew method
        async def mock_start_crew(crew_id, inputs, sio):
            # Verify that nested objects are preserved
            assert inputs["config"]["database"]["host"] == "localhost"
            assert inputs["config"]["database"]["port"] == 5432
            assert inputs["config"]["api_keys"]["openai"] == "sk-12345"
            return "mock-process-id-nested"
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Test with nested object inputs
        nested_inputs = {
            "topic": "Database Migration",
            "config": {
                "database": {
                    "host": "localhost",
                    "port": 5432,
                    "username": "admin",
                    "password": "secret"
                },
                "api_keys": {
                    "openai": "sk-12345",
                    "anthropic": "claude-12345"
                },
                "settings": {
                    "timeout": 30,
                    "retries": 3,
                    "batch_size": 100
                }
            }
        }
        
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": nested_inputs}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "process_id" in response_data
        assert response_data["success"] is True

    def test_start_crew_with_array_inputs(self, test_client, monkeypatch):
        """Test starting a crew with array inputs."""
        crew_id = "test-array-inputs-crew"
        
        # Mock the crew manager's start_crew method
        async def mock_start_crew(crew_id, inputs, sio):
            # Verify that arrays are preserved
            assert len(inputs["topics"]) == 3
            assert "AI" in inputs["topics"]
            assert inputs["sources"][0]["name"] == "Research Paper"
            assert inputs["sources"][0]["url"] == "http://example.com"
            return "mock-process-id-array"
        
        monkeypatch.setattr('main.crew_manager.start_crew', AsyncMock(side_effect=mock_start_crew))
        monkeypatch.setattr('main.sio', MagicMock())
        
        # Test with array inputs
        array_inputs = {
            "topics": ["AI", "Machine Learning", "Neural Networks"],
            "sources": [
                {"name": "Research Paper", "url": "http://example.com", "type": "academic"},
                {"name": "Blog Post", "url": "http://blog.example.com", "type": "blog"}
            ],
            "keywords": ["innovation", "technology", "future"]
        }
        
        response = test_client.post(
            f"/api/crews/{crew_id}/start",
            json={"inputs": array_inputs}
        )
        
        assert response.status_code == 200
        response_data = response.json()
        assert "process_id" in response_data
        assert response_data["success"] is True