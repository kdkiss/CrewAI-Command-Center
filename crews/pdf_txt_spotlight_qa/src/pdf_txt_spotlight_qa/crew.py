from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import PDFSearchTool, TXTSearchTool


@CrewBase
class PdfTxtSpotlightQaCrew:
    """PDF + TXT Spotlight Q&A crew."""

    @agent
    def doc_reader(self) -> Agent:
        return Agent(
            config=self.agents_config["doc_reader"],
            tools=[
                PDFSearchTool(pdf="docs/paper.pdf"),
                TXTSearchTool(txt="docs/appendix.txt"),
            ],
            verbose=True,
            allow_delegation=False,
            max_iter=5,
        )

    @agent
    def answerer(self) -> Agent:
        return Agent(
            config=self.agents_config["answerer"],
            tools=[
                PDFSearchTool(pdf="docs/paper.pdf"),
                TXTSearchTool(txt="docs/appendix.txt"),
            ],
            verbose=True,
            allow_delegation=False,
            max_iter=5,
        )

    @task
    def doc_reader_task(self) -> Task:
        return Task(
            config=self.tasks_config["doc_reader_task"],
            markdown=True,
        )

    @task
    def answerer_task(self) -> Task:
        return Task(
            config=self.tasks_config["answerer_task"],
            markdown=True,
            output_file="output/answers.md",
        )

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
