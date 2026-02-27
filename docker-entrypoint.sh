#!/bin/sh
# Copyright The Linux Foundation and each contributor to LFX.
# SPDX-License-Identifier: MIT

set -e

# The Node.js runtime constructs the database connection string via
# buildConnectionString(), which properly encodes special characters
# in credentials using encodeURIComponent. Do NOT assemble DATABASE_URL
# in shell — it cannot safely handle passwords with $, [, #, {, %, etc.

exec "$@"
