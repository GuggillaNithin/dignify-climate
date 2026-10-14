"""Time series normalization, continuity checking, and missing data auditing."""
from dataclasses import dataclass
from datetime import date, datetime, timedelta
import math
from typing import Any, Dict, List, Optional, Set, Tuple


@dataclass
class DailyObservationPoint:
    """A strictly ordered single calendar day atmospheric point."""
    date_str: str
    calendar_date: date
    year: int
    day_of_year: int  # 1 to 366
    value: Optional[float]
    is_valid: bool


class TimeseriesValidator:
    """Enforces daily chronological completeness, gap detection, and physical boundaries."""

    @staticmethod
    def parse_iso_date(date_str: str) -> date:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except Exception:
            raise ValueError(f"Invalid ISO date: '{date_str}'. Expected YYYY-MM-DD.")

    @classmethod
    def sanitize_temperature(cls, val: Any) -> Optional[float]:
        """Validate temperature against physical bounds [-80.0°C, 65.0°C]."""
        if val is None:
            return None
        try:
            f = float(val)
            if math.isnan(f) or math.isinf(f):
                return None
            if -80.0 <= f <= 65.0:
                return round(f, 2)
            # Implausible physical outlier
            return None
        except (ValueError, TypeError):
            return None

    @classmethod
    def sanitize_precipitation(cls, val: Any) -> Optional[float]:
        """Validate precipitation against physical bounds [0.0 mm, 2000.0 mm]."""
        if val is None:
            return None
        try:
            f = float(val)
            if math.isnan(f) or math.isinf(f):
                return None
            if 0.0 <= f <= 2000.0:
                return round(f, 2)
            return None
        except (ValueError, TypeError):
            return None

    @classmethod
    def align_continuous_daily_series(
        cls,
        raw_data: List[Tuple[str, Optional[float]]],
        variable_type: str = "temperature",
    ) -> List[DailyObservationPoint]:
        """Align input into a strictly continuous daily timeline.
        
        Calendar gaps between start and end date are filled with explicit None records.
        Duplicates raise ValueError. Chronological order is guaranteed.
        """
        if not raw_data:
            return []

        # 1. Parse and detect duplicate dates
        seen_dates: Set[date] = set()
        parsed_records: Dict[date, Optional[float]] = {}

        for d_str, val in raw_data:
            d = cls.parse_iso_date(d_str)
            if d in seen_dates:
                raise ValueError(f"Duplicate date detected in series: '{d_str}'. Timeline must be unique.")
            seen_dates.add(d)

            if variable_type == "temperature":
                clean_val = cls.sanitize_temperature(val)
            else:
                clean_val = cls.sanitize_precipitation(val)
            parsed_records[d] = clean_val

        min_date = min(seen_dates)
        max_date = max(seen_dates)

        # 2. Iterate continuous calendar days
        continuous_series: List[DailyObservationPoint] = []
        cur = min_date
        one_day = timedelta(days=1)

        while cur <= max_date:
            cur_iso = cur.isoformat()
            if cur in parsed_records:
                val = parsed_records[cur]
                continuous_series.append(
                    DailyObservationPoint(
                        date_str=cur_iso,
                        calendar_date=cur,
                        year=cur.year,
                        day_of_year=cur.timetuple().tm_yday,
                        value=val,
                        is_valid=(val is not None),
                    )
                )
            else:
                # Missing calendar gap in input - explicitly mark as invalid
                continuous_series.append(
                    DailyObservationPoint(
                        date_str=cur_iso,
                        calendar_date=cur,
                        year=cur.year,
                        day_of_year=cur.timetuple().tm_yday,
                        value=None,
                        is_valid=False,
                    )
                )
            cur += one_day

        return continuous_series

    @staticmethod
    def get_days_in_year(year: int) -> int:
        """Return 366 for leap year, 365 otherwise."""
        if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0):
            return 366
        return 365
