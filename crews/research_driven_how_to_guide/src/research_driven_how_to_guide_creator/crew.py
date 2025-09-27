import os
from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import (
	SerperDevTool,
	BraveSearchTool,
    FileWriterTool
)
from .tools.safe_file_writer import SafeFileWriterTool
from .tools.notion_tools import NotionCreateSummaryPageTool
from .tools.file_tools import RecentMarkdownFinderTool, ReadFileExcerptTool

from crewai_tools import CrewaiEnterpriseTools


@CrewBase
class ResearchDrivenHowToGuideCreatorCrew:
    """ResearchDrivenHowToGuideCreator crew"""

    # Read model ID from environment, with a sensible default
    MODEL_ID = os.getenv("LLM_MODEL", "openrouter/moonshotai/kimi-k2:free")

    
    @agent
    def trend_research_specialist(self) -> Agent:
        
        return Agent(
            config=self.agents_config["trend_research_specialist"],
            tools=[SerperDevTool(), SafeFileWriterTool(), FileWriterTool()],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model=self.MODEL_ID,
                temperature=0.7,
                max_tokens=1200,
                num_retries=3,
                timeout=90,
            ),
        )
    
    @agent
    def how_to_guide_creator(self) -> Agent:
        
        return Agent(
            config=self.agents_config["how_to_guide_creator"],
            tools=[BraveSearchTool(), SafeFileWriterTool(), FileWriterTool()],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model=self.MODEL_ID,
                temperature=0.7,
                max_tokens=4000,
                num_retries=3,
                timeout=90,
            ),
        )
    
    @agent
    def digital_products_database_manager(self) -> Agent:
        # Prefer native Notion tool to guarantee URL and success checks.
        # Enterprise tools can be added alongside if desired.
        # Remove enterprise tools to prevent accidental duplicate Notion writes
        
        return Agent(
            config=self.agents_config["digital_products_database_manager"],
            tools=[
				RecentMarkdownFinderTool(),
				ReadFileExcerptTool(),
				NotionCreateSummaryPageTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model=self.MODEL_ID,
                temperature=0.7,
                max_tokens=800,
                num_retries=3,
                timeout=90,
            ),
        )
    

    
    @task
    def research_hot_how_to_topics(self) -> Task:
        return Task(
            config=self.tasks_config["research_hot_how_to_topics"],
            markdown=False,
        )
    
    @task
    def create_comprehensive_how_to_guide(self) -> Task:
        return Task(
            config=self.tasks_config["create_comprehensive_how_to_guide"],
            markdown=False,
        )
    
    @task
    def upload_guide_to_digital_products_db(self) -> Task:
        return Task(
            config=self.tasks_config["upload_guide_to_digital_products_db"],
            markdown=False,
        )
    

    @crew
    def crew(self) -> Crew:
        """Creates the ResearchDrivenHowToGuideCreator crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
        )
