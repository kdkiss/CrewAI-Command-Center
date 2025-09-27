"""
Academic Essay Humanizer Crew
This module defines the crew that humanizes drafts and enforces citation styles.
"""

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task


@CrewBase
class AcademicEssayHumanizerCrew:
    """Crew that rewrites drafts and applies citation styles."""

    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def editor(self) -> Agent:
        """Creates the editor agent"""
        return Agent(
            config=self.agents_config['editor'],
            verbose=True
        )

    @agent
    def style_checker(self) -> Agent:
        """Creates the style checker agent"""
        return Agent(
            config=self.agents_config['style_checker'],
            verbose=True
        )

    @task
    def humanize_draft(self) -> Task:
        """Task that rewrites the draft into academic prose"""
        return Task(
            config=self.tasks_config['humanize_draft'],
            context=[],
            output_file='humanized_draft.md'
        )

    @task
    def enforce_style(self) -> Task:
        """Task that enforces the chosen citation style"""
        return Task(
            config=self.tasks_config['enforce_style'],
            context=[self.humanize_draft()],
            output_file='styled_draft.md'
        )

    @crew
    def crew(self) -> Crew:
        """Assembles the Academic Essay Humanizer crew"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
            output_log_file='crew_execution.log'
        )
