# Lab Test Components Implementation Guide

## Overview
Add individual lab test component tracking to existing MediKeep lab results. Users can store specific test values (WBC, RBC, Glucose, etc.) with beautiful visual displays and multiple entry methods.

## Visual Reference
- **Main Mockup**: `lab-results-mockup.html` - Beautiful card displays, templates, bulk entry
- **Integration**: `lab-results-integration-mockup.html` - How it fits with existing lab results
- **Realistic Version**: `realistic-lab-results-mockup.html` - Simplified achievable version

## Database Schema

### New Model: LabTestComponent (Following MediKeep Patterns)

**Analysis of Existing Patterns:**
- **Table naming**: `lab_test_components` (snake_case, plural)
- **Index naming**: `idx_[table]_[column]` format
- **Foreign keys**: Standard pattern with CASCADE delete
- **Timestamps**: Uses `get_utc_now()` function like all other models
- **Field types**: String (no length specified), Float for numbers, Text for long content

```python
# Add to app/models/models.py
class LabTestComponent(Base):
    """
    Individual test components/values within a lab result.
    Each LabResult can have multiple test components (WBC, RBC, Glucose, etc.).
    Follows existing MediKeep model patterns exactly.
    """
    __tablename__ = "lab_test_components"

    id = Column(Integer, primary_key=True)
    lab_result_id = Column(Integer, ForeignKey("lab_results.id"), nullable=False)

    # Test identification - following existing string patterns
    test_name = Column(String, nullable=False)  # e.g., "White Blood Cell Count"
    abbreviation = Column(String, nullable=True)  # e.g., "WBC"
    test_code = Column(String, nullable=True)  # LOINC codes like existing models

    # Test values - using Float like Vitals model
    value = Column(Float, nullable=False)  # Numeric result
    unit = Column(String, nullable=False)  # e.g., "K/uL", "mg/dL"

    # Reference ranges - following Vitals pattern with min/max
    ref_range_min = Column(Float, nullable=True)
    ref_range_max = Column(Float, nullable=True)
    ref_range_text = Column(String, nullable=True)  # For non-numeric ranges

    # Status and organization - following existing status patterns
    status = Column(String, nullable=True)  # normal, high, low, critical
    category = Column(String, nullable=True)  # hematology, chemistry, etc.
    display_order = Column(Integer, nullable=True)  # For consistent ordering

    # Notes - using Text like other models
    notes = Column(Text, nullable=True)

    # Timestamps - EXACT pattern from all other models
    created_at = Column(DateTime, default=get_utc_now, nullable=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now, nullable=False)

    # Relationships - following exact pattern from LabResultFile
    lab_result = orm_relationship("LabResult", back_populates="test_components")

    # Indexes - following exact naming pattern from other models
    __table_args__ = (
        Index("idx_lab_test_components_lab_result_id", "lab_result_id"),
        Index("idx_lab_test_components_status", "status"),
        Index("idx_lab_test_components_category", "category"),
    )
```

### Update Existing LabResult Model
```python
# Add to existing LabResult class relationships section
test_components = orm_relationship(
    "LabTestComponent", back_populates="lab_result", cascade="all, delete-orphan"
)
```

### Database Migration Process (Using Alembic)

**Step 1: Add Model to models.py (above)**

**Step 2: Generate Migration**
```bash
# From project root (following CLAUDE.md commands)
.venv/Scripts/python.exe -m alembic revision --autogenerate -m "add lab test components table"
```

**Step 3: Review Generated Migration**
The migration will be auto-generated in `alembic/migrations/versions/` and should look like:
```python
"""add lab test components table

Revision ID: [auto-generated]
Revises: [previous_revision]
Create Date: [auto-generated]
"""
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    # Auto-generated commands
    op.create_table('lab_test_components',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('lab_result_id', sa.Integer(), nullable=False),
        sa.Column('test_name', sa.String(), nullable=False),
        sa.Column('abbreviation', sa.String(), nullable=True),
        sa.Column('test_code', sa.String(), nullable=True),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('ref_range_min', sa.Float(), nullable=True),
        sa.Column('ref_range_max', sa.Float(), nullable=True),
        sa.Column('ref_range_text', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['lab_result_id'], ['lab_results.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_lab_test_components_lab_result_id', 'lab_test_components', ['lab_result_id'], unique=False)
    op.create_index('idx_lab_test_components_status', 'lab_test_components', ['status'], unique=False)
    op.create_index('idx_lab_test_components_category', 'lab_test_components', ['category'], unique=False)

def downgrade() -> None:
    op.drop_index('idx_lab_test_components_category', table_name='lab_test_components')
    op.drop_index('idx_lab_test_components_status', table_name='lab_test_components')
    op.drop_index('idx_lab_test_components_lab_result_id', table_name='lab_test_components')
    op.drop_table('lab_test_components')
```

**Step 4: Apply Migration**
```bash
.venv/Scripts/python.exe -m alembic upgrade head
```

## Backend Implementation

### 1. Schemas (`app/schemas/lab_test_component.py`)
```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class LabTestComponentBase(BaseModel):
    test_name: str
    abbreviation: Optional[str] = None
    test_code: Optional[str] = None
    value: float
    unit: str
    ref_range_min: Optional[float] = None
    ref_range_max: Optional[float] = None
    ref_range_text: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    display_order: Optional[int] = None
    notes: Optional[str] = None

class LabTestComponentCreate(LabTestComponentBase):
    pass

class LabTestComponentUpdate(BaseModel):
    test_name: Optional[str] = None
    value: Optional[float] = None
    unit: Optional[str] = None
    ref_range_min: Optional[float] = None
    ref_range_max: Optional[float] = None
    status: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None

class LabTestComponentResponse(LabTestComponentBase):
    id: int
    lab_result_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LabTestComponentBulkCreate(BaseModel):
    components: List[LabTestComponentCreate]

class LabTestComponentTemplate(BaseModel):
    name: str
    description: str
    components: List[LabTestComponentCreate]
```

### 2. CRUD Operations (`app/crud/lab_test_component.py`)

**Following Existing CRUD Patterns from lab_result.py:**

```python
from typing import List, Optional
from sqlalchemy.orm import Session
from app.crud.base import CRUDBase
from app.models.models import LabTestComponent
from app.schemas.lab_test_component import LabTestComponentCreate, LabTestComponentUpdate

class CRUDLabTestComponent(CRUDBase[LabTestComponent, LabTestComponentCreate, LabTestComponentUpdate]):
    def get_by_lab_result(self, db: Session, *, lab_result_id: int) -> List[LabTestComponent]:
        """Get all test components for a specific lab result"""
        return db.query(LabTestComponent).filter(
            LabTestComponent.lab_result_id == lab_result_id
        ).order_by(LabTestComponent.display_order, LabTestComponent.test_name).all()

    def create_with_lab_result(
        self, db: Session, *, obj_in: LabTestComponentCreate, lab_result_id: int
    ) -> LabTestComponent:
        """Create a test component linked to a lab result"""
        # Auto-calculate status based on reference ranges
        status = self._calculate_status(obj_in.value, obj_in.ref_range_min, obj_in.ref_range_max)

        # Create object with calculated status
        obj_data = obj_in.dict()
        obj_data["status"] = status

        db_obj = LabTestComponent(
            lab_result_id=lab_result_id,
            **obj_data
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def create_bulk_with_lab_result(
        self, db: Session, *, components: List[LabTestComponentCreate], lab_result_id: int
    ) -> List[LabTestComponent]:
        """Create multiple test components for a lab result"""
        db_objects = []
        for component in components:
            status = self._calculate_status(component.value, component.ref_range_min, component.ref_range_max)
            obj_data = component.dict()
            obj_data["status"] = status

            db_obj = LabTestComponent(
                lab_result_id=lab_result_id,
                **obj_data
            )
            db_objects.append(db_obj)

        db.add_all(db_objects)
        db.commit()
        for obj in db_objects:
            db.refresh(obj)
        return db_objects

    def update_with_status(
        self, db: Session, *, db_obj: LabTestComponent, obj_in: LabTestComponentUpdate
    ) -> LabTestComponent:
        """Update test component and recalculate status if needed"""
        update_data = obj_in.dict(exclude_unset=True)

        # If value or ranges changed, recalculate status
        if "value" in update_data or "ref_range_min" in update_data or "ref_range_max" in update_data:
            new_value = update_data.get("value", db_obj.value)
            new_min = update_data.get("ref_range_min", db_obj.ref_range_min)
            new_max = update_data.get("ref_range_max", db_obj.ref_range_max)
            update_data["status"] = self._calculate_status(new_value, new_min, new_max)

        return super().update(db=db, db_obj=db_obj, obj_in=update_data)

    def _calculate_status(self, value: float, ref_min: Optional[float], ref_max: Optional[float]) -> str:
        """Calculate test result status based on reference ranges"""
        if ref_min is None and ref_max is None:
            return "unknown"

        # Critical thresholds (configurable in future)
        critical_multiplier = 2.0

        if ref_max is not None and value >= (ref_max * critical_multiplier):
            return "critical"
        elif ref_min is not None and value <= (ref_min / critical_multiplier):
            return "critical"
        elif ref_max is not None and value > ref_max:
            return "high"
        elif ref_min is not None and value < ref_min:
            return "low"
        else:
            return "normal"

# Create instance following existing pattern
lab_test_component = CRUDLabTestComponent(LabTestComponent)
```

### 3. API Endpoints (`app/api/v1/endpoints/lab_test_component.py`)

**Following Exact Patterns from existing lab_result.py:**

```python
from typing import List
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.error_handling import (
    NotFoundException,
    ForbiddenException,
    BusinessLogicException,
    DatabaseException,
    handle_database_errors
)
from app.api.v1.endpoints.utils import (
    handle_create_with_logging,
    handle_delete_with_logging,
    handle_not_found,
    handle_update_with_logging,
)
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.crud.lab_test_component import lab_test_component
from app.schemas.lab_test_component import (
    LabTestComponentCreate,
    LabTestComponentUpdate,
    LabTestComponentResponse,
    LabTestComponentBulkCreate
)

router = APIRouter()
logger = get_logger(__name__, "app")

@router.get("/lab-results/{lab_result_id}/test-components", response_model=List[LabTestComponentResponse])
def get_test_components(
    *,
    request: Request,
    lab_result_id: int,
    db: Session = Depends(get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
):
    """Get test components for a lab result."""
    with handle_database_errors(request=request):
        components = lab_test_component.get_by_lab_result(db, lab_result_id=lab_result_id)

        logger.info("Lab test components retrieved", extra={
            "lab_result_id": lab_result_id,
            "component_count": len(components),
            "component": "lab_test_component"
        })

        return components

@router.post("/lab-results/{lab_result_id}/test-components", response_model=LabTestComponentResponse)
def create_test_component(
    *,
    request: Request,
    lab_result_id: int,
    component_in: LabTestComponentCreate,
    db: Session = Depends(get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
):
    """Create a test component for a lab result."""
    with handle_database_errors(request=request):
        new_component = lab_test_component.create_with_lab_result(
            db, obj_in=component_in, lab_result_id=lab_result_id
        )

        logger.info("Lab test component created", extra={
            "lab_result_id": lab_result_id,
            "component_id": new_component.id,
            "test_name": component_in.test_name,
            "component": "lab_test_component"
        })

        return new_component

@router.post("/lab-results/{lab_result_id}/test-components/bulk", response_model=List[LabTestComponentResponse])
def create_test_components_bulk(
    *,
    request: Request,
    lab_result_id: int,
    bulk_data: LabTestComponentBulkCreate,
    db: Session = Depends(get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
):
    """Create multiple test components for a lab result."""
    with handle_database_errors(request=request):
        new_components = lab_test_component.create_bulk_with_lab_result(
            db, components=bulk_data.components, lab_result_id=lab_result_id
        )

        logger.info("Lab test components bulk created", extra={
            "lab_result_id": lab_result_id,
            "component_count": len(new_components),
            "component": "lab_test_component"
        })

        return new_components

@router.put("/lab-results/{lab_result_id}/test-components/{component_id}", response_model=LabTestComponentResponse)
def update_test_component(
    *,
    request: Request,
    lab_result_id: int,
    component_id: int,
    component_in: LabTestComponentUpdate,
    db: Session = Depends(get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
):
    """Update a test component."""
    with handle_database_errors(request=request):
        component = lab_test_component.get(db, id=component_id)
        if not component:
            raise NotFoundException(f"Test component with id {component_id} not found")

        # Verify the component belongs to the specified lab result
        if component.lab_result_id != lab_result_id:
            raise ForbiddenException("Test component does not belong to the specified lab result")

        updated_component = lab_test_component.update_with_status(
            db, db_obj=component, obj_in=component_in
        )

        logger.info("Lab test component updated", extra={
            "lab_result_id": lab_result_id,
            "component_id": component_id,
            "component": "lab_test_component"
        })

        return updated_component

@router.delete("/lab-results/{lab_result_id}/test-components/{component_id}")
def delete_test_component(
    *,
    request: Request,
    lab_result_id: int,
    component_id: int,
    db: Session = Depends(get_db),
    target_patient_id: int = Depends(deps.get_accessible_patient_id),
):
    """Delete a test component."""
    with handle_database_errors(request=request):
        component = lab_test_component.get(db, id=component_id)
        if not component:
            raise NotFoundException(f"Test component with id {component_id} not found")

        # Verify the component belongs to the specified lab result
        if component.lab_result_id != lab_result_id:
            raise ForbiddenException("Test component does not belong to the specified lab result")

        lab_test_component.remove(db, id=component_id)

        logger.info("Lab test component deleted", extra={
            "lab_result_id": lab_result_id,
            "component_id": component_id,
            "component": "lab_test_component"
        })

        return {"message": "Test component deleted successfully"}
```

### 4. Template System (`app/data/test_templates.py`)
```python
# Pre-defined test templates
CBC_TEMPLATE = [
    {
        "test_name": "White Blood Cell Count",
        "abbreviation": "WBC",
        "unit": "K/uL",
        "ref_range_min": 4.5,
        "ref_range_max": 11.0,
        "category": "hematology",
        "display_order": 1
    },
    {
        "test_name": "Red Blood Cell Count",
        "abbreviation": "RBC",
        "unit": "M/uL",
        "ref_range_min": 4.50,
        "ref_range_max": 5.90,
        "category": "hematology",
        "display_order": 2
    },
    {
        "test_name": "Hemoglobin",
        "abbreviation": "HGB",
        "unit": "g/dL",
        "ref_range_min": 13.5,
        "ref_range_max": 17.5,
        "category": "hematology",
        "display_order": 3
    },
    {
        "test_name": "Hematocrit",
        "abbreviation": "HCT",
        "unit": "%",
        "ref_range_min": 41.0,
        "ref_range_max": 53.0,
        "category": "hematology",
        "display_order": 4
    },
    {
        "test_name": "Platelet Count",
        "abbreviation": "PLT",
        "unit": "K/uL",
        "ref_range_min": 150,
        "ref_range_max": 400,
        "category": "hematology",
        "display_order": 5
    }
]

BMP_TEMPLATE = [
    {
        "test_name": "Glucose",
        "abbreviation": "GLU",
        "unit": "mg/dL",
        "ref_range_min": 70,
        "ref_range_max": 100,
        "category": "chemistry",
        "display_order": 1
    },
    {
        "test_name": "Sodium",
        "abbreviation": "Na",
        "unit": "mmol/L",
        "ref_range_min": 136,
        "ref_range_max": 145,
        "category": "chemistry",
        "display_order": 2
    },
    {
        "test_name": "Potassium",
        "abbreviation": "K",
        "unit": "mmol/L",
        "ref_range_min": 3.5,
        "ref_range_max": 5.1,
        "category": "chemistry",
        "display_order": 3
    },
    {
        "test_name": "Creatinine",
        "abbreviation": "CREA",
        "unit": "mg/dL",
        "ref_range_min": 0.6,
        "ref_range_max": 1.2,
        "category": "chemistry",
        "display_order": 4
    }
]

LIPID_TEMPLATE = [
    {
        "test_name": "Total Cholesterol",
        "abbreviation": "CHOL",
        "unit": "mg/dL",
        "ref_range_max": 200,
        "category": "lipids",
        "display_order": 1
    },
    {
        "test_name": "LDL Cholesterol",
        "abbreviation": "LDL",
        "unit": "mg/dL",
        "ref_range_max": 100,
        "category": "lipids",
        "display_order": 2
    },
    {
        "test_name": "HDL Cholesterol",
        "abbreviation": "HDL",
        "unit": "mg/dL",
        "ref_range_min": 40,
        "category": "lipids",
        "display_order": 3
    },
    {
        "test_name": "Triglycerides",
        "abbreviation": "TRIG",
        "unit": "mg/dL",
        "ref_range_max": 150,
        "category": "lipids",
        "display_order": 4
    }
]

TEMPLATES = {
    "cbc": {
        "name": "Complete Blood Count (CBC)",
        "description": "Comprehensive blood cell analysis",
        "components": CBC_TEMPLATE
    },
    "bmp": {
        "name": "Basic Metabolic Panel (BMP)",
        "description": "Essential chemistry tests",
        "components": BMP_TEMPLATE
    },
    "lipid": {
        "name": "Lipid Panel",
        "description": "Cholesterol and lipid analysis",
        "components": LIPID_TEMPLATE
    }
}
```

## Frontend Implementation

### 1. Component Structure
```
frontend/src/components/medical/labresults/testComponents/
├── TestComponentsTab.js          # Main tab container
├── TestComponentDisplay.js       # Beautiful card display (from mockup)
├── TestComponentEntry.js         # Entry form with templates
├── TestComponentTemplates.js     # Template selection
├── TestComponentBulkEntry.js     # Copy/paste parsing
├── TestComponentCard.js          # Individual test card
└── TestComponentStats.js         # Summary statistics
```

### 2. API Service (`frontend/src/services/api/labTestComponentApi.js`)
```javascript
import { BaseApiService } from './baseApi';

class LabTestComponentApiService extends BaseApiService {
  constructor() {
    super('/lab-test-components');
  }

  async getByLabResult(labResultId, signal) {
    return this.get(`/lab-results/${labResultId}/test-components`, { signal });
  }

  async createForLabResult(labResultId, data, signal) {
    return this.post(`/lab-results/${labResultId}/test-components`, data, { signal });
  }

  async createBulkForLabResult(labResultId, components, signal) {
    return this.post(`/lab-results/${labResultId}/test-components/bulk`,
      { components }, { signal });
  }

  async update(labResultId, componentId, data, signal) {
    return this.put(`/lab-results/${labResultId}/test-components/${componentId}`, data, { signal });
  }

  async delete(labResultId, componentId, signal) {
    return this.delete(`/lab-results/${labResultId}/test-components/${componentId}`, { signal });
  }

  async getTemplates() {
    // Could be API call or static data
    return Promise.resolve({
      cbc: { name: "Complete Blood Count (CBC)", tests: 8 },
      bmp: { name: "Basic Metabolic Panel (BMP)", tests: 8 },
      lipid: { name: "Lipid Panel", tests: 4 }
    });
  }
}

export const labTestComponentApi = new LabTestComponentApiService();
```

### 3. Main Display Component (`TestComponentDisplay.js`)
```javascript
import React from 'react';
import { Grid, Paper, Group, Badge, Text, Stack, Title } from '@mantine/core';

const TestComponentDisplay = ({ components = [], loading = false }) => {
  // Group by category like in mockup
  const groupedComponents = components.reduce((acc, component) => {
    const category = component.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(component);
    return acc;
  }, {});

  const getCategoryIcon = (category) => {
    switch(category.toLowerCase()) {
      case 'hematology': return '🩸';
      case 'chemistry': return '🧪';
      case 'lipids': return '💧';
      case 'hormones': return '⚡';
      default: return '📊';
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'normal': return 'green';
      case 'high': case 'low': return 'orange';
      case 'critical': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status, value, refMin, refMax) => {
    if (status === 'critical') {
      return value > refMax ? '⇈' : '⇊';
    }
    if (status === 'high') return '↑';
    if (status === 'low') return '↓';
    return '';
  };

  if (loading) {
    return <Text>Loading test results...</Text>;
  }

  if (components.length === 0) {
    return (
      <Paper p="xl" style={{ textAlign: 'center' }}>
        <Text size="lg" c="dimmed" mb="md">📋</Text>
        <Text size="lg" fw={600} mb="xs">No Test Results Added</Text>
        <Text c="dimmed">Click "Add Test Results" to get started</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="lg">
      {Object.entries(groupedComponents).map(([category, tests]) => (
        <Paper key={category} p="md" withBorder>
          <Group justify="space-between" mb="md">
            <Title order={4}>
              {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
            </Title>
            <Badge color="blue" variant="light">{tests.length} tests</Badge>
          </Group>

          <Grid>
            {tests.map((test) => (
              <Grid.Col key={test.id} span={{ base: 12, sm: 6, md: 4 }}>
                <Paper
                  p="md"
                  withBorder
                  radius="md"
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    ':hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }
                  }}
                >
                  <Group justify="space-between" mb="xs">
                    <div>
                      <Text fw={600} size="sm">{test.test_name}</Text>
                      {test.abbreviation && (
                        <Text size="xs" c="dimmed">{test.abbreviation}</Text>
                      )}
                    </div>
                    <Badge
                      color={getStatusColor(test.status)}
                      size="sm"
                    >
                      {test.status?.toUpperCase()} {getStatusIcon(test.status, test.value, test.ref_range_min, test.ref_range_max)}
                    </Badge>
                  </Group>

                  <Text size="xl" fw={700} mb="xs">
                    {test.value} <Text span size="sm" fw={400} c="dimmed">{test.unit}</Text>
                  </Text>

                  {(test.ref_range_min || test.ref_range_max) && (
                    <Text size="xs" c="dimmed">
                      Reference: {test.ref_range_min || '–'} - {test.ref_range_max || '–'}
                    </Text>
                  )}
                </Paper>
              </Grid.Col>
            ))}
          </Grid>
        </Paper>
      ))}
    </Stack>
  );
};

export default TestComponentDisplay;
```

### 4. Template Entry Component (`TestComponentTemplates.js`)
```javascript
import React, { useState } from 'react';
import { Paper, Grid, Text, Button, Stack, NumberInput, Group } from '@mantine/core';

const TEST_TEMPLATES = {
  cbc: {
    name: "Complete Blood Count (CBC)",
    description: "8 common blood tests",
    tests: [
      { test_name: "White Blood Cell Count", abbreviation: "WBC", unit: "K/uL", ref_range_min: 4.5, ref_range_max: 11.0, category: "hematology" },
      { test_name: "Red Blood Cell Count", abbreviation: "RBC", unit: "M/uL", ref_range_min: 4.50, ref_range_max: 5.90, category: "hematology" },
      { test_name: "Hemoglobin", abbreviation: "HGB", unit: "g/dL", ref_range_min: 13.5, ref_range_max: 17.5, category: "hematology" },
      { test_name: "Hematocrit", abbreviation: "HCT", unit: "%", ref_range_min: 41.0, ref_range_max: 53.0, category: "hematology" },
      { test_name: "Platelet Count", abbreviation: "PLT", unit: "K/uL", ref_range_min: 150, ref_range_max: 400, category: "hematology" }
    ]
  },
  bmp: {
    name: "Basic Metabolic Panel (BMP)",
    description: "8 chemistry tests",
    tests: [
      { test_name: "Glucose", abbreviation: "GLU", unit: "mg/dL", ref_range_min: 70, ref_range_max: 100, category: "chemistry" },
      { test_name: "Sodium", abbreviation: "Na", unit: "mmol/L", ref_range_min: 136, ref_range_max: 145, category: "chemistry" },
      { test_name: "Potassium", abbreviation: "K", unit: "mmol/L", ref_range_min: 3.5, ref_range_max: 5.1, category: "chemistry" },
      { test_name: "Creatinine", abbreviation: "CREA", unit: "mg/dL", ref_range_min: 0.6, ref_range_max: 1.2, category: "chemistry" }
    ]
  }
};

const TestComponentTemplates = ({ onSave, onCancel }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [values, setValues] = useState({});

  const handleTemplateSelect = (templateKey) => {
    setSelectedTemplate(templateKey);
    // Initialize empty values for each test
    const initialValues = {};
    TEST_TEMPLATES[templateKey].tests.forEach((test, index) => {
      initialValues[index] = '';
    });
    setValues(initialValues);
  };

  const handleValueChange = (testIndex, value) => {
    setValues(prev => ({
      ...prev,
      [testIndex]: value
    }));
  };

  const handleSave = () => {
    if (!selectedTemplate) return;

    const template = TEST_TEMPLATES[selectedTemplate];
    const components = template.tests.map((test, index) => ({
      ...test,
      value: parseFloat(values[index]) || 0
    })).filter(component => component.value > 0); // Only save tests with values

    onSave(components);
  };

  if (!selectedTemplate) {
    return (
      <Stack gap="md">
        <Text size="lg" fw={600}>Select a Test Panel Template</Text>
        <Grid>
          {Object.entries(TEST_TEMPLATES).map(([key, template]) => (
            <Grid.Col key={key} span={{ base: 12, sm: 6, md: 4 }}>
              <Paper
                p="md"
                withBorder
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => handleTemplateSelect(key)}
              >
                <Text fw={600} mb="xs">{template.name}</Text>
                <Text size="sm" c="dimmed">{template.description}</Text>
              </Paper>
            </Grid.Col>
          ))}
        </Grid>
        <Group justify="flex-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </Group>
      </Stack>
    );
  }

  const template = TEST_TEMPLATES[selectedTemplate];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="lg" fw={600}>{template.name} - Enter Values</Text>
        <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
          ← Back to Templates
        </Button>
      </Group>

      <Paper p="md" withBorder>
        <Grid>
          {template.tests.map((test, index) => (
            <Grid.Col key={index} span={{ base: 12, sm: 6, md: 4 }}>
              <Stack gap="xs">
                <Text fw={600} size="sm">{test.test_name}</Text>
                <Text size="xs" c="dimmed">{test.abbreviation}</Text>
                <NumberInput
                  placeholder={`Enter value`}
                  value={values[index]}
                  onChange={(value) => handleValueChange(index, value)}
                  rightSection={<Text size="xs" c="dimmed">{test.unit}</Text>}
                  step={0.1}
                />
                <Text size="xs" c="dimmed">
                  Ref: {test.ref_range_min || '–'} - {test.ref_range_max || '–'}
                </Text>
              </Stack>
            </Grid.Col>
          ))}
        </Grid>
      </Paper>

      <Group justify="flex-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>Save Test Results</Button>
      </Group>
    </Stack>
  );
};

export default TestComponentTemplates;
```

### 5. Bulk Entry Component (`TestComponentBulkEntry.js`)
```javascript
import React, { useState } from 'react';
import { Paper, Textarea, Button, Stack, Text, Group, Alert } from '@mantine/core';

const TestComponentBulkEntry = ({ onSave, onCancel }) => {
  const [inputText, setInputText] = useState('');
  const [parsedResults, setParsedResults] = useState([]);
  const [parseError, setParseError] = useState('');

  const parseInput = () => {
    try {
      const lines = inputText.split('\n').filter(line => line.trim());
      const results = [];

      for (const line of lines) {
        // Simple format: TestName: Value Unit (Min-Max)
        // Example: WBC: 12.3 K/uL (4.5-11.0)
        const match = line.match(/^(.+?):\s*(\d+\.?\d*)\s*(\S+)(?:\s*\((\d+\.?\d*)-(\d+\.?\d*)\))?/);

        if (match) {
          const [, testName, value, unit, refMin, refMax] = match;
          results.push({
            test_name: testName.trim(),
            value: parseFloat(value),
            unit: unit.trim(),
            ref_range_min: refMin ? parseFloat(refMin) : null,
            ref_range_max: refMax ? parseFloat(refMax) : null,
            category: 'other' // Default category
          });
        }
      }

      if (results.length === 0) {
        setParseError('No valid test results found. Please check the format.');
      } else {
        setParsedResults(results);
        setParseError('');
      }
    } catch (error) {
      setParseError('Error parsing input. Please check the format.');
    }
  };

  const handleSave = () => {
    if (parsedResults.length > 0) {
      onSave(parsedResults);
    }
  };

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>Copy/Paste Lab Results</Text>

      <Alert color="blue" title="Supported Format">
        <Text size="sm">TestName: Value Unit (Min-Max)</Text>
        <Text size="sm">Example: WBC: 12.3 K/uL (4.5-11.0)</Text>
      </Alert>

      <Textarea
        label="Paste Your Lab Results"
        placeholder={`WBC: 12.3 K/uL (4.5-11.0)
RBC: 4.82 M/uL (4.50-5.90)
Hemoglobin: 14.2 g/dL (13.5-17.5)
Glucose: 95 mg/dL (70-100)`}
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        minRows={6}
        error={parseError}
      />

      <Group>
        <Button variant="outline" onClick={parseInput}>
          Parse Results
        </Button>
        {parsedResults.length > 0 && (
          <Text size="sm" c="green">
            ✓ Found {parsedResults.length} valid test results
          </Text>
        )}
      </Group>

      {parsedResults.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={600} mb="md">Preview Parsed Results:</Text>
          <Stack gap="xs">
            {parsedResults.map((result, index) => (
              <Group key={index} justify="space-between">
                <Text size="sm">{result.test_name}</Text>
                <Text size="sm">{result.value} {result.unit}</Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      <Group justify="flex-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={handleSave}
          disabled={parsedResults.length === 0}
        >
          Import {parsedResults.length} Results
        </Button>
      </Group>
    </Stack>
  );
};

export default TestComponentBulkEntry;
```

### 6. Main Tab Component (`TestComponentsTab.js`)
```javascript
import React, { useState, useEffect } from 'react';
import { Stack, Group, Button, Tabs, Paper, Text } from '@mantine/core';
import TestComponentDisplay from './TestComponentDisplay';
import TestComponentTemplates from './TestComponentTemplates';
import TestComponentBulkEntry from './TestComponentBulkEntry';
import TestComponentStats from './TestComponentStats';
import { labTestComponentApi } from '../../../services/api/labTestComponentApi';
import logger from '../../../services/logger';

const TestComponentsTab = ({ labResult, onUpdate }) => {
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entryMode, setEntryMode] = useState(null); // null, 'template', 'bulk'

  useEffect(() => {
    fetchComponents();
  }, [labResult.id]);

  const fetchComponents = async () => {
    try {
      setLoading(true);
      const data = await labTestComponentApi.getByLabResult(labResult.id);
      setComponents(data);
    } catch (err) {
      setError(err.message);
      logger.error('fetch_test_components_error', {
        labResultId: labResult.id,
        error: err.message,
        component: 'TestComponentsTab'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveComponents = async (newComponents) => {
    try {
      setLoading(true);
      await labTestComponentApi.createBulkForLabResult(labResult.id, newComponents);
      await fetchComponents(); // Refresh
      setEntryMode(null);

      logger.info('test_components_saved', {
        labResultId: labResult.id,
        componentCount: newComponents.length,
        component: 'TestComponentsTab'
      });

      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message);
      logger.error('save_test_components_error', {
        labResultId: labResult.id,
        error: err.message,
        component: 'TestComponentsTab'
      });
    } finally {
      setLoading(false);
    }
  };

  if (entryMode === 'template') {
    return (
      <TestComponentTemplates
        onSave={handleSaveComponents}
        onCancel={() => setEntryMode(null)}
      />
    );
  }

  if (entryMode === 'bulk') {
    return (
      <TestComponentBulkEntry
        onSave={handleSaveComponents}
        onCancel={() => setEntryMode(null)}
      />
    );
  }

  return (
    <Stack gap="md">
      {/* Action Bar */}
      <Paper p="md" withBorder>
        <Group justify="space-between">
          <TestComponentStats components={components} />
          <Group>
            <Button variant="outline" onClick={() => setEntryMode('template')}>
              📋 Add from Template
            </Button>
            <Button variant="outline" onClick={() => setEntryMode('bulk')}>
              📄 Copy/Paste
            </Button>
            <Button>➕ Add Individual Test</Button>
          </Group>
        </Group>
      </Paper>

      {/* Display */}
      <TestComponentDisplay
        components={components}
        loading={loading}
      />
    </Stack>
  );
};

export default TestComponentsTab;
```

### 7. Enhanced Lab Result Card (`LabResultCard.js` modifications)
```javascript
// Add to existing LabResultCard.js after the existing fields (around line 100)

// Test components summary
if (labResult.test_components && labResult.test_components.length > 0) {
  const normalCount = labResult.test_components.filter(t => t.status === 'normal').length;
  const abnormalCount = labResult.test_components.filter(t => ['high', 'low'].includes(t.status)).length;
  const criticalCount = labResult.test_components.filter(t => t.status === 'critical').length;

  fields.push({
    label: 'Test Results',
    value: `${labResult.test_components.length} components`,
    render: () => (
      <Paper p="xs" withBorder radius="md" style={{ background: '#f8f9fa', marginTop: '8px' }}>
        <Group gap="xs" mb="xs">
          <Text size="sm" fw={600}>📊 {labResult.test_components.length} Test Results</Text>
        </Group>
        <Group gap="xs">
          <Badge color="green" size="sm">{normalCount} Normal</Badge>
          {abnormalCount > 0 && <Badge color="orange" size="sm">{abnormalCount} Abnormal</Badge>}
          {criticalCount > 0 && <Badge color="red" size="sm">{criticalCount} Critical</Badge>}
        </Group>
      </Paper>
    )
  });
}
```

### 8. Enhanced Lab Result View Modal (`LabResultViewModal.js` modifications)
```javascript
// Add import
import TestComponentsTab from './testComponents/TestComponentsTab';

// Add state for active tab (around line 50)
const [activeTab, setActiveTab] = useState('overview');

// Modify the tabs section to include test results tab
<Tabs value={activeTab} onChange={setActiveTab}>
  <Tabs.List>
    <Tabs.Tab value="overview">Overview</Tabs.Tab>
    <Tabs.Tab value="test-results">
      Test Results
      {labResult.test_components?.length > 0 && (
        <Badge ml="xs" size="sm" color="blue">
          {labResult.test_components.length}
        </Badge>
      )}
    </Tabs.Tab>
    <Tabs.Tab value="documents">Documents</Tabs.Tab>
    <Tabs.Tab value="conditions">Related Conditions</Tabs.Tab>
  </Tabs.List>

  <Tabs.Panel value="overview">
    {/* Existing overview content */}
  </Tabs.Panel>

  <Tabs.Panel value="test-results">
    <TestComponentsTab
      labResult={labResult}
      onUpdate={fetchLabResultConditions} // Reuse existing refresh
    />
  </Tabs.Panel>

  {/* Existing other tabs */}
</Tabs>
```

## Implementation Timeline

### Week 1: Backend Foundation
- [ ] Create database migration for `lab_test_components` table
- [ ] Add `LabTestComponent` model to `app/models/models.py`
- [ ] Create schemas in `app/schemas/lab_test_component.py`
- [ ] Implement CRUD operations in `app/crud/lab_test_component.py`
- [ ] Add API endpoints in `app/api/v1/endpoints/lab_test_component.py`
- [ ] Add relationship to existing `LabResult` model
- [ ] Test all API endpoints

### Week 2: Frontend Core
- [ ] Create component structure in `testComponents/` folder
- [ ] Implement `TestComponentDisplay.js` with beautiful cards
- [ ] Create `TestComponentTemplates.js` with CBC/BMP templates
- [ ] Build `TestComponentBulkEntry.js` with simple parsing
- [ ] Implement `TestComponentsTab.js` as main container
- [ ] Create API service `labTestComponentApi.js`
- [ ] Test all components in isolation

### Week 3: Integration & Polish
- [ ] Enhance `LabResultCard.js` with test summary
- [ ] Add test results tab to `LabResultViewModal.js`
- [ ] Connect to existing error handling and logging patterns
- [ ] Add export functionality (CSV)
- [ ] Comprehensive testing of all workflows
- [ ] Bug fixes and performance optimization
- [ ] Documentation updates

## Key Features Delivered

✅ **Core Functionality**
- Store individual test values linked to lab results
- Auto-calculate status (normal/high/low/critical)
- Beautiful visual display grouped by category
- Multiple entry methods (templates, bulk, manual)

✅ **Visual Design**
- Matches mockup design with cards, colors, status indicators
- Category grouping (Hematology, Chemistry, Lipids)
- Status badges with directional arrows
- Summary statistics

✅ **Entry Methods**
- Template selection (CBC, BMP, Lipid Panel)
- Copy/paste with simple parsing
- Manual individual test entry
- Bulk import capabilities

✅ **Integration**
- Seamless integration with existing lab results
- Follows all MediKeep patterns and conventions
- Uses existing Mantine UI components
- Reuses existing error handling and logging

## Testing Checklist

### Backend Testing
- [ ] All API endpoints return correct data
- [ ] Status calculation works correctly
- [ ] Bulk creation handles errors gracefully
- [ ] Database relationships are maintained
- [ ] Migration runs successfully

### Frontend Testing
- [ ] Template selection and value entry works
- [ ] Bulk parsing handles various formats
- [ ] Cards display correctly with proper styling
- [ ] Status colors and icons show correctly
- [ ] Integration with lab result modal works
- [ ] Error states are handled properly

### Integration Testing
- [ ] End-to-end workflow from lab result to test components
- [ ] Data persistence across browser sessions
- [ ] Error handling follows MediKeep patterns
- [ ] Logging captures all important events
- [ ] Performance is acceptable with large datasets

## Future Enhancements (Post-MVP)
- Historical trend charts
- Comparison with previous results
- More sophisticated parsing algorithms
- Additional test templates
- Export to PDF with formatting
- Advanced filtering and search
- Mobile optimization
- Accessibility improvements

## File Tracking

### New Files Created
```
Backend:
- app/schemas/lab_test_component.py
- app/crud/lab_test_component.py
- app/api/v1/endpoints/lab_test_component.py
- app/data/test_templates.py
- alembic/versions/[timestamp]_add_lab_test_components.py

Frontend:
- frontend/src/services/api/labTestComponentApi.js
- frontend/src/components/medical/labresults/testComponents/TestComponentsTab.js
- frontend/src/components/medical/labresults/testComponents/TestComponentDisplay.js
- frontend/src/components/medical/labresults/testComponents/TestComponentEntry.js
- frontend/src/components/medical/labresults/testComponents/TestComponentTemplates.js
- frontend/src/components/medical/labresults/testComponents/TestComponentBulkEntry.js
- frontend/src/components/medical/labresults/testComponents/TestComponentCard.js
- frontend/src/components/medical/labresults/testComponents/TestComponentStats.js
```

### Modified Files
```
Backend:
- app/models/models.py (add test_components relationship to LabResult)
- app/api/v1/api.py (include new router)

Frontend:
- frontend/src/components/medical/labresults/LabResultCard.js (add test summary)
- frontend/src/components/medical/labresults/LabResultViewModal.js (add test results tab)
- frontend/src/services/api/index.js (export new API service)
```

This document serves as the complete implementation guide for the lab test components feature, providing all necessary code, patterns, and step-by-step instructions following MediKeep's existing architecture.