from langchain_core.messages import RemoveMessage
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import ToolNode

from philoagents.application.conversation_service.workflow.chains import (
    get_business_conversation_summary_chain,
    get_business_expert_response_chain,
)

from philoagents.application.conversation_service.workflow.state import BusinessCanvasState
from philoagents.config import settings
from philoagents.domain.business_user_factory import BusinessUserFactory
from philoagents.domain.business_user import BusinessUser
from loguru import logger

async def business_conversation_node(state: BusinessCanvasState, config: RunnableConfig):
    """Business canvas expert conversation node."""
    summary = state.get("summary", "")
    conversation_chain = get_business_expert_response_chain()

    # Format user context for the prompt
    user_context_section = ""
    user_context_data = state.get("user_context")
    if user_context_data:
        try:
            # Reconstruct BusinessUser from dict if needed
            user = BusinessUser(**user_context_data)
            user_context_section = BusinessUserFactory.format_user_context(user)
        except Exception as e:
            logger.error(f"Error reconstructing BusinessUser in workflow node: {e}")
            user_context_section = "You're speaking with a business owner seeking guidance."
    else:
        user_context_section = BusinessUserFactory.format_user_context(None)

    response = await conversation_chain.ainvoke(
        {
            "messages": state["messages"],
            "expert_context": state["expert_context"],
            "expert_name": state["expert_name"],
            "expert_domain": state["expert_domain"],
            "expert_perspective": state["expert_perspective"],
            "expert_style": state["expert_style"],
            "user_context_section": user_context_section,
            "summary": summary,
        },
        config,
    )
    
    return {"messages": response}

async def business_summarize_conversation_node(state: BusinessCanvasState):
    """Business expert conversation summary node."""
    summary = state.get("summary", "")
    summary_chain = get_business_conversation_summary_chain(summary)

    response = await summary_chain.ainvoke(
        {
            "messages": state["messages"],
            "expert_name": state["expert_name"],
            "summary": summary,
        }
    )

    delete_messages = [
        RemoveMessage(id=m.id) # type: ignore
        for m in state["messages"][: -settings.TOTAL_MESSAGES_AFTER_SUMMARY]
    ]
    return {"summary": response.content, "messages": delete_messages}

