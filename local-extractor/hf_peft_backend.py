"""Qwen3-1.7B + PEFT LoRA adapter on Apple Silicon (MPS), loaded exactly as the training notebook trained it.

STATUS: written from the notebook (ClearWeek_Calendar_Extraction_Colab_fixed.ipynb). Run on 2026-11-09 against the
Colab artifact on Apple MPS: 60/60 test outputs matched Colab's byte for byte. See docs/extraction.md.

Faithfulness rules taken from the notebook:
  * tokenizer: AutoTokenizer from the BASE model at the recorded revision; pad = eos if missing; right padding
  * prompt: apply_chat_template([system, user], tokenize=True, add_generation_prompt=True, enable_thinking=False)
  * system prompt: the exported system-prompt.txt, byte for byte (never rebuilt here)
  * decoding: greedy, max_new_tokens=256, prompt must be <= 768 tokens (evaluation raised on longer prompts)
  * a PEFT adapter is not a standalone model: it is loaded onto the matching base model
"""
import json
import time
from pathlib import Path

from server import GenerationTimeout, InputTooLong

BASE_MODEL = "Qwen/Qwen3-1.7B"
MAX_PROMPT_TOKENS = 768
MAX_NEW_TOKENS = 256
PINNED = {"transformers": "4.57.1", "peft": "0.17.1"}  # versions in the notebook's install cell


class HfPeftBackend:
    def __init__(self, adapter_dir, manifest_path, system_prompt_path, base_revision):
        adapter = Path(adapter_dir)
        manifest = json.loads(Path(manifest_path).read_text())
        if manifest.get("model") != BASE_MODEL:
            raise SystemExit(f"manifest base model is {manifest.get('model')!r}, expected {BASE_MODEL!r}")
        if manifest.get("model_revision") != base_revision:
            raise SystemExit("--base-revision does not match manifest model_revision; refusing to pair adapter and base")
        config = json.loads((adapter / "adapter_config.json").read_text())
        if config.get("peft_type") != "LORA":
            raise SystemExit(f"adapter peft_type is {config.get('peft_type')!r}, expected LORA")
        if config.get("base_model_name_or_path") != BASE_MODEL:
            raise SystemExit("adapter_config base_model_name_or_path does not match the base model")
        self.system = Path(system_prompt_path).read_text()  # exact bytes; no strip

        import peft
        import torch
        import transformers
        for name, module in (("transformers", transformers), ("peft", peft)):
            if module.__version__ != PINNED[name]:
                print(f"WARNING: {name} {module.__version__} differs from the training pin {PINNED[name]}", flush=True)
        self.torch = torch
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.tokenizer = transformers.AutoTokenizer.from_pretrained(BASE_MODEL, revision=base_revision)
        if self.tokenizer.pad_token_id is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "right"
        base = transformers.AutoModelForCausalLM.from_pretrained(
            BASE_MODEL, revision=base_revision, torch_dtype=torch.bfloat16, attn_implementation="sdpa")
        self.model = peft.PeftModel.from_pretrained(base, str(adapter)).to(self.device).eval()
        self.label = f"{BASE_MODEL}@{base_revision[:8]} + LoRA ({self.device}, trained 4bit={manifest.get('4bit')})"

    def generate(self, text, max_seconds):
        torch = self.torch
        ids = self.tokenizer.apply_chat_template(
            [{"role": "system", "content": self.system}, {"role": "user", "content": text}],
            tokenize=True, add_generation_prompt=True, enable_thinking=False)
        if len(ids) > MAX_PROMPT_TOKENS:
            raise InputTooLong()
        inputs = torch.tensor([ids], device=self.device)
        start = time.perf_counter()
        with torch.inference_mode():
            out = self.model.generate(
                input_ids=inputs, attention_mask=torch.ones_like(inputs), max_new_tokens=MAX_NEW_TOKENS,
                do_sample=False, use_cache=True, max_time=max_seconds,
                pad_token_id=self.tokenizer.pad_token_id, eos_token_id=self.tokenizer.eos_token_id)
        generated = out[0, len(ids):]
        if time.perf_counter() - start >= max_seconds and generated[-1].item() != self.tokenizer.eos_token_id:
            raise GenerationTimeout()
        return self.tokenizer.decode(generated, skip_special_tokens=True).strip()
