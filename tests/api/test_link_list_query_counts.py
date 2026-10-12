"""
The lists of conditions linked to a medication and to a lab result take the same
number of queries however many links there are (#1128). They used to fetch each
condition on its own, one query per link.
"""

from contextlib import contextmanager

import pytest
from sqlalchemy import event


@contextmanager
def count_statements(session):
    engine = session.get_bind()
    statements = []

    def record(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", record)


@pytest.fixture
def patient_id(user_with_patient):
    return user_with_patient["patient"].id


@pytest.fixture
def medication(client, authenticated_headers, patient_id):
    response = client.post(
        "/api/v1/medications/",
        json={
            "medication_name": "Lisinopril",
            "status": "active",
            "patient_id": patient_id,
        },
        headers=authenticated_headers,
    )
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def lab_result(client, authenticated_headers, patient_id):
    response = client.post(
        "/api/v1/lab-results/",
        json={
            "test_name": "Liver Panel",
            "test_category": "chemistry",
            "status": "completed",
            "patient_id": patient_id,
        },
        headers=authenticated_headers,
    )
    assert response.status_code == 201
    return response.json()


def _new_condition(client, headers, patient_id, name):
    response = client.post(
        "/api/v1/conditions/",
        json={"diagnosis": name, "status": "active", "patient_id": patient_id},
        headers=headers,
    )
    assert response.status_code == 200
    return response.json()


def _statements_for(client, session, url, headers):
    with count_statements(session) as statements:
        response = client.get(url, headers=headers)
    assert response.status_code == 200
    return len(statements), response.json()


def test_a_medications_conditions_take_one_query_however_many(
    client, db_session, authenticated_headers, patient_id, medication
):
    url = f"/api/v1/conditions/medication/{medication['id']}/conditions"
    first = _new_condition(client, authenticated_headers, patient_id, "Hypertension")
    client.post(
        f"/api/v1/conditions/{first['id']}/medications",
        json={"medication_id": medication["id"]},
        headers=authenticated_headers,
    )
    one_link, rows = _statements_for(client, db_session, url, authenticated_headers)
    assert len(rows) == 1

    for index in range(4):
        condition = _new_condition(
            client, authenticated_headers, patient_id, f"Condition {index}"
        )
        client.post(
            f"/api/v1/conditions/{condition['id']}/medications",
            json={"medication_id": medication["id"]},
            headers=authenticated_headers,
        )
    five_links, rows = _statements_for(client, db_session, url, authenticated_headers)

    assert len(rows) == 5
    assert {row["condition"]["diagnosis"] for row in rows} >= {
        "Hypertension",
        "Condition 3",
    }
    assert five_links == one_link


def test_a_lab_results_conditions_take_one_query_however_many(
    client, db_session, authenticated_headers, patient_id, lab_result
):
    url = f"/api/v1/lab-results/{lab_result['id']}/conditions"

    def link(name):
        condition = _new_condition(client, authenticated_headers, patient_id, name)
        response = client.post(
            url,
            json={"lab_result_id": lab_result["id"], "condition_id": condition["id"]},
            headers=authenticated_headers,
        )
        assert response.status_code == 200

    link("Hypertension")
    one_link, rows = _statements_for(client, db_session, url, authenticated_headers)
    assert len(rows) == 1

    for index in range(4):
        link(f"Condition {index}")
    five_links, rows = _statements_for(client, db_session, url, authenticated_headers)

    assert len(rows) == 5
    assert all(row["condition"]["diagnosis"] for row in rows)
    assert five_links == one_link
