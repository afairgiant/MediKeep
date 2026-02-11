"""
Tests for Pharmacy CRUD operations.
"""
import pytest
from sqlalchemy.orm import Session

from app.crud.pharmacy import pharmacy as pharmacy_crud
from app.models.models import Pharmacy
from app.schemas.pharmacy import PharmacyCreate, PharmacyUpdate


class TestPharmacyCRUD:
    """Test Pharmacy CRUD operations."""

    def test_create_pharmacy(self, db_session: Session):
        """Test creating a pharmacy."""
        pharmacy_data = PharmacyCreate(
            name="CVS Pharmacy - Main Street",
            brand="CVS",
            phone_number="919-555-1234",
            address="123 Main Street",
            city="Raleigh",
            state="NC",
            zip_code="27601",
            twenty_four_hour=False,
            drive_through=True
        )

        pharmacy = pharmacy_crud.create(db_session, obj_in=pharmacy_data)

        assert pharmacy is not None
        assert pharmacy.name == "CVS Pharmacy - Main Street"
        assert pharmacy.brand == "CVS"
        assert pharmacy.city == "Raleigh"
        assert pharmacy.state == "NC"
        assert pharmacy.zip_code == "27601"
        assert pharmacy.drive_through is True

    def test_create_pharmacy_international_postal_code(self, db_session: Session):
        """Test creating a pharmacy with international postal codes."""
        # Canadian postal code
        pharmacy_ca = PharmacyCreate(
            name="Shoppers Drug Mart - Toronto",
            brand="Independent",
            city="Toronto",
            state="Ontario",
            zip_code="M5V 2T6",
            country="Canada",
        )
        created_ca = pharmacy_crud.create(db_session, obj_in=pharmacy_ca)
        assert created_ca.zip_code == "M5V 2T6"
        assert created_ca.country == "Canada"

        # UK postcode
        pharmacy_uk = PharmacyCreate(
            name="Boots Pharmacy - London",
            city="London",
            zip_code="SW1A 1AA",
            country="United Kingdom",
        )
        created_uk = pharmacy_crud.create(db_session, obj_in=pharmacy_uk)
        assert created_uk.zip_code == "SW1A 1AA"

        # German postal code
        pharmacy_de = PharmacyCreate(
            name="Apotheke Berlin",
            city="Berlin",
            zip_code="10115",
            country="Germany",
        )
        created_de = pharmacy_crud.create(db_session, obj_in=pharmacy_de)
        assert created_de.zip_code == "10115"

    def test_get_by_name(self, db_session: Session):
        """Test getting a pharmacy by exact name.

        Note: The query method lowercases filter values for matching.
        """
        # Use lowercase to match query behavior
        pharmacy_data = PharmacyCreate(
            name="walgreens - downtown",
            brand="Walgreens"
        )
        pharmacy_crud.create(db_session, obj_in=pharmacy_data)

        found = pharmacy_crud.get_by_name(db_session, name="Walgreens - Downtown")

        assert found is not None
        assert found.name == "walgreens - downtown"

    def test_get_by_name_not_found(self, db_session: Session):
        """Test getting non-existent pharmacy by name."""
        found = pharmacy_crud.get_by_name(db_session, name="Non-existent Pharmacy")

        assert found is None

    def test_search_by_name(self, db_session: Session):
        """Test searching pharmacies by partial name."""
        pharmacies_data = [
            PharmacyCreate(name="CVS Pharmacy - Store 1", brand="CVS"),
            PharmacyCreate(name="CVS Pharmacy - Store 2", brand="CVS"),
            PharmacyCreate(name="Walgreens - Main", brand="Walgreens"),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        results = pharmacy_crud.search_by_name(db_session, name="CVS")

        assert len(results) == 2
        assert all("CVS" in r.name for r in results)

    def test_search_by_brand(self, db_session: Session):
        """Test searching pharmacies by brand."""
        pharmacies_data = [
            PharmacyCreate(name="CVS Store 1", brand="CVS"),
            PharmacyCreate(name="CVS Store 2", brand="CVS"),
            PharmacyCreate(name="Walgreens Store", brand="Walgreens"),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        results = pharmacy_crud.search_by_brand(db_session, brand="CVS")

        assert len(results) == 2

    def test_get_by_brand(self, db_session: Session):
        """Test getting pharmacies by exact brand.

        Note: The query method lowercases filter values for matching.
        """
        # Use lowercase to match query behavior
        pharmacies_data = [
            PharmacyCreate(name="Rite Aid 1", brand="rite aid"),
            PharmacyCreate(name="Rite Aid 2", brand="rite aid"),
            PharmacyCreate(name="CVS Store", brand="cvs"),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        rite_aid = pharmacy_crud.get_by_brand(db_session, brand="Rite Aid")

        assert len(rite_aid) == 2
        assert all(p.brand == "rite aid" for p in rite_aid)

    def test_get_all_brands(self, db_session: Session):
        """Test getting all unique brands."""
        brands = ["CVS", "Walgreens", "Rite Aid", "CVS"]  # CVS duplicate

        for i, brand in enumerate(brands):
            pharmacy_data = PharmacyCreate(
                name=f"Pharmacy {i+1}",
                brand=brand
            )
            pharmacy_crud.create(db_session, obj_in=pharmacy_data)

        unique_brands = pharmacy_crud.get_all_brands(db_session)

        assert len(unique_brands) == 3
        assert "CVS" in unique_brands
        assert "Walgreens" in unique_brands
        assert "Rite Aid" in unique_brands

    def test_get_all_cities(self, db_session: Session):
        """Test getting all unique cities."""
        cities = ["Raleigh", "Durham", "Chapel Hill", "Raleigh"]

        for i, city in enumerate(cities):
            pharmacy_data = PharmacyCreate(
                name=f"Pharmacy {i+1}",
                city=city,
                state="NC"
            )
            pharmacy_crud.create(db_session, obj_in=pharmacy_data)

        unique_cities = pharmacy_crud.get_all_cities(db_session)

        assert len(unique_cities) == 3

    def test_get_all_cities_by_state(self, db_session: Session):
        """Test getting cities filtered by state."""
        pharmacies_data = [
            PharmacyCreate(name="NC Store 1", city="Raleigh", state="NC"),
            PharmacyCreate(name="NC Store 2", city="Durham", state="NC"),
            PharmacyCreate(name="SC Store", city="Charleston", state="SC"),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        nc_cities = pharmacy_crud.get_all_cities(db_session, state="NC")

        assert len(nc_cities) == 2
        assert "Raleigh" in nc_cities
        assert "Durham" in nc_cities
        assert "Charleston" not in nc_cities

    def test_search_by_location(self, db_session: Session):
        """Test searching pharmacies by location."""
        pharmacies_data = [
            PharmacyCreate(name="NC Store 1", city="Raleigh", state="NC", zip_code="27601"),
            PharmacyCreate(name="NC Store 2", city="Raleigh", state="NC", zip_code="27602"),
            PharmacyCreate(name="SC Store", city="Charleston", state="SC", zip_code="29401"),
            PharmacyCreate(name="CA Store", city="Toronto", state="Ontario", zip_code="m5v 2t6"),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        # Search by city
        raleigh = pharmacy_crud.search_by_location(db_session, city="Raleigh")
        assert len(raleigh) == 2

        # Search by state
        nc_stores = pharmacy_crud.search_by_location(db_session, state="NC")
        assert len(nc_stores) == 2

        # Search by zip (US)
        zip_results = pharmacy_crud.search_by_location(db_session, zip_code="27601")
        assert len(zip_results) == 1

        # Search by postal code (international)
        # Note: query method lowercases filter values for matching
        postal_results = pharmacy_crud.search_by_location(db_session, zip_code="M5V 2T6")
        assert len(postal_results) == 1
        assert postal_results[0].name == "CA Store"

    def test_get_by_store_number(self, db_session: Session):
        """Test getting pharmacy by brand and store number.

        Note: The query method lowercases filter values for matching.
        """
        # Use lowercase to match query behavior
        pharmacy_data = PharmacyCreate(
            name="CVS #12345",
            brand="cvs",
            store_number="12345"
        )
        pharmacy_crud.create(db_session, obj_in=pharmacy_data)

        found = pharmacy_crud.get_by_store_number(
            db_session, brand="CVS", store_number="12345"
        )

        assert found is not None
        assert found.store_number == "12345"

    def test_get_by_zip_code(self, db_session: Session):
        """Test getting pharmacies by postal code."""
        pharmacies_data = [
            PharmacyCreate(name="Store 1", zip_code="27601"),
            PharmacyCreate(name="Store 2", zip_code="27601"),
            PharmacyCreate(name="Store 3", zip_code="27602"),
            PharmacyCreate(name="Store CA", zip_code="m5v 2t6"),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        # US ZIP code
        results = pharmacy_crud.get_by_zip_code(db_session, zip_code="27601")
        assert len(results) == 2

        # Canadian postal code
        # Note: query method lowercases filter values for matching
        ca_results = pharmacy_crud.get_by_zip_code(db_session, zip_code="M5V 2T6")
        assert len(ca_results) == 1
        assert ca_results[0].name == "Store CA"

    def test_get_24_hour_pharmacies(self, db_session: Session):
        """Test getting 24-hour pharmacies."""
        pharmacies_data = [
            PharmacyCreate(name="24hr Store", twenty_four_hour=True),
            PharmacyCreate(name="Regular Store 1", twenty_four_hour=False),
            PharmacyCreate(name="Regular Store 2", twenty_four_hour=False),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        twenty_four_hour = pharmacy_crud.get_24_hour_pharmacies(db_session)

        assert len(twenty_four_hour) == 1
        assert twenty_four_hour[0].name == "24hr Store"

    def test_get_drive_through_pharmacies(self, db_session: Session):
        """Test getting drive-through pharmacies."""
        pharmacies_data = [
            PharmacyCreate(name="Drive-thru 1", drive_through=True),
            PharmacyCreate(name="Drive-thru 2", drive_through=True),
            PharmacyCreate(name="No Drive-thru", drive_through=False),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        drive_through = pharmacy_crud.get_drive_through_pharmacies(db_session)

        assert len(drive_through) == 2
        assert all(p.drive_through is True for p in drive_through)

    def test_is_name_taken(self, db_session: Session):
        """Test checking if pharmacy name is taken.

        Note: The query method lowercases filter values for matching.
        """
        # Use lowercase to match query behavior
        pharmacy_data = PharmacyCreate(name="unique pharmacy name")
        pharmacy_crud.create(db_session, obj_in=pharmacy_data)

        assert pharmacy_crud.is_name_taken(db_session, name="Unique Pharmacy Name") is True
        assert pharmacy_crud.is_name_taken(db_session, name="Different Name") is False

    def test_create_if_not_exists_creates(self, db_session: Session):
        """Test create_if_not_exists creates new pharmacy."""
        pharmacy_data = PharmacyCreate(
            name="New Pharmacy",
            brand="Independent"
        )

        pharmacy = pharmacy_crud.create_if_not_exists(
            db_session, pharmacy_data=pharmacy_data
        )

        assert pharmacy is not None
        assert pharmacy.name == "New Pharmacy"

    def test_create_if_not_exists_returns_existing(self, db_session: Session):
        """Test create_if_not_exists returns existing pharmacy.

        Note: The query method lowercases filter values for matching.
        """
        # Use lowercase to match query behavior
        initial_data = PharmacyCreate(
            name="existing pharmacy",
            brand="Original Brand"
        )
        initial = pharmacy_crud.create(db_session, obj_in=initial_data)

        second_data = PharmacyCreate(
            name="existing pharmacy",
            brand="Different Brand"
        )
        second = pharmacy_crud.create_if_not_exists(
            db_session, pharmacy_data=second_data
        )

        assert second.id == initial.id
        assert second.brand == "Original Brand"

    def test_count_by_brand(self, db_session: Session):
        """Test counting pharmacies by brand."""
        pharmacies_data = [
            PharmacyCreate(name="CVS 1", brand="CVS"),
            PharmacyCreate(name="CVS 2", brand="CVS"),
            PharmacyCreate(name="Walgreens 1", brand="Walgreens"),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        counts = pharmacy_crud.count_by_brand(db_session)

        assert counts["CVS"] == 2
        assert counts["Walgreens"] == 1

    def test_count_by_state(self, db_session: Session):
        """Test counting pharmacies by state."""
        pharmacies_data = [
            PharmacyCreate(name="NC Store 1", state="NC"),
            PharmacyCreate(name="NC Store 2", state="NC"),
            PharmacyCreate(name="SC Store", state="SC"),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        counts = pharmacy_crud.count_by_state(db_session)

        assert counts["NC"] == 2
        assert counts["SC"] == 1

    def test_update_pharmacy(self, db_session: Session):
        """Test updating a pharmacy."""
        pharmacy_data = PharmacyCreate(
            name="Original Name",
            brand="Original Brand"
        )
        created = pharmacy_crud.create(db_session, obj_in=pharmacy_data)

        update_data = PharmacyUpdate(
            phone_number="919-555-9999",
            drive_through=True
        )

        updated = pharmacy_crud.update(
            db_session, db_obj=created, obj_in=update_data
        )

        assert updated.name == "Original Name"  # Unchanged
        assert updated.drive_through is True

    def test_delete_pharmacy(self, db_session: Session):
        """Test deleting a pharmacy."""
        pharmacy_data = PharmacyCreate(name="To Delete")
        created = pharmacy_crud.create(db_session, obj_in=pharmacy_data)
        pharmacy_id = created.id

        deleted = pharmacy_crud.delete(db_session, id=pharmacy_id)

        assert deleted is not None
        assert deleted.id == pharmacy_id

        # Verify deleted
        retrieved = pharmacy_crud.get(db_session, id=pharmacy_id)
        assert retrieved is None

    def test_search_comprehensive(self, db_session: Session):
        """Test comprehensive search across multiple fields."""
        pharmacies_data = [
            PharmacyCreate(
                name="CVS Main",
                brand="CVS",
                city="Raleigh",
                state="NC",
                drive_through=True,
                twenty_four_hour=False
            ),
            PharmacyCreate(
                name="CVS 24hr",
                brand="CVS",
                city="Durham",
                state="NC",
                drive_through=True,
                twenty_four_hour=True
            ),
            PharmacyCreate(
                name="Walgreens",
                brand="Walgreens",
                city="Raleigh",
                state="NC",
                drive_through=False,
                twenty_four_hour=False
            ),
        ]

        for phar_data in pharmacies_data:
            pharmacy_crud.create(db_session, obj_in=phar_data)

        # Search for CVS with drive-through
        results = pharmacy_crud.search_comprehensive(
            db_session, brand="CVS", drive_through=True
        )
        assert len(results) == 2

        # Search for 24-hour pharmacies
        results = pharmacy_crud.search_comprehensive(
            db_session, twenty_four_hour=True
        )
        assert len(results) == 1
