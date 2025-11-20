"""LangSmith tracing utilities for direct Google GenAI calls using @traceable decorator."""
import base64
import uuid
from typing import Any, Dict, List, Optional, Union
from google import genai
from google.genai import types

try:
    from langsmith import traceable
    from langsmith.schemas import Attachment
    LANGSMITH_AVAILABLE = True
except ImportError:
    LANGSMITH_AVAILABLE = False
    # Create a mock decorator when LangSmith is not available
    def traceable(*args, **kwargs):
        def decorator(func):
            def wrapper(*args, **kwargs):
                return func(*args, **kwargs)
            return wrapper
        return decorator
    # Create a mock Attachment class when LangSmith is not available
    class Attachment:
        def __init__(self, mime_type: str, data: Union[bytes, str]):
            self.mime_type = mime_type
            self.data = data

from philoagents.config import settings


@traceable(name="genai_pdf_image_processing", run_type="llm", dangerously_allow_filesystem=True)
def traced_generate_content(
    messages: Union[str, List[str]],
    pdf_attachment: Optional[Attachment] = None,
    image_attachment: Optional[Attachment] = None,
    pdf_name: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> tuple[str, Dict[str, Any]]:
    """
    Generate content using Google GenAI with automatic LangSmith tracing.
    
    This function is automatically traced by LangSmith using the @traceable decorator.
    It captures inputs, outputs, and execution metadata without manual intervention.
    
    Args:
        messages: Input messages
        pdf_attachment: Optional PDF attachment (binary data)
        image_attachment: Optional image attachment (binary data)
        pdf_name: Name of the PDF file
        metadata: Optional metadata
    
    Returns:
        tuple of (response_text, trace_metadata)
    """
    
    # Initialize Google GenAI client
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Create content parts
    content_parts = []
    
    # Add message text
    if isinstance(messages, str):
        content_parts.append(messages)
    elif isinstance(messages, list):
        content_parts.extend(messages)
    
    # Add PDF if present - use binary data directly from attachment
    if pdf_attachment:
        pdf_part = types.Part.from_bytes(
            data=pdf_attachment.data,
            mime_type='application/pdf',
        )
        content_parts.append(pdf_part)
    
    # Add image if present - use binary data directly from attachment
    if image_attachment:
        image_part = types.Part.from_bytes(
            data=image_attachment.data,
            mime_type='image/png',
        )
        content_parts.append(image_part)
    
    # Generate response
    response = client.models.generate_content(
        model=settings.GEMINI_LLM_MODEL,
        contents=content_parts
    )
    
    # Prepare output data for metadata
    output_data = {
        "response_text": response.text,
        "model_used": settings.GEMINI_LLM_MODEL,
        "content_parts_count": len(content_parts),
        "operation_id": str(uuid.uuid4()),
    }
    
    # Add file-specific metadata
    if pdf_attachment:
        output_data["pdf_size"] = len(pdf_attachment.data)
        output_data["pdf_name"] = pdf_name
    if image_attachment:
        output_data["image_size"] = len(image_attachment.data)
    
    # Add custom metadata to the trace
    if metadata:
        output_data.update(metadata)
    
    return response.text, output_data


@traceable(name="pdf_processing", run_type="tool", tags=["file_processing", "pdf"])
def trace_pdf_processing(
    pdf_attachment: Attachment,
    pdf_name: Optional[str] = None,
    max_size_bytes: int = 5 * 1024 * 1024,  # 5MB default
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Trace PDF processing operations with automatic LangSmith tracing.
    
    Args:
        pdf_attachment: PDF attachment (binary data)
        pdf_name: Name of the PDF file
        max_size_bytes: Maximum allowed file size
        metadata: Optional metadata to include in the trace
    
    Returns:
        Dictionary with processing results and metadata
    """
    
    pdf_size = len(pdf_attachment.data)
    
    if pdf_size > max_size_bytes:
        raise RuntimeError(f"PDF size exceeds limit. Current: {pdf_size:.2f} bytes, Max: {max_size_bytes} bytes")
    
    # Verify PDF data is valid bytes
    try:
        if isinstance(pdf_attachment.data, str):
            # If it's a string, decode from base64
            pdf_bytes = base64.b64decode(pdf_attachment.data)
        else:
            # If it's already bytes, use directly
            pdf_bytes = pdf_attachment.data
        
        result = {
            "success": True,
            "pdf_size": pdf_size,
            "pdf_name": pdf_name,
            "decoded_size": len(pdf_bytes),
            "status": "processed"
        }
        
        # Add metadata to the result if provided
        if metadata:
            result.update(metadata)
            
        return result
    except Exception as e:
        raise RuntimeError(f"Failed to process PDF: {e}")


@traceable(name="image_processing", run_type="tool", tags=["file_processing", "image"])
def trace_image_processing(
    image_attachment: Attachment,
    max_size_bytes: int = 5 * 1024 * 1024,  # 5MB default
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Trace image processing operations with automatic LangSmith tracing.
    
    Args:
        image_attachment: Image attachment (binary data)
        max_size_bytes: Maximum allowed file size
        metadata: Optional metadata to include in the trace
    
    Returns:
        Dictionary with processing results and metadata
    """
    
    image_size = len(image_attachment.data)
    
    if image_size > max_size_bytes:
        raise RuntimeError(f"Image size exceeds limit. Current: {image_size:.2f} bytes, Max: {max_size_bytes} bytes")
    
    # Verify image data is valid bytes
    try:
        if isinstance(image_attachment.data, str):
            # If it's a string, decode from base64
            image_bytes = base64.b64decode(image_attachment.data)
        else:
            # If it's already bytes, use directly
            image_bytes = image_attachment.data
        
        result = {
            "success": True,
            "image_size": image_size,
            "decoded_size": len(image_bytes),
            "status": "processed"
        }
        
        # Add metadata to the result if provided
        if metadata:
            result.update(metadata)
            
        return result
    except Exception as e:
        raise RuntimeError(f"Failed to process image: {e}")


# Utility functions for creating attachments

def create_pdf_attachment(pdf_base64: str, pdf_name: Optional[str] = None) -> Attachment:
    """
    Create a PDF attachment from base64 data.
    
    Args:
        pdf_base64: Base64 encoded PDF data
        pdf_name: Optional name for the PDF
    
    Returns:
        Attachment object with PDF data
    """
    pdf_bytes = base64.b64decode(pdf_base64)
    return Attachment(mime_type="application/pdf", data=pdf_bytes)


def create_image_attachment(image_base64: str, mime_type: str = "image/png") -> Attachment:
    """
    Create an image attachment from base64 data.
    
    Args:
        image_base64: Base64 encoded image data
        mime_type: MIME type of the image (default: image/png)
    
    Returns:
        Attachment object with image data
    """
    image_bytes = base64.b64decode(image_base64)
    return Attachment(mime_type=mime_type, data=image_bytes)


@traceable(name="business_workflow_execution", run_type="chain", tags=["workflow", "langgraph"])
def trace_workflow_execution(
    operation_name: str,
    inputs: Dict[str, Any],
    outputs: Optional[Dict[str, Any]] = None,
    error: Optional[Exception] = None,
) -> Any:
    """
    Trace workflow execution with automatic LangSmith tracing.
    
    Args:
        operation_name: Name of the workflow operation
        inputs: Input parameters
        outputs: Optional output results
        error: Optional error that occurred
    
    Returns:
        The result of the workflow operation or re-raises the error
    """
    
    if error:
        # Re-raise the error to let LangSmith capture it
        raise error
    
    return outputs


@traceable(name="streaming_workflow_execution", run_type="chain", tags=["workflow", "streaming"])
def trace_streaming_workflow_execution(
    operation_name: str,
    inputs: Dict[str, Any],
) -> Any:
    """
    Trace streaming workflow execution with automatic LangSmith tracing.
    
    Args:
        operation_name: Name of the streaming workflow operation
        inputs: Input parameters
    
    Returns:
        The result of the streaming workflow operation
    """
    
    # This will be used to wrap streaming operations
    # The actual streaming logic will be handled by the caller
    return {"status": "streaming_initiated", "inputs": inputs}


# Utility function to check if tracing is enabled
def is_tracing_enabled() -> bool:
    """Check if LangSmith tracing is properly configured and enabled."""
    if not LANGSMITH_AVAILABLE:
        return False
    
    if not settings.LANGSMITH_API_KEY:
        return False
    
    return settings.LANGSMITH_TRACING


# Convenience function to get tracing status
def get_tracing_status() -> Dict[str, Any]:
    """Get current tracing configuration status."""
    return {
        "langsmith_available": LANGSMITH_AVAILABLE,
        "api_key_configured": bool(settings.LANGSMITH_API_KEY),
        "tracing_enabled": settings.LANGSMITH_TRACING,
        "project_name": settings.LANGSMITH_PROJECT,
        "tracing_active": is_tracing_enabled(),
    }