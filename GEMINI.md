# Project Overview

This project is a course on building AI agents called "PhiloAgents". It consists of a Python backend (`philoagents-api`) and a JavaScript-based game UI (`philoagents-ui`).

The backend is a FastAPI application that uses the `langchain`, `langgraph`, `groq`, and `google-genai` libraries to create AI agents. It provides an API for the frontend to interact with the agents.

The frontend is a web-based game built with the Phaser game framework. It allows users to interact with the "PhiloAgents" in a virtual world.

The project uses Docker to manage the local infrastructure (agent API and game UI), but connects to a cloud-hosted MongoDB Atlas database for persistence in both local and production environments.

# Building and Running

The project uses a top-level `Makefile` to orchestrate the build and run process.

**Prerequisites:**
- Ensure you have a `philoagents-api/.env` file containing your MongoDB Atlas connection string: `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/...`

**1. Start the application:**

To start the application stack (backend and frontend), run the following command from the root directory:

```bash
make infrastructure-up
```

This will start the following services:
- `philoagents-api`: The backend API, available at `http://localhost:8000`
- `philoagents-ui`: The frontend game, available at `http://localhost:8080`

**2. Stop the application:**

To stop the application, run:

```bash
make infrastructure-stop
```

**3. Database Management:**

To populate the MongoDB Atlas database with the required data for the agents, run:

```bash
make create-long-term-memory
```

To delete the long-term memory from the database, run:

```bash
make delete-long-term-memory
```

**4. Agent Interaction (CLI):**

To call an agent directly from the command line (e.g., Turing with a default query), run:

```bash
make call-agent
```

**5. Evaluation:**

To generate an evaluation dataset for the agents, run:

```bash
make generate-evaluation-dataset
```

To run the agent evaluation process, run:

```bash
make evaluate-agent
```

# Development Conventions

## Backend

The backend is a Python project that uses `uv` for dependency management. To install the dependencies, run:

```bash
cd philoagents-api
uv venv .venv
source .venv/bin/activate
uv pip install -e .
```

## Frontend

The frontend is a JavaScript project that uses `npm` for dependency management. To install the dependencies, run:

```bash
cd philoagents-ui
npm install
```

To run the frontend in development mode, run:

```bash
npm run dev
```

To build the frontend for production, run:

```bash
npm run build
```
