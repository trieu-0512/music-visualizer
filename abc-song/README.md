# ABC Song Catalog

200 proposed ABC songs (`0001` through `0200`) generated under the project-local `abc-song-catalog-designer` diversity contract.

Each song contains `theme.txt`, `objects.txt`, and `mapping.proposal.json`. The root also contains `THEMES.md`, `themes.csv`, and machine/human diversity audit reports.

Catalog generation first emits proposals. Batch diversity is recorded in `DIVERSITY_AUDIT.*`; per-song mapping review is recorded in `mapping-qc.json` plus root `MAPPING_QC_SUMMARY.*`. Only proposals with no hard Mapping QC failures may be promoted to canonical `authoring/mapping.json` with `state=LOCKED`, `revision=1`, and `mappingAuthority=project-locked`.
