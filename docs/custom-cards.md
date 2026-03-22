# Custom Cards

This project now supports a lightweight custom card file:

- `src/data/customCards.json`

## Why this exists

Instead of editing the huge `flameCardsBest.json` every time, you can add handcrafted cards here.
This is better for designer-driven iteration and special cards with custom effect text.

## Current example

- `f_70001` / 建御雷神

## Authoring rules

Each entry should look like the imported card format:

- `id`
- `name`
- `type`
- `quality`
- `cost`
- `phyle`
- `description`
- `ability1`..`ability5`
- `abilities`
- `image`
- `unit`
- `effectRuleMap`

## Suggested workflow

1. Duplicate an existing card block in `src/data/customCards.json`
2. Change name / cost / stats / abilities
3. Reload the game
4. If needed, later add dedicated art under `/cards/custom/...`
