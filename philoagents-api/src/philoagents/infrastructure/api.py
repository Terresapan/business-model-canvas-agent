from contextlib import asynccontextmanager
from typing import List, Optional
import os
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from opik.integrations.langchain import OpikTracer
from pydantic import BaseModel

from philoagents.application.conversation_service.business_workflow_response import (
    get_business_response,
    get_business_streaming_response,
)
from philoagents.domain.business_expert_factory import BusinessExpertFactory
from philoagents.domain.business_user_factory import (
    BusinessUserFactory,
    DatabaseConnectionError,
    DatabaseOperationError,
    UserAlreadyExistsError,
)
from philoagents.domain.business_user import BusinessUser

import logging
from philoagents.config import settings
from urllib.parse import urlparse


# Configure logging
logging.basicConfig(level=logging.INFO)

# Log MongoDB host to verify correct URI
uri_host = urlparse(settings.MONGODB_URI).netloc
logging.info(f"MongoDB host in use: {uri_host}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database connection and create indexes
    try:
        await BusinessUserFactory.create_collection_with_index()
        print("✅ BusinessUserFactory initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize BusinessUserFactory: {e}")
        # You might want to fail startup if database is critical
        raise
    yield
    # Cleanup on shutdown
    try:
        await BusinessUserFactory.close_connections()
        print("🔌 BusinessUserFactory connections closed")
    except Exception as e:
        print(f"⚠️ Error closing database connections: {e}")


app = FastAPI(lifespan=lifespan)

# CORS configuration - allow specific origins when credentials are enabled
# Get allowed origins from environment or use defaults
allowed_origins = [
    "https://philoagents-ui-635390037922.us-central1.run.app",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

# Add environment-specific origins if available
if "CORS_ORIGINS" in os.environ:
    allowed_origins.extend(os.environ["CORS_ORIGINS"].split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- THIS IS THE NEW HEALTH CHECK ENDPOINT ---
#
@app.get("/")
async def health_check():
    """A simple health check endpoint that Cloud Run can ping."""
    return {"status": "ok"}
#
# --- END OF NEW SECTION ---

# --- DIAGNOSTIC ENDPOINT FOR DATABASE CONNECTIVITY ---
#
@app.get("/diagnostics/database")
async def database_diagnostics():
    """Diagnostic endpoint to check database connectivity and status."""
    try:
        user_factory = BusinessUserFactory()
        
        # Test connection by getting user count
        user_count = await user_factory.get_users_count()
        
        # Test by fetching all users (should return empty array if none exist)
        users = await user_factory.get_all_users()
        
        # Get MongoDB host info from settings
        uri_host = urlparse(settings.MONGODB_URI).netloc
        
        return {
            "status": "healthy",
            "database": {
                "host": uri_host,
                "connected": True,
                "user_count": user_count,
                "users_loaded": len(users)
            },
            "timestamp": __import__('datetime').datetime.utcnow().isoformat()
        }
    except DatabaseConnectionError as e:
        return {
            "status": "unhealthy",
            "database": {
                "connected": False,
                "error": f"Connection error: {str(e)}"
            },
            "timestamp": __import__('datetime').datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": {
                "connected": False,
                "error": f"Unexpected error: {str(e)}"
            },
            "timestamp": __import__('datetime').datetime.utcnow().isoformat()
        }
#
# --- END DIAGNOSTIC ENDPOINT ---

class BusinessChatMessage(BaseModel):
    message: str
    expert_id: str
    user_token: str
    image_base64: Optional[str] = None
    pdf_base64: Optional[str] = None
    pdf_name: Optional[str] = None


@app.post("/chat/business")
async def business_chat(chat_message: BusinessChatMessage):
    """Chat with a Business Canvas expert."""
    try:
        print(f"🔍 DEBUG: Received business chat request")
        print(f"🔍 DEBUG: Message: {chat_message.message[:100]}...")
        print(f"🔍 DEBUG: Expert ID: {chat_message.expert_id}")
        print(f"🔍 DEBUG: User token: {chat_message.user_token}")
        print(f"🔍 DEBUG: Has image: {bool(chat_message.image_base64)}")
        print(f"🔍 DEBUG: Has PDF: {bool(chat_message.pdf_base64)}")
        if chat_message.pdf_name:
            print(f"🔍 DEBUG: PDF name: {chat_message.pdf_name}")
        if chat_message.pdf_base64:
            print(f"🔍 DEBUG: PDF base64 length: {len(chat_message.pdf_base64)}")
        
        expert_factory = BusinessExpertFactory()
        expert = expert_factory.get_expert(chat_message.expert_id)
        print(f"🔍 DEBUG: Got expert: {expert.name} ({expert.domain})")

        # Get user context if token provided
        user_context = None
        if chat_message.user_token:
            try:
                user_factory = BusinessUserFactory()
                user = await user_factory.get_user_by_token(chat_message.user_token)
                if user:
                    user_context = user.model_dump()
                    print(f"🔍 DEBUG: Got user context for: {user_context.get('business_name', 'Unknown')}")
                else:
                    print(f"🔍 DEBUG: No user found with token: {chat_message.user_token}")
            except (DatabaseConnectionError, DatabaseOperationError) as e:
                # Continue without user context if database issues occur
                print(f"Warning: Could not retrieve user context: {e}")

        print(f"🔍 DEBUG: Starting get_business_response call...")
        response, state = await get_business_response(
            messages=chat_message.message,
            expert_id=chat_message.expert_id,
            expert_name=expert.name,
            expert_domain=expert.domain,
            expert_perspective=expert.perspective,
            expert_style=expert.style,
            expert_context=f"Domain: {expert.domain}. Expertise: {expert.perspective}",
            user_token=chat_message.user_token,
            user_context=user_context,
            image_base64=chat_message.image_base64,
            pdf_base64=chat_message.pdf_base64,
            pdf_name=chat_message.pdf_name,
        )
        print(f"🔍 DEBUG: get_business_response completed successfully")
        print(f"🔍 DEBUG: Response length: {len(response)}")
        return {"response": response}
    except Exception as e:
        print(f"❌ ERROR in business_chat: {len(str(e))} characters")
        print(f"🔍 DEBUG: Error type: {type(e)}")
        import traceback
        print(f"🔍 DEBUG: Full traceback: {traceback.format_exc()}")
        
        # Don't flush tracer if it's not available
        try:
            opik_tracer = OpikTracer()
            opik_tracer.flush()
        except:
            pass

        raise HTTPException(status_code=500, detail=str(e))


@app.get("/business/experts")
async def get_business_experts():
    """Get list of available business canvas experts."""
    try:
        expert_factory = BusinessExpertFactory()
        expert_ids = expert_factory.get_available_experts()
        
        experts = []
        for expert_id in expert_ids:
            expert = expert_factory.get_expert(expert_id)
            experts.append({
                "id": expert.id,
                "name": expert.name,
                "domain": expert.domain,
                "perspective": expert.perspective,
                "style": expert.style,
            })
        
        return {"experts": experts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/business/tokens/validate")
async def validate_token(token: str = Query(...)):
    """Validate a business user token."""
    try:
        user_factory = BusinessUserFactory()
        is_valid = await user_factory.is_valid_token(token)

        if is_valid:
            user = await user_factory.get_user_by_token(token)
            if user:
                return {
                    "valid": True,
                    "user": {
                        "business_name": user.business_name,
                        "sector": user.sector,
                        "business_type": user.business_type,
                    }
                }
            else:
                return {"valid": False}
        else:
            return {"valid": False}
    except DatabaseConnectionError as e:
        # Return false for validation failures instead of 500 error
        return {"valid": False}
    except DatabaseOperationError as e:
        # Return false for validation failures instead of 500 error
        return {"valid": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---
# --- NEW: FULL CRUD ENDPOINTS FOR BUSINESS USERS ---
# ---

# --- CREATE ---
@app.post("/business/user", status_code=status.HTTP_201_CREATED)
async def create_business_user(user: BusinessUser):
    """Creates a new business user profile."""
    print(f"=== RECEIVED CREATE USER REQUEST ===")
    print(f"Request method: POST")
    print(f"Request endpoint: /business/user")
    print(f"User data received: {user.model_dump()}")
    print(f"User token: {user.token}")
    print(f"User business_name: {user.business_name}")
    
    try:
        print("Creating BusinessUserFactory instance...")
        user_factory = BusinessUserFactory()
        print("Calling user_factory.create_user()...")
        success = await user_factory.create_user(user)
        print(f"user_factory.create_user() returned: {success}")

        if success:
            print("✅ User creation successful, returning response")
            return {
                "status": "success",
                "message": f"User '{user.business_name}' created.",
                "token": user.token
            }
        else:
            print("❌ Database write operation failed silently")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database write operation failed, but no exception was raised."
            )
    except UserAlreadyExistsError as e:
        print(f"❌ UserAlreadyExistsError: {e}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except DatabaseConnectionError as e:
        print(f"❌ DatabaseConnectionError: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed. Please try again later."
        )
    except DatabaseOperationError as e:
        print(f"❌ DatabaseOperationError: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed. Please try again."
        )
    except Exception as e:
        print(f"❌ Unexpected error in create_business_user: {e}")
        print(f"Error type: {type(e)}")
        print(f"Error args: {e.args}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

# --- READ (All) ---
@app.get("/business/users", response_model=List[BusinessUser])
async def get_all_business_users():
    """Get a list of all business user profiles."""
    try:
        user_factory = BusinessUserFactory()
        users = await user_factory.get_all_users()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- READ (One) ---
@app.get("/business/user/{token}", response_model=BusinessUser)
async def get_business_user(token: str):
    """Get a single business user profile by their token."""
    try:
        user_factory = BusinessUserFactory()
        user = await user_factory.get_user_by_token(token)
        if user:
            return user
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with token '{token}' not found."
            )
    except DatabaseConnectionError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed. Please try again later."
        )
    except DatabaseOperationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed. Please try again."
        )
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

# --- UPDATE ---
@app.put("/business/user/{token}")
async def update_business_user(token: str, user: BusinessUser):
    """Updates/Replaces a business user profile by their token."""
    try:
        user_factory = BusinessUserFactory()
        
        if token != user.token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token in URL does not match token in request body."
            )

        success = await user_factory.update_user(token, user)
        
        if success:
            return {
                "status": "success",
                "message": f"User '{user.business_name}' (token: {token}) updated."
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with token '{token}' not found. No update performed."
            )
    except DatabaseConnectionError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed. Please try again later."
        )
    except DatabaseOperationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed. Please try again."
        )
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

# --- DELETE ---
@app.delete("/business/user/{token}")
async def delete_business_user(token: str):
    """Deletes a business user profile by their token."""
    try:
        user_factory = BusinessUserFactory()
        success = await user_factory.delete_user(token)
        
        if success:
            return {
                "status": "success",
                "message": f"User with token '{token}' successfully deleted."
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with token '{token}' not found. No deletion performed."
            )
    except DatabaseConnectionError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed. Please try again later."
        )
    except DatabaseOperationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database operation failed. Please try again."
        )
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))
# ---
# --- END OF CRUD ENDPOINTS ---
# ---

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
