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
from philoagents.application.conversation_service.business_security import (
    business_validator,
    ValidationResult,
    BusinessContext,
)
from loguru import logger

def _sanitize_base64(b64_string: str | None) -> str | None:
    """Sanitize base64 string, handling Swagger placeholders and padding."""
    if not b64_string or b64_string == "string":
        return None
    
    # Fix padding if needed
    missing_padding = len(b64_string) % 4
    if missing_padding:
        b64_string += "=" * (4 - missing_padding)
    return b64_string

async def file_processing_node(state: BusinessCanvasState):
    """Handle PDF and image processing validation within the LangGraph workflow.
    
    This node validates business context for file operations.
    Actual file content is now passed directly to the LLM via LangChain.
    """
    pdf_base64 = _sanitize_base64(state.get("pdf_base64"))
    image_base64 = _sanitize_base64(state.get("image_base64"))
    pdf_name = state.get("pdf_name")
    user_token = state.get("user_token")
    
    # If no files to process, just mark as completed
    if not pdf_base64 and not image_base64:
        return {"file_processing_completed": True}
    
    logger.info(f"Validating file access in LangGraph workflow: PDF={bool(pdf_base64)}, Image={bool(image_base64)}")
    
    # Validate business context before processing files
    validation_result, business_context = await business_validator.validate_business_context(
        user_token, "file_processing_node"
    )
    
    if validation_result != ValidationResult.VALID:
        logger.error(f"Business validation failed in file processing node: {validation_result}")
        # Log failed attempt for audit
        if business_context:
            file_sizes = {
                "pdf": len(pdf_base64) if pdf_base64 else 0,
                "image": len(image_base64) if image_base64 else 0
            }
            
            if pdf_base64:
                business_validator.log_file_processing_audit(
                    business_context=business_context,
                    file_type="pdf",
                    file_name=pdf_name,
                    file_size=file_sizes["pdf"],
                    success=False,
                    error_message=f"Validation failed: {validation_result}"
                )
            if image_base64:
                business_validator.log_file_processing_audit(
                    business_context=business_context,
                    file_type="image",
                    file_name="image",
                    file_size=file_sizes["image"],
                    success=False,
                    error_message=f"Validation failed: {validation_result}"
                )
        
        # Continue workflow but mark processing as failed
        return {
            "file_processing_completed": True,
            "file_processing_error": f"Business validation failed: {validation_result}"
        }
    
    # Log successful validation/access
    if business_context:
        if pdf_base64:
            business_validator.log_file_processing_audit(
                business_context=business_context,
                file_type="pdf",
                file_name=pdf_name,
                file_size=len(pdf_base64),
                success=True
            )
        if image_base64:
            business_validator.log_file_processing_audit(
                business_context=business_context,
                file_type="image",
                file_name="image",
                file_size=len(image_base64),
                success=True
            )

    # Mark file processing as completed (validation passed)
    return {"file_processing_completed": True}


async def business_conversation_node(state: BusinessCanvasState, config: RunnableConfig):
    """Business canvas expert conversation node.
    
    This node handles the actual conversation, including any file processing
    results that were processed in the previous workflow step.
    """
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

    # Check if we need to process files - always use traced GenAI when files are present
    pdf_base64 = _sanitize_base64(state.get("pdf_base64"))
    image_base64 = _sanitize_base64(state.get("image_base64"))
    pdf_name = state.get("pdf_name")
    user_token = state.get("user_token")
    
    # If files are present, use LangChain's native multimodal support
    if pdf_base64 or image_base64:
        logger.info("Processing files with LangChain native support in conversation node")
        
        # Extract the last message content
        last_message = state["messages"][-1] if state["messages"] else None
        message_content = ""
        if last_message and hasattr(last_message, 'content'):
            if isinstance(last_message.content, str):
                message_content = last_message.content
            elif isinstance(last_message.content, list):
                # Extract text from mixed content
                for part in last_message.content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        message_content = part["text"]
                        break
        
        # Construct the message content list
        content_parts = [{"type": "text", "text": message_content}]
        
        if pdf_base64:
            content_parts.append({
                "type": "file",
                "base64": pdf_base64,
                "mime_type": "application/pdf",
            })
            
        if image_base64:
            content_parts.append({
                "type": "image_url",
                "image_url": f"data:image/png;base64,{image_base64}",
            })
            
        # Create a new HumanMessage with the multimodal content
        from langchain_core.messages import HumanMessage
        multimodal_message = HumanMessage(content=content_parts)
        
        # Replace the last message with the multimodal one for this turn
        # Note: We don't want to permanently mutate the history with the base64 data if we can avoid it,
        # but for the chain invocation we need it.
        
        # Invoke the chain with the multimodal message
        # We need to manually invoke the model here or adjust the chain input
        
        # Option 1: Use the existing chain but override the messages
        # The chain expects a list of messages. We'll replace the last one.
        messages_for_chain = state["messages"][:-1] + [multimodal_message]
        
        response = await conversation_chain.ainvoke(
            {
                "messages": messages_for_chain,
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
    
    # Regular conversation without files
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

