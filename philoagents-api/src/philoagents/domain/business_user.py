from typing import List
from pydantic import BaseModel, Field
import uuid


class BusinessUser(BaseModel):
    """A class representing a simulated business user profile.

    Args:
        token (str): Access token for this user profile.
        owner_name (str): Name of the business owner.
        business_name (str): Name of the business.
        sector (str): Industry sector.
        challenges (List[str]): Current business challenges.
        goals (List[str]): Business goals and objectives.
    """

    token: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Access token for this user profile")
    role: str = Field(default="user", description="User role (admin or user)")
    owner_name: str = Field(description="Name of the business owner")
    business_name: str = Field(description="Name of the business")
    sector: str = Field(description="Industry sector")
    challenges: List[str] = Field(description="Current business challenges")
    goals: List[str] = Field(description="Business goals and objectives")

    def to_context_string(self) -> str:
        """Convert the business user profile to a formatted context string."""
        return f"""
                CLIENT PROFILE:
                Name: {self.owner_name} (your client)
                Business: {self.business_name}
                Sector: {self.sector}
                Current Challenges: {', '.join(self.challenges)}
                Business Goals: {', '.join(self.goals)}
                
                Note: You are meeting with {self.owner_name.split()[0]} for a business consultation. 
                They are your established client and you should know their name.
                """

    def __str__(self) -> str:
        return f"BusinessUser(token={self.token}, business_name={self.business_name}, sector={self.sector})"
