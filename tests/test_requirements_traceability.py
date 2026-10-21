import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS = ROOT / "みのり屋_販売管理システム_統合要件書_v3.md"


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

    def test_v3_audit_covers_all_defined_requirement_ids(self) -> None:
        pattern = r"^\|\s*((?:FR|NFR)-\d{3}|F-10-\d{3}|NF-\d{2}|SCR-\d{2}|AT-\d{2}|IF-\d{2}|B-\d{2})(?=\s|\|)"
        requirements = set(re.findall(pattern, self.document, re.MULTILINE))
        audit = (ROOT / "docs/requirements-v3-audit.md").read_text(encoding="utf-8")
        audited = set(re.findall(pattern, audit, re.MULTILINE))
        self.assertEqual(226, len(requirements))
        self.assertEqual(requirements, audited, "v3と照合台帳のID集合が一致しません")

    def test_supabase_migration_versions_are_unique(self) -> None:
        versions = [path.name.split("_", 1)[0] for path in (ROOT / "supabase/migrations").glob("*.sql")]
        self.assertEqual(len(versions), len(set(versions)), "Supabase CLIで適用できない同一版のマイグレーションがあります")


if __name__ == "__main__":
    unittest.main()
