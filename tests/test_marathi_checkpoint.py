"""Synthetic consistency contracts, not recognition accuracy tests."""
import tempfile
import unittest
from pathlib import Path
from scripts.audit_marathi_checkpoint import merge_vocabulary, vocabulary_mismatches, cache_identity, save_new


class CheckpointAuditTests(unittest.TestCase):
    def test_shared_special_token_is_not_a_conflict(self):
        self.assertEqual(merge_vocabulary({"a": 0, "end": 1}, {"end": 1, "mr": 2}),
                         {"a": 0, "end": 1, "mr": 2})

    def test_invalid_conflicting_duplicate_and_missing_ids_rejected(self):
        for base, added in [({"a": 0}, {"a": 1}), ({"a": 0}, {"b": 0}),
                            ({"a": 0}, {"b": 2}), ({"a": True}, {}), ({"a": -1}, {})]:
            with self.assertRaises(ValueError):
                merge_vocabulary(base, added)

    def test_reordered_or_missing_converted_tokens_detected(self):
        self.assertEqual(vocabulary_mismatches({"a": 0, "b": 1}, ["a", "b"]), [])
        self.assertEqual(vocabulary_mismatches({"a": 0, "b": 1}, ["b", "a"]), ["a", "b"])
        self.assertEqual(vocabulary_mismatches({"a": 0, "b": 1}, ["a"]), ["b"])

    def test_cache_metadata_and_exclusive_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "input"
            metadata = Path(directory) / "metadata"
            path.write_bytes(b"hello\n")
            metadata.write_text("revision\nce013625030ba8dba906f756967f9e9ca394464a\n1.0\n")
            self.assertTrue(cache_identity(path, metadata, "revision")["gitBlobMatches"])
            self.assertFalse(cache_identity(path, metadata, "other")["revisionMatches"])
            path.write_bytes(b"changed")
            self.assertFalse(cache_identity(path, metadata, "revision")["gitBlobMatches"])
            metadata.write_text("incomplete")
            with self.assertRaises(ValueError):
                cache_identity(path, metadata, "revision")
            output = Path(directory) / "result.json"
            save_new(output, {"synthetic": True})
            with self.assertRaises(FileExistsError):
                save_new(output, {"synthetic": False})


if __name__ == "__main__":
    unittest.main()
