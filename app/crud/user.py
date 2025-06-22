from typing import Optional

from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.crud.base import CRUDBase
from app.models.models import User
from app.schemas.user import UserCreate, UserUpdate


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    """
    User-specific CRUD operations that extend the base CRUD functionality.

    This class inherits all the basic CRUD operations (get, get_multi, create, update, delete)
    from CRUDBase and adds User-specific methods like authentication and unique field lookups.
    """

    def get_by_username(self, db: Session, *, username: str) -> Optional[User]:
        """
        Retrieve a user by their username.

        Args:
            db: SQLAlchemy database session
            username: The username to search for

        Returns:
            User object if found, None otherwise

        Example:
            user = user_crud.get_by_username(db, username="john_doe")
        """
        users = super().get_by_field(
            db=db,
            field_name="username",
            field_value=username.lower(),
            limit=1,
        )
        return users[0] if users else None

    def get_by_email(self, db: Session, *, email: str) -> Optional[User]:
        """
        Retrieve a user by their email address.

        Args:
            db: SQLAlchemy database session
            email: The email address to search for

        Returns:
            User object if found, None otherwise

        Example:
            user = user_crud.get_by_email(db, email="john@example.com")
        """
        users = super().get_by_field(
            db=db,
            field_name="email",
            field_value=email,
            limit=1,
        )
        return users[0] if users else None

    def create(self, db: Session, *, obj_in: UserCreate) -> User:
        """
        Create a new user with password hashing.

        This method overrides the base create method to handle password hashing
        before storing the user in the database.

        Args:
            db: SQLAlchemy database session
            obj_in: UserCreate schema with user data including plain text password

        Returns:
            The newly created User object (without password)

        Example:
            user_data = UserCreate(
                username="john_doe",
                email="john@example.com",
                password="my_password123",
                full_name="John Doe",
                role="user"
            )
            new_user = user_crud.create(db, obj_in=user_data)
        """  # Hash the password before storing it
        hashed_password = get_password_hash(obj_in.password)

        # Create the User object with hashed password
        # We manually create the object instead of using the base create method
        # because we need to transform the password field
        db_obj = User(
            username=obj_in.username.lower(),  # Store username in lowercase for consistency
            email=obj_in.email,
            password_hash=hashed_password,  # Store hashed password, not plain text
            full_name=obj_in.full_name,
            role=obj_in.role.lower(),  # Store role in lowercase for consistency
        )

        # Add to database session
        db.add(db_obj)

        # Commit the transaction
        db.commit()

        # Refresh to get any database-generated values (like ID, timestamps)
        db.refresh(db_obj)

        return db_obj

    def authenticate(
        self, db: Session, *, username: str, password: str
    ) -> Optional[User]:
        """
        Authenticate a user by username and password.

        Args:
            db: SQLAlchemy database session
            username: The username to authenticate
            password: The plain text password to verify

        Returns:
            User object if authentication successful, None otherwise

        Example:
            user = user_crud.authenticate(db, username="john_doe", password="my_password123")
            if user:
                print("Login successful")
            else:
                print("Invalid credentials")
        """
        # First, try to find the user by username
        user = self.get_by_username(db, username=username)

        # If user doesn't exist, return None
        if not user:
            return None  # If user exists, verify the password using bcrypt
        if not verify_password(password, str(user.password_hash)):
            return None

        # If both username and password are correct, return the user
        return user

    def update_password(
        self, db: Session, *, user_id: int, new_password: str
    ) -> Optional[User]:
        """
        Update a user's password.

        Args:
            db: SQLAlchemy database session
            user_id: ID of the user to update
            new_password: New plain text password

        Returns:
            Updated User object if successful, None if user not found

        Example:
            updated_user = user_crud.update_password(db, user_id=5, new_password="new_password123")
        """
        # Get the existing user
        user = self.get(db, id=user_id)

        if not user:
            return None  # Hash the new password
        hashed_password = get_password_hash(new_password)

        # Update the password hash using setattr
        setattr(user, "password_hash", hashed_password)

        # Commit the changes
        db.add(user)
        db.commit()
        db.refresh(user)

        return user

    def is_username_taken(
        self, db: Session, *, username: str, exclude_user_id: Optional[int] = None
    ) -> bool:
        """
        Check if a username is already taken by another user.

        Args:
            db: SQLAlchemy database session
            username: Username to check
            exclude_user_id: Optional user ID to exclude from the check (useful for updates)

        Returns:
            True if username is taken, False if available

        Example:
            # Check if username is available for new user
            is_taken = user_crud.is_username_taken(db, username="john_doe")

            # Check if username is available for user update (excluding current user)
            is_taken = user_crud.is_username_taken(db, username="john_doe", exclude_user_id=5)
        """
        users = super().get_by_field(
            db=db,
            field_name="username",
            field_value=username.lower(),
            limit=1,
        )

        if not users:
            return False

        if exclude_user_id and users[0].id == exclude_user_id:
            return False

        return True

    def is_email_taken(
        self, db: Session, *, email: str, exclude_user_id: Optional[int] = None
    ) -> bool:
        """
        Check if an email is already taken by another user.

        Args:
            db: SQLAlchemy database session
            email: Email to check
            exclude_user_id: Optional user ID to exclude from the check (useful for updates)

        Returns:
            True if email is taken, False if available

        Example:
            # Check if email is available for new user
            is_taken = user_crud.is_email_taken(db, email="john@example.com")

            # Check if email is available for user update (excluding current user)
            is_taken = user_crud.is_email_taken(db, email="john@example.com", exclude_user_id=5)
        """
        users = super().get_by_field(
            db=db,
            field_name="email",
            field_value=email,
            limit=1,
        )

        if not users:
            return False

        if exclude_user_id and users[0].id == exclude_user_id:
            return False

        return True

    def get_with_patient(self, db: Session, *, user_id: int) -> Optional[User]:
        """
        Get a user with their patient record loaded.

        Args:
            db: SQLAlchemy database session
            user_id: ID of the user

        Returns:
            User object with patient relationship loaded, or None if not found

        Example:
            user_with_patient = user_crud.get_with_patient(db, user_id=current_user.id)
            patient_info = user_with_patient.patient
        """
        return super().get_with_relations(
            db=db, record_id=user_id, relations=["patient"]
        )


# Create the user CRUD instance
user = CRUDUser(User)
