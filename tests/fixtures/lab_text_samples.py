"""
Test fixtures with sample lab text for parser testing.

Contains clean text samples and OCR-corrupted variants from real scanned PDFs.
"""

# Clean LabCorp sample (ideal extraction - no OCR corruption)
LABCORP_CLEAN_TEXT = """
Laboratory Corporation of America
Date Collected: 05/19/2023

CBC With Differential/Platelet

Test Current Result and Flag Previous Result and Date Units Reference Interval
WBC 6.2 8.6 11/23/2022 x10E3/uL 3.4-10.8
RBC 4.85 4.66 11/23/2022 x10E6/uL 4.14-5.80
Hemoglobin 14.0 13.8 11/23/2022 g/dL 13.0-17.7
Hematocrit 41.4 40.5 11/23/2022 % 37.5-51.0
MCV 85 87 11/23/2022 fL 79-97
MCH 28.9 29.6 11/23/2022 pg 26.6-33.0
MCHC 33.8 34.1 11/23/2022 g/dL 31.5-35.7
RDW 12.2 12.5 11/23/2022 % 11.6-15.4
Platelets 225 242 11/23/2022 x10E3/uL 150-450
Neutrophils 52 55 11/23/2022 % Not Estab.
Lymphs 33 34 11/23/2022 % Not Estab.
Monocytes 11 8 11/23/2022 % Not Estab.
Eos 3 2 11/23/2022 % Not Estab.
Basos 1 1 11/23/2022 % Not Estab.
Neutrophils (Absolute) 3.2 4.7 11/23/2022 x10E3/uL 1.4-7.0
Lymphs (Absolute) 2.0 2.9 11/23/2022 x10E3/uL 0.7-3.1
Monocytes (Absolute) 0.7 0.7 11/23/2022 x10E3/uL 0.1-0.9
Eos (Absolute) 0.2 0.2 11/23/2022 x10E3/uL 0.0-0.4
Baso (Absolute) 0.1 0.1 11/23/2022 x10E3/uL 0.0-0.2
Immature Granulocytes 0 0 11/23/2022 % Not Estab.
Immature Grans (Abs) 0.0 0.0 11/23/2022 x10E3/uL 0.0-0.1

Estradiol

Test Current Result and Flag Previous Result and Date Units Reference Interval
Estradiol 18.0 <5.0 04/13/2022 pg/mL 7.6-42.6
"""

# LabCorp sample with OCR corruption (actual scanned PDF artifacts)
LABCORP_SAMPLE_WITH_OCR_ERRORS = """
Laboratory Corporation of America
Date Collected: 05/19/2023

CBC With Differential/Platelet

Test Current Result and Flag Previous Result and Date Units Reference Interval
WBC" 6.2 8.6 11/23/2022 xlOE3/uL 3.4-10.8
RBC<" 4.85 4.66 11/23/2022 xlOE6/uL 4.14-5.80
Hemoglobin" 14.0 13.8 11/23/2022 g/dL 13.0-17.7
Hematocrit" 41.4 40.5 11/23/2022 % 37.5-51.0
MCV" 85 87 11/23/2022 fL 79-97
MCH" 28.9 29.6 11/23/2022 Pg 26.6-33.0
MCHC" 33.8 34.1 11/23/2022 g/dL 31.5-35.7
RDW" 12.2 12.5 11/23/2022 % 11.6-15.4
Platelets" 225 242 11/23/2022 X10E3/UL 150-450
Neutrophils"' 52 55 11/23/2022 % Not Estab.
Lymphs" 33 34 11/23/2022 % Not Estab.
Monocytes" 11 8 11/23/2022 % Not Estab.
Eos" 3 2 11/23/2022 % Not Estab.
^asos" 1 1 11/23/2022 % Not Estab.
hleutrophils (Absolute)" 3.2 4.7 11/23/2022 xlOE3/uL 1.4-7.0
Lymphs( Absolute)" 2.0 2.9 11/23/2022 xlOE3/uL 0.7-3.1
Monocytes(Absolute)" 0.7 0.7 11/23/2022 xlOE3/uL 0.1-0.9
Eos (Absolute)" 0.2 0.2 11/23/2022 xlOE3/uL 0.0-0.4
Baso (Absolute)" 0.1 0.1 11/23/2022 xlOE3/uL 0.0-0.2
lijnmature Granulocytes"
0 0 11/23/2022 % Not Estab.
Immature Grans( Abs)" 0.0 0.0 11/23/2022 xlOE3/uL 0.0-0.1

Estradiol

Test Current Result and Flag Previous Result and Date Units Reference Interval
Estradiol" 18.0 <5.0 04/13/2022 pg/mL 7.6-42.6
"""

# Multi-line test sample (test name on one line, values on next)
LABCORP_MULTILINE_TEST = """
Laboratory Corporation of America
Date Collected: 10/15/2023

CBC With Differential/Platelet

Immature Granulocytes
0 0 11/23/2022 % Not Estab.

Hemoglobin A1c
6.5 6.2 10/01/2022 % <5.7

Vitamin D, 25-Hydroxy
45.0 38.0 09/15/2022 ng/mL 30-100
"""

# Minimal sample (< 5 tests) to trigger OCR fallback
LABCORP_MINIMAL_SAMPLE = """
Laboratory Corporation of America
Date Collected: 05/19/2023

CBC

WBC" 6.2 x10E3/uL 3.4-10.8
RBC" 4.85 x10E6/uL 4.14-5.80
Hemoglobin" 14.0 g/dL 13.0-17.7
"""

# Sample with percent symbol in test name
LABCORP_PERCENT_TEST = """
Laboratory Corporation of America
Date Collected: 08/10/2023

Testosterone Tests

% Free Testosterone 2.1 1.8 10/01/2022 % 1.5-4.2
Testosterone, Total 450 420 10/01/2022 ng/dL 264-916
"""

# Sample with special flags
LABCORP_WITH_FLAGS = """
Laboratory Corporation of America
Date Collected: 06/12/2023

Metabolic Panel

Glucose 145 High 98 05/01/2023 mg/dL 70-99
Creatinine 0.8 0.9 05/01/2023 mg/dL 0.7-1.3
BUN 18 22 High 05/01/2023 mg/dL 7-20
Sodium 142 138 Low 05/01/2023 mEq/L 136-145
"""

# Non-LabCorp sample (should NOT match LabCorp parser)
QUEST_DIAGNOSTICS_SAMPLE = """
Quest Diagnostics
Collection Date: 05/19/2023

CHOLESTEROL, TOTAL 170 Reference Range: <200 mg/dL
HDL CHOLESTEROL 45 Reference Range: >40 mg/dL
LDL CHOLESTEROL 105 Reference Range: <100 mg/dL OPTIMAL
TRIGLYCERIDES 100 Reference Range: <150 mg/dL
"""

# ============================================================
# Epic MyChart samples
# ============================================================

# Clean Epic MyChart renal panel (3 tests, sequential extraction)
EPIC_MYCHART_RENAL_PANEL = """
MyChart - licensed from Epic Systems Corporation
Collected on Apr 10, 2025
Authorizing provider: Dr. Smith
Result status: Final
Resulting lab: Main Hospital Lab

Creatinine Level
Normal range: 0.50 - 0.90 mg/dL
0.50    0.90
0.72

Blood Urea Nitrogen (BUN)
Normal range: 7 - 25 mg/dL
7    25
15

Calcium Level
Normal range: 8.5 - 10.5 mg/dL
8.5    10.5
9.4
"""

# Full 12-test panel including EGFR with "above >=90" and "Value" label
EPIC_MYCHART_FULL_PANEL = """
MyChart - licensed from Epic Systems Corporation
Collected on Apr 10, 2025
Authorizing provider: Dr. Smith
Result status: Final
Resulting lab: Main Hospital Lab

Glucose Level
Normal range: 74 - 106 mg/dL
74    106
92

Blood Urea Nitrogen (BUN)
Normal range: 7 - 25 mg/dL
7    25
15

Creatinine Level
Normal range: 0.50 - 0.90 mg/dL
0.50    0.90
0.72

EGFR
Normal range: above >=90 mL/min/1.73m2
Value
126

Sodium Level
Normal range: 136 - 145 mmol/L
136    145
140

Potassium Level
Normal range: 3.5 - 5.1 mmol/L
3.5    5.1
4.2

Chloride Level
Normal range: 98 - 106 mmol/L
98    106
102

Carbon Dioxide Level
Normal range: 20 - 29 mmol/L
20    29
24

Calcium Level
Normal range: 8.5 - 10.5 mg/dL
8.5    10.5
9.4

Protein Total
Normal range: 6.0 - 8.5 g/dL
6.0    8.5
7.1

Albumin Level
Normal range: 3.5 - 5.5 g/dL
3.5    5.5
4.3

Anion Gap
Normal range: 5 - 15 mmol/L
5    15
10
"""

# Epic MyChart with abnormal flags (values outside normal range)
EPIC_MYCHART_WITH_FLAGS = """
MyChart - licensed from Epic Systems Corporation
Collected on Jun 15, 2025
Authorizing provider: Dr. Johnson
Result status: Final
Resulting lab: Regional Medical Center

Glucose Level
Normal range: 74 - 106 mg/dL
74    106
118

Creatinine Level
Normal range: 0.50 - 0.90 mg/dL
0.50    0.90
0.42

EGFR
Normal range: above >=90 mL/min/1.73m2
Value
72

Sodium Level
Normal range: 136 - 145 mmol/L
136    145
140
"""

# Edge case: Empty PDF
EMPTY_PDF_TEXT = ""

# Edge case: PDF with no test results (just headers)
LABCORP_NO_TESTS = """
Laboratory Corporation of America
Patient: John Doe
DOB: 01/15/1980
Date Collected: 05/19/2023
Ordering Physician: Dr. Smith

This report contains no test results.
Please contact the lab for more information.
"""

# Real-world comprehensive sample (all types of corruption)
LABCORP_COMPREHENSIVE_CORRUPTED = """
Laboratory Corporation of America
Date Collected: 05/19/2023

CBC With Differential/Platelet

Test Current Result and Flag Previous Result and Date Units Reference Interval
WBC" 6.2 8.6 11/23/2022 xlOE3/uL 3.4-10.8
RBC<" 4.85 4.66 11/23/2022 xlOE6/uL 4.14-5.80
Hemoglobin" 14.0 High 13.8 11/23/2022 g/dL 13.0-17.7
^asos" 1 1 11/23/2022 % Not Estab.
hleutrophils (Absolute)" 3.2 4.7 11/23/2022 xlOE3/uL 1.4-7.0
lijnmature Granulocytes"
0 0 11/23/2022 % Not Estab.
% Free Testosterone 2.1 1.8 10/01/2022 % 1.5-4.2
"""
