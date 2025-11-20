# Project Overview

This project is a course on building AI agents called "PhiloAgents". It consists of a Python backend (`philoagents-api`) and a JavaScript-based game UI (`philoagents-ui`).

The backend is a FastAPI application that uses the `langchain`, `langgraph`, `groq`, and `google-genai` libraries to create AI agents. It provides an API for the frontend to interact with the agents.

The frontend is a web-based game built with the Phaser game framework. It allows users to interact with the "PhiloAgents" in a virtual world.

The project uses Docker to manage the local infrastructure (agent API and game UI), but connects to a cloud-hosted MongoDB Atlas database for persistence in both local and production environments.

# Building and Running

The project uses a top-level `Makefile` to orchestrate the build and run process.

**Prerequisites:**
- Ensure you have a `philoagents-api/.env` file containing:
  - `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/...`
  - `ADMIN_TOKEN=test-admin-token` (or your preferred secure token for admin API access)

# Business Features & Security

The project now includes a robust Business User system with Role-Based Access Control (RBAC) and file isolation.

## Access Modes

1.  **Admin Access**:
    - Accessed via the "Admin Access" button on the main menu.
    - Requires a password (default: `agentgarden`) for the "Smart Login" UI.
    - Provides a dashboard to:
        - View all registered business profiles.
        - Create new profiles.
        - Edit existing profiles.
        - Enter the game as any user.

2.  **User Access**:
    - Accessed via the "Enter Token" button.
    - Requires a valid, unique Business Token (UUID).
    - Provides a dashboard to:
        - Edit their own profile.
        - Enter the game with their specific business context.

## Security & Isolation

-   **File Isolation**: Files uploaded by a user (images/PDFs) are strictly isolated to their session. They persist across interactions with different experts but are cleared upon logout or session end. Users cannot access each other's files.
-   **Token-Based Auth**: All business users are identified by a unique, auto-generated UUID token.
-   **Role-Based Access Control**: API endpoints are secured. Only users with the `admin` role (or a valid `ADMIN_TOKEN`) can list all users or access sensitive endpoints.

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
