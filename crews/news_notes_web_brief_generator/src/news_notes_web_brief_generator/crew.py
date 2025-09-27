from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai import LLM
from crewai_tools import SerperDevTool, ScrapeWebsiteTool


@CrewBase
class NewsNotesWebBriefGeneratorCrew:
    """NewsNotesWebBriefGenerator crew"""

    @agent
    def news_researcher(self) -> Agent:
        return Agent(
            config=self.agents_config["news_researcher"],
            tools=[SerperDevTool()],
            reasoning=False,
            inject_date=True,
            allow_delegation=False,
            max_iter=5,
            llm=LLM(
                model="openai/meta-llama/llama-3.1-70b-instruct:free",
                temperature=0.0,
            ),
        )

    @agent
    def brief_drafter(self) -> Agent:
        return Agent(
            config=self.agents_config["brief_drafter"],
            tools=[ScrapeWebsiteTool()],
            reasoning=False,
            inject_date=True,
            allow_delegation=False,
            max_iter=5,
            llm=LLM(
                model="openai/google/gemma-3-27b-it:free",
                temperature=0.0,
            ),
        )

    @task
    def identify_top_sources(self) -> Task:
        return Task(
            config=self.tasks_config["identify_top_sources"],
            markdown=False,
        )

    @task
    def draft_markdown_brief(self) -> Task:
        return Task(
            config=self.tasks_config["draft_markdown_brief"],
            markdown=True,
            output_file="output/brief.md",
        )

    @crew
    def crew(self) -> Crew:
        """Creates the NewsNotesWebBriefGenerator crew"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
