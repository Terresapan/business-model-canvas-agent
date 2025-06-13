from functools import lru_cache

from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import tools_condition

from philoagents.application.conversation_service.workflow.edges import (
    should_summarize_business_conversation,
)
from philoagents.application.conversation_service.workflow.nodes import (
    business_conversation_node,
    business_summarize_conversation_node,
)
from philoagents.application.conversation_service.workflow.state import BusinessCanvasState
from philoagents.config import settings


@lru_cache(maxsize=1)
def create_business_workflow_graph():
    """Create the Business Model Canvas workflow graph."""
    graph_builder = StateGraph(BusinessCanvasState)

    # Add business canvas nodes
    graph_builder.add_node("business_conversation_node", business_conversation_node)
    graph_builder.add_node("business_summarize_conversation_node", business_summarize_conversation_node)

    # Define the business workflow flow
    graph_builder.add_edge(START, "business_conversation_node")
    graph_builder.add_conditional_edges("business_conversation_node", should_summarize_business_conversation)
    graph_builder.add_edge("business_summarize_conversation_node", END)
    
    return graph_builder


# Primary graph for Business Model Canvas 
graph = create_business_workflow_graph().compile()

