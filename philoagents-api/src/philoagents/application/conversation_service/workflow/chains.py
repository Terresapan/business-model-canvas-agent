from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_groq import ChatGroq

# from philoagents.application.conversation_service.workflow.tools import tools
from philoagents.config import settings
from philoagents.domain.prompts import (
    BUSINESS_EXPERT_CHARACTER_CARD,
    EXTEND_SUMMARY_PROMPT,
    SUMMARY_PROMPT,
)


def get_chat_model(temperature: float = 0.7, model_name: str = settings.GROQ_LLM_MODEL) -> ChatGroq:
    return ChatGroq(
        api_key=settings.GROQ_API_KEY,
        model_name=model_name, # type: ignore
        temperature=temperature,
    )


def get_business_expert_response_chain():
    """Chain for business canvas expert conversations."""
    model = get_chat_model()
    # Remove tools binding since we're simplifying to no long-term memory
    system_message = BUSINESS_EXPERT_CHARACTER_CARD

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_message.prompt),
            MessagesPlaceholder(variable_name="messages"),
        ],
        template_format="jinja2",
    )

    return prompt | model


def get_business_conversation_summary_chain(summary: str = ""):
    """Summary chain for business expert conversations."""
    model = get_chat_model(model_name=settings.GROQ_LLM_MODEL_CONTEXT_SUMMARY) # type: ignore

    summary_message = EXTEND_SUMMARY_PROMPT if summary else SUMMARY_PROMPT

    prompt = ChatPromptTemplate.from_messages(
        [
            MessagesPlaceholder(variable_name="messages"),
            ("human", summary_message.prompt),
        ],
        template_format="jinja2",
    )

    return prompt | model
