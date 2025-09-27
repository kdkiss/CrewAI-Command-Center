# Architecture Overview

The CrewAI Command Center is a modular system that separates the user interface, API, and crew orchestration layers while maintaining real-time communication between them.

```mermaid
graph TD
    subgraph "Frontend"
        A[React Application<br/>Port 3000]
        B[TailwindCSS]
        C[Socket.IO Client]
    end

    subgraph "Backend"
        D[FastAPI Server<br/>Port 8001]
        E[Socket.IO Server]
        F[CrewManager<br/>Python Service]
    end

    subgraph "CrewAI Projects"
        G[Crew 1 – manus crew example]
        H[Crew 2 – research crew example]
        I[Additional crews]
    end

    A --> D
    A --> E
    D --> F
    E --> F
    F --> G
    F --> H
    F --> I
```

The React frontend communicates with the FastAPI backend and Socket.IO server to deliver real-time crew activity, configuration management, and observability features. The backend orchestrates multiple CrewAI projects through the CrewManager service, allowing additional crews to be plugged into the system as needed.
