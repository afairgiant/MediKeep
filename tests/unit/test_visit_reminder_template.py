"""Visit reminder notification text."""

from app.services.notification_templates import get_template

BASE = {"reason": "Dental cleaning", "visit_date": "2026-12-10"}


def test_timed_visit_is_minimal_by_default():
    title, body = get_template("visit_reminder_due", {**BASE, "visit_time": "10:30"})
    assert title == "Upcoming Visit: Dental cleaning"
    assert body == "Your visit is on 2026-12-10 at 10:30."


def test_all_day_visit():
    _, body = get_template("visit_reminder_due", {**BASE, "visit_time": ""})
    assert body == "Your visit is on 2026-12-10 (all day)."


def test_details_listed_when_present():
    _, body = get_template(
        "visit_reminder_due",
        {
            **BASE,
            "visit_time": "10:30",
            "practitioner_name": "Dr. Lee",
            "location": "Main St",
        },
    )
    assert body.splitlines()[1:] == ["With: Dr. Lee", "Location: Main St"]


def test_test_reminder_wording():
    title, body = get_template("visit_reminder_due", {**BASE, "is_test": True})
    assert title == "Test Reminder: Dental cleaning"
    assert "notification channel is working" in body
