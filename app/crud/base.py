from datetime import datetime, timedelta
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union

from fastapi.encoders import jsonable_encoder
from sqlalchemy import and_, asc, desc, or_
from sqlalchemy.orm import Session, joinedload

# Define the type variables for the Generic class
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


class QueryMixin:
    """
    Mixin providing common query patterns for CRUD operations.

    This mixin provides generic methods for common filtering patterns
    that are repeated across multiple CRUD classes.

    Note: This mixin expects the class using it to have a 'model' attribute.
    """

    model: Type[Any]  # Type hint for the model attribute

    def get_by_field(
        self,
        db: Session,
        *,
        field_name: str,
        field_value: Any,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = True,
        additional_filters: Optional[Dict[str, Any]] = None,
        load_relations: Optional[List[str]] = None,
    ) -> List[ModelType]:
        """
        Generic method to get records by any field with optional additional filters.

        Args:
            db: Database session
            field_name: Name of the field to filter by
            field_value: Value to filter for
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Field name to order by (defaults to 'id' if not specified)
            order_desc: Whether to order in descending order
            additional_filters: Additional field filters as {field_name: value}
            load_relations: List of relationship names to eager load

        Returns:
            List of records matching the criteria

        Example:
            # Get all medications for patient 5
            meds = medication.get_by_field(db, field_name="patient_id", field_value=5)

            # Get active medications for patient 5
            active_meds = medication.get_by_field(
                db,
                field_name="patient_id",
                field_value=5,
                additional_filters={"status": "active"}
            )
        """
        if not hasattr(self.model, field_name):
            raise ValueError(
                f"Model {self.model.__name__} does not have field '{field_name}'"
            )

        # Start with base query
        query = db.query(self.model)

        # Apply main filter
        field = getattr(self.model, field_name)
        query = query.filter(field == field_value)

        # Apply additional filters
        if additional_filters:
            for filter_field, filter_value in additional_filters.items():
                if hasattr(self.model, filter_field):
                    field = getattr(self.model, filter_field)
                    query = query.filter(field == filter_value)

        # Apply ordering
        if order_by:
            if hasattr(self.model, order_by):
                order_field = getattr(self.model, order_by)
                if order_desc:
                    query = query.order_by(desc(order_field))
                else:
                    query = query.order_by(asc(order_field))
        else:
            # Default ordering by id
            if order_desc:
                query = query.order_by(desc(self.model.id))
            else:
                query = query.order_by(asc(self.model.id))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        # Load relationships if specified
        if load_relations:
            for relation in load_relations:
                if hasattr(self.model, relation):
                    query = query.options(joinedload(getattr(self.model, relation)))

        return query.all()

    def get_by_date_range(
        self,
        db: Session,
        *,
        date_field: str,
        start_date: datetime,
        end_date: datetime,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = True,
        additional_filters: Optional[Dict[str, Any]] = None,
        load_relations: Optional[List[str]] = None,
    ) -> List[ModelType]:
        """
        Generic method to get records within a date range.

        Args:
            db: Database session
            date_field: Name of the date field to filter by
            start_date: Start of date range
            end_date: End of date range
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Field name to order by (defaults to date_field)
            order_desc: Whether to order in descending order
            additional_filters: Additional field filters
            load_relations: List of relationship names to eager load

        Returns:
            List of records within the date range
        """
        if not hasattr(self.model, date_field):
            raise ValueError(
                f"Model {self.model.__name__} does not have field '{date_field}'"
            )

        # Start with base query
        query = db.query(self.model)

        # Apply date range filter
        date_attr = getattr(self.model, date_field)
        query = query.filter(and_(date_attr >= start_date, date_attr <= end_date))

        # Apply additional filters
        if additional_filters:
            for filter_field, filter_value in additional_filters.items():
                if hasattr(self.model, filter_field):
                    field = getattr(self.model, filter_field)
                    query = query.filter(field == filter_value)

        # Apply ordering (default to date field)
        order_field_name = order_by or date_field
        if hasattr(self.model, order_field_name):
            order_field = getattr(self.model, order_field_name)
            if order_desc:
                query = query.order_by(desc(order_field))
            else:
                query = query.order_by(asc(order_field))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        # Load relationships if specified
        if load_relations:
            for relation in load_relations:
                if hasattr(self.model, relation):
                    query = query.options(joinedload(getattr(self.model, relation)))

        return query.all()

    def get_recent_records(
        self,
        db: Session,
        *,
        date_field: str,
        days: int = 7,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = True,
        additional_filters: Optional[Dict[str, Any]] = None,
        load_relations: Optional[List[str]] = None,
    ) -> List[ModelType]:
        """
        Generic method to get recent records from the last N days.

        Args:
            db: Database session
            date_field: Name of the date field to filter by
            days: Number of days back to look
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Field name to order by (defaults to date_field)
            order_desc: Whether to order in descending order
            additional_filters: Additional field filters
            load_relations: List of relationship names to eager load

        Returns:
            List of recent records
        """
        cutoff_date = datetime.now() - timedelta(days=days)
        end_date = datetime.now()

        return self.get_by_date_range(
            db=db,
            date_field=date_field,
            start_date=cutoff_date,
            end_date=end_date,
            skip=skip,
            limit=limit,
            order_by=order_by,
            order_desc=order_desc,
            additional_filters=additional_filters,
            load_relations=load_relations,
        )

    def get_by_patient(
        self,
        db: Session,
        *,
        patient_id: int,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = True,
        additional_filters: Optional[Dict[str, Any]] = None,
        load_relations: Optional[List[str]] = None,
    ) -> List[ModelType]:
        """
        Get records by patient_id with optional additional filters.

        Args:
            db: Database session
            patient_id: Patient ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Field name to order by
            order_desc: Whether to order in descending order
            additional_filters: Additional field filters
            load_relations: List of relationship names to eager load

        Returns:
            List of records for the patient
        """
        return self.get_by_field(
            db=db,
            field_name="patient_id",
            field_value=patient_id,
            skip=skip,
            limit=limit,
            order_by=order_by,
            order_desc=order_desc,
            additional_filters=additional_filters,
            load_relations=load_relations,
        )

    def get_by_practitioner(
        self,
        db: Session,
        *,
        practitioner_id: int,
        patient_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = True,
        additional_filters: Optional[Dict[str, Any]] = None,
        load_relations: Optional[List[str]] = None,
    ) -> List[ModelType]:
        """
        Get records by practitioner_id with optional patient filter.

        Args:
            db: Database session
            practitioner_id: Practitioner ID to filter by
            patient_id: Optional patient ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Field name to order by
            order_desc: Whether to order in descending order
            additional_filters: Additional field filters
            load_relations: List of relationship names to eager load

        Returns:
            List of records for the practitioner
        """
        filters = {"practitioner_id": practitioner_id}
        if patient_id:
            filters["patient_id"] = patient_id

        if additional_filters:
            filters.update(additional_filters)

        return self.get_by_field(
            db=db,
            field_name="practitioner_id",
            field_value=practitioner_id,
            skip=skip,
            limit=limit,
            order_by=order_by,
            order_desc=order_desc,
            additional_filters=additional_filters,
            load_relations=load_relations,
        )

    def get_by_status(
        self,
        db: Session,
        *,
        status: str,
        patient_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = True,
        additional_filters: Optional[Dict[str, Any]] = None,
        load_relations: Optional[List[str]] = None,
    ) -> List[ModelType]:
        """
        Get records by status with optional patient filter.

        Args:
            db: Database session
            status: Status to filter by
            patient_id: Optional patient ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Field name to order by
            order_desc: Whether to order in descending order
            additional_filters: Additional field filters
            load_relations: List of relationship names to eager load

        Returns:
            List of records with the specified status
        """
        filters: Dict[str, Any] = {"status": status.lower()}
        if patient_id:
            filters["patient_id"] = patient_id

        if additional_filters:
            filters.update(additional_filters)

        return self.get_by_field(
            db=db,
            field_name="status",
            field_value=status.lower(),
            skip=skip,
            limit=limit,
            order_by=order_by,
            order_desc=order_desc,
            additional_filters=additional_filters,
            load_relations=load_relations,
        )

    def search_by_text_field(
        self,
        db: Session,
        *,
        field_name: str,
        search_term: str,
        patient_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = True,
        additional_filters: Optional[Dict[str, Any]] = None,
        load_relations: Optional[List[str]] = None,
    ) -> List[ModelType]:
        """
        Search records by text field using ILIKE pattern matching.

        Args:
            db: Database session
            field_name: Name of the text field to search
            search_term: Text to search for
            patient_id: Optional patient ID to filter by
            skip: Number of records to skip
            limit: Maximum number of records to return
            order_by: Field name to order by
            order_desc: Whether to order in descending order
            additional_filters: Additional field filters
            load_relations: List of relationship names to eager load

        Returns:
            List of records matching the search criteria
        """
        if not hasattr(self.model, field_name):
            raise ValueError(
                f"Model {self.model.__name__} does not have field '{field_name}'"
            )

        # Start with base query
        query = db.query(self.model)

        # Apply text search filter
        field = getattr(self.model, field_name)
        search_pattern = f"%{search_term}%"
        query = query.filter(field.ilike(search_pattern))

        # Apply patient filter if specified
        if patient_id:
            if hasattr(self.model, "patient_id"):
                query = query.filter(self.model.patient_id == patient_id)

        # Apply additional filters
        if additional_filters:
            for filter_field, filter_value in additional_filters.items():
                if hasattr(self.model, filter_field):
                    field = getattr(self.model, filter_field)
                    query = query.filter(field == filter_value)

        # Apply ordering
        if order_by:
            if hasattr(self.model, order_by):
                order_field = getattr(self.model, order_by)
                if order_desc:
                    query = query.order_by(desc(order_field))
                else:
                    query = query.order_by(asc(order_field))
        else:
            # Default ordering by id
            if order_desc:
                query = query.order_by(desc(self.model.id))
            else:
                query = query.order_by(asc(self.model.id))

        # Apply pagination
        query = query.offset(skip).limit(limit)

        # Load relationships if specified
        if load_relations:
            for relation in load_relations:
                if hasattr(self.model, relation):
                    query = query.options(joinedload(getattr(self.model, relation)))

        return query.all()

    def get_with_relations(
        self, db: Session, *, record_id: int, relations: List[str]
    ) -> Optional[ModelType]:
        """
        Get a single record with specified relationships loaded.

        Args:
            db: Database session
            record_id: ID of the record to retrieve
            relations: List of relationship names to eager load

        Returns:
            Record with relationships loaded, or None if not found
        """
        query = db.query(self.model)

        # Load specified relationships
        for relation in relations:
            if hasattr(self.model, relation):
                query = query.options(joinedload(getattr(self.model, relation)))

        return query.filter(self.model.id == record_id).first()


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType], QueryMixin):
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
        """
        # Import Base at runtime to avoid the TYPE_CHECKING issue
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
            return db.query(self.model).filter(*filter_condition).first()  # type: ignore
        else:
            return (
                db.query(self.model)
                .filter(getattr(self.model, self.primary_key) == id)
                .first()  # type: ignore
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
        Create a new record in the database with sequence protection.

        Args:
            db: SQLAlchemy database session
            obj_in: Pydantic schema containing data for the new record

        Returns:
            The newly created record from the database

        Example:
            user_data = UserCreate(username="john", email="john@example.com")
            new_user = user_crud.create(db, obj_in=user_data)
        """
        from sqlalchemy.exc import IntegrityError

        from app.core.logging_config import get_logger

        logger = get_logger(__name__, "crud")

        # Convert Pydantic model to a dictionary that SQLAlchemy can use
        # jsonable_encoder handles datetime, UUID, and other special types
        obj_in_data = jsonable_encoder(obj_in)

        # Ensure no ID is being passed for auto-increment fields
        if hasattr(self.model, "id") and "id" in obj_in_data:
            logger.warning(
                f"Removing explicit ID from {self.model.__name__} creation data"
            )
            del obj_in_data["id"]

        max_retries = 3
        for attempt in range(max_retries):
            try:
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

            except IntegrityError as e:
                db.rollback()

                # Check if it's a unique constraint violation on primary key
                if "duplicate key value violates unique constraint" in str(
                    e
                ) and "_pkey" in str(e):
                    logger.warning(
                        f"Primary key collision detected for {self.model.__name__} "
                        f"(attempt {attempt + 1}/{max_retries}). Attempting sequence fix..."
                    )

                    # Try to fix the sequence
                    if self._fix_sequence(db):
                        logger.info(
                            f"Sequence fixed for {self.model.__name__}, retrying..."
                        )
                        continue
                    else:
                        logger.error(
                            f"Failed to fix sequence for {self.model.__name__}"
                        )

                # Re-raise the error if it's not a sequence issue or we can't fix it
                raise  # If we've exhausted all retries
        sequence_error = Exception(f"Sequence issues after {max_retries} attempts")
        raise IntegrityError(
            statement=f"Failed to create {self.model.__name__} after {max_retries} attempts due to sequence issues",
            params=None,
            orig=sequence_error,
        )

    def _fix_sequence(self, db: Session) -> bool:
        """
        Attempt to fix PostgreSQL sequence for the model's primary key.

        Returns:
            True if sequence was successfully fixed, False otherwise
        """
        from sqlalchemy import text

        from app.core.logging_config import get_logger

        logger = get_logger(__name__, "sequence_fix")

        try:
            # Get table name and primary key column
            table_name = getattr(self.model, "__tablename__", None)
            if not table_name:
                logger.error(
                    f"Model {self.model.__name__} does not have __tablename__ attribute"
                )
                return False
            pk_column = "id"  # Assuming 'id' is the primary key for most models            # Only attempt for PostgreSQL
            try:
                # For SQLAlchemy 2.0+, access the URL properly
                from app.core.database import engine

                db_url = str(engine.url)
            except Exception:
                # If all else fails, assume it's not PostgreSQL
                return False

            if not db_url.startswith("postgresql"):
                return False

            # Get max ID from table
            max_id_result = db.execute(
                text(f"SELECT COALESCE(MAX({pk_column}), 0) FROM {table_name}")
            ).fetchone()
            max_id = max_id_result[0] if max_id_result else 0

            # Reset sequence to max_id + 1
            sequence_name = f"{table_name}_{pk_column}_seq"
            next_value = max_id + 1

            db.execute(text(f"SELECT setval('{sequence_name}', {next_value}, false)"))
            db.commit()

            logger.info(f"Successfully reset sequence {sequence_name} to {next_value}")
            return True

        except Exception as e:
            logger.error(f"Failed to fix sequence for {self.model.__name__}: {e}")
            db.rollback()
            return False

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
