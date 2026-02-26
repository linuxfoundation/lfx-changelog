#!/usr/bin/env bash

# Copyright The Linux Foundation and each contributor to LFX.
# SPDX-License-Identifier: MIT

# A simple script that scans source files checking for the license header.
# Exits with a 0 if all source files have license headers
# Exits with a 1 if one or more source files are missing a license header

exclude_pattern='node_modules|.vendor|.idea|gen|.venv|.ruff_cache|.pytest_cache|.angular|dist|playwright-report|test-results'

files=()
echo "Scanning source code..."
echo 'Searching html|css|ts|js files...'
files+=($(find . -type f \( -name '*.html' -o -name '*.css' -o -name '*.ts' -o -name '*.js' -o -name '*.scss' \) -print | egrep -v ${exclude_pattern}))
echo "Searching shell files..."
files+=($(find . -type f \( -name '*.sh' -o -name '*.bash' -o -name '*.ksh' -o -name '*.csh' -o -name '*.tcsh' -o -name '*.fsh' \) -print | egrep -v ${exclude_pattern}))
echo "Searching yaml|yml files..."
files+=($(find . -type f \( -name '*.yaml' -o -name '*.yml' \) -print | egrep -v ${exclude_pattern}))
files+=($(find . -type f -name '.gitignore' -print | egrep -v ${exclude_pattern}))
echo "Searching TOML files..."
files+=($(find . -type f -name '*.toml' -print | egrep -v ${exclude_pattern}))
echo "Searching SQL files..."
files+=($(find . -type f -name '*.sql' -print | egrep -v ${exclude_pattern}))

# This is the copyright line to look for - adjust as necessary
copyright_line="Copyright The Linux Foundation"

# Flag to indicate if we were successful or not
missing_license_header=0

# For each file...
echo "Checking ${#files[@]} source code files for the license header..."
for file in "${files[@]}"; do
  # Header is typically one of the first few lines in the file...
  head -4 "${file}" | grep -q "${copyright_line}"
  exit_code=$?
  if [[ ${exit_code} -ne 0 ]]; then
    echo "${file} is missing the license header"
    missing_license_header=1
  fi
done

# Summary
if [[ ${missing_license_header} -eq 1 ]]; then
  echo "One or more source files is missing the license header."
else
  echo "License check passed."
fi

exit ${missing_license_header}
