import pytest
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock
import yaml

# Add the parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from crew_manager import CrewManager


class TestCrewManagerAdditional:
    """Additional tests for CrewManager to increase coverage."""
    
    def test_extract_inputs_from_patterns_with_no_matches(self, crew_manager):
        """Test _extract_inputs_from_patterns with content that has no matches."""
        content = "This content has no input parameters."
        inputs = {}
        crew_manager._extract_inputs_from_patterns(content, inputs)
        # Should return an empty dict since no patterns matched
        assert inputs == {}
    
    def test_extract_inputs_from_patterns_with_complex_content(self, crew_manager):
        """Test _extract_inputs_from_patterns with complex content."""
        content = '''
        def run(topic: str, target_audience: str) -> None:
            """
            Run the crew with the given parameters.
            
            Args:
                topic (str): The topic to research
                target_audience (str): The target audience for the research
            """
            inputs = {
                "topic": "Default Topic",
                "target_audience": "General Audience"
            }
            pass
        '''
        inputs = {}
        crew_manager._extract_inputs_from_patterns(content, inputs)
        # Should extract the parameters from the function signature
        assert "topic" in inputs
        assert "target_audience" in inputs
    
    def test_extract_inputs_from_patterns_with_varied_signatures(self, crew_manager):
        """Test _extract_inputs_from_patterns with varied function signatures."""
        # Test with default values
        content1 = 'def run(topic: str = "Default Topic", target_audience: str = "General Audience") -> None:'
        inputs1 = {}
        crew_manager._extract_inputs_from_patterns(content1, inputs1)
        assert "topic" in inputs1
        assert "target_audience" in inputs1
        
        # Test with mixed parameters
        content2 = 'def run(required_param: str, optional_param: str = "Default", flag: bool = False) -> None:'
        inputs2 = {}
        crew_manager._extract_inputs_from_patterns(content2, inputs2)
        assert "required_param" in inputs2
        assert "optional_param" in inputs2
        assert "flag" in inputs2
    
    def test_extract_inputs_from_patterns_with_multiline_signatures(self, crew_manager):
        """Test _extract_inputs_from_patterns with multiline function signatures."""
        content = '''
        def run(
            topic: str,
            target_audience: str,
            research_depth: int = 5,
            include_sources: bool = True
        ) -> None:
        '''
        inputs = {}
        crew_manager._extract_inputs_from_patterns(content, inputs)
        assert "topic" in inputs
        assert "target_audience" in inputs
        assert "research_depth" in inputs
        assert "include_sources" in inputs
    
    def test_extract_inputs_from_patterns_with_type_annotations(self, crew_manager):
        """Test _extract_inputs_from_patterns with various type annotations."""
        content = '''
        def run(
            name: str,
            count: int,
            rate: float,
            active: bool,
            tags: list,
            metadata: dict
        ) -> None:
        '''
        inputs = {}
        crew_manager._extract_inputs_from_patterns(content, inputs)
        assert "name" in inputs
        assert "count" in inputs
        assert "rate" in inputs
        assert "active" in inputs
        assert "tags" in inputs
        assert "metadata" in inputs
    
    def test_extract_inputs_from_patterns_with_complex_defaults(self, crew_manager):
        """Test _extract_inputs_from_patterns with complex default values."""
        content = '''
        def run(
            topic: str = "Default Topic",
            tags: list = [],
            metadata: dict = {},
            threshold: float = 0.75
        ) -> None:
        '''
        inputs = {}
        crew_manager._extract_inputs_from_patterns(content, inputs)
        assert "topic" in inputs
        assert "tags" in inputs
        assert "metadata" in inputs
        assert "threshold" in inputs
    
    def test_extract_inputs_from_patterns_with_docstring_descriptions(self, crew_manager):
        """Test _extract_inputs_from_patterns with docstring descriptions."""
        content = '''
        def run(topic: str, target_audience: str) -> None:
            """
            Run the research crew.
            
            Args:
                topic: The main topic to research
                target_audience: Who the research is intended for
            """
        '''
        inputs = {}
        crew_manager._extract_inputs_from_patterns(content, inputs)
        assert "topic" in inputs
        assert "target_audience" in inputs
    
    def test_extract_inputs_from_patterns_edge_cases(self, crew_manager):
        """Test _extract_inputs_from_patterns with edge cases."""
        # Empty content
        inputs = {}
        crew_manager._extract_inputs_from_patterns("", inputs)
        assert inputs == {}
        
        # Content with no function definition
        inputs = {}
        crew_manager._extract_inputs_from_patterns("This is just text with no function.", inputs)
        assert inputs == {}
        
        # Content with malformed function definition
        inputs = {}
        crew_manager._extract_inputs_from_patterns("def run(:) -> None:", inputs)
        assert inputs == {}
    
    def test_extract_inputs_from_patterns_with_special_characters(self, crew_manager):
        """Test _extract_inputs_from_patterns with special characters in parameters."""
        content = '''
        def run(
            topic_with_underscore: str,
            topicWithCamelCase: str,
            topic_with_numbers_123: str,
            "quoted_param": str
        ) -> None:
        '''
        inputs = {}
        crew_manager._extract_inputs_from_patterns(content, inputs)
        # Should handle valid parameter names
        assert "topic_with_underscore" in inputs
        assert "topicWithCamelCase" in inputs
        assert "topic_with_numbers_123" in inputs