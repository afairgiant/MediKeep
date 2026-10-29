import asyncio
import csv
import io

import pytest

from app.api.v1.admin.csv_utils import neutralize_formula, stream_csv


@pytest.mark.parametrize(
    "value", ["=1+1", "+cmd", "-2+3+cmd|' /C calc'!A0", "@SUM(A1)", "\tx", "\rx"]
)
def test_formula_starts_are_quoted(value):
    assert neutralize_formula(value) == f"'{value}"


@pytest.mark.parametrize(
    "value",
    ["", "Mozilla/5.0 (X11; Linux) Firefox/131.0", "a=b", "-5", "+1.5", -5, None],
)
def test_other_values_are_unchanged(value):
    assert neutralize_formula(value) == value


def test_stream_csv_quotes_every_formula_cell():
    response = stream_csv(
        ["Name", "Value"], [{"Name": '=HYPERLINK("x")', "Value": -5}], "x.csv"
    )

    async def body():
        return "".join([chunk async for chunk in response.body_iterator])

    rows = list(csv.reader(io.StringIO(asyncio.run(body()))))

    assert rows[1] == ['\'=HYPERLINK("x")', "-5"]
