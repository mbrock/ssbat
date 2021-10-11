#!/usr/bin/env bash
set -ex
validation=$(./validation-document)
curl -X PUT "$COUCHDB_URL"/flats/_design/validation -d "$validation"
curl -X PUT "$COUCHDB_URL"/flat-accounts/_design/validation -d "$validation"
