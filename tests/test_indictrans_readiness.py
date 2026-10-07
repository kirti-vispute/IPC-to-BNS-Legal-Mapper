"""Synthetic file-integrity tests, not translation or legal labels."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from scripts.check_indictrans2_files import check_files, write_evidence


class ReadinessTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.folder = Path(self.directory.name)
        self.contents = {"config.json": b'{"synthetic":true}', "model.safetensors": b"not-real-weights",
                         "modeling_indictrans.py": b'raise RuntimeError("Must never execute")\n'}
        required = {}
        for name, data in self.contents.items():
            (self.folder / name).write_bytes(data)
            key = "sha256" if name == "model.safetensors" else "gitBlob"
            digest = hashlib.sha256(data).hexdigest() if key == "sha256" else hashlib.sha1(
                f"blob {len(data)}\0".encode() + data).hexdigest()
            required[name] = {"size": len(data), key: digest}
        self.metadata = {"modelId": "SYNTHETIC-TEST-ONLY", "revision": "not-a-real-model", "requiredFiles": required}

    def test_absent_folder_never_claims_ready(self):
        result = check_files(None, self.metadata)
        self.assertFalse(result["officialFilesVerified"])
        self.assertFalse(result["readyForInference"])
        self.assertTrue(all(row["status"] == "MISSING" for row in result["files"]))

    def test_exact_files_verified_without_executing_custom_code(self):
        result = check_files(self.folder, self.metadata)
        self.assertTrue(result["officialFilesVerified"])
        self.assertFalse(result["readyForInference"])
        self.assertEqual(result["status"], "FILES_VERIFIED_REVIEW_PENDING")

    def test_missing_weight_and_truncated_files_rejected(self):
        (self.folder / "model.safetensors").unlink()
        (self.folder / "config.json").write_bytes(b"short")
        result = check_files(self.folder, self.metadata)
        self.assertFalse(result["officialFilesVerified"])
        statuses = {row["file"]: row["status"] for row in result["files"]}
        self.assertEqual(statuses["model.safetensors"], "MISSING")
        self.assertEqual(statuses["config.json"], "SIZE_MISMATCH")

    def test_same_size_tampering_rejected_for_lfs_and_git_files(self):
        for name in ["model.safetensors", "modeling_indictrans.py"]:
            data = self.contents[name]
            (self.folder / name).write_bytes(bytes([data[0] ^ 1]) + data[1:])
        result = check_files(self.folder, self.metadata)
        self.assertFalse(result["officialFilesVerified"])
        self.assertEqual(sum(row["status"] == "HASH_MISMATCH" for row in result["files"]), 2)

    def test_extra_python_file_is_reported_not_imported(self):
        (self.folder / "surprise.py").write_text('raise RuntimeError("Must never import")\n')
        result = check_files(self.folder, self.metadata)
        self.assertEqual(result["extraPythonFiles"], ["surprise.py"])
        self.assertFalse(result["readyForInference"])

    def test_manifest_path_traversal_rejected(self):
        self.metadata["requiredFiles"]["../config.json"] = {"size": 0, "gitBlob": "invalid"}
        with self.assertRaises(ValueError):
            check_files(self.folder, self.metadata)

    def test_evidence_never_overwritten(self):
        path = self.folder / "report.json"
        write_evidence(path, {"type": "SYNTHETIC"})
        with self.assertRaises(FileExistsError):
            write_evidence(path, {"type": "REPLACEMENT"})
        self.assertEqual(json.loads(path.read_text()), {"type": "SYNTHETIC"})


if __name__ == "__main__":
    unittest.main()
