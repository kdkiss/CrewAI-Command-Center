import pytest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
import asyncio

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from main import app, sio, crew_manager
from fastapi.testclient import TestClient


class TestMainAdditional8:
    """Additional tests for main.py to increase coverage."""
    
    def test_import_crew_endpoint_with_complex_data(self, test_client, monkeypatch):
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
                        "optional_field": None
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "optional_field": "value"
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
    
    def test_import_crew_endpoint_with_special_characters(self, test_client, monkeypatch):
        """Test import_crew endpoint with special characters in data."""
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
                "name": "Special Characters Crew",
                "agents": [
                    {
                        "name": "researcher_123",
                        "role": "Researcher & Developer",
                        "goal": "Research topics with special chars: @#$%^&*()",
                        "backstory": "Experienced researcher with café experience"
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task_v1.0",
                        "description": "Research a topic with unicode: naïve, résumé",
                        "expected_output": "Research report with € symbol"
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_nested_objects(self, test_client, monkeypatch):
        """Test import_crew endpoint with nested objects in data."""
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
                "name": "Nested Objects Crew",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
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
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "constraints": {
                            "max_length": 1000,
                            "min_sources": 3,
                            "language": "en"
                        }
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_arrays(self, test_client, monkeypatch):
        """Test import_crew endpoint with arrays in data."""
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
                "name": "Arrays Crew",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "tools": ["tool1", "tool2", "tool3"],
                        "skills": ["research", "analysis", "writing"],
                        "tags": ["AI", "ML", "DL"]
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "keywords": ["innovation", "technology", "future"],
                        "sources": [
                            {"name": "Research Paper", "url": "http://example.com", "type": "academic"},
                            {"name": "Blog Post", "url": "http://blog.example.com", "type": "blog"}
                        ]
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_none_values(self, test_client, monkeypatch):
        """Test import_crew endpoint with None values in data."""
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
                "name": "None Values Crew",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "optional_field": None,
                        "another_field": None
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "optional_constraint": None
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_empty_arrays(self, test_client, monkeypatch):
        """Test import_crew endpoint with empty arrays in data."""
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
                "name": "Empty Arrays Crew",
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
        """Test import_crew endpoint with boolean values in data."""
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
                "name": "Boolean Values Crew",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "active": True,
                        "verified": False
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "include_sources": True,
                        "require_review": False
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_numeric_values(self, test_client, monkeypatch):
        """Test import_crew endpoint with numeric values in data."""
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
                "name": "Numeric Values Crew",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "experience_years": 5,
                        "success_rate": 0.95
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "max_length": 1000,
                        "min_sources": 3,
                        "priority": 1
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"
    
    def test_import_crew_endpoint_with_mixed_data_types(self, test_client, monkeypatch):
        """Test import_crew endpoint with mixed data types in data."""
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
                "name": "Mixed Data Types Crew",
                "agents": [
                    {
                        "name": "researcher",
                        "role": "Researcher",
                        "goal": "Research topics",
                        "backstory": "Experienced researcher",
                        "active": True,
                        "experience_years": 5,
                        "success_rate": 0.95,
                        "tools": ["tool1", "tool2"],
                        "skills": ["research", "analysis"],
                        "config": {
                            "timeout": 30,
                            "retries": 3
                        },
                        "tags": ["AI", "ML"],
                        "optional_field": None
                    }
                ],
                "tasks": [
                    {
                        "name": "research_task",
                        "description": "Research a topic",
                        "expected_output": "Research report",
                        "include_sources": True,
                        "max_length": 1000,
                        "min_sources": 3,
                        "priority": 1,
                        "keywords": ["innovation", "technology"],
                        "sources": [
                            {"name": "Research Paper", "url": "http://example.com", "type": "academic"}
                        ],
                        "constraints": {
                            "language": "en",
                            "max_depth": 5
                        },
                        "optional_constraint": None
                    }
                ]
            }
        )
        
        # Should succeed
        assert response.status_code == 200
        assert response.json()["status"] == "success"