import uuid
from typing import Any, AsyncGenerator, Union, Dict, Optional
from philoagents.config import settings
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
# from langgraph.checkpoint.mongodb.aio import AsyncMongoDBSaver
from langgraph.checkpoint.memory import InMemorySaver
from philoagents.application.conversation_service.workflow.graph import (
    create_business_workflow_graph,
)
from philoagents.application.conversation_service.workflow.state import BusinessCanvasState

checkpointer = InMemorySaver()

async def get_business_response(
    messages: str | list[str] | list[dict[str, Any]],
    expert_id: str,
    expert_name: str,
    expert_domain: str,
    expert_perspective: str,
    expert_style: str,
    expert_context: str,
    user_token: str,
    user_context: Optional[Dict[str, Any]] = None,
    image_base64: Optional[str] = None,
    pdf_base64: Optional[str] = None,
    pdf_name: Optional[str] = None,
    new_thread: bool = False,
) -> tuple[str, BusinessCanvasState]:
    """Run a business canvas conversation through the workflow graph.

    Args:
        messages: Initial message to start the conversation.
        expert_id: Unique identifier for the business expert.
        expert_name: Name of the business expert.
        expert_domain: Business Model Canvas component domain.
        expert_perspective: Expert's approach and expertise.
        expert_style: Style of conversation.
        expert_context: Additional context about the expert.
        user_token: Unique identifier for the user to isolate conversations.
        user_context: Business user context and profile.
        image_base64: Optional base64 encoded image to include in the context.
        new_thread: Whether to create a new conversation thread.

    Returns:
        tuple[str, BusinessCanvasState]: A tuple containing:
            - The content of the last message in the conversation.
            - The final state after running the workflow.

    Raises:
        RuntimeError: If there's an error running the conversation workflow.
    """

    graph_builder = create_business_workflow_graph()

    try:
        # async with AsyncMongoDBSaver.from_conn_string(
        #     conn_string=settings.MONGO_URI, 
        #     db_name=settings.MONGO_DB_NAME, 
        #     checkpoint_collection_name=settings.MONGO_STATE_CHECKPOINT_COLLECTION, 
        #     writes_collection_name=settings.MONGO_STATE_WRITES_COLLECTION,
        # ) as checkpointer:
        graph = graph_builder.compile(checkpointer=checkpointer)

        # Generate thread ID using expert ID and user token
        thread_id = f"{expert_id}:{user_token}"
        
        # Append UUID if starting new thread
        if new_thread:
            thread_id = f"{thread_id}:{uuid.uuid4()}"
        config = {
            "configurable": {"thread_id": thread_id},
        }

        # Format messages and inject image if present
        formatted_messages = __format_messages(messages=messages)
        if image_base64:
            if formatted_messages and isinstance(formatted_messages[-1], HumanMessage):
                last_msg = formatted_messages[-1]
                # Ensure we don't already have a list content (avoid double wrapping if logic changes)
                if isinstance(last_msg.content, str):
                    last_msg.content = [
                        {"type": "text", "text": last_msg.content},
                        {"type": "image_url", "image_url": f"data:image/png;base64,{image_base64}"},
                    ]
        
        # Handle PDF and/or image processing using google-genai directly
        if pdf_base64 or image_base64:
            try:
                print(f"🔍 DEBUG: Starting file processing")
                print(f"🔍 DEBUG: Has PDF: {bool(pdf_base64)}")
                print(f"🔍 DEBUG: Has image: {bool(image_base64)}")
                
                # Add file size validation (5MB max for solo business owners)
                max_size_bytes = 5 * 1024 * 1024  # 5MB
                
                if pdf_base64:
                    pdf_size = len(pdf_base64) * 3 / 4  # base64 to bytes (approximate)
                    print(f"🔍 DEBUG: PDF base64 length: {len(pdf_base64)}")
                    print(f"🔍 DEBUG: PDF estimated size: {pdf_size:.2f} bytes")
                    print(f"🔍 DEBUG: PDF name: {pdf_name}")
                    
                    if pdf_size > max_size_bytes:
                        raise RuntimeError(f"PDF size exceeds 5MB limit. Current: {pdf_size:.2f} bytes")
                
                if image_base64:
                    image_size = len(image_base64) * 3 / 4  # base64 to bytes (approximate)
                    print(f"🔍 DEBUG: Image base64 length: {len(image_base64)}")
                    print(f"🔍 DEBUG: Image estimated size: {image_size:.2f} bytes")
                    
                    if image_size > max_size_bytes:
                        raise RuntimeError(f"Image size exceeds 5MB limit. Current: {image_size:.2f} bytes")
                
                print(f"🔍 DEBUG: GEMINI_API_KEY exists: {bool(settings.GEMINI_API_KEY)}")
                print(f"🔍 DEBUG: GEMINI_LLM_MODEL: {settings.GEMINI_LLM_MODEL}")
                
                # Import Google GenAI with detailed logging
                try:
                    from google import genai
                    from google.genai import types
                    print(f"🔍 DEBUG: Successfully imported google.genai")
                except ImportError as e:
                    print(f"❌ ERROR: Failed to import google.genai: {e}")
                    raise RuntimeError(f"Google GenAI not available: {e}")
                
                # Initialize client with error handling
                try:
                    client = genai.Client(api_key=settings.GEMINI_API_KEY)
                    print(f"🔍 DEBUG: Successfully initialized GenAI client")
                except Exception as e:
                    print(f"❌ ERROR: Failed to initialize GenAI client: {e}")
                    print(f"🔍 DEBUG: API key type: {type(settings.GEMINI_API_KEY)}")
                    print(f"🔍 DEBUG: API key length: {len(settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else 'None'}")
                    raise RuntimeError(f"Failed to initialize GenAI client: {e}")
                
                # Import base64 for file processing
                import base64
                
                # Create the content parts
                content_parts = []
                
                # Add the message text if it exists
                if formatted_messages and isinstance(formatted_messages[-1], HumanMessage):
                    if isinstance(formatted_messages[-1].content, str):
                        content_parts.append(formatted_messages[-1].content)
                        print(f"🔍 DEBUG: Added string message to content parts")
                    elif isinstance(formatted_messages[-1].content, list):
                        # Extract text from mixed content (ignore image_url parts)
                        for part in formatted_messages[-1].content:
                            if isinstance(part, dict) and part.get("type") == "text":
                                content_parts.append(part["text"])
                                print(f"🔍 DEBUG: Added text from mixed content parts")
                
                # Add the PDF if present
                if pdf_base64:
                    try:
                        print("🔍 DEBUG: Adding PDF bytes to content parts...")
                        pdf_bytes = base64.b64decode(pdf_base64)
                        print(f"🔍 DEBUG: Successfully decoded PDF base64, length: {len(pdf_bytes)}")
                        pdf_part = types.Part.from_bytes(
                            data=pdf_bytes,
                            mime_type='application/pdf',
                        )
                        print(f"🔍 DEBUG: Successfully created PDF part from {len(pdf_bytes)} bytes")
                        content_parts.append(pdf_part)
                    except Exception as e:
                        print(f"❌ ERROR: Failed to process PDF: {e}")
                        raise RuntimeError(f"Failed to process PDF: {e}")
                
                # Add the image if present
                if image_base64:
                    try:
                        print("🔍 DEBUG: Adding image to content parts...")
                        image_part = types.Part.from_bytes(
                            data=base64.b64decode(image_base64),
                            mime_type='image/png',
                        )
                        print(f"🔍 DEBUG: Successfully created image part from {len(image_base64)} base64 chars")
                        content_parts.append(image_part)
                    except Exception as e:
                        print(f"❌ ERROR: Failed to process image: {e}")
                        raise RuntimeError(f"Failed to process image: {e}")
                
                print(f"🔍 DEBUG: Content parts count: {len(content_parts)}")
                
                # Calculate token estimates for cost tracking
                estimated_tokens = 0
                for i, part in enumerate(content_parts):
                    if isinstance(part, str):
                        # Text content: roughly 4 characters per token
                        tokens = len(part) / 4
                        estimated_tokens += tokens
                        print(f"🔍 DEBUG: Part {i} (text): {len(part)} chars ≈ {tokens:.1f} tokens")
                    else:
                        # File content: use approximate conversion rates
                        if hasattr(part, 'data') and hasattr(part.data, '__len__'):
                            file_size = len(part.data)
                        elif isinstance(part, str) and part.startswith('data:'):
                            # Base64 encoded file in content
                            file_size = len(part.split(',')[1]) * 3 / 4 if ',' in part else 0
                        else:
                            file_size = 0
                        
                        # Gemini file token estimation: ~750 tokens per 1MB of file
                        file_tokens = (file_size / (1024 * 1024)) * 750
                        estimated_tokens += file_tokens
                        mime_type = getattr(part, 'mime_type', 'unknown')
                        print(f"🔍 DEBUG: Part {i} (file): {file_size} bytes ≈ {file_tokens:.1f} tokens (type: {mime_type})")
                
                print(f"🔍 DEBUG: TOTAL ESTIMATED TOKENS FOR THIS REQUEST: {estimated_tokens:.1f}")
                
                # Generate response using google-genai with detailed logging
                try:
                    print(f"🔍 DEBUG: Calling GenAI generate_content...")
                    response = client.models.generate_content(
                        model=settings.GEMINI_LLM_MODEL,
                        contents=content_parts
                    )
                    print(f"🔍 DEBUG: Successfully got response from GenAI")
                    print(f"🔍 DEBUG: Response type: {type(response)}")
                    print(f"🔍 DEBUG: Response has text: {hasattr(response, 'text')}")
                    if hasattr(response, 'text'):
                        print(f"🔍 DEBUG: Response text length: {len(response.text)}")
                except Exception as e:
                    print(f"❌ ERROR: GenAI API call failed: {e}")
                    print(f"🔍 DEBUG: Model: {settings.GEMINI_LLM_MODEL}")
                    print(f"🔍 DEBUG: Content parts types: {[type(part) for part in content_parts]}")
                    raise RuntimeError(f"GenAI API call failed: {e}")
                
                # Return the response directly
                result_state = BusinessCanvasState(
                    messages=formatted_messages + [AIMessage(content=response.text)],
                    expert_context=expert_context,
                    expert_name=expert_name,
                    expert_domain=expert_domain,
                    expert_perspective=expert_perspective,
                    expert_style=expert_style,
                    user_context=user_context,
                    summary="",
                )
                print(f"🔍 DEBUG: Successfully created result state")
                return response.text, result_state
                
            except Exception as e:
                print(f"❌ ERROR in file processing: {e}")
                print(f"🔍 DEBUG: File processing failed")
                import traceback
                print(f"🔍 DEBUG: Full traceback: {traceback.format_exc()}")
                raise RuntimeError(f"File processing failed: {e}")
        
        output_state = await graph.ainvoke(
            input={
                "messages": formatted_messages,
                "expert_context": expert_context,
                "expert_name": expert_name,
                "expert_domain": expert_domain,
                "expert_perspective": expert_perspective,
                "expert_style": expert_style,
                "user_context": user_context,
                "summary": "",
            },
            config=config, # type: ignore
        )
        last_message = output_state["messages"][-1]
        return last_message.content, BusinessCanvasState(**output_state)
    except Exception as e:
        raise RuntimeError(f"Error running business conversation workflow: {str(e)}") from e


async def get_business_streaming_response(
    messages: str | list[str] | list[dict[str, Any]],
    expert_id: str,
    expert_name: str,
    expert_domain: str,
    expert_perspective: str,
    expert_style: str,
    expert_context: str,
    user_token: str,
    user_context: Optional[Dict[str, Any]] = None,
    new_thread: bool = False,
) -> AsyncGenerator[str, None]:
    """Run a business canvas conversation through the workflow graph with streaming response.

    Args:
        messages: Initial message to start the conversation.
        expert_id: Unique identifier for the business expert.
        expert_name: Name of the business expert.
        expert_domain: Business Model Canvas component domain.
        expert_perspective: Expert's approach and expertise.
        expert_style: Style of conversation.
        expert_context: Additional context about the expert.
        user_token: Unique identifier for the user to isolate conversations.
        user_context: Business user context and profile.
        new_thread: Whether to create a new conversation thread.

    Yields:
        Chunks of the response as they become available.

    Raises:
        RuntimeError: If there's an error running the conversation workflow.
    """
    graph_builder = create_business_workflow_graph()

    try:
        # async with AsyncMongoDBSaver.from_conn_string(
        #     conn_string=settings.MONGO_URI,
        #     db_name=settings.MONGO_DB_NAME,
        #     checkpoint_collection_name=settings.MONGO_STATE_CHECKPOINT_COLLECTION,
        #     writes_collection_name=settings.MONGO_STATE_WRITES_COLLECTION,
        # ) as checkpointer:
        graph = graph_builder.compile(checkpointer=checkpointer)

        # Generate thread ID using expert ID and user token
        thread_id = f"{expert_id}:{user_token}"
        
        # Append UUID if starting new thread
        if new_thread:
            thread_id = f"{thread_id}:{uuid.uuid4()}"
        config = {
            "configurable": {"thread_id": thread_id},
        }

        async for chunk in graph.astream(
            input={
                "messages": __format_messages(messages=messages),
                "expert_context": expert_context,
                "expert_name": expert_name,
                "expert_domain": expert_domain,
                "expert_perspective": expert_perspective,
                "expert_style": expert_style,
                "user_context": user_context,
                "summary": "",
            },
            config=config, # type: ignore
            stream_mode="messages",
        ):
            if chunk[1]["langgraph_node"] == "business_conversation_node" and isinstance( # type: ignore
                chunk[0], AIMessageChunk # type: ignore
            ):
                yield chunk[0].content # type: ignore

    except Exception as e:
        raise RuntimeError(
            f"Error running streaming business conversation workflow: {str(e)}"
        ) from e


def __format_messages(
    messages: Union[str, list[str], list[dict[str, Any]]],
) -> list[Union[HumanMessage, AIMessage]]:
    """Convert various message formats to a list of LangChain message objects.

    Args:
        messages: Can be one of:
            - A single string message
            - A list of string messages
            - A list of dictionaries with 'role' and 'content' keys

    Returns:
        List[Union[HumanMessage, AIMessage]]: A list of LangChain message objects
    """

    if isinstance(messages, str):
        return [HumanMessage(content=messages)]

    if isinstance(messages, list):
        if not messages:
            return []

        # Check if it's a list of dictionaries with role/content
        if (
            isinstance(messages[0], dict)
            and "role" in messages[0]
            and "content" in messages[0]
        ):
            result = []
            for msg in messages:
                if msg["role"] == "user": # type: ignore
                    result.append(HumanMessage(content=str(msg["content"]))) # type: ignore
                elif msg["role"] == "assistant": # type: ignore
                    result.append(AIMessage(content=str(msg["content"]))) # type: ignore
            return result

        # Otherwise treat as list of strings
        return [HumanMessage(content=str(message)) for message in messages]

    return []
