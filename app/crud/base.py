from datetime import datetime, timedelta
from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union

from fastapi.encoders import jsonable_encoder
from sqlalchemy import and_, asc, desc, or_, text
from sqlalchemy.orm import Session, joinedload

# Define the type variables for the Generic class
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


class QueryMixin:
    """
    Simplified mixin providing flexible query patterns for CRUD operations.
    Consolidates all query methods into a single flexible interface with backward compatibility.
    """

    model: Type[Any]  # Type hint for the model attribute

    def query(
        self,
        db: Session,
        *,
        filters: Optional[Dict[str, Any]] = None,
        date_range: Optional[Dict[str, Any]] = None,
        search: Optional[Dict[str, str]] = None,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = True,
        load_relations: Optional[List[str]] = None,
    ) -> List[ModelType]:
        """
        Flexible query method that handles all common query patterns.

        Args:
            db: Database session
            filters: Field filters as {field_name: value}
            date_range: Date range filter as {field: str, start: datetime, end: datetime}
            search: Text search as {field: str, term: str}
            skip: Records to skip (pagination)
            limit: Max records to return
            order_by: Field to order by (defaults to 'id')
            order_desc: Order direction
            load_relations: Relations to eager load

        Returns:
            List of matching records

        Examples:
            # Get by patient
            records = crud.query(db, filters={"patient_id": 5})

            # Get by status and patient
            records = crud.query(db, filters={"patient_id": 5, "status": "active"})

            # Get recent records
            records = crud.query(db, date_range={
                "field": "created_at",
                "start": datetime.now() - timedelta(days=7),
                "end": datetime.now()
            })

            # Search by name
            records = crud.query(db, search={"field": "name", "term": "john"})
        """
        query = db.query(self.model)

        # Apply field filters
        if filters:
            for field_name, value in filters.items():
                if hasattr(self.model, field_name):
                    field = getattr(self.model, field_name)
                    if isinstance(value, str):
                        query = query.filter(field == value.lower())
                    else:
                        query = query.filter(field == value)

        # Apply date range filter
        if date_range:
            field_name = date_range.get("field")
            start_date = date_range.get("start")
            end_date = date_range.get("end")

            if (
                field_name
                and hasattr(self.model, field_name)
                and start_date
                and end_date
            ):
                date_field = getattr(self.model, field_name)
                query = query.filter(
                    and_(date_field >= start_date, date_field <= end_date)
                )

        # Apply text search
        if search:
            field_name = search.get("field")
            search_term = search.get("term")

            if field_name and search_term and hasattr(self.model, field_name):
                field = getattr(self.model, field_name)
                query = query.filter(field.ilike(f"%{search_term}%"))

        # Apply ordering
        order_field = order_by or "id"
        if hasattr(self.model, order_field):
            field = getattr(self.model, order_field)
            query = query.order_by(desc(field) if order_desc else asc(field))

        # Load relationships
        if load_relations:
            for relation in load_relations:
                if hasattr(self.model, relation):
                    query = query.options(joinedload(getattr(self.model, relation)))

        # Apply pagination and return
        return query.offset(skip).limit(limit).all()

    # Backward compatibility methods - these wrap the new query method
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
        """Backward compatibility wrapper for get_by_field."""
        filters: Dict[str, Any] = {field_name: field_value}
        if additional_filters:
            filters.update(additional_filters)

        return self.query(
            db=db,
            filters=filters,
            skip=skip,
            limit=limit,
            order_by=order_by,
            order_desc=order_desc,
            load_relations=load_relations,
        )

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
        """Backward compatibility wrapper for get_by_date_range."""
        return self.query(
            db=db,
            filters=additional_filters,
            date_range={"field": date_field, "start": start_date, "end": end_date},
            skip=skip,
            limit=limit,
            order_by=order_by or date_field,
            order_desc=order_desc,
            load_relations=load_relations,
        )

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
        """Backward compatibility wrapper for get_recent_records."""
        start_date = datetime.now() - timedelta(days=days)
        return self.get_by_date_range(
            db=db,
            date_field=date_field,
            start_date=start_date,
            end_date=datetime.now(),
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
        """Backward compatibility wrapper for get_by_status."""
        filters: Dict[str, Any] = {"status": status.lower()}
        if patient_id:
            filters["patient_id"] = patient_id
        if additional_filters:
            filters.update(additional_filters)

        return self.query(
            db=db,
            filters=filters,
            skip=skip,
            limit=limit,
            order_by=order_by,
            order_desc=order_desc,
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
        """Backward compatibility wrapper for get_by_practitioner."""
        filters: Dict[str, Any] = {"practitioner_id": practitioner_id}
        if patient_id:
            filters["patient_id"] = patient_id
        if additional_filters:
            filters.update(additional_filters)

        return self.query(
            db=db,
            filters=filters,
            skip=skip,
            limit=limit,
            order_by=order_by,
            order_desc=order_desc,
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
        """Backward compatibility wrapper for search_by_text_field."""
        filters: Dict[str, Any] = additional_filters or {}
        if patient_id:
            filters["patient_id"] = patient_id

        return self.query(
            db=db,
            filters=filters,
            search={"field": field_name, "term": search_term},
            skip=skip,
            limit=limit,
            order_by=order_by,
            order_desc=order_desc,
            load_relations=load_relations,
        )

    # Convenience methods that use the new query interface
    def get_by_patient(self, db: Session, patient_id: int, **kwargs) -> List[ModelType]:
        """Convenience method for getting records by patient_id."""
        return self.query(db, filters={"patient_id": patient_id}, **kwargs)

    def get_recent(
        self, db: Session, date_field: str = "created_at", days: int = 7, **kwargs
    ) -> List[ModelType]:
        """Convenience method for getting recent records."""
        start_date = datetime.now() - timedelta(days=days)
        return self.query(
            db,
            date_range={
                "field": date_field,
                "start": start_date,
                "end": datetime.now(),
            },
            **kwargs,
        )

    def search_text(
        self, db: Session, field: str, term: str, **kwargs
    ) -> List[ModelType]:
        """Convenience method for text search."""
        return self.query(db, search={"field": field, "term": term}, **kwargs)

    def get_with_relations(
        self, db: Session, record_id: int, relations: List[str]
    ) -> Optional[ModelType]:
        """Get a single record with relationships loaded."""
        query = db.query(self.model)
        for relation in relations:
            if hasattr(self.model, relation):
                query = query.options(joinedload(getattr(self.model, relation)))
        return query.filter(self.model.id == record_id).first()


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType], QueryMixin):
    """
    Simplified base CRUD class with essential methods only.
    Uses composition over complex inheritance for better maintainability.
    """

    def __init__(
        self,
        model: Type[ModelType],
        primary_key: Union[str, List[str]] = "id",
        timezone_fields: Optional[List[str]] = None,
    ):
        """Initialize with model class - maintains backward compatibility with composite key support."""
        from app.models.models import Base

        if not issubclass(model, Base):
            raise TypeError(f"Expected a subclass of Base, got {type(model).__name__}")
        self.model = model
        self.primary_key = primary_key
        self.timezone_fields = timezone_fields or []

    def _convert_timezone_fields(self, obj_data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert timezone fields from user input to UTC."""
        from app.core.datetime_utils import to_utc

        converted_data = obj_data.copy()
        for field in self.timezone_fields:
            if field in converted_data and converted_data[field] is not None:
                try:
                    converted_data[field] = to_utc(converted_data[field])
                except ValueError as e:
                    raise ValueError(
                        f"Invalid datetime in field {field}: {obj_data[field]}"
                    )

        return converted_data

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        """Get a single record by ID."""
        return db.query(self.model).filter(self.model.id == id).first()

    def get_multi(
        self, db: Session, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        """Get multiple records with pagination."""
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record with simplified error handling."""
        obj_in_data = jsonable_encoder(obj_in)

        # Convert timezone fields
        obj_in_data = self._convert_timezone_fields(obj_in_data)

        # Remove explicit ID if present
        if "id" in obj_in_data:
            del obj_in_data["id"]

        db_obj = self.model(**obj_in_data)
        db.add(db_obj)

        try:
            db.commit()
            db.refresh(db_obj)
            return db_obj
        except Exception as e:
            db.rollback()
            # Try sequence fix once, then re-raise
            if "duplicate key" in str(e) and self._fix_sequence(db):
                db_obj = self.model(**obj_in_data)
                db.add(db_obj)
                db.commit()
                db.refresh(db_obj)
                return db_obj
            raise

    def _fix_sequence(self, db: Session) -> bool:
        """Simplified sequence fix for PostgreSQL."""
        try:
            table_name = self.model.__tablename__
            # Get max ID and reset sequence
            max_id = (
                db.execute(
                    text(f"SELECT COALESCE(MAX(id), 0) FROM {table_name}")
                ).scalar()
                or 0
            )
            sequence_name = f"{table_name}_id_seq"
            db.execute(text(f"SELECT setval('{sequence_name}', {max_id + 1})"))
            db.commit()
            return True
        except Exception:
            db.rollback()
            return False

    def update(
        self,
        db: Session,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]],
    ) -> ModelType:
        """Update an existing record."""
        obj_data = jsonable_encoder(db_obj)

        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = (
                obj_in.dict(exclude_unset=True)  # type: ignore
                if hasattr(obj_in, "dict")
                else jsonable_encoder(obj_in)
            )

        # Convert timezone fields
        update_data = self._convert_timezone_fields(update_data)

        # Update only fields that exist in the model
        for field, value in update_data.items():
            if field in obj_data and hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, *, id: int) -> ModelType:
        """Delete a record by ID."""
        obj = db.query(self.model).filter(self.model.id == id).first()
        if obj is None:
            raise ValueError(f"Record with id {id} not found")

        db.delete(obj)
        db.commit()
        return obj
