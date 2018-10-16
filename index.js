#!/usr/bin/env node
let cheerio = require("cheerio")
let fetch = require("node-fetch")
let toText = x => require("html-to-text").fromString(x, {
  tables: true,
  wordwrap: false,
})

let flat1 = "https://www.ss.com/msg/lv/real-estate/flats/riga/bolderaya/ddpdg.html"

fetch(flat1).then(x => x.text()).then(x => {
  let $ = cheerio.load(x)
  let xs = []
  $(".ads_opt_name").each((i, el) => {
    xs.push([$(el).text(), $(el).next().text().replace(" [Karte]", "")])
  })
  console.log(xs)
})
