import os

from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import (
	SerplyNewsSearchTool,
	ScrapeWebsiteTool,
	BraveSearchTool
)






@CrewBase
class RegionalFraudIntelligenceAutomationCrew:
    """RegionalFraudIntelligenceAutomation crew"""

    
    @agent
    def fraud_intelligence_researcher(self) -> Agent:

        
        return Agent(
            config=self.agents_config["fraud_intelligence_researcher"],
            
            
            tools=[
				SerplyNewsSearchTool(),
				BraveSearchTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=5,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="openai/meta-llama/llama-4-maverick:free",
                temperature=0.0,
            ),
            
        )
    
    @agent
    def fraud_analyst(self) -> Agent:

        
        return Agent(
            config=self.agents_config["fraud_analyst"],
            
            
            tools=[
				ScrapeWebsiteTool()
            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=5,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="openai/google/gemma-3-27b-it:free",
                temperature=0.0,
            ),
            
        )
    
    @agent
    def compliance_briefing_specialist(self) -> Agent:

        
        return Agent(
            config=self.agents_config["compliance_briefing_specialist"],
            
            
            tools=[

            ],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=5,
            max_rpm=None,
            max_execution_time=None,
            llm=LLM(
                model="openai/x-ai/grok-4-fast:free",
                temperature=0.0,
            ),
            
        )
    

    
    @task
    def research_recent_fraud_intelligence(self) -> Task:
        return Task(
            config=self.tasks_config["research_recent_fraud_intelligence"],
            markdown=False,
            
            
        )
    
    @task
    def analyze_fraud_patterns_and_trends(self) -> Task:
        return Task(
            config=self.tasks_config["analyze_fraud_patterns_and_trends"],
            markdown=False,
            
            
        )
    
    @task
    def create_executive_fraud_briefing(self) -> Task:
        return Task(
            config=self.tasks_config["create_executive_fraud_briefing"],
            markdown=False,
            
            
        )
    

    @crew
    def crew(self) -> Crew:
        """Creates the RegionalFraudIntelligenceAutomation crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
        )

    def _load_response_format(self, name):
        with open(os.path.join(self.base_directory, "config", f"{name}.json")) as f:
            json_schema = json.loads(f.read())

        return SchemaConverter.build(json_schema)
