from typing import Generic, TypeVar, Type, Optional, List, Union, Dict, Any
from sqlalchemy.orm import Session
from fastapi.encoders import jsonable_encoder

# Define the type variables for the Generic class
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base CRUD class with default methods to Create, Read, Update, Delete (CRUD).

    This class uses Python Generics to work with any SQLAlchemy model and its corresponding
    Pydantic schemas. When you inherit from this class, you specify the types:

    Example:
        class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
            pass

    This tells Python that:
    - ModelType = User (SQLAlchemy model)
    - CreateSchemaType = UserCreate (Pydantic schema for creating)
    - UpdateSchemaType = UserUpdate (Pydantic schema for updating)
    """

    def __init__(
        self, model: Type[ModelType], primary_key: Union[str, List[str]] = "id"
    ):
        """
        Initialize the CRUD object with a SQLAlchemy model class and primary key attribute.

        Args:
            model (Type[ModelType]): A SQLAlchemy model class (like User, Patient, etc.)
                  This is the actual class, not an instance of it
            primary_key (Union[str, List[str]]): The name(s) of the primary key attribute(s)

        Example:
            user_crud = CRUDUser(User, primary_key="user_id")  # User is the class
            # For composite keys: CRUDUser(User, primary_key=["user_id", "tenant_id"])
        """  # Import Base at runtime to avoid the TYPE_CHECKING issue
        from app.models.models import Base

        if not issubclass(model, Base):
            raise TypeError(f"Expected a subclass of Base, got {type(model).__name__}")
        self.model = model
        self.primary_key = primary_key

        # Validate that the primary key(s) exist in the model
        if isinstance(primary_key, list):
            for key in primary_key:
                if not hasattr(model, key):
                    raise ValueError(
                        f"Model {model.__name__} does not have attribute '{key}'"
                    )
        else:
            if not hasattr(model, primary_key):
                raise ValueError(
                    f"Model {model.__name__} does not have attribute '{primary_key}'"
                )

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        """
        Retrieve a single record by its ID.

        Args:
            db: SQLAlchemy database session
            id: Primary key value (usually an integer) or dict for composite keys

        Returns:
            The found record or None if not found

        Example:
            user = user_crud.get(db, id=5)  # Gets user with ID 5
        """
        if isinstance(self.primary_key, list):
            if not isinstance(id, dict):
                raise ValueError(
                    "Composite primary key requires a dictionary of key-value pairs"
                )
            filter_condition = [
                getattr(self.model, key) == id[key] for key in self.primary_key
            ]
            return db.query(self.model).filter(*filter_condition).first()
        else:
            return (
                db.query(self.model)
                .filter(getattr(self.model, self.primary_key) == id)
                .first()
            )

    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        """
        Retrieve multiple records with pagination.

        Args:
            db: SQLAlchemy database session
            skip: Number of records to skip (for pagination)
            limit: Maximum number of records to return

        Returns:
            List of records (can be empty if no records found)

        Example:
            users = user_crud.get_multi(db, skip=10, limit=5)  # Gets users 11-15
        """
        if skip < 0 or limit < 0:
            raise ValueError("skip and limit must be non-negative")

        # Query all records from the table
        # .offset(skip) skips the first 'skip' records
        # .limit(limit) restricts the result to 'limit' records
        # .all() returns a list of all matching records
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        """
        Create a new record in the database.

        Args:
            db: SQLAlchemy database session
            obj_in: Pydantic schema containing data for the new record

        Returns:
            The newly created record from the database

        Example:
            user_data = UserCreate(username="john", email="john@example.com")
            new_user = user_crud.create(db, obj_in=user_data)
        """
        # Convert Pydantic model to a dictionary that SQLAlchemy can use
        # jsonable_encoder handles datetime, UUID, and other special types
        obj_in_data = jsonable_encoder(obj_in)

        # Create a new instance of our SQLAlchemy model with the data
        # **obj_in_data unpacks the dictionary as keyword arguments
        db_obj = self.model(**obj_in_data)

        # Add the new object to the database session (staging)
        db.add(db_obj)

        # Commit the transaction to actually save to database
        db.commit()

        # Refresh the object to get any database-generated values (like auto-increment ID)
        db.refresh(db_obj)

        return db_obj

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,  # Existing record from database
        obj_in: Union[UpdateSchemaType, Dict[str, Any]],  # New data to update with
    ) -> ModelType:
        """
        Update an existing record in the database.

        Args:
            db: SQLAlchemy database session
            db_obj: The existing record to update (from database)
            obj_in: Pydantic schema or dictionary with new data

        Returns:
            The updated record from the database

        Example:
            existing_user = user_crud.get(db, id=5)
            update_data = UserUpdate(email="newemail@example.com")
            updated_user = user_crud.update(db, db_obj=existing_user, obj_in=update_data)
        """
        # Convert the existing database object to a dictionary
        # This gives us the current state of the record
        obj_data = jsonable_encoder(
            db_obj
        )  # Handle both Pydantic models and plain dictionaries
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            # Check if it's a Pydantic model with the dict method
            if hasattr(obj_in, "dict") and callable(getattr(obj_in, "dict")):
                # For Pydantic models (BaseModel instances)
                update_data = obj_in.dict(exclude_unset=True)  # type: ignore
            else:
                # Fallback for other objects
                update_data = jsonable_encoder(obj_in)

        # Validate that update_data keys match model attributes
        try:
            # Try to access SQLAlchemy table columns
            model_fields = {column.name for column in self.model.__table__.columns}  # type: ignore
        except AttributeError:
            # Fallback: use a basic set of common fields to avoid errors
            model_fields = set(obj_data.keys())

        # Update each field in the database object
        for field in obj_data:
            # Only update if the field is provided in the update data and is a valid model attribute
            if field in update_data and field in model_fields:
                # setattr() dynamically sets the attribute value
                # setattr(obj, 'name', 'John') is equivalent to obj.name = 'John'
                setattr(db_obj, field, update_data[field])

        # Add the modified object back to the session
        db.add(db_obj)

        # Commit the changes to the database
        db.commit()

        # Refresh to get the latest state from database
        db.refresh(db_obj)

        return db_obj

    def delete(self, db: Session, *, id: Union[int, Dict[str, Any]]) -> ModelType:
        """
        Delete a record from the database.

        Args:
            db: SQLAlchemy database session
            id: Primary key of the record to delete (int for single key, dict for composite keys)

        Returns:
            The deleted record (before deletion)

        Example:
            deleted_user = user_crud.delete(db, id=5)
            # For composite keys: user_crud.delete(db, id={"user_id": 1, "tenant_id": 2})

        Note: This will raise a ValueError if the record doesn't exist
        """
        # Handle composite primary keys by constructing a filter condition
        if isinstance(self.primary_key, list):
            if not isinstance(id, dict):
                raise ValueError(
                    "Composite primary key requires a dictionary of key-value pairs"
                )
            filter_condition = [
                getattr(self.model, key) == id[key] for key in self.primary_key
            ]
            obj = db.query(self.model).filter(*filter_condition).first()
        else:
            obj = (
                db.query(self.model)
                .filter(getattr(self.model, self.primary_key) == id)
                .first()
            )

        if obj is None:
            raise ValueError(f"Record with id {id} not found")

        # Remove the object from the database
        db.delete(obj)

        # Commit the deletion
        db.commit()

        # Return the deleted object (it still exists in memory)
        return obj
