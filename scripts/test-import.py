import importlib.util
import pathlib
import unittest


spec = importlib.util.spec_from_file_location(
    "importer", pathlib.Path(__file__).with_name("import-video.py")
)
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class FakeLevel:
    """Огибающая звука: громко везде внутри loud, кроме провалов quiet."""

    hop = 0.01

    def __init__(self, quiet=(), loud=((0.0, 1e9),)):
        self.quiet = quiet
        self.loud_spans = loud

    def index(self, seconds):
        return max(0, round(seconds / self.hop))

    def time(self, index):
        return round(index * self.hop, 4)

    def loud(self, index):
        seconds = self.time(index)
        return any(a <= seconds < b for a, b in self.loud_spans) and not any(
            start <= seconds < end for start, end in self.quiet
        )

    def looks_like_speech(self, _start, _end, _speech_db, _cfg):
        return True


def cuts(duration, phrases, level):
    return importer.plan_cuts(duration, phrases, set(), [], level, -20.0, dict(importer.DEFAULTS))


class Cuts(unittest.TestCase):
    def test_voiceless_consonant_inside_word_is_never_cut(self):
        # «микрофон»: глухая «ф» на 0,12 с тише порога — это ещё слово.
        level = FakeLevel(loud=[(1.0, 2.0)], quiet=[(1.4, 1.52)])
        result = cuts(3.0, [[{"start": 1.0, "end": 2.0, "word": "микрофон"}]], level)
        self.assertEqual(len(result), 1)
        self.assertTrue(result[0][0] <= 1.0 and result[0][1] >= 2.0)

    def test_word_tail_after_early_whisper_end_is_kept(self):
        # Запись «айфон»: модель закончила слово на 1,71, а «-фон» после
        # провала на «ф» звучит до 2,05. Раньше здесь резало «айфо|н».
        level = FakeLevel(loud=[(1.3, 1.58), (1.70, 2.05)])
        result = cuts(4.0, [[{"start": 1.3, "end": 1.71, "word": "iPhone"}]], level)
        self.assertGreaterEqual(result[-1][1], 2.05)

    def test_silence_before_first_sound_is_not_protected(self):
        # Модель ставит начало первого слова на 0,4 с раньше голоса.
        level = FakeLevel(loud=[(0.6, 1.2)])
        result = cuts(2.0, [[{"start": 0.2, "end": 1.2, "word": "Тогда"}]], level)
        self.assertGreaterEqual(result[0][0], 0.45)

    def test_pause_glued_into_short_word_is_cut(self):
        # «микрофон | и»: модель растянула «и» на полсекунды тишины.
        level = FakeLevel(loud=[(1.0, 2.0), (2.35, 2.45), (2.5, 3.0)])
        words = [
            {"start": 1.0, "end": 2.0, "word": "микрофон"},
            {"start": 2.0, "end": 2.45, "word": "и"},
            {"start": 2.5, "end": 3.0, "word": "проверить"},
        ]
        result = cuts(4.0, [words], level)
        self.assertEqual(len(result), 2)
        self.assertLess(result[0][1], 2.15)
        self.assertGreater(result[1][0], 2.25)

    def test_every_audible_word_stays_after_filters(self):
        level = FakeLevel(loud=[(1.0, 1.4), (3.0, 3.5)])
        words = [{"start": 1.0, "end": 1.4, "word": "раз"}, {"start": 3.0, "end": 3.5, "word": "два"}]
        keeps, restored = importer.cover_words([[0.9, 1.5]], words, level, 0.03, 5.0, dict(importer.DEFAULTS))
        self.assertEqual(restored, ["два"])
        self.assertTrue(any(a <= 3.0 and b >= 3.5 for a, b in keeps))


class Framing(unittest.TestCase):
    PHONE = (720, 1280)
    FACE = {"x": 184.5, "y": 562.5, "w": 391.5, "h": 391.5}

    def assert_covers(self, box, frame):
        W, H = frame
        self.assertLessEqual(box["left"], 0)
        self.assertLessEqual(box["top"], 0)
        self.assertGreaterEqual(box["left"] + box["width"], W - 0.5)
        self.assertGreaterEqual(box["top"] + box["height"], H - 0.5)

    def test_split_half_is_always_covered_without_side_bars(self):
        # Вертикальное видео в нижней половине 1080x960: раньше contain давал
        # пустые полосы по бокам.
        box = importer.frame_camera(self.FACE, self.PHONE, (1080, 960), 0.42, 1.8)
        self.assert_covers(box, (1080, 960))
        self.assertGreaterEqual(box["width"], 1080)

    def test_face_is_centred_with_eyes_on_the_line(self):
        box = importer.frame_camera(self.FACE, self.PHONE, (1080, 960), 0.42, 1.8)
        self.assertAlmostEqual(box["faceX"], 540, delta=2)
        self.assertAlmostEqual(box["eyesY"] / 960, 0.42, delta=0.01)

    def test_face_at_edge_zooms_to_centre_but_never_uncovers(self):
        face = {"x": 20, "y": 400, "w": 200, "h": 200}
        box = importer.frame_camera(face, self.PHONE, (1080, 960), 0.42, 1.8)
        self.assert_covers(box, (1080, 960))
        self.assertLessEqual(box["zoom"], 1.8 + 1e-6)

    def test_full_screen_is_covered_and_zoom_is_capped(self):
        box = importer.frame_camera(self.FACE, self.PHONE, (1080, 1920), 0.40, 1.15)
        self.assert_covers(box, (1080, 1920))
        self.assertLessEqual(box["zoom"], 1.15 + 1e-6)

    def test_landscape_source_fills_both_layouts(self):
        for frame in ((1080, 960), (1080, 1920)):
            self.assert_covers(importer.frame_camera(None, (1920, 1080), frame, 0.42, 1.5), frame)

    def test_rotated_phone_video_is_portrait(self):
        stream = {"width": 1920, "height": 1080, "side_data_list": [{"rotation": -90}]}
        self.assertEqual(importer.display_size(stream), (1080, 1920))

    def test_stage_sits_inside_the_split_graphic_zone(self):
        box = importer.stage_box(270, 900)
        height = importer.STAGE_HEIGHT * box["scale"]
        centre = box["top"] + importer.STAGE_HEIGHT / 2
        self.assertAlmostEqual(centre, 585, delta=1)
        self.assertGreaterEqual(centre - height / 2, 270 - 0.5)
        self.assertLessEqual(centre + height / 2, 900 + 0.5)


if __name__ == "__main__":
    unittest.main()
