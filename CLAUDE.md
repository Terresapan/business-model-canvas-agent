# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **AI-powered educational platform** featuring interactive conversations with:
- **Philosophers** - Historical philosophy figures (Socrates, Aristotle, Descartes, etc.)
- **Business Experts** - Business Model Canvas specialists

The system uses LangGraph-based AI agents, MongoDB for conversation memory (RAG), and a Phaser 3-based 2D game interface.

## Recent Updates (feature/mongodb-integration branch)

**MongoDB Integration for Business User Management:**
- ✅ Full CRUD API for business user profiles
- ✅ Frontend profile creation and editing UI
- ✅ Real-time dropdown population from MongoDB
- ✅ 2x2 grid button layout for better UX
- ✅ Production-ready environment variable handling
- ✅ Fixed webpack configuration issues

**Key Files Modified:**
- `philoagents-api/src/philoagents/domain/business_user_factory.py` - MongoDB integration
- `philoagents-api/src/philoagents/infrastructure/api.py` - CRUD endpoints
- `philoagents-ui/src/scenes/MainMenu.js` - UI layout and database integration
- `philoagents-ui/src/simple-profile.js` - Profile management module
- `philoagents-ui/webpack/config*.js` - Fixed script injection
- `philoagents-ui/index.html` - Updated script tags
- `philoagents-api/pyproject.toml` - Added motor dependency

**Branch Status:** All features committed and tested locally. Ready for deployment to production.

## Architecture

### Clean Architecture Pattern (Backend)

The backend follows Clean Architecture with three main layers:

```
philoagents-api/src/philoagents/
├── application/          # Application layer (LangGraph workflows)
│   └── conversation_service/
│       └── workflow/         # LangGraph-based agent orchestration
│           ├── graph.py      # Main graph definition
│           ├── nodes.py      # Graph nodes (processing steps)
│           ├── edges.py      # Graph edges (state transitions)
│           ├── chains.py     # LLM chains and prompts
│           └── state.py      # State management
├── domain/               # Domain layer (business logic)
│   ├── business_expert.py
│   ├── business_expert_factory.py
│   ├── business_user.py
│   ├── business_user_factory.py
│   ├── exceptions.py
│   └── prompts.py
├── infrastructure/       # Infrastructure layer
│   └── api.py           # FastAPI REST endpoints
└── config.py            # Configuration settings
```

**Key Features:**
- Factory pattern for expert/user creation
- MongoDB for persistent conversation memory
- LangGraph workflow for agent reasoning
- CORS-enabled API for frontend integration

### Game-Based Frontend (Phaser 3)

```
philoagents-ui/src/
├── main.js              # Game initialization
├── scenes/              # Phaser scenes
│   ├── Preloader.js     # Asset loading
│   ├── MainMenu.js      # Start screen
│   ├── Game.js          # Main gameplay
│   └── PauseMenu.js     # Pause functionality
├── classes/             # Game objects
│   ├── Character.js     # Character sprites
│   ├── DialogueBox.js   # Text bubbles
│   └── DialogueManager.js # Dialog system
└── services/            # API integration
    ├── ApiService.js    # REST API client
    └── WebSocketApiService.js # WebSocket client
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Backend Runtime** | Python 3.11 |
| **Backend Framework** | FastAPI |
| **AI/Agent Framework** | LangGraph, LangChain |
| **LLM Provider** | Groq API |
| **Database** | MongoDB |
| **Observability** | Opik (LLMOps), LangSmith |
| **Frontend** | Phaser 3 (Game Engine), JavaScript |
| **Build Tools** | Webpack 5, Babel |
| **Package Managers** | uv (Python), npm (Node.js) |
| **Containerization** | Docker, Docker Compose |
| **Cloud Platform** | Google Cloud Run, Artifact Registry |
| **Code Quality** | Ruff, Pre-commit |

## Common Commands

### Prerequisites

Before running any commands, ensure you have:
- Python 3.11
- uv ≥ 0.4.30
- GNU Make ≥ 3.81
- Docker ≥ 27.4.0
- Required API keys in `philoagents-api/.env`:
  - `GROQ_API_KEY` - Groq LLM access (free tier available)
  - `COMET_API_KEY` - Opik monitoring (optional for Module 5)
  - `OPENAI_API_KEY` - Evaluation (optional for Module 5)

### Development Workflow

**1. Set up Python environment:**
```bash
cd philoagents-api
uv venv .venv
source .venv/bin/activate
uv pip install -e .
```

**2. Configure environment:**
```bash
cd philoagents-api
cp .env.example .env
# Edit .env with your API keys
```

**3. Start all services (Docker):**
```bash
# From project root directory
make infrastructure-up
```

**4. Initialize MongoDB memory:**
```bash
make create-long-term-memory
```

**5. Access the application:**
- Game UI: http://localhost:8080
- API Docs: http://localhost:8000/docs

### Infrastructure Commands

```bash
# Start all services
make infrastructure-up

# Stop all services
make infrastructure-stop

# Build Docker images (without running)
make infrastructure-build
```

### Testing & Development

**Direct agent testing (bypass UI):**
```bash
make call-agent
```

**Backend development (run API directly):**
```bash
cd philoagents-api
source .venv/bin/activate
fastapi run src/philoagents/infrastructure/api.py --port 8000 --host 0.0.0.0
```

**Frontend development:**
```bash
cd philoagents-ui
npm run dev          # With logging
npm run dev-nolog    # Without logging
```

**Production builds:**
```bash
# Backend: Docker image is built automatically
# Frontend:
cd philoagents-ui
npm run build        # With logging
npm run build-nolog  # Without logging
```

### Memory & Data Management

```bash
# Populate MongoDB with long-term memory (RAG)
make create-long-term-memory

# Delete all long-term memory from MongoDB
make delete-long-term-memory

# Generate evaluation dataset
make generate-evaluation-dataset

# Run agent evaluation suite
make evaluate-agent
```

### Business Profile Management

**Via Web UI (http://localhost:8080):**
1. Click "Create Profile" to add a new business profile
2. Fill in the form with business details
3. Select profile from dropdown
4. Click "Enter" to start conversation with Business Canvas experts
5. Click "Edit Profile" to modify existing profiles

**Manual MongoDB Access:**
```bash
# Connect to MongoDB (when running locally)
docker compose exec local_dev_atlas mongosh -u philoagents -p philoagents

# Query business users collection
use philoagents
db.business_users.find().pretty()
```

### Profile Data Flow
1. User creates/edits profile in frontend form
2. Form submits to `POST /business/user` or `PUT /business/user/{token}`
3. Backend validates and stores in MongoDB
4. MainMenu dropdown refreshes automatically
5. Selected profile context is passed to business expert conversations

### Code Quality

```bash
# Backend linting and formatting (ruff)
cd philoagents-api
uv run ruff check .
uv run ruff format .

# Run tests (pytest)
uv run pytest
```

## API Endpoints

Main endpoints in `philoagents-api/src/philoagents/infrastructure/api.py`:

**Business Expert Chat:**
- `POST /chat/business` - Chat with business experts
- `GET /business/experts` - List available experts
- `GET /business/tokens/validate` - Validate user tokens

**Business User Management (MongoDB-based):**
- `POST /business/user` - Create a new business profile
- `GET /business/users` - Get all business profiles
- `GET /business/user/{token}` - Get a specific profile by token
- `PUT /business/user/{token}` - Update an existing profile
- `DELETE /business/user/{token}` - Delete a profile

Access interactive documentation at http://localhost:8000/docs

## Project Structure

```
philoagents-course/
├── philoagents-api/          # Backend (Python)
│   ├── src/philoagents/       # Source code
│   ├── data/                  # Data files (evaluation dataset, etc.)
│   ├── tools/                 # CLI scripts
│   ├── .env.example           # Environment template
│   ├── pyproject.toml         # Dependencies
│   └── Dockerfile
├── philoagents-ui/           # Frontend (Node.js)
│   ├── src/                   # Source code
│   ├── webpack/               # Build configuration
│   ├── package.json           # Dependencies
│   └── Dockerfile
├── docker-compose.yml        # Multi-service orchestration
├── Makefile                  # Build automation
├── cloudbuild-api.yaml       # Cloud Run deployment (API)
└── cloudbuild-ui.yaml        # Cloud Run deployment (UI)
```

## Key Configuration Files

- `docker-compose.yml` - MongoDB (27017), API (8000), UI (8080)
- `pyproject.toml` - Python dependencies (20+ packages for AI/ML)
- `package.json` - Frontend dependencies (Phaser 3, Webpack)
- `philoagents-api/.env` - API keys and configuration
- `philoagents-api/src/philoagents/config.py` - Default configuration values

## Module-Specific Notes

### Modules 1-4, 6
- Must test together (coupled modules)
- Requires: `make create-long-term-memory` before running
- Access game at http://localhost:8080

### Module 5 (Evaluation & Monitoring)
- Visualization: Visit [Opik dashboard](https://rebrand.ly/philoagents-opik-dashboard)
- Commands: `make evaluate-agent`, `make generate-evaluation-dataset`
- Requires: `COMET_API_KEY` and `OPENAI_API_KEY`

## Deployment

Production deployment uses Google Cloud:
- Backend: `cloudbuild-api.yaml` → Cloud Run (us-central1)
- Frontend: `cloudbuild-ui.yaml` → Cloud Run
- Container registry: Google Artifact Registry
- Secrets: Groq, LangSmith, and other API keys

## Important Implementation Details

### LangGraph Workflow
- Located in `philoagents-api/src/philoagents/application/conversation_service/workflow/`
- Uses `graph.py` as main entry point
- State management in `state.py`
- Custom nodes and edges for agent reasoning

### MongoDB Integration
- Used for conversation memory (RAG)
- Collections: philosophers, business experts, conversations
- Check `philoagents-api/tools/` for memory management scripts

### Factory Pattern
- `business_expert_factory.py` and `business_user_factory.py`
- Clean separation of concerns for different agent types

### Frontend Profile Management (NEW)
- **simple-profile.js** - Profile CRUD operations module
  - Create/Edit profiles via form overlay
  - MongoDB integration for persistent storage
  - Automatic dropdown refresh after changes
  - Production-safe environment variable handling
- **MainMenu.js** - Updated UI layout
  - 2x2 grid button layout (Enter/Instructions top, Create/Edit bottom)
  - Database integration - loads business users from MongoDB
  - Dropdown selection for business profiles
  - Refresh callback system for real-time updates
- **ApiService.js** - Enhanced API client
  - Safe `process.env` handling for browser compatibility
  - Dynamic API URL detection (production/development)
  - Full CRUD methods for user management

### Webpack Configuration (FIXED)
- **config.js & config.prod.js** - Updated HtmlWebpackPlugin settings
  - Added `inject: false` to prevent duplicate script tags
  - CopyPlugin now includes simple-profile.js for profile management
  - Proper script tag management in production builds

### Profile Data Model
Business profiles include:
- `token` - Unique identifier (primary key)
- `owner_name` - Business owner name
- `business_name` - Business name
- `sector` - Industry sector
- `business_type` - Type of business
- `size` - Business size
- `challenges` - Array of business challenges
- `goals` - Array of business goals
- `current_focus` - Current business focus area

## Troubleshooting

**Ports already in use:**
```bash
make infrastructure-stop
# Kill processes on ports 27017, 8000, 8080 if needed
```

**Missing Docker images:**
```bash
make infrastructure-build
```

**API not responding:**
- Check Docker: `docker compose ps`
- View logs: `docker compose logs -f api`
- Ensure `.env` file exists with valid API keys

**MongoDB connection issues:**
- Verify MongoDB is running: `docker compose ps | grep mongo`
- Check `MONGODB_URI` in `.env` matches Docker network
- View MongoDB logs: `docker compose logs -f mongo`