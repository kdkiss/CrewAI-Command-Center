import pytest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
import asyncio

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from main import app, sio, crew_manager
from fastapi.testclient import TestClient


class TestMainAdditional7:
    """Additional tests for main.py to increase coverage."""
    
    def test_import_crew_endpoint_complex_data(self, test_client, monkeypatch):
        """Test import_crew endpoint with complex data."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with complex data
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Complex Test Crew",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "tools": ["tool1", "tool2"],
                        "verbose": True
                    },
                    {
                        "name": "writer",
                        "role": "Writer",
                        "goal": "Write reports",
                        "backstory": "Experienced writer",
                        "tools": ["tool3"],
                        "verbose": False
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "agent": "researcher",
                        "async_execution": False,
                        "human_input": True
                    },
                    {
                        "name": "write_task",
                        "description": "Write a report",
                        "expected_output": "Final report",
                        "agent": "writer",
                        "async_execution": True,
                        "human_input": False,
                        "context": ["research_task"]
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_special_characters(self, test_client, monkeypatch):
        """Test import_crew endpoint with special characters."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with special characters
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Test Crew with Special Characters: @#$%^&*()",
                "agents": [
                    {
                        "name": "researcher-1",
                        "role": "Researcher/Analyst",
                        "goal": "Research topics & analyze data",
                        "backstory": "Experienced researcher with expertise in AI/ML"
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task_1",
                        "description": "Research a topic with special chars: @#$%^&*()",
                        "expected_output": "Research report with unicode: café, naïve, résumé"
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_nested_objects(self, test_client, monkeypatch):
        """Test import_crew endpoint with nested objects."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with nested objects
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Test Crew with Nested Objects",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "config": {
                            "model": "gpt-4",
                            "temperature": 0.7,
                            "max_tokens": 2000
                        }
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "config": {
                            "output_file": "research_report.txt",
                            "save_output": True
                        }
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_arrays(self, test_client, monkeypatch):
        """Test import_crew endpoint with arrays."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with arrays
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Test Crew with Arrays",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "tools": ["tool1", "tool2", "tool3"],
                        "skills": ["research", "analysis", "writing"]
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "keywords": ["AI", "ML", "Data Science"],
                        "sources": [
                            {"name": "Source 1", "url": "http://example.com/1"},
                            {"name": "Source 2", "url": "http://example.com/2"}
                        ]
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_none_values(self, test_client, monkeypatch):
        """Test import_crew endpoint with None values."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with None values
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Test Crew with None Values",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "optional_field": None
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "optional_field": None
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_empty_arrays(self, test_client, monkeypatch):
        """Test import_crew endpoint with empty arrays."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with empty arrays
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Test Crew with Empty Arrays",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "tools": [],
                        "skills": []
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "keywords": [],
                        "sources": []
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_boolean_values(self, test_client, monkeypatch):
        """Test import_crew endpoint with boolean values."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with boolean values
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Test Crew with Boolean Values",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "verbose": True,
                        "allow_delegation": False
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "async_execution": False,
                        "human_input": True
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_numeric_values(self, test_client, monkeypatch):
        """Test import_crew endpoint with numeric values."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with numeric values
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Test Crew with Numeric Values",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "config": {
                            "temperature": 0.7,
                            "max_tokens": 2000,
                            "top_p": 0.9
                        }
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "priority": 1,
                        "estimated_time": 30
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_mixed_data_types(self, test_client, monkeypatch):
        """Test import_crew endpoint with mixed data types."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with mixed data types
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Test Crew with Mixed Data Types",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "tools": ["tool1", "tool2"],
                        "verbose": True,
                        "config": {
                            "temperature": 0.7,
                            "max_tokens": 2000
                        },
                        "skills": ["research", "analysis"],
                        "optional_field": None
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "keywords": ["AI", "ML"],
                        "async_execution": False,
                        "priority": 1,
                        "estimated_time": 30,
                        "sources": [
                            {"name": "Source 1", "url": "http://example.com/1"},
                            {"name": "Source 2", "url": "http://example.com/2"}
                        ],
                        "optional_field": None
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_minimal_data(self, test_client, monkeypatch):
        """Test import_crew endpoint with minimal data."""
        # Mock crew_manager.create_crew
        mock_create_crew = MagicMock(return_value={"status": "success", "message": "Crew created"})
        monkeypatch.setattr('main.crew_manager.create_crew', mock_create_crew)
        
        # Mock crew_manager.get_crews
        mock_get_crews = MagicMock(return_value=[])
        monkeypatch.setattr('main.crew_manager.get_crews', mock_get_crews)
        
        # Mock sio.emit
        mock_sio_emit = AsyncMock()
        monkeypatch.setattr('main.sio.emit', mock_sio_emit)
        
        # Test with minimal data
        response = test_client.post(
            "/api/crews/import",
            json={
                "name": "Minimal Test Crew",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher"
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report"
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"