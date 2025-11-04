import logging
import asyncio
from typing import Optional, List
from philoagents.domain.business_user import BusinessUser
from philoagents.config import settings
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError, ConnectionFailure, OperationFailure
import threading

# Configure logging
logger = logging.getLogger(__name__)

# Custom database exceptions
class DatabaseConnectionError(Exception):
    """Exception raised when database connection fails."""
    pass

class DatabaseOperationError(Exception):
    """Exception raised when a database operation fails."""
    pass

class UserAlreadyExistsError(Exception):
    """Exception raised when trying to create a user that already exists."""
    
    def __init__(self, token: str):
        self.token = token
        self.message = f"User with token '{token}' already exists."
        super().__init__(self.message)

# --- REMOVED HARDCODED DATA ---

class BusinessUserFactory:
    _client: Optional[AsyncIOMotorClient] = None
    _collection = None
    _lock = threading.Lock()
    _index_created = False

    @classmethod
    async def create_collection_with_index(cls):
        """Creates collection and ensures unique index exists (called once at startup)."""
        if cls._index_created:
            return
            
        with cls._lock:
            if cls._index_created:  # Double-check pattern
                return
                
            try:
                if cls._client is None:
                    cls._client = AsyncIOMotorClient(
                        settings.MONGODB_URI,
                        serverSelectionTimeoutMS=5000  # 5 second timeout
                    )
                    
                    # Test connection
                    await cls._client.admin.command('ping')
                    logger.info("Successfully connected to MongoDB")
                
                db = cls._client[settings.MONGODB_DB_NAME]
                cls._collection = db[settings.MONGODB_USER_COLLECTION]
                
                # Create unique index only once
                await cls._collection.create_index("token", unique=True)
                cls._index_created = True
                logger.info("MongoDB collection and index initialized successfully")
                
            except ConnectionFailure as e:
                logger.error(f"Failed to connect to MongoDB: {e}")
                raise DatabaseConnectionError(f"Unable to connect to database: {e}") from e
            except Exception as e:
                logger.error(f"Failed to initialize database: {e}")
                raise DatabaseOperationError(f"Database initialization failed: {e}") from e

    def _get_collection(self):
        """Returns the database collection (after initialization)."""
        if self._collection is None:
            raise DatabaseConnectionError("Database not initialized. Call create_collection_with_index() first.")
        return self._collection

    # --- READ (One) ---
    async def get_user_by_token(self, token: str) -> Optional[BusinessUser]:
        """
        Retrieves a business user profile from MongoDB by their access token.
        
        Args:
            token: The unique access token for the user
            
        Returns:
            BusinessUser object if found, None otherwise
            
        Raises:
            DatabaseOperationError: If database operation fails
        """
        if not token or not isinstance(token, str):
            logger.warning(f"Invalid token provided: {token}")
            return None
            
        try:
            collection = self._get_collection()
            user_data = await collection.find_one({"token": token})
            
            if user_data:
                # Remove MongoDB _id field before creating BusinessUser
                user_data.pop('_id', None)
                return BusinessUser(**user_data)
            return None
            
        except OperationFailure as e:
            logger.error(f"Database operation failed while fetching user with token '{token}': {e}")
            raise DatabaseOperationError(f"Failed to retrieve user: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error while fetching user with token '{token}': {e}")
            raise DatabaseOperationError(f"Unexpected error retrieving user: {e}") from e

    # --- READ (All) ---
    async def get_all_users(self) -> List[BusinessUser]:
        """
        Retrieves all business user profiles from the database.
        
        Returns:
            List of BusinessUser objects
            
        Raises:
            DatabaseOperationError: If database operation fails
        """
        try:
            collection = self._get_collection()
            users = []
            cursor = collection.find({})
            
            async for user_data in cursor:
                # Remove MongoDB _id field before creating BusinessUser
                user_data.pop('_id', None)
                users.append(BusinessUser(**user_data))
                
            logger.info(f"Retrieved {len(users)} users from database")
            return users
            
        except OperationFailure as e:
            logger.error(f"Database operation failed while fetching all users: {e}")
            raise DatabaseOperationError(f"Failed to retrieve users: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error while fetching all users: {e}")
            raise DatabaseOperationError(f"Unexpected error retrieving users: {e}") from e

    # --- CREATE ---
    async def create_user(self, user: BusinessUser) -> bool:
        """
        Inserts a new business user into the database.
        
        Args:
            user: BusinessUser object to create
            
        Returns:
            True if successful
            
        Raises:
            UserAlreadyExistsError: If user with same token already exists
            DatabaseOperationError: If database operation fails
        """
        if not user or not isinstance(user, BusinessUser):
            raise ValueError("Invalid BusinessUser object provided")
            
        if not hasattr(user, 'token') or not user.token:
            raise ValueError("User must have a valid token")
            
        try:
            collection = self._get_collection()
            user_document = user.model_dump()
            
            await collection.insert_one(user_document)
            logger.info(f"Successfully created user with token '{user.token}'")
            return True
            
        except DuplicateKeyError:
            error_msg = f"User with token '{user.token}' already exists"
            logger.warning(error_msg)
            raise UserAlreadyExistsError(user.token) from None
        except OperationFailure as e:
            error_msg = f"Database operation failed while creating user '{user.token}': {e}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
        except Exception as e:
            error_msg = f"Unexpected error while creating user '{user.token}': {e}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e

    # --- UPDATE ---
    async def update_user(self, token: str, user_update_data: BusinessUser) -> bool:
        """
        Replaces an existing user document with new data.
        
        Args:
            token: The token of the user to update
            user_update_data: New BusinessUser data
            
        Returns:
            True if a document was successfully updated
            
        Raises:
            DatabaseOperationError: If database operation fails
        """
        if not token or not isinstance(token, str):
            raise ValueError("Invalid token provided")
            
        if not user_update_data or not isinstance(user_update_data, BusinessUser):
            raise ValueError("Invalid BusinessUser object provided")
            
        try:
            collection = self._get_collection()
            result = await collection.replace_one(
                {"token": token},
                user_update_data.model_dump()
            )
            
            if result.matched_count > 0:
                logger.info(f"Successfully updated user with token '{token}'")
            else:
                logger.warning(f"No user found with token '{token}' to update")
                
            return result.matched_count > 0
            
        except OperationFailure as e:
            error_msg = f"Database operation failed while updating user '{token}': {e}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
        except Exception as e:
            error_msg = f"Unexpected error while updating user '{token}': {e}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e

    # --- DELETE ---
    async def delete_user(self, token: str) -> bool:
        """
        Deletes a user document from the database by its token.
        
        Args:
            token: The token of the user to delete
            
        Returns:
            True if a document was deleted
            
        Raises:
            DatabaseOperationError: If database operation fails
        """
        if not token or not isinstance(token, str):
            raise ValueError("Invalid token provided")
            
        try:
            collection = self._get_collection()
            result = await collection.delete_one({"token": token})
            
            if result.deleted_count > 0:
                logger.info(f"Successfully deleted user with token '{token}'")
            else:
                logger.warning(f"No user found with token '{token}' to delete")
                
            return result.deleted_count > 0
            
        except OperationFailure as e:
            error_msg = f"Database operation failed while deleting user '{token}': {e}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
        except Exception as e:
            error_msg = f"Unexpected error while deleting user '{token}': {e}"
            logger.error(error_msg)
            raise DatabaseOperationError(error_msg) from e
    
    # --- Utility Methods ---
    
    async def is_valid_token(self, token: str) -> bool:
        """
        Checks if a token exists in the database.
        
        Args:
            token: The token to validate
            
        Returns:
            True if token exists, False otherwise
            
        Raises:
            DatabaseOperationError: If database operation fails
        """
        if not token or not isinstance(token, str):
            return False
            
        try:
            collection = self._get_collection()
            count = await collection.count_documents({"token": token}, limit=1)
            return count > 0
            
        except OperationFailure as e:
            logger.error(f"Database operation failed while validating token '{token}': {e}")
            raise DatabaseOperationError(f"Failed to validate token: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error while validating token '{token}': {e}")
            raise DatabaseOperationError(f"Unexpected error validating token: {e}") from e

    async def get_all_tokens(self) -> List[str]:
        """
        Returns a list of all valid tokens from the database.
        
        Returns:
            List of token strings
            
        Raises:
            DatabaseOperationError: If database operation fails
        """
        try:
            collection = self._get_collection()
            cursor = collection.find({}, {"token": 1, "_id": 0})
            tokens = []
            
            async for doc in cursor:
                token = doc.get("token")
                if token:
                    tokens.append(token)
                    
            return tokens
            
        except OperationFailure as e:
            logger.error(f"Database operation failed while fetching tokens: {e}")
            raise DatabaseOperationError(f"Failed to retrieve tokens: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error while fetching tokens: {e}")
            raise DatabaseOperationError(f"Unexpected error retrieving tokens: {e}") from e

    async def get_users_count(self) -> int:
        """
        Returns the total count of users in the database.
        
        Returns:
            Total number of users
            
        Raises:
            DatabaseOperationError: If database operation fails
        """
        try:
            collection = self._get_collection()
            count = await collection.count_documents({})
            return count
            
        except OperationFailure as e:
            logger.error(f"Database operation failed while counting users: {e}")
            raise DatabaseOperationError(f"Failed to count users: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error while counting users: {e}")
            raise DatabaseOperationError(f"Unexpected error counting users: {e}") from e

    @classmethod
    async def close_connections(cls):
        """Properly close database connections (call on shutdown)."""
        if cls._client:
            cls._client.close()
            cls._client = None
            cls._collection = None
            cls._index_created = False
            logger.info("MongoDB connections closed")

    @staticmethod
    def format_user_context(user: Optional[BusinessUser]) -> str:
        """
        Formats user context for use in prompts.
        
        Args:
            user: Optional BusinessUser object
            
        Returns:
            Formatted context string
        """
        if not user:
            return "You're speaking with a general business owner seeking guidance."
        
        return user.to_context_string()