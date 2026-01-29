"""
Unit tests for the UnitConverter class in export_service.py

Tests cover:
1. Unit conversion accuracy for weight, height, and temperature
2. Correct unit labels for both imperial and metric systems
3. Handling of null/None values during conversion
4. BMI calculation from metric values
"""

import pytest
from app.services.export_service import UnitConverter, UNIT_LABELS


class TestUnitConverterWeightConversion:
    """Tests for weight conversion (lbs to kg)."""

    def test_lbs_to_kg_standard_value(self):
        """Test conversion of a standard weight value."""
        # 150 lbs = 68.0 kg (rounded to 1 decimal)
        result = UnitConverter.lbs_to_kg(150)
        assert result == 68.0

    def test_lbs_to_kg_zero(self):
        """Test conversion of zero weight."""
        result = UnitConverter.lbs_to_kg(0)
        assert result == 0.0

    def test_lbs_to_kg_decimal_value(self):
        """Test conversion of decimal weight value."""
        # 100.5 lbs = 45.6 kg (rounded)
        result = UnitConverter.lbs_to_kg(100.5)
        assert result == 45.6

    def test_lbs_to_kg_none(self):
        """Test that None input returns None."""
        result = UnitConverter.lbs_to_kg(None)
        assert result is None

    def test_lbs_to_kg_large_value(self):
        """Test conversion of large weight value."""
        # 300 lbs = 136.1 kg
        result = UnitConverter.lbs_to_kg(300)
        assert result == 136.1


class TestUnitConverterHeightConversion:
    """Tests for height conversion (inches to cm)."""

    def test_inches_to_cm_standard_value(self):
        """Test conversion of a standard height value."""
        # 70 inches = 177.8 cm
        result = UnitConverter.inches_to_cm(70)
        assert result == 177.8

    def test_inches_to_cm_zero(self):
        """Test conversion of zero height."""
        result = UnitConverter.inches_to_cm(0)
        assert result == 0.0

    def test_inches_to_cm_decimal_value(self):
        """Test conversion of decimal height value."""
        # 65.5 inches = 166.4 cm
        result = UnitConverter.inches_to_cm(65.5)
        assert result == 166.4

    def test_inches_to_cm_none(self):
        """Test that None input returns None."""
        result = UnitConverter.inches_to_cm(None)
        assert result is None

    def test_inches_to_cm_short_height(self):
        """Test conversion of short height (child)."""
        # 36 inches (3 feet) = 91.4 cm
        result = UnitConverter.inches_to_cm(36)
        assert result == 91.4


class TestUnitConverterTemperatureConversion:
    """Tests for temperature conversion (Fahrenheit to Celsius)."""

    def test_fahrenheit_to_celsius_body_temp(self):
        """Test conversion of normal body temperature."""
        # 98.6°F = 37.0°C
        result = UnitConverter.fahrenheit_to_celsius(98.6)
        assert result == 37.0

    def test_fahrenheit_to_celsius_freezing(self):
        """Test conversion of freezing point."""
        # 32°F = 0°C
        result = UnitConverter.fahrenheit_to_celsius(32)
        assert result == 0.0

    def test_fahrenheit_to_celsius_boiling(self):
        """Test conversion of boiling point."""
        # 212°F = 100°C
        result = UnitConverter.fahrenheit_to_celsius(212)
        assert result == 100.0

    def test_fahrenheit_to_celsius_fever(self):
        """Test conversion of fever temperature."""
        # 102°F = 38.9°C
        result = UnitConverter.fahrenheit_to_celsius(102)
        assert result == 38.9

    def test_fahrenheit_to_celsius_none(self):
        """Test that None input returns None."""
        result = UnitConverter.fahrenheit_to_celsius(None)
        assert result is None


class TestUnitConverterBMICalculation:
    """Tests for BMI calculation from metric values."""

    def test_calculate_bmi_normal_weight(self):
        """Test BMI calculation for normal weight person."""
        # 70 kg, 175 cm -> BMI = 70 / (1.75)^2 = 22.9
        result = UnitConverter.calculate_bmi(70, 175)
        assert result == 22.9

    def test_calculate_bmi_overweight(self):
        """Test BMI calculation for overweight person."""
        # 90 kg, 170 cm -> BMI = 90 / (1.70)^2 = 31.1
        result = UnitConverter.calculate_bmi(90, 170)
        assert result == 31.1

    def test_calculate_bmi_underweight(self):
        """Test BMI calculation for underweight person."""
        # 50 kg, 175 cm -> BMI = 50 / (1.75)^2 = 16.3
        result = UnitConverter.calculate_bmi(50, 175)
        assert result == 16.3

    def test_calculate_bmi_none_weight(self):
        """Test that None weight returns None."""
        result = UnitConverter.calculate_bmi(None, 175)
        assert result is None

    def test_calculate_bmi_none_height(self):
        """Test that None height returns None."""
        result = UnitConverter.calculate_bmi(70, None)
        assert result is None

    def test_calculate_bmi_both_none(self):
        """Test that both None returns None."""
        result = UnitConverter.calculate_bmi(None, None)
        assert result is None

    def test_calculate_bmi_zero_height(self):
        """Test that zero height returns None (avoid division by zero)."""
        result = UnitConverter.calculate_bmi(70, 0)
        assert result is None

    def test_calculate_bmi_negative_height(self):
        """Test that negative height returns None."""
        result = UnitConverter.calculate_bmi(70, -175)
        assert result is None


class TestUnitConverterLabels:
    """Tests for unit label retrieval."""

    def test_get_unit_labels_imperial(self):
        """Test getting imperial unit labels."""
        labels = UnitConverter.get_unit_labels("imperial")
        assert labels["weight"] == "lbs"
        assert labels["height"] == "inches"
        assert labels["temperature"] == "°F"

    def test_get_unit_labels_metric(self):
        """Test getting metric unit labels."""
        labels = UnitConverter.get_unit_labels("metric")
        assert labels["weight"] == "kg"
        assert labels["height"] == "cm"
        assert labels["temperature"] == "°C"

    def test_get_unit_labels_invalid_defaults_to_imperial(self):
        """Test that invalid unit system defaults to imperial."""
        labels = UnitConverter.get_unit_labels("invalid")
        assert labels["weight"] == "lbs"
        assert labels["height"] == "inches"
        assert labels["temperature"] == "°F"

    def test_get_unit_labels_empty_defaults_to_imperial(self):
        """Test that empty string defaults to imperial."""
        labels = UnitConverter.get_unit_labels("")
        assert labels["weight"] == "lbs"

    def test_unit_labels_constant_structure(self):
        """Test that UNIT_LABELS constant has correct structure."""
        assert "imperial" in UNIT_LABELS
        assert "metric" in UNIT_LABELS
        assert set(UNIT_LABELS["imperial"].keys()) == {"weight", "height", "temperature"}
        assert set(UNIT_LABELS["metric"].keys()) == {"weight", "height", "temperature"}


class TestUnitConverterRoundTrip:
    """Tests for conversion accuracy using round-trip validation."""

    def test_weight_conversion_precision(self):
        """Test that weight conversion maintains reasonable precision."""
        # Convert 150 lbs to kg, then verify it's close to expected
        kg = UnitConverter.lbs_to_kg(150)
        # 150 * 0.453592 = 68.0388, rounded to 68.0
        assert abs(kg - 68.0) < 0.1

    def test_height_conversion_precision(self):
        """Test that height conversion maintains reasonable precision."""
        # Convert 72 inches to cm
        cm = UnitConverter.inches_to_cm(72)
        # 72 * 2.54 = 182.88, rounded to 182.9
        assert abs(cm - 182.9) < 0.1

    def test_temperature_conversion_precision(self):
        """Test that temperature conversion maintains reasonable precision."""
        # Convert 100°F to Celsius
        celsius = UnitConverter.fahrenheit_to_celsius(100)
        # (100-32) * 5/9 = 37.777..., rounded to 37.8
        assert abs(celsius - 37.8) < 0.1
