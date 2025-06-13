from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from opik.integrations.langchain import OpikTracer
from pydantic import BaseModel

from philoagents.application.conversation_service.business_workflow_response import (
    get_business_response,
    get_business_streaming_response,
)
from philoagents.domain.business_expert_factory import BusinessExpertFactory
from philoagents.domain.business_user_factory import BusinessUserFactory



@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events for the API."""
    # Startup code (if any) goes here
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BusinessChatMessage(BaseModel):
    message: str
    expert_id: str
    user_token: str


@app.post("/chat/business")
async def business_chat(chat_message: BusinessChatMessage):
    """Chat with a Business Canvas expert."""
    try:
        expert_factory = BusinessExpertFactory()
        expert = expert_factory.get_expert(chat_message.expert_id)

        # Get user context if token provided
        user_context = None
        if chat_message.user_token:
            user_factory = BusinessUserFactory()
            user = user_factory.get_user_by_token(chat_message.user_token)
            if user:
                user_context = user.dict()

        response, _ = await get_business_response(
            messages=chat_message.message,
            expert_id=chat_message.expert_id,
            expert_name=expert.name,
            expert_domain=expert.domain,
            expert_perspective=expert.perspective,
            expert_style=expert.style,
            expert_context=f"Domain: {expert.domain}. Expertise: {expert.perspective}",
            user_token=chat_message.user_token,
            user_context=user_context,
        )
        return {"response": response}
    except Exception as e:
        opik_tracer = OpikTracer()
        opik_tracer.flush()

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
        is_valid = user_factory.is_valid_token(token)
        
        if is_valid:
            user = user_factory.get_user_by_token(token)
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
