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
from philoagents.application.conversation_service.langsmith_tracing import (
    traced_generate_content,
    trace_pdf_processing,
    trace_image_processing,
    create_pdf_attachment,
    create_image_attachment,
)
from philoagents.application.conversation_service.business_security import (
    business_validator,
    ValidationResult,
    BusinessContext,
)
from loguru import logger

async def file_processing_node(state: BusinessCanvasState):
    """Handle PDF and image processing within the LangGraph workflow.
    
    This node processes any PDF or image files and updates the state.
    It's traced as part of the LangGraph workflow for unified visibility.
    Enhanced with business context validation and audit logging.
    """
    pdf_base64 = state.get("pdf_base64")
    image_base64 = state.get("image_base64")
    pdf_name = state.get("pdf_name")
    user_token = state.get("user_token")
    
    # If no files to process, just mark as completed
    if not pdf_base64 and not image_base64:
        return {"file_processing_completed": True}
    
    logger.info(f"Processing files in LangGraph workflow: PDF={bool(pdf_base64)}, Image={bool(image_base64)}")
    
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
    
    try:
        # Create attachments from Base64 data
        pdf_attachment = None
        image_attachment = None
        
        # Process PDF if present
        if pdf_base64:
            logger.info(f"Processing PDF: {pdf_name}")
            pdf_attachment = create_pdf_attachment(pdf_base64, pdf_name)
            pdf_result = trace_pdf_processing(
                pdf_attachment=pdf_attachment,
                pdf_name=pdf_name,
                metadata=business_context.to_metadata()
            )
            logger.info(f"PDF processing completed: {pdf_result}")
            
            # Log successful PDF processing
            business_validator.log_file_processing_audit(
                business_context=business_context,
                file_type="pdf",
                file_name=pdf_name,
                file_size=len(pdf_base64),
                success=True
            )
        
        # Process image if present
        if image_base64:
            logger.info("Processing image")
            image_attachment = create_image_attachment(image_base64)
            image_result = trace_image_processing(
                image_attachment=image_attachment,
                metadata=business_context.to_metadata()
            )
            logger.info(f"Image processing completed: {image_result}")
            
            # Log successful image processing
            business_validator.log_file_processing_audit(
                business_context=business_context,
                file_type="image",
                file_name="image",
                file_size=len(image_base64),
                success=True
            )
        
        # Mark file processing as completed
        return {"file_processing_completed": True}
        
    except Exception as e:
        logger.error(f"Error in file processing node: {e}")
        
        # Log failed processing attempt
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
                    error_message=str(e)
                )
            if image_base64:
                business_validator.log_file_processing_audit(
                    business_context=business_context,
                    file_type="image",
                    file_name="image",
                    file_size=file_sizes["image"],
                    success=False,
                    error_message=str(e)
                )
        
        # Still mark as completed to continue workflow, but log the error
        return {
            "file_processing_completed": True,
            "file_processing_error": str(e)
        }


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
    pdf_base64 = state.get("pdf_base64")
    image_base64 = state.get("image_base64")
    pdf_name = state.get("pdf_name")
    user_token = state.get("user_token")
    
    # If files are present, always use traced GenAI processing (handles both PDF and image)
    if pdf_base64 or image_base64:
        logger.info("Processing files with GenAI in conversation node")
        
        # Validate business context before processing files
        validation_result, business_context = await business_validator.validate_business_context(
            user_token, "business_conversation_node"
        )
        
        if validation_result != ValidationResult.VALID:
            logger.error(f"Business validation failed in conversation node: {validation_result}")
            
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
            
            # Return error response
            return {
                "messages": [{"role": "assistant", "content": "File processing failed: business validation unsuccessful. Please ensure you have proper access permissions."}],
                "file_processing_completed": True,
                "file_processing_error": f"Business validation failed: {validation_result}"
            }
        
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
        
        # Create attachments from Base64 data
        pdf_attachment = None
        image_attachment = None
        
        # Create PDF attachment if present
        if pdf_base64:
            pdf_attachment = create_pdf_attachment(pdf_base64, pdf_name)
        
        # Create image attachment if present
        if image_base64:
            image_attachment = create_image_attachment(image_base64)
        
        # Enhanced metadata with business context
        enhanced_metadata = {
            "workflow_node": "business_conversation_node",
            "file_processing_in_workflow": True,
            "has_pdf": bool(pdf_base64),
            "has_image": bool(image_base64),
            **business_context.to_metadata()
        }
        
        # Use traced GenAI processing within the workflow
        response_text, trace_data = traced_generate_content(
            messages=message_content,
            pdf_attachment=pdf_attachment,
            image_attachment=image_attachment,
            pdf_name=pdf_name,
            metadata=enhanced_metadata
        )
        
        logger.info(f"File processing with GenAI completed. Response length: {len(response_text)}")
        
        # Log successful file processing
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
        
        # Return the processed response and mark files as processed
        return {
            "messages": [{"role": "assistant", "content": response_text}],
            "file_processing_completed": True
        }
    
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

