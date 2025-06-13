from langgraph.graph import MessagesState
from typing import Optional, Dict, Any


class BusinessCanvasState(MessagesState):
    """State class for the LangGraph workflow for Business Canvas Expert conversations.

    Attributes:
        expert_context (str): The business context and expertise of the expert.
        expert_name (str): The name of the business expert.
        expert_domain (str): The Business Model Canvas component they specialize in.
        expert_perspective (str): The expert's approach and expertise.
        expert_style (str): The expert's communication style.
        user_context (Optional[Dict[str, Any]]): The business user's context and profile.
        summary (str): A summary of the conversation. This is used to reduce the token usage of the model.
    """

    expert_context: str
    expert_name: str
    expert_domain: str
    expert_perspective: str
    expert_style: str
    user_context: Optional[Dict[str, Any]]
    summary: str


def business_state_to_str(state: BusinessCanvasState) -> str:
    if "summary" in state and bool(state["summary"]):
        conversation = state["summary"]
    elif "messages" in state and bool(state["messages"]):
        conversation = state["messages"]
    else:
        conversation = ""

    user_info = state.get("user_context", {})
    user_business = user_info.get("business_name", "Unknown") if user_info else "Unknown"

    return f"""
            BusinessCanvasState(expert_context={state["expert_context"]}, 
            expert_name={state["expert_name"]}, 
            expert_domain={state["expert_domain"]}, 
            expert_perspective={state["expert_perspective"]}, 
            expert_style={state["expert_style"]}, 
            user_business={user_business},
            conversation={conversation})
        """
