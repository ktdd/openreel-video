# OpenReel filter recipes → LUT generator

Build LUTs from YAML recipes for the filter-presets subsystem.

## Setup
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt

## Generate everything
    python generate.py

Outputs land in `out/cube/*.cube` and `out/manifest.json`.

## Tests
    pytest tests/ -v

## Deploy
    ./deploy.sh   # uploads out/ to R2 via wrangler

This is an optional standalone asset-generation/deployment utility, not the browser app's build or deployment pipeline. It requires Python and a separately installed Wrangler CLI; neither is supplied by the app. The historical design archive has been removed.
