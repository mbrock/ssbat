#!/usr/bin/env node
db = require("nano")(process.env.COUCHDB_URL).db.use("flats")

async function go () {
  let rows = (await db.list({ include_docs: false })).rows
  for (let row of rows) {
    console.log(`deleting ${row.id}`)
    await db.destroy(row.id, row.value.rev)
  }
}

go()
