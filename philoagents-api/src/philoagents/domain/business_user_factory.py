from typing import Optional
from philoagents.domain.business_user import BusinessUser

BUSINESS_USER_PROFILES = {
    "Sarah's Artisan Bakery": BusinessUser(
        token="Sarah's Artisan Bakery",
        owner_name="Sarah Mitchell",
        business_name="Sarah's Artisan Bakery",
        sector="Food & Beverage",
        business_type="Local Bakery",
        size="Small (5 employees)",
        challenges=[
            "Limited online presence", 
            "Seasonal demand fluctuations",
            "Competition from chain bakeries"
        ],
        goals=[
            "Expand delivery service", 
            "Build customer loyalty program",
            "Increase weekend catering orders"
        ],
        current_focus="Looking to understand customer segments better, improve online ordering and decrease operational costs"
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
