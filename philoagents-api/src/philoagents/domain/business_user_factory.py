from typing import Optional
from philoagents.domain.business_user import BusinessUser

BUSINESS_USER_PROFILES = {
    "Sarah's Artisan Bakery": BusinessUser(
        token="Diva Rides",
        owner_name="Diana Walker",
        business_name="Diva Rides",
        sector="independent ride-sharing service",
        business_type="a private, independent ride-sharing service. The owner, Diana, uses her personal SUVs to provide pre-scheduled and on-demand rides for cash, positioning her service as a more personal and often lower-cost alternative to platforms like Uber and Lyft",
        size="Small (2 employees)",
        challenges=[
            "Inconsistent Customer Flow: The primary challenge is the lack of a steady, consistent stream of customers. Business can be busy in the mornings but then slow down for the rest of the day, making the income unreliable.", 
            "Customer Acquisition:Relying on word-of-mouth and social media platforms like Nextdoor and Facebook has not generated a consistent enough 'traffic' of riders.",
            "Low Profit Margins: To compete with Uber and Lyft, Diana keeps her prices low, which limits her profitability and makes it difficult to absorb operational costs like vehicle maintenance and fuel.",
            "Resource Underutilization: The business owns two vehicles but lacks consistent drivers (the owner, her son, and her boyfriend are not always available), meaning the assets are not being used to their full potential.",
        ],
        goals=[
            "Immediate Goal: To establish a consistent and predictable revenue stream that is sufficient to cover personal living expenses (like her mortgage) and the costs of running the business.", 
            "Aspirational Goal: To scale the business by expanding her fleet to 4-6 newer vehicles and hiring a team of reliable drivers to work for her. She also envisions expanding into group transportation, such as providing transport for church trips.",
        ],
        current_focus="""
        Based on the consultant's guidance, the immediate focus is to move from being a general taxi service to a specialized transportation provider by concentrating on the following:
        1, Defining Target Customer Segments: Deeply analyzing and focusing on her most valuable customer groups, specifically: 1) working professionals who need reliable daily commutes and 2) elderly individuals who need transport for appointments, shopping, and church.
        2, Developing a Unique Value Proposition: Creating a clear selling point that differentiates her from Uber/Lyft. This includes offering highly reliable, pre-scheduled, and personalized service (e.g., a subscription model for a weekly churchgoer) that larger platforms cannot match.
        3, Building Stronger Customer Relationships: Shifting the model from one-off rides to building loyal, long-term relationships that ensure repeat business.
        4, Identifying Key Partners: Exploring partnerships with organizations like churches or local businesses that can provide a consistent stream of customers from her target segments."""
    ),
    "TechFix Solutions": BusinessUser(
        token="TechFix Solutions",
        owner_name="Marcus Chen", 
        business_name="TechFix Solutions",
        sector="Technology Services",
        business_type="IT Repair Shop",
        size="Small (3 employees)",
        challenges=[
            "Competition from big box stores",
            "Customer acquisition costs",
            "Unpredictable revenue streams"
        ],
        goals=[
            "Develop recurring revenue streams",
            "Expand service offerings", 
            "Build corporate client base"
        ],
        current_focus="Exploring subscription-based support models and managed IT services"
    ),
    "Bloom & Co Florist": BusinessUser(
        token="Bloom & Co Florist",
        owner_name="Isabella Rodriguez",
        business_name="Bloom & Co Florist",
        sector="Retail & Events",
        business_type="Boutique Florist",
        size="Small (4 employees)",
        challenges=[
            "Inventory management with perishables",
            "Wedding season dependency", 
            "Rising wholesale flower costs"
        ],
        goals=[
            "Diversify beyond weddings",
            "Create subscription flower service",
            "Expand corporate partnerships"
        ],
        current_focus="Developing year-round revenue streams and reducing waste through better demand forecasting"
    ),
    "FitLife Personal Training": BusinessUser(
        token="FitLife Personal Training",
        owner_name="David Thompson",
        business_name="FitLife Personal Training",
        sector="Health & Fitness",
        business_type="Personal Training Studio",
        size="Small (6 trainers)",
        challenges=[
            "Client retention after initial goals",
            "Limited physical space for growth",
            "Seasonal membership fluctuations"
        ],
        goals=[
            "Launch online training programs",
            "Increase average client lifetime value",
            "Develop corporate wellness partnerships"
        ],
        current_focus="Creating hybrid online/offline training packages and building stronger client relationships"
    ),
    "Craftworks Furniture": BusinessUser(
        token="Craftworks Furniture",
        owner_name="Elena Vasquez",
        business_name="Craftworks Furniture",
        sector="Manufacturing & Retail",
        business_type="Custom Furniture Workshop",
        size="Medium (12 employees)",
        challenges=[
            "Long production lead times",
            "Raw material cost volatility",
            "Scaling custom work processes"
        ],
        goals=[
            "Streamline production workflow",
            "Develop semi-custom product lines",
            "Expand into commercial markets"
        ],
        current_focus="Balancing custom craftsmanship with scalable business processes and exploring new revenue channels"
    ),
    "GreenThumb Landscaping": BusinessUser(
        token="GreenThumb Landscaping",
        owner_name="James Wilson",
        business_name="GreenThumb Landscaping",
        sector="Home & Garden Services", 
        business_type="Landscaping Company",
        size="Medium (15 employees)",
        challenges=[
            "Weather-dependent operations",
            "Seasonal workforce management",
            "Equipment maintenance costs"
        ],
        goals=[
            "Develop year-round service offerings",
            "Increase commercial contract revenue",
            "Improve crew efficiency and scheduling"
        ],
        current_focus="Creating maintenance contracts and exploring indoor plant services to reduce seasonal dependency"
    )
}

VALID_TOKENS = list(BUSINESS_USER_PROFILES.keys())


class BusinessUserFactory:
    @staticmethod
    def get_user_by_token(token: str) -> Optional[BusinessUser]:
        """Retrieves a business user profile by their access token.

        Args:
            token (str): Access token for the user profile

        Returns:
            Optional[BusinessUser]: Business user profile if token is valid, None otherwise
        """
        return BUSINESS_USER_PROFILES.get(token)

    @staticmethod
    def is_valid_token(token: str) -> bool:
        """Checks if a token is valid.

        Args:
            token (str): Token to validate

        Returns:
            bool: True if token is valid, False otherwise
        """
        return token in VALID_TOKENS

    @staticmethod
    def get_all_tokens() -> list[str]:
        """Returns a list of all valid tokens.

        Returns:
            list[str]: List of all valid access tokens
        """
        return VALID_TOKENS

    @staticmethod
    def format_user_context(user: Optional[BusinessUser]) -> str:
        """Formats user context for use in prompts.

        Args:
            user (Optional[BusinessUser]): Business user profile

        Returns:
            str: Formatted context string for prompts
        """
        if not user:
            return "You're speaking with a general business owner seeking guidance."
        
        return user.to_context_string()
