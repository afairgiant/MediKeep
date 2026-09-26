import pytest

from app.core.http.content_disposition import content_disposition_header


@pytest.mark.parametrize(
    "filename, expected",
    [
        ("report.pdf", 'inline; filename="report.pdf"'),
        (
            "ВитаминD.pdf",
            "inline; filename*=utf-8''%D0%92%D0%B8%D1%82%D0%B0%D0%BC%D0%B8%D0%BDD.pdf",
        ),
        (
            "检验报告.pdf",
            "inline; filename*=utf-8''%E6%A3%80%E9%AA%8C%E6%8A%A5%E5%91%8A.pdf",
        ),
        ("café.pdf", "inline; filename*=utf-8''caf%C3%A9.pdf"),
        ("my report.pdf", "inline; filename*=utf-8''my%20report.pdf"),
        ('a"b.pdf', "inline; filename*=utf-8''a%22b.pdf"),
        ("a;b.pdf", "inline; filename*=utf-8''a%3Bb.pdf"),
        ("a/b.pdf", "inline; filename*=utf-8''a%2Fb.pdf"),
        ("a\r\nb.pdf", "inline; filename*=utf-8''a%0D%0Ab.pdf"),
    ],
)
def test_content_disposition_header(filename, expected):
    assert content_disposition_header("inline", filename) == expected
