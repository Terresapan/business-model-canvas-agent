import uuid
from typing import Any, AsyncGenerator, Union, Dict, Optional

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
