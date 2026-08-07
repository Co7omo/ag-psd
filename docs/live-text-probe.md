# Photoshop live text compatibility probe

## Problem

A PSD written from scratch by ag-psd 31.0.2 can be reopened by ag-psd with a `text` layer, but Adobe Photoshop Desktop 26.11.6 asks to update the layer and then requires rasterization before editing it. That behavior is not acceptable for a live-text PSD exporter.

## Hypothesis

The current writer emits the layer-level `TySh` descriptor and EngineData but does not construct document-level `Txt2` global text engine data for a PSD created from scratch. ag-psd preserves `Psd.engineData` when one already exists.

Upstream already contains a decoded/reference `EngineData2.bin` fixture. This probe uses that block only as an experiment; it is not proposed as a production implementation.

## Controlled experiment

`scripts/generate-live-text-probe.js` writes two PSDs with identical canvas, layers, fallback pixels, text content and Type Layer metadata:

- `live-text-control-no-txt2.psd`: normal from-scratch writer behavior;
- `live-text-probe-with-reference-txt2.psd`: same document with `Psd.engineData` populated from the upstream reference `test/EngineData2.bin`.

The controlled variable is therefore the presence of global `Txt2` data.

## Photoshop acceptance

Open both files in Adobe Photoshop Desktop 26.11.6 or newer.

For each file record:

1. whether an update/redraw warning appears;
2. whether the Type tool can place a caret in `EDIT ME`;
3. whether Photoshop requests rasterization;
4. whether the text can be changed and remain a Type Layer;
5. whether save, close and reopen preserves editability.

The hypothesis is supported only if the `Txt2` probe changes the behavior relative to the control. The reference binary must not become production data even if the probe succeeds; a generated, document-specific `Txt2` encoder would be the next implementation step.
