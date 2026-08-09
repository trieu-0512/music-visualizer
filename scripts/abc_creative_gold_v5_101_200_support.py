from __future__ import annotations

"""Helpers for V5 deep-polish modules 0101-0200."""

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_ENTRY = (
    "{letter} — {object}! {fact}",
    "{letter} ... {letter} ... {object}! {fact}",
    "{letter}? {object}! {fact}",
    "{letter} is {object}. {fact}",
)
_RECALL = (
    "Recall {letter} ... {object}! {action}",
    "Find {letter} ... {object}! {action}",
    "Which one starts {letter}? ... {object}! {action}",
    "Check {letter} ... {object}! {action}",
)


def round1(objects: tuple[str, ...], facts: dict[str, str]) -> tuple[tuple[str, str], ...]:
    if len(objects) != 26:
        raise ValueError(f"expected 26 objects, got {len(objects)}")
    rows = []
    for i, (letter, obj) in enumerate(zip(LETTERS, objects)):
        fact = facts.get(obj)
        if not fact:
            raise KeyError(f"missing curated fact for {obj!r}")
        line = _ENTRY[i % len(_ENTRY)].format(letter=letter, object=obj, fact=fact)
        # A bar marks an audible internal phrase break; the fact remains the semantic payload.
        if " | " not in line:
            if "! " in line:
                line = line.replace("! ", "! | ", 1)
            else:
                line += " |"
        rows.append((letter, line))
    return tuple(rows)


def round2(
    objects: tuple[str, ...],
    actions: dict[str, str] | None = None,
    cue_prefix: str = "Recall",
) -> tuple[tuple[str, str], ...]:
    if len(objects) != 26:
        raise ValueError(f"expected 26 objects, got {len(objects)}")
    actions = actions or {}
    rows = []
    for i, (letter, obj) in enumerate(zip(LETTERS, objects)):
        defaults = ("Point once; air-trace its outline.", "Point once; name its main job.", "Point once; show its shape with empty hands.", "Point once; recall one Round-1 clue.")
        action = actions.get(obj, defaults[i % len(defaults)])
        template = _RECALL[i % len(_RECALL)]
        line = template.format(letter=letter, object=obj, action=action)
        if i % 4 == 0:
            line = line.replace("Recall", cue_prefix, 1)
        rows.append((letter, line))
    return tuple(rows)


def craft_from(facts: dict[str, str], actions: dict[str, str] | None = None) -> dict[str, tuple[str, str]]:
    actions = actions or {}
    defaults = ("Point once; air-trace its outline.", "Point once; name its main job.", "Point once; show its shape with empty hands.", "Point once; recall one Round-1 clue.")
    return {obj: (fact, actions.get(obj, defaults[i % len(defaults)])) for i, (obj, fact) in enumerate(facts.items())}




OBJECT_CRAFT_REGISTRY: dict[tuple[str, str], tuple[str, str]] = {}

def register_craft(objects_by_song: dict[str, tuple[str, ...]], facts: dict[str, str], actions: dict[str, str] | None = None) -> None:
    actions = actions or {}
    defaults = ("Point once; air-trace its outline.", "Point once; name its main job.", "Point once; show its shape with empty hands.", "Point once; recall one Round-1 clue.")
    for sid, objects in objects_by_song.items():
        for i, obj in enumerate(objects):
            fact = facts.get(obj)
            if not fact:
                raise KeyError(f"{sid}: missing craft fact for {obj!r}")
            OBJECT_CRAFT_REGISTRY[(sid, obj)] = (fact, actions.get(obj, defaults[i % len(defaults)]))


def make_spec(
    *,
    objects: tuple[str, ...],
    facts: dict[str, str],
    actions: dict[str, str] | None,
    authorial_intent: str,
    lyric_identity: str,
    image_motifs: tuple[str, ...],
    semantic_arc: tuple[str, ...],
    forbidden_generic_language: tuple[str, ...],
    rhyme_engine: str,
    chorus_rhyme_engine: str,
    point_of_view: str,
    chorus_function: str,
    groove_meter: str,
    round1_grammar: str,
    round2_grammar: str,
    intro_lines: tuple[str, ...],
    hook_lines: tuple[str, ...],
    outro_lines: tuple[str, ...],
    style_blueprint: str,
    signature_color: str,
    cue_prefix: str = "Recall",
    interlude_lines: tuple[str, ...] = (),
) -> dict[str, object]:
    performance_tail = (
        " Opening stays sparse. Round 1 teaches with a narrow stepwise melody; "
        "Round 2 retrieval leaves a response gap. Arrangement builds lightly into the chorus, then thins. "
        "Duck backing vocals and percussion around every target-word. End with a clean cadence."
    )
    return {
        "opening_type": "authored-scene",
        "target_entry_families": ("direct-name", "delayed-name", "question-answer", "semantic-definition"),
        "line_length_contour": ("short", "medium", "long", "medium"),
        "rhyme_engine": rhyme_engine,
        "chorus_rhyme_engine": chorus_rhyme_engine,
        "point_of_view": point_of_view,
        "chorus_function": chorus_function,
        "groove_meter": groove_meter,
        "round1_grammar": round1_grammar,
        "round2_grammar": round2_grammar,
        "section_contrast": "teaching-to-retrieval",
        "signature_color": signature_color,
        "authorial_intent": authorial_intent,
        "lyric_identity": lyric_identity,
        "image_motifs": image_motifs,
        "semantic_arc": semantic_arc,
        "forbidden_generic_language": forbidden_generic_language,
        "intro_lines": intro_lines,
        "hook_lines": hook_lines,
        "outro_lines": outro_lines,
        "interlude_lines": interlude_lines,
        "round1_patterns": ("{letter} — {object}! {semantic}",),
        "round2_patterns": ("{letter} ... {object}! {action}",),
        "round1_overrides": round1(objects, facts),
        "round2_overrides": round2(objects, actions, cue_prefix),
        "style_blueprint": style_blueprint + performance_tail,
        "object_craft_required": False,
    }
