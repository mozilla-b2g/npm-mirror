#!/usr/bin/env bash
time DEBUG=* bin/npm-mirror \
  --master http://registry.npmjs.org \
  --manifest package.json \
  --hostname http://localhost:8080 \
  --root packages
