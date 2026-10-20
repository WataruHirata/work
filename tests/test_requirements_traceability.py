import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS = ROOT / "みのり屋_販売管理システム_要件定義書_最終統合完全版.md"


def section(document: str, start: str, end: str) -> str:
    return document.split(start, 1)[1].split(end, 1)[0]


def ids_in_traceability(document: str) -> set[str]:
    matrix = section(document, "## 20. トレーサビリティ", "## 21. 用語集")
    found: set[str] = set()
    pattern = re.compile(r"\b(FR|NFR)-(\d{3})(?:[～~-](?:FR-|NFR-)?(\d{3}))?\b")
    for kind, first, last in pattern.findall(matrix):
        first_number = int(first)
        last_number = int(last) if last else first_number
        found.update(f"{kind}-{number:03d}" for number in range(first_number, last_number + 1))
    return found


class RequirementsTraceabilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.document = REQUIREMENTS.read_text(encoding="utf-8")

    def test_functional_requirements_are_covered_by_traceability_matrix(self) -> None:
        functional = section(self.document, "## 9. 機能要件", "## 10. 非機能要件")
        requirement_ids = set(re.findall(r"\bFR-\d{3}\b", functional))
        self.assertTrue(requirement_ids, "機能要件IDが見つかりません")
        missing = sorted(requirement_ids - ids_in_traceability(self.document))
        self.assertEqual([], missing, f"トレーサビリティ表にない機能要件: {missing}")

    def test_nonfunctional_requirements_are_covered_by_traceability_matrix(self) -> None:
        nonfunctional = section(self.document, "## 10. 非機能要件", "## 11. ")
        requirement_ids = set(re.findall(r"\bNFR-\d{3}\b", nonfunctional))
        self.assertTrue(requirement_ids, "非機能要件IDが見つかりません")
        missing = sorted(requirement_ids - ids_in_traceability(self.document))
        self.assertEqual([], missing, f"トレーサビリティ表にない非機能要件: {missing}")

    def test_acceptance_test_ids_are_present_and_unique(self) -> None:
        acceptance = section(self.document, "## 16. テスト・受入条件", "## 17. ")
        listed_ids = re.findall(r"\bAT-\d{2}\b", acceptance)
        self.assertTrue(listed_ids, "受入試験IDが見つかりません")
        self.assertEqual(len(listed_ids), len(set(listed_ids)), "受入試験IDが重複しています")
        self.assertEqual(
            {f"AT-{number:02d}" for number in range(1, 13)},
            set(listed_ids),
            "AT-01～AT-12が揃っていません",
        )


if __name__ == "__main__":
    unittest.main()
