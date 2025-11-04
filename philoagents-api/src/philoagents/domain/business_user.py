from typing import List
from pydantic import BaseModel, Field


class BusinessUser(BaseModel):
    """A class representing a simulated business user profile.

    Args:
        token (str): Access token for this user profile.
        owner_name (str): Name of the business owner.
        business_name (str): Name of the business.
        sector (str): Industry sector.
        business_type (str): Type of business (e.g., "Local Bakery").
        size (str): Business size description.
        challenges (List[str]): Current business challenges.
        goals (List[str]): Business goals and objectives.
        current_focus (str): What the business is currently focusing on.
    """

    token: str = Field(description="Access token for this user profile", min_length=1)
    owner_name: str = Field(description="Name of the business owner")
    business_name: str = Field(description="Name of the business")
    sector: str = Field(description="Industry sector")
    business_type: str = Field(description="Type of business")
    size: str = Field(description="Business size description")
    challenges: List[str] = Field(description="Current business challenges")
    goals: List[str] = Field(description="Business goals and objectives")
    current_focus: str = Field(description="What the business is currently focusing on")

    def to_context_string(self) -> str:
        """Convert the business user profile to a formatted context string."""
        return f"""
                CLIENT PROFILE:
                Name: {self.owner_name} (your client)
                Business: {self.business_name}
                Business Type: {self.business_type} in {self.sector}
                Team Size: {self.size}
                Current Challenges: {', '.join(self.challenges)}
                Business Goals: {', '.join(self.goals)}
                Current Focus: {self.current_focus}
                
                Note: You are meeting with {self.owner_name.split()[0]} for a business consultation. 
                They are your established client and you should know their name.
                """

    def __str__(self) -> str:
        return f"BusinessUser(token={self.token}, business_name={self.business_name}, sector={self.sector})"
