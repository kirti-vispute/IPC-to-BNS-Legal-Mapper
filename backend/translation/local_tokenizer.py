"""Use the installed NLLB fast-tokenizer data without importing a training runtime."""
from tokenizers import Tokenizer


class LocalTokenizer:
    def __init__(self, model):
        self.engine = Tokenizer.from_file(str(model / "tokenizer.json"))
        self.end = self.engine.token_to_id("</s>")
        self.unknown = self.engine.token_to_id("<unk>")
        if self.end is None or self.unknown is None:
            raise ValueError("Invalid NLLB tokenizer")

    def encode(self, text, source):
        language = self.engine.token_to_id(source)
        if language is None:
            raise ValueError("Unsupported tokenizer language")
        # This is the non-legacy NLLB template verified against the existing fast tokenizer.
        ids = [language, *self.engine.encode(text, add_special_tokens=False).ids, self.end]
        return [self.engine.id_to_token(index) for index in ids]

    def decode(self, tokens):
        ids = [self.engine.token_to_id(token) for token in tokens]
        return self.engine.decode([self.unknown if index is None else index for index in ids], skip_special_tokens=True)
