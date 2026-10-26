"""Offline contract checks. These do not claim a completed FFmpeg render."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("braand_renderer", Path(__file__).with_name("server.py"))
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)


class Contract(unittest.TestCase):
    def valid(self):
        return {"id": "job-test", "title": "Recette", "clips": [{"fileId": "file-test", "version": 1,
                "sha256": "a" * 64, "trimStart": 0, "duration": 5}], "width": 1080, "height": 1920,
                "captions": [{"text": "Bonjour", "start": 0, "end": 4}], "maxCredits": 10}

    def test_valid_bounded_contract(self):
        self.assertEqual(renderer.validate(self.valid())["clips"][0]["duration"], 5)

    def test_paths_and_extra_execution_fields_are_rejected(self):
        for field in ("command", "url", "javascript"):
            value = self.valid()
            value[field] = "forbidden"
            with self.assertRaises(ValueError):
                renderer.validate(value)
        value = self.valid()
        value["clips"][0]["fileId"] = "../private"
        with self.assertRaises(ValueError):
            renderer.validate(value)

    def test_duration_resolution_and_captions_are_bounded(self):
        values = []
        value = self.valid(); value["width"] = 1081; values.append(value)
        value = self.valid(); value["clips"][0]["duration"] = 121; values.append(value)
        value = self.valid(); value["captions"][0]["end"] = 6; values.append(value)
        value = self.valid(); value["clips"] = [copy.deepcopy(value["clips"][0])] * 11; values.append(value)
        for value in values:
            with self.assertRaises(ValueError):
                renderer.validate(value)

    def test_subtitle_time(self):
        self.assertEqual(renderer.timestamp(61.125), "00:01:01,125")

    def test_typed_style_and_legacy_compatibility(self):
        value = self.valid()
        value["style"] = {"fit": "cover", "motion": "zoom_in", "grade": "warm", "audioVolume": 0.5, "fadeSeconds": 0.2}
        renderer.validate(value)
        self.assertIn("crop=1080:1920", renderer.video_filter(value, value["clips"][0], True))
        self.assertIn("zoompan=", renderer.video_filter(value, value["clips"][0], True))
        self.assertNotIn("zoompan=", renderer.video_filter(value, value["clips"][0], False))
        for key, invalid in (("filter", "movie=/secret"), ("fadeSeconds", True), ("audioVolume", float("nan"))):
            edited = copy.deepcopy(value); edited["style"][key] = invalid
            with self.assertRaises(ValueError):
                renderer.validate(edited)

    def test_boolean_versions_and_credit_amounts_are_invalid(self):
        for key in ("maxCredits", "version"):
            value = self.valid()
            if key == "version": value["clips"][0][key] = True
            else: value[key] = True
            with self.assertRaises(ValueError):
                renderer.validate(value)


if __name__ == "__main__":
    unittest.main()
