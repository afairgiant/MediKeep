"""
Trend Statistics Utilities

Shared statistical helpers for trend analysis across vitals and lab results.
"""

from typing import List


def compute_trend_direction(values: List[float]) -> str:
    """
    Determine trend direction using linear regression slope.

    Fits a least-squares line y = mx + b to the values (using index as x)
    and checks whether the total predicted change over the dataset is
    meaningful relative to the data's range.
    """
    n = len(values)
    if n < 3:
        return "stable"

    # Least-squares linear regression: y = mx + b
    # x values are 0, 1, 2, ..., n-1
    sum_x = n * (n - 1) / 2
    sum_x2 = n * (n - 1) * (2 * n - 1) / 6
    sum_y = sum(values)
    sum_xy = sum(i * v for i, v in enumerate(values))

    denominator = n * sum_x2 - sum_x * sum_x
    if abs(denominator) < 1e-10:
        return "stable"

    slope = (n * sum_xy - sum_x * sum_y) / denominator

    # Total predicted change over the dataset
    total_change = slope * (n - 1)

    # Compare against the data range to determine significance
    data_range = max(values) - min(values)
    avg = sum_y / n

    # Use whichever is larger as the baseline for comparison
    baseline = max(data_range, abs(avg) * 0.01)
    if baseline < 1e-10:
        return "stable"

    # Trend is meaningful if the regression line's total rise/fall
    # is at least 10% of the data range (or avg for flat data)
    threshold = baseline * 0.10
    if total_change > threshold:
        return "increasing"
    if total_change < -threshold:
        return "decreasing"

    return "stable"
