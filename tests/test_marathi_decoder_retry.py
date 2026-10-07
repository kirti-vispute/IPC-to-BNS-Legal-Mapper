import unittest

from scripts.probe_marathi_decoder_retry import buffer_available


class DecoderBufferTest(unittest.TestCase):
    def test_null_and_missing_pointers_are_unavailable(self):
        for interface in ({"data": (0, False)}, {}, None, {"data": None}):
            self.assertFalse(buffer_available(interface))

    def test_readable_pointer_is_available(self):
        self.assertTrue(buffer_available({"data": (123, False)}))


if __name__ == "__main__":
    unittest.main()
