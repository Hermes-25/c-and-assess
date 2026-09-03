# CSV and image import guide

This is the fastest way to publish a paper without editing code.

## Files to prepare

1. One UTF-8 CSV file.
2. One ZIP file only if at least one question has an image.
3. Keep each upload under 10 MB in the current release.

Use the example in test-fixtures/deployment-e2e.csv as a working reference.

## Supported columns

| Column | Required | Meaning |
| --- | --- | --- |
| Question | Yes | Full prompt |
| Type | Yes | MCQ, multi-select, TITA/single-line, subjective or comprehension |
| Answer | Objective questions | Correct choice text/label or typed answer |
| Choice1 through Choice6 | Choice questions | Visible options |
| Marks | Yes | Positive marks |
| Negative Marks | No | Deduction for a wrong response |
| Image | No | Exact filename inside the ZIP |
| Duration In Seconds | No | Expected time for analysis |
| Tag | No | Broad searchable label |
| Solution | Recommended | Explanation shown after release |
| Difficulty | Recommended | easy, medium or hard |
| Section | Recommended | Paper section |
| Topic | Recommended | Skill/topic for analysis |
| Subtopic | Optional | Finer analysis label |
| Source | Optional | Internal provenance note |
| Accepted Variants | TITA | Alternative typed answers |
| TITA Tolerance | Numeric TITA | Allowed numeric difference |

## Image filenames: the exact rule

The value in the CSV Image cell must match one file inside the ZIP exactly, including:

- every letter;
- upper/lower case;
- spaces, if any;
- the extension.

Example:

| CSV Image cell | File directly inside ZIP | Result |
| --- | --- | --- |
| q001.png | q001.png | Valid |
| q001.png | Q001.png | Invalid: case differs |
| q001.png | images/q001.png | Invalid: do not put folders in the CSV path |
| blank | no image | Valid |

Recommended naming:

- q001.png
- q002.jpg
- q003.jpeg

Use one unique filename per image. Keep image files directly inside the ZIP. Accepted formats are PNG, JPG and JPEG.

## Answer formats

### Single-correct MCQ

Prefer the complete choice text. The importer also accepts labels such as A or B and converts them with a warning.

### Multiple-select

Separate answers with commas. Complete choice text is preferred. Example: Choice A text, Choice C text.

### TITA / single-line

Put the canonical answer in Answer. Add alternatives in Accepted Variants; use TITA Tolerance only for numeric tolerance.

### Subjective

The current release records the response but does not automatically award a final mark. Use answer keywords only as organizer support, not as an opaque automatic grade.

## Safe publishing behaviour

- Uploading files does not immediately replace the live paper.
- The server validates every row and every referenced image.
- Errors identify the row and field to fix.
- A successful validation shows a green ready state.
- Publish only after checking the organizer preview.
- Once candidate activity exists, prefer a new paper version and an announced correction over an invisible edit.

## Common failures

| Message | Fix |
| --- | --- |
| Image not found | Match the CSV name and ZIP file exactly |
| Unsupported question type | Use a listed type or update the importer deliberately |
| Answer not in choices | Copy the exact choice text or a valid label |
| Duplicate image name | Give each image a unique filename |
| Missing marks | Enter a positive numeric value |
| Mojibake/symbol errors | Export the CSV as UTF-8 |
