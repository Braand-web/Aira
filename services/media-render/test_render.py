"""Real synthetic render. Requires ffmpeg/ffprobe; never calls an external service."""
import hashlib
import importlib.util
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest

module = importlib.util.spec_from_file_location("renderer", Path(__file__).with_name("server.py"))
renderer = importlib.util.module_from_spec(module); module.loader.exec_module(renderer)


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg runtime unavailable")
class Render(unittest.TestCase):
    def test_image_motion_captions_and_actual_quality_evidence(self):
        with tempfile.TemporaryDirectory(prefix="braand-render-") as temporary:
            renderer.ROOT = Path(temporary)
            folder = renderer.job_dir("synthetic-test"); folder.mkdir()
            source = folder / "input-picture"
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-frames:v", "1", "-f", "image2", "-vcodec", "png", str(source)], check=True, capture_output=True, timeout=30)
            spec = {"id":"synthetic-test", "title":"Synthetic motion test", "clips":[{"fileId":"picture", "version":1,
                    "sha256":hashlib.sha256(source.read_bytes()).hexdigest(), "trimStart":0, "duration":1.2}],
                    "width":320, "height":568, "captions":[{"text":"Bonjour Braand", "start":0.1, "end":1.0}], "maxCredits":10,
                    "style":{"fit":"cover", "motion":"zoom_in", "grade":"warm", "audioVolume":0.5, "fadeSeconds":0.1}}
            renderer.validate(spec)
            renderer.save_job(spec["id"], {"id":spec["id"], "status":"running", "spec":spec, "createdAt":0})
            renderer.render(spec["id"])
            job = renderer.read_job(spec["id"])
            self.assertEqual(job["status"], "completed")
            self.assertEqual(job["outputSha256"], hashlib.sha256((folder / "output.mp4").read_bytes()).hexdigest())
            report = job["qualityReport"]
            self.assertEqual((report["width"],report["height"]), (320,568))
            self.assertAlmostEqual(report["duration"],1.2,delta=0.1)
            self.assertEqual(report["decode"],"passed"); self.assertEqual(report["framesSampled"],6)
            self.assertEqual(report["semanticReview"],"not_performed"); self.assertEqual(report["audioListening"],"not_performed")
            sheet = (folder / "contact-sheet.png").read_bytes()
            self.assertEqual(struct.unpack(">II",sheet[16:24]),(960,360))
            self.assertEqual(job["contactSheetSha256"],hashlib.sha256(sheet).hexdigest())


if __name__ == "__main__":
    unittest.main()
