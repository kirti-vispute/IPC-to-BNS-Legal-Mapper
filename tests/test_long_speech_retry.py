"""Retry launcher affects only the exact standalone diagnostic worker command."""
import sys
import unittest

from scripts.retry_long_marathi_trace import retry_launcher


class LongSpeechRetryTests(unittest.TestCase):
    def test_worker_redirect_preserves_original_arguments_and_return(self):
        calls, handle = [], object()
        def original(argv, *args, **kwargs):
            calls.append((argv, args, kwargs))
            return handle
        source = [sys.executable, "-m", "scripts.trace_long_marathi_speech", "worker"]
        self.assertIs(retry_launcher(original)(source, "arg", cwd="synthetic"), handle)
        self.assertEqual(source[2], "scripts.trace_long_marathi_speech")
        self.assertEqual(calls, [([sys.executable, "-m", "scripts.retry_long_marathi_trace", "worker"], ("arg",), {"cwd": "synthetic"})])

    def test_other_subprocesses_are_forwarded_without_mutation(self):
        calls = []
        def original(argv, **kwargs):
            calls.append((argv, kwargs))
        for command in (["powershell.exe", "-Command", "synthetic"],
                        [sys.executable, "-m", "scripts.trace_long_marathi_speech", "register"]):
            retry_launcher(original)(command, timeout=15)
            self.assertIs(calls[-1][0], command)
            self.assertEqual(calls[-1][1], {"timeout": 15})


if __name__ == "__main__":
    unittest.main()
