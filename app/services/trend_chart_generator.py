"""
Trend Chart Generator

Generates trend chart images (PNG) for vital signs and lab test results
using matplotlib's OO API (thread-safe, no pyplot import).

Charts are designed for print: white background, dark text, clear gridlines.
"""

import io
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import matplotlib

matplotlib.use("Agg")  # Non-interactive backend, must be set before importing Figure

# pylint: disable=wrong-import-position  # matplotlib.use() must precede submodule imports
import numpy as np
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.dates import date2num
from matplotlib.figure import Figure

from app.core.logging.config import get_logger

# pylint: enable=wrong-import-position

logger = get_logger(__name__, "app")

# Chart constants
CHART_WIDTH_INCHES = 6.5
CHART_HEIGHT_INCHES = 3.0
CHART_DPI = 150
MAX_RAW_DATA_POINTS = 10000

# Print-friendly colors
COLOR_TEXT = "#212121"
COLOR_GRID = "#BDBDBD"
COLOR_LINE = "#1565C0"
COLOR_SYSTOLIC = "#C62828"
COLOR_DIASTOLIC = "#1565C0"
COLOR_REF_BAND = "#E8F5E9"
COLOR_REF_EDGE = "#81C784"
COLOR_TREND_LINE = "#9E9E9E"
COLOR_DOT = "#2E7D32"


def _marker_style(n: int) -> dict:
    """Return marker kwargs adapted to dataset size. Hides markers when dense."""
    if n <= 30:
        return {"marker": "o", "markersize": 4}
    if n <= 80:
        return {"marker": "o", "markersize": 2}
    return {}  # no markers for dense datasets


def _line_width(n: int) -> float:
    """Thinner line for dense datasets so it stays readable."""
    if n <= 50:
        return 1.5
    if n <= 150:
        return 1.0
    return 0.7


class TrendChartGenerator:
    """Generates trend chart PNG images using matplotlib OO API."""

    def generate_vital_chart(
        self,
        vital_data: Dict[str, Any],
        vital_type: str,
    ) -> Optional[bytes]:
        """
        Generate a chart for vital sign trend data.

        Args:
            vital_data: Dict from TrendDataFetcher.fetch_vital_trend() or
                        fetch_blood_pressure_trend()
            vital_type: The vital type identifier

        Returns:
            PNG bytes or None if no data
        """
        # Handle blood pressure as special case (dual lines)
        if vital_type == "blood_pressure" and "systolic_values" in vital_data:
            return self._generate_bp_chart(vital_data)

        dates = vital_data.get("dates", [])
        values = vital_data.get("values", [])

        if not dates or not values:
            return None

        dates, values = _downsample_if_needed(dates, values)
        display_name = vital_data.get("display_name", vital_type)
        unit = vital_data.get("unit", "")
        ref_range = vital_data.get("reference_range")

        fig = Figure(figsize=(CHART_WIDTH_INCHES, CHART_HEIGHT_INCHES), dpi=CHART_DPI)
        canvas = FigureCanvasAgg(fig)
        try:
            ax = fig.add_subplot(111)
            _apply_print_style(ax)

            # Reference band
            if (
                ref_range
                and isinstance(ref_range, (list, tuple))
                and len(ref_range) == 2
            ):
                ax.axhspan(
                    ref_range[0],
                    ref_range[1],
                    alpha=0.15,
                    facecolor=COLOR_REF_BAND,
                    edgecolor=COLOR_REF_EDGE,
                    linewidth=0.5,
                    label="Normal range",
                )

            # Plot line (adapt markers/thickness to data density)
            n = len(dates)
            ax.plot(
                dates,
                values,
                color=COLOR_LINE,
                linewidth=_line_width(n),
                markerfacecolor=COLOR_LINE,
                zorder=5,
                **_marker_style(n),
            )

            # Trend line
            _add_trend_line(ax, dates, values)

            # Labels
            ylabel = f"{display_name} ({unit})" if unit else display_name
            ax.set_ylabel(ylabel, fontsize=9, color=COLOR_TEXT)
            chart_title = vital_data.get("chart_title", f"{display_name} Trend")
            ax.set_title(
                chart_title, fontsize=11, color=COLOR_TEXT, fontweight="bold", pad=14
            )

            _format_date_axis(
                ax, vital_data.get("date_from"), vital_data.get("date_to")
            )

            fig.tight_layout()
            return _figure_to_png(fig, canvas)
        finally:
            fig.clear()
            del fig, canvas

    def _generate_bp_chart(self, bp_data: Dict[str, Any]) -> Optional[bytes]:
        """Generate a dual-line blood pressure chart."""
        dates = bp_data.get("dates", [])
        systolic = bp_data.get("systolic_values", [])
        diastolic = bp_data.get("diastolic_values", [])

        if not dates:
            return None

        dates, systolic, diastolic = _downsample_bp_if_needed(
            dates, systolic, diastolic
        )

        fig = Figure(figsize=(CHART_WIDTH_INCHES, CHART_HEIGHT_INCHES), dpi=CHART_DPI)
        canvas = FigureCanvasAgg(fig)
        try:
            ax = fig.add_subplot(111)
            _apply_print_style(ax)

            # Normal range bands
            ax.axhspan(
                90,
                120,
                alpha=0.08,
                facecolor=COLOR_REF_BAND,
                edgecolor=COLOR_REF_EDGE,
                linewidth=0.5,
            )
            ax.axhspan(
                60,
                80,
                alpha=0.08,
                facecolor=COLOR_REF_BAND,
                edgecolor=COLOR_REF_EDGE,
                linewidth=0.5,
            )

            # Plot both lines (adapt to data density)
            n = len(dates)
            lw = _line_width(n)
            mk = _marker_style(n)
            ax.plot(
                dates,
                systolic,
                color=COLOR_SYSTOLIC,
                linewidth=lw,
                label="Systolic",
                zorder=5,
                **mk,
            )
            ax.plot(
                dates,
                diastolic,
                color=COLOR_DIASTOLIC,
                linewidth=lw,
                label="Diastolic",
                zorder=5,
                **mk,
            )

            # Trend lines
            _add_trend_line(ax, dates, systolic)
            _add_trend_line(ax, dates, diastolic)

            bp_display = bp_data.get("display_name", "Blood Pressure")
            ax.set_ylabel(f"{bp_display} (mmHg)", fontsize=9, color=COLOR_TEXT)
            bp_title = bp_data.get("chart_title", f"{bp_display} Trend")
            ax.set_title(
                bp_title, fontsize=11, color=COLOR_TEXT, fontweight="bold", pad=14
            )
            ax.legend(
                loc="lower left",
                fontsize=7,
                framealpha=0.9,
                bbox_to_anchor=(0.0, 1.02),
                ncol=2,
                borderaxespad=0,
            )

            _format_date_axis(ax, bp_data.get("date_from"), bp_data.get("date_to"))

            fig.tight_layout()
            return _figure_to_png(fig, canvas)
        finally:
            fig.clear()
            del fig, canvas

    def generate_lab_test_chart(
        self,
        lab_data: Dict[str, Any],
    ) -> Optional[bytes]:
        """
        Generate a chart for lab test trend data.

        Args:
            lab_data: Dict from TrendDataFetcher.fetch_lab_test_trend()

        Returns:
            PNG bytes or None if no data
        """
        dates = lab_data.get("dates", [])
        values = lab_data.get("values", [])
        statuses = lab_data.get("statuses", [])

        if not dates or not values:
            return None

        # Filter out None values
        filtered = [
            (d, v, s) for d, v, s in zip(dates, values, statuses) if v is not None
        ]
        if not filtered:
            return None

        dates, values, statuses = zip(*filtered)
        dates = list(dates)
        values = [float(v) for v in values]
        statuses = list(statuses)

        dates, values, statuses = _downsample_lab_if_needed(dates, values, statuses)

        display_name = lab_data.get("display_name", "Lab Test")
        unit = lab_data.get("unit", "")
        ref_min = lab_data.get("ref_range_min")
        ref_max = lab_data.get("ref_range_max")

        fig = Figure(figsize=(CHART_WIDTH_INCHES, CHART_HEIGHT_INCHES), dpi=CHART_DPI)
        canvas = FigureCanvasAgg(fig)
        try:
            ax = fig.add_subplot(111)
            _apply_print_style(ax)

            # Reference range band
            if ref_min is not None and ref_max is not None:
                ax.axhspan(
                    float(ref_min),
                    float(ref_max),
                    alpha=0.15,
                    facecolor=COLOR_REF_BAND,
                    edgecolor=COLOR_REF_EDGE,
                    linewidth=0.5,
                    label="Normal range",
                )

            # Plot line (adapt to data density)
            n = len(dates)
            lw = _line_width(n)
            ax.plot(dates, values, color=COLOR_LINE, linewidth=lw, zorder=4)

            # Data point dots (skip when too dense)
            if n <= 80:
                dot_size = 5 if n <= 30 else 3
                ax.plot(
                    dates,
                    values,
                    linestyle="none",
                    marker="o",
                    markersize=dot_size,
                    color=COLOR_DOT,
                    markeredgecolor=COLOR_DOT,
                    zorder=6,
                )

            # Trend line
            _add_trend_line(ax, dates, values)

            ylabel = f"{display_name} ({unit})" if unit else display_name
            ax.set_ylabel(ylabel, fontsize=9, color=COLOR_TEXT)
            lab_title = lab_data.get("chart_title", f"{display_name} Trend")
            ax.set_title(
                lab_title, fontsize=11, color=COLOR_TEXT, fontweight="bold", pad=14
            )

            _format_date_axis(ax, lab_data.get("date_from"), lab_data.get("date_to"))

            fig.tight_layout()
            return _figure_to_png(fig, canvas)
        finally:
            fig.clear()
            del fig, canvas


def _apply_print_style(ax):
    """Apply print-friendly styling to an axes."""
    ax.set_facecolor("white")
    ax.figure.set_facecolor("white")
    ax.grid(True, linestyle="--", linewidth=0.5, color=COLOR_GRID, alpha=0.7)
    ax.tick_params(axis="both", labelsize=8, colors=COLOR_TEXT)
    for spine in ax.spines.values():
        spine.set_color(COLOR_GRID)
        spine.set_linewidth(0.5)


def _format_date_axis(ax, date_from=None, date_to=None):
    """Format the x-axis with date labels. Adds a subtitle showing the requested date range."""
    from matplotlib.dates import num2date
    from matplotlib.ticker import FixedLocator, FuncFormatter

    # Add date range note under the title if the user specified dates
    if date_from or date_to:
        from_str = date_from.strftime("%b %d, %Y") if date_from else "earliest"
        to_str = date_to.strftime("%b %d, %Y") if date_to else "latest"
        ax.text(
            0.5,
            1.02,
            f"Requested range: {from_str}  \u2013  {to_str}",
            transform=ax.transAxes,
            fontsize=7,
            color="#757575",
            ha="center",
            va="bottom",
        )

    x_min, x_max = ax.get_xlim()
    if x_min >= x_max:
        return

    span = x_max - x_min
    dt_min = num2date(x_min)
    dt_max = num2date(x_max)

    # Generate calendar-aligned interior ticks based on the time span
    interior = _calendar_ticks(dt_min, dt_max, span)

    # Always anchor with data start/end; drop interior ticks too close to them
    margin = span * 0.06
    ticks = [x_min]
    for t in interior:
        t_num = date2num(t)
        if t_num - x_min > margin and x_max - t_num > margin:
            ticks.append(t_num)
    ticks.append(x_max)

    ax.xaxis.set_major_locator(FixedLocator(ticks))

    def _tick_fmt(val, _pos):
        dt = num2date(val)
        is_endpoint = abs(val - x_min) < 0.5 or abs(val - x_max) < 0.5
        if is_endpoint or span > 365:
            return dt.strftime("%b %d, %Y")
        return dt.strftime("%b %d")

    ax.xaxis.set_major_formatter(FuncFormatter(_tick_fmt))
    ax.figure.autofmt_xdate(rotation=30, ha="right")


def _calendar_ticks(dt_min, dt_max, span_days):
    """Generate calendar-aligned tick dates between dt_min and dt_max.

    Picks natural boundaries based on the span:
      < 90 days:   1st and 15th of each month
      < 365 days:  1st of each month
      < 730 days:  1st of every other month
      < 1825 days: 1st of each quarter (Jan, Apr, Jul, Oct)
      >= 1825 days: Jan 1 of each year
    """
    from dateutil.relativedelta import relativedelta

    ticks = []
    if span_days <= 30:
        # Daily ticks
        from datetime import timedelta

        cur = (dt_min + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        while cur <= dt_max:
            ticks.append(cur)
            cur = cur + timedelta(days=1)
    elif span_days < 90:
        # Semi-monthly: 1st and 15th
        cur = dt_min.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        while cur <= dt_max:
            if cur >= dt_min:
                ticks.append(cur)
            mid = cur.replace(day=15)
            if dt_min <= mid <= dt_max:
                ticks.append(mid)
            cur = cur + relativedelta(months=1)
    elif span_days < 365:
        # Monthly: 1st of each month
        cur = dt_min.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if cur < dt_min:
            cur = cur + relativedelta(months=1)
        while cur <= dt_max:
            ticks.append(cur)
            cur = cur + relativedelta(months=1)
    elif span_days < 730:
        # Bi-monthly: 1st of every other month
        cur = dt_min.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if cur < dt_min:
            cur = cur + relativedelta(months=1)
        # Snap to even month
        if cur.month % 2 != 0:
            cur = cur + relativedelta(months=1)
        while cur <= dt_max:
            ticks.append(cur)
            cur = cur + relativedelta(months=2)
    elif span_days < 1825:
        # Quarterly: Jan 1, Apr 1, Jul 1, Oct 1
        quarter_months = [1, 4, 7, 10]
        cur = dt_min.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Advance to next quarter start
        while cur.month not in quarter_months or cur < dt_min:
            cur = cur + relativedelta(months=1)
        while cur <= dt_max:
            ticks.append(cur)
            cur = cur + relativedelta(months=3)
    else:
        # Yearly: Jan 1
        year = dt_min.year + 1
        while year <= dt_max.year:
            ticks.append(
                dt_min.replace(
                    year=year, month=1, day=1, hour=0, minute=0, second=0, microsecond=0
                )
            )
            year += 1

    return ticks


def _add_trend_line(ax, dates: List, values: List[float]) -> None:
    """Add a linear regression trend line to the chart."""
    n = len(values)
    if n < 3:
        return

    # Convert dates to numeric values for regression
    numeric_dates = date2num(dates)
    x = np.array(numeric_dates)
    y = np.array(values)

    # Least-squares fit
    coeffs = np.polyfit(x, y, 1)
    trend_y = np.polyval(coeffs, x)

    ax.plot(
        dates,
        trend_y,
        color=COLOR_TREND_LINE,
        linewidth=1.0,
        linestyle="--",
        zorder=3,
        alpha=0.7,
    )


def _figure_to_png(_fig: Figure, canvas: FigureCanvasAgg) -> bytes:
    """Render figure to PNG bytes."""
    buf = io.BytesIO()
    canvas.print_png(buf)
    png_bytes = buf.getvalue()
    buf.close()
    return png_bytes


def _group_by_month(
    dates: List,
    *series: List,
) -> List[Tuple[List, ...]]:
    """
    Group dates and parallel value series into monthly buckets.

    Returns a chronologically sorted list of tuples, each containing:
      (bucket_dates, bucket_series_1, bucket_series_2, ...)
    """
    monthly: Dict[str, Tuple[list, ...]] = {}
    num_series = len(series)
    for i, d in enumerate(dates):
        dt = d if isinstance(d, datetime) else datetime.combine(d, datetime.min.time())
        key = dt.strftime("%Y-%m")
        if key not in monthly:
            monthly[key] = tuple([] for _ in range(num_series + 1))
        monthly[key][0].append(dt)
        for s_idx in range(num_series):
            monthly[key][s_idx + 1].append(series[s_idx][i])

    return [monthly[key] for key in sorted(monthly.keys())]


def _monthly_median_date(bucket_dates: List) -> datetime:
    """Pick the median date from a monthly bucket."""
    return bucket_dates[len(bucket_dates) // 2]


def _downsample_if_needed(
    dates: List,
    values: List[float],
) -> Tuple[List, List[float]]:
    """Downsample data if over the safety cap by monthly averaging."""
    if len(dates) <= MAX_RAW_DATA_POINTS:
        return dates, values

    logger.info("Downsampling %d data points to monthly averages", len(dates))
    avg_dates = []
    avg_values = []
    for bucket_dates, bucket_values in _group_by_month(dates, values):
        avg_dates.append(_monthly_median_date(bucket_dates))
        avg_values.append(sum(bucket_values) / len(bucket_values))
    return avg_dates, avg_values


def _downsample_bp_if_needed(
    dates: List,
    systolic: List[float],
    diastolic: List[float],
) -> Tuple[List, List[float], List[float]]:
    """Downsample blood pressure data if over the safety cap."""
    if len(dates) <= MAX_RAW_DATA_POINTS:
        return dates, systolic, diastolic

    logger.info("Downsampling %d BP data points to monthly averages", len(dates))
    avg_dates = []
    avg_sys = []
    avg_dia = []
    for bucket_dates, bucket_sys, bucket_dia in _group_by_month(
        dates, systolic, diastolic
    ):
        avg_dates.append(_monthly_median_date(bucket_dates))
        avg_sys.append(sum(bucket_sys) / len(bucket_sys))
        avg_dia.append(sum(bucket_dia) / len(bucket_dia))
    return avg_dates, avg_sys, avg_dia


def _downsample_lab_if_needed(
    dates: List,
    values: List[float],
    statuses: List[str],
) -> Tuple[List, List[float], List[str]]:
    """Downsample lab data if over the safety cap."""
    if len(dates) <= MAX_RAW_DATA_POINTS:
        return dates, values, statuses

    logger.info("Downsampling %d lab data points to monthly averages", len(dates))
    avg_dates = []
    avg_values = []
    last_statuses = []
    for bucket_dates, bucket_values, bucket_statuses in _group_by_month(
        dates, values, statuses
    ):
        avg_dates.append(_monthly_median_date(bucket_dates))
        avg_values.append(sum(bucket_values) / len(bucket_values))
        last_statuses.append(bucket_statuses[-1])
    return avg_dates, avg_values, last_statuses
