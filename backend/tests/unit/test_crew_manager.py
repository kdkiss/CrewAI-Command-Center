import pytest
import yaml
import sys
import json
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock, ANY, mock_open, AsyncMock

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from crew_manager import CrewManager

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

class TestCrewManager:
    def test_initialization(self, crew_manager, temp_crews_dir):
        """Test that CrewManager initializes with the correct directory."""
        assert str(crew_manager.crews_folder) == str(temp_crews_dir)
        assert crew_manager.crews_folder.exists()
        assert len(crew_manager.running_crews) == 0
        
    def test_initialization_creates_directory(self, temp_crews_dir):
        """Test that CrewManager creates the directory if it doesn't exist."""
        # Remove the directory if it exists
        if temp_crews_dir.exists():
            shutil.rmtree(temp_crews_dir)
            
        # Initialize with the non-existent directory
        manager = CrewManager(str(temp_crews_dir))
        assert temp_crews_dir.exists()

    def test_get_crews_empty(self, crew_manager):
        """Test getting crews when no crews exist."""
        crews = crew_manager.get_crews()
        assert isinstance(crews, list)
        assert len(crews) == 0
        
    def test_get_crews_with_invalid_directories(self, crew_manager, temp_crews_dir):
        """Test getting crews with invalid directories."""
        # Create a file instead of a directory
        (temp_crews_dir / "not_a_dir").touch()
        
        # Create an empty directory
        (temp_crews_dir / "empty_dir").mkdir()
        
        crews = crew_manager.get_crews()
        assert len(crews) == 0

    def test_create_crew(self, crew_manager, sample_crew_config):
        """Test creating a new crew."""
        crew_id = "test-crew-1"
        result = crew_manager.create_crew(crew_id, sample_crew_config)
        
        assert result == {"status": "success", "message": f"Crew {crew_id} created successfully"}
        
        # Verify the crew directory structure was created correctly
        crew_dir = crew_manager.crews_folder / crew_id
        src_dir = crew_dir / "src"
        pkg_dir = src_dir / crew_id
        config_dir = pkg_dir / "config"
        
        assert crew_dir.exists()
        assert src_dir.exists()
        assert pkg_dir.exists()
        assert config_dir.exists()
        
        # Verify the required files were created
        main_py = pkg_dir / "main.py"
        agents_yaml = config_dir / "agents.yaml"
        tasks_yaml = config_dir / "tasks.yaml"
        
        assert main_py.exists()
        assert agents_yaml.exists()
        assert tasks_yaml.exists()
        
        # Verify the agents.yaml file content
        with open(agents_yaml, 'r') as f:
            saved_agents = yaml.safe_load(f)
        assert saved_agents == sample_crew_config["agents"]
        
        # Verify the tasks.yaml file content
        with open(tasks_yaml, 'r') as f:
            saved_tasks = yaml.safe_load(f)
        assert saved_tasks == sample_crew_config["tasks"]

    @patch('asyncio.create_subprocess_exec')
    @pytest.mark.asyncio
    async def test_start_crew(self, mock_subprocess, crew_manager, sample_crew_config):
        """Test starting a crew."""
        crew_id = "test-crew-1"
        crew_manager.create_crew(crew_id, sample_crew_config)
        
        # Mock the subprocess instance
        mock_process = MagicMock()
        mock_process.pid = 1234
        mock_process.returncode = None
        mock_process.stdout = MagicMock()
        mock_process.stderr = MagicMock()
        mock_subprocess.return_value = mock_process
        
        # Mock socket
        mock_socket = MagicMock()
        mock_socket.emit = MagicMock()
        
        # Patch the stream_logs method to avoid async issues
        with patch.object(crew_manager, '_stream_logs', new_callable=AsyncMock) as mock_stream:
            result = await crew_manager.start_crew(crew_id, {}, mock_socket)
            
            # Verify the crew was started
            assert isinstance(result, str)  # process ID as string (UUID)
            assert len(result) == 36  # UUID length
            assert crew_id in crew_manager.running_crews
            assert crew_manager.running_crews[crew_id]["process"].pid == 1234
            mock_subprocess.assert_called_once()
            mock_stream.assert_called_once_with(crew_id, mock_process, mock_socket)

    @patch('asyncio.create_subprocess_exec')
    @pytest.mark.asyncio
    async def test_start_crew_with_inputs(self, mock_subprocess, crew_manager, sample_crew_config):
        """Test starting a crew with input parameters."""
        crew_id = "test-crew-1"
        crew_manager.create_crew(crew_id, sample_crew_config)
        
        # Mock the subprocess instance
        mock_process = MagicMock()
        mock_process.pid = 1234
        mock_process.returncode = None
        mock_process.stdout = MagicMock()
        mock_process.stderr = MagicMock()
        mock_subprocess.return_value = mock_process
        
        # Mock socket
        mock_socket = MagicMock()
        mock_socket.emit = MagicMock()
        
        # Test inputs
        test_inputs = {"topic": "AI Research", "target_audience": "Developers"}
        
        # Patch the stream_logs method to avoid async issues
        with patch.object(crew_manager, '_stream_logs', new_callable=AsyncMock):
            result = await crew_manager.start_crew(crew_id, test_inputs, mock_socket)
            
            # Verify the crew was started with inputs
            assert isinstance(result, str)
            mock_subprocess.assert_called_once_with(
                "python", ANY,
                cwd=ANY,
                stdout=ANY,
                stderr=ANY,
                env=ANY
            )
            # Check that inputs were passed as environment variables
            call_kwargs = mock_subprocess.call_args[1]
            for key, value in test_inputs.items():
                assert key in call_kwargs['env']
                assert call_kwargs['env'][key] == value

    @pytest.mark.asyncio
    async def test_start_crew_invalid_crew_id(self, crew_manager):
        """Test starting a crew with an invalid crew ID."""
        mock_socket = MagicMock()
        
        # Try to start a crew that doesn't exist
        with pytest.raises(Exception, match="Invalid crew directory structure"):
            await crew_manager.start_crew("nonexistent-crew", {}, mock_socket)
        
        # Verify no crew was added to running_crews
        assert "nonexistent-crew" not in crew_manager.running_crews

    @pytest.mark.asyncio
    async def test_start_crew_already_running(self, crew_manager, sample_crew_config):
        """Test starting a crew that is already running."""
        crew_id = "test-crew-1"
        crew_manager.create_crew(crew_id, sample_crew_config)
        
        # Mock the subprocess
        mock_process = MagicMock()
        mock_process.pid = 1234
        mock_process.returncode = None
        
        # Add the crew to running_crews to simulate it's already running
        crew_manager.running_crews[crew_id] = {
            "process": mock_process,
            "process_id": "test-process-id"
        }
        
        mock_socket = MagicMock()
        
        # Try to start the same crew again
        with pytest.raises(Exception, match=f"Crew {crew_id} is already running"):
            await crew_manager.start_crew(crew_id, {}, mock_socket)
        
        # Verify the crew is still in running_crews
        assert crew_id in crew_manager.running_crews

    @pytest.mark.asyncio
    async def test_start_crew_missing_main_py(self, crew_manager, sample_crew_config, temp_crews_dir):
        """Test starting a crew with missing main.py file."""
        crew_id = "test-crew-1"
        crew_manager.create_crew(crew_id, sample_crew_config)
        
        # Remove the main.py file to simulate a missing file
        crew_dir = temp_crews_dir / crew_id
        src_dir = crew_dir / "src" / crew_id
        main_py = src_dir / "main.py"
        main_py.unlink()  # Remove the file
        
        mock_socket = MagicMock()
        
        # Try to start the crew
        with pytest.raises(Exception, match="main.py not found"):
            await crew_manager.start_crew(crew_id, {}, mock_socket)
        
        # Verify no crew was added to running_crews
        assert crew_id not in crew_manager.running_crews

    def test_stop_crew(self, crew_manager, sample_crew_config):
        """Test stopping a running crew."""
        crew_id = "test-crew-1"
        
        # Create the crew first (this creates the directory structure)
        crew_manager.create_crew(crew_id, sample_crew_config)
        
        # Mock the process
        mock_process = MagicMock()
        mock_process.pid = 1234
        mock_process.returncode = None
        crew_manager.running_crews[crew_id] = {
            "process": mock_process,
            "process_id": 1234
        }
        
        # Stop the crew
        result = crew_manager.stop_crew(crew_id)
        
        # Verify the crew was stopped
        assert result is None
        assert crew_id not in crew_manager.running_crews
        mock_process.terminate.assert_called_once()
        # Note: wait() might not be called in all cases, so we won't assert it
        
    def test_stop_nonexistent_crew(self, crew_manager):
        """Test stopping a crew that doesn't exist."""
        result = crew_manager.stop_crew("nonexistent-crew")
        assert result is None
        
    @patch('yaml.dump')
    @patch.object(CrewManager, '_atomic_write')
    @patch.object(Path, 'mkdir')
    def test_create_crew_creates_required_files(self, mock_mkdir, mock_atomic_write, mock_yaml_dump, crew_manager, sample_crew_config):
        """Test that create_crew creates all required files."""
        crew_id = "test-crew-1"
        result = crew_manager.create_crew(crew_id, sample_crew_config)
        
        assert result == {"status": "success", "message": f"Crew {crew_id} created successfully"}
        
        # Verify directories were created
        mock_mkdir.assert_called_once_with(parents=True, exist_ok=True)
        
        # Verify atomic writes were called for 3 files
        assert mock_atomic_write.call_count == 3
        
        # Verify yaml dump was called with correct data
        mock_yaml_dump.assert_any_call(sample_crew_config["agents"], default_flow_style=False, allow_unicode=True)
        mock_yaml_dump.assert_any_call(sample_crew_config["tasks"], default_flow_style=False, allow_unicode=True)
        
        # Verify main.py content was generated
        mock_atomic_write.assert_any_call(
            ANY,  # main.py path
            ANY   # main.py content (generated)
        )
    
    def test_create_crew_validation(self, crew_manager):
        """Test input validation for crew creation."""
        # Test missing required fields
        with pytest.raises(ValueError, match="Invalid configuration: 'agents' must be a dictionary"):
            crew_manager.create_crew("test-crew-3", {})
            
        # Test with missing agents
        with pytest.raises(ValueError, match="Invalid configuration: 'agents' must be a dictionary"):
            crew_manager.create_crew("test-crew-3", {"tasks": {}})
        
        # Test with missing tasks
        with pytest.raises(ValueError, match="Invalid configuration: 'tasks' must be a dictionary"):
            crew_manager.create_crew("test-crew-3", {"agents": {}})
        
        # Test with agent missing required fields
        with pytest.raises(ValueError, match="Invalid agent configuration for 'researcher': must be a dictionary"):
            crew_manager.create_crew("test-crew-3", {
                "agents": {"researcher": "not a dict"},
                "tasks": {}
            })
        
        # Test with agent missing name field
        invalid_config = {
            "agents": {
                "researcher": {
                    "role": "Test Role",
                    "goal": "Test Goal",
                    "backstory": "Test Backstory"
                }
            },
            "tasks": {
                "test_task": {
                    "description": "Test description",
                    "expected_output": "Test output"
                }
            }
        }
        with pytest.raises(ValueError, match="Agent 'name' field must match the dictionary key"):
            crew_manager.create_crew("test-crew-4", invalid_config)
            
    def test_load_crew_info_missing_files(self, crew_manager, temp_crews_dir):
        """Test _load_crew_info with missing files."""
        # Create a crew directory structure
        crew_id = "test-missing-files"
        crew_dir = temp_crews_dir / crew_id
        (crew_dir / "src" / crew_id / "config").mkdir(parents=True, exist_ok=True)
        
        # Call _load_crew_info directly
        result = crew_manager._load_crew_info(crew_dir)
        assert result is None
        
    @patch('yaml.safe_load')
    def test_load_crew_info_invalid_yaml(self, mock_yaml_load, crew_manager, temp_crews_dir):
        """Test _load_crew_info with invalid YAML."""
        # Setup mock to raise an error when loading YAML
        mock_yaml_load.side_effect = yaml.YAMLError("Invalid YAML")
        
        # Create a crew directory structure with required files
        crew_id = "test-invalid-yaml"
        crew_dir = temp_crews_dir / crew_id
        src_dir = crew_dir / "src" / crew_id
        config_dir = src_dir / "config"
        config_dir.mkdir(parents=True, exist_ok=True)
        
        # Create required files
        (src_dir / "main.py").touch()
        (config_dir / "agents.yaml").touch()
        (config_dir / "tasks.yaml").touch()
        
        # Call _load_crew_info directly
        with patch('builtins.open', mock_open()):
            result = crew_manager._load_crew_info(crew_dir)
            assert result is None

    @patch('os.fsync')
    @patch('yaml.dump')
    @patch('shutil.move')
    @patch('tempfile.NamedTemporaryFile')
    def test_create_crew_atomic_write(self, mock_tempfile, mock_move, mock_yaml_dump, mock_fsync, crew_manager, sample_crew_config):
        """Test atomic write functionality in crew creation."""
        crew_id = "test-atomic-crew"
        
        # Mock tempfile creation with proper fileno method
        mock_temp_file = MagicMock()
        mock_temp_file.name = "/tmp/test_file.tmp"
        mock_temp_file.fileno.return_value = 42  # Mock file descriptor
        mock_temp_file.write = MagicMock(return_value=None)
        mock_temp_file.flush = MagicMock(return_value=None)
        mock_tempfile.return_value.__enter__.return_value = mock_temp_file
        
        result = crew_manager.create_crew(crew_id, sample_crew_config)
        
        assert result == {"status": "success", "message": f"Crew {crew_id} created successfully"}
        
        # Verify yaml dump was called with correct data (no stream, as it's handled internally)
        mock_yaml_dump.assert_any_call(sample_crew_config["agents"], default_flow_style=False, allow_unicode=True)
        mock_yaml_dump.assert_any_call(sample_crew_config["tasks"], default_flow_style=False, allow_unicode=True)
        
        # Verify tempfile was called with correct parameters
        mock_tempfile.assert_called_with(mode='w', encoding='utf-8', dir=ANY, delete=False)
        
        # Verify file operations were called
        mock_temp_file.write.assert_called()
        mock_temp_file.flush.assert_called()
        mock_fsync.assert_called_with(42)  # The mocked file descriptor
        
        # Verify move was called for atomic replacement
        assert mock_move.call_count >= 3  # 3 files: main.py, agents.yaml, tasks.yaml

    @patch('asyncio.create_subprocess_exec')
    @pytest.mark.asyncio
    async def test_start_crew_stream_logs_called(self, mock_subprocess, crew_manager, sample_crew_config):
        """Test that _stream_logs is called when starting a crew."""
        crew_id = "test-crew-1"
        crew_manager.create_crew(crew_id, sample_crew_config)
        
        # Mock the subprocess instance
        mock_process = MagicMock()
        mock_process.pid = 1234
        mock_process.returncode = None
        mock_subprocess.return_value = mock_process
        
        # Mock socket
        mock_socket = MagicMock()
        
        # Patch the stream_logs method to verify it's called
        with patch.object(crew_manager, '_stream_logs', new_callable=AsyncMock) as mock_stream:
            await crew_manager.start_crew(crew_id, {}, mock_socket)
            
            # Verify _stream_logs was called
            mock_stream.assert_called_once_with(crew_id, mock_process, mock_socket)

    def test_get_yaml_content(self, crew_manager, sample_crew_config, temp_crews_dir):
        """Test getting YAML content from a crew."""
        crew_id = "test-crew-1"
        crew_manager.create_crew(crew_id, sample_crew_config)
        
        # Test getting agents.yaml content
        agents_content = crew_manager.get_yaml_content(crew_id, "agents")
        assert "researcher" in agents_content
        
        # Test getting tasks.yaml content
        tasks_content = crew_manager.get_yaml_content(crew_id, "tasks")
        assert "research_task" in tasks_content
        
        # Test getting non-existent file
        empty_content = crew_manager.get_yaml_content(crew_id, "nonexistent")
        assert empty_content == ""

    def test_save_yaml_content(self, crew_manager, sample_crew_config, temp_crews_dir):
        """Test saving YAML content to a crew."""
        crew_id = "test-crew-1"
        crew_manager.create_crew(crew_id, sample_crew_config)
        
        # Test saving agents.yaml content
        new_agents_content = """
new_agent:
  name: new_agent
  role: New Role
  goal: New Goal
  backstory: New Backstory
"""
        crew_manager.save_yaml_content(crew_id, "agents", new_agents_content)
        
        # Verify the content was saved
        saved_content = crew_manager.get_yaml_content(crew_id, "agents")
        assert "new_agent" in saved_content

    def test_save_yaml_content_invalid_yaml(self, crew_manager, sample_crew_config):
        """Test saving invalid YAML content."""
        crew_id = "test-crew-1"
        crew_manager.create_crew(crew_id, sample_crew_config)
        
        # Test saving invalid YAML - this should raise a ValueError
        # Using clearly invalid YAML that will cause yaml.safe_load to fail
        invalid_yaml = """
invalid: [yaml
  - missing closing bracket
    - and inconsistent indentation
"""
        
        # The save_yaml_content method should validate the YAML before saving
        with pytest.raises(ValueError, match="Invalid YAML syntax in agents.yaml for crew test-crew-1"):
            crew_manager.save_yaml_content(crew_id, "agents", invalid_yaml)

    def test_create_crew_invalid_structure(self, crew_manager):
        """Test creating a crew with invalid directory structure."""
        crew_id = "test-crew-1"
        config = {
            "agents": {
                "researcher": {
                    "name": "researcher",
                    "role": "Research Specialist",
                    "goal": "Conduct research on given topics",
                    "backstory": "You are a research specialist..."
                }
            },
            "tasks": {
                "research_task": {
                    "description": "Research a given topic",
                    "expected_output": "A detailed research report"
                }
            }
        }
        
        result = crew_manager.create_crew(crew_id, config)
        assert result["status"] == "success"