#!/usr/bin/env node
let uuid = require("uuid/v1")
let proc = require("child_process")
let $ = require("cheerio")
let fetch = require("node-fetch")
let nano = require("nano")(process.env.COUCHDB_URL)
let db = nano.db.use("flats")
let get = url => fetch(url).then(x => x.text())

let $map = (xs, f) => {
  let r = []; xs.map((_, el) => r.push(f($(el)))); return r }

let hrefs = xs => $map(xs, el => el.attr("href"))

let object = kvs => {
  let r = {}; kvs.forEach(([k, v]) => r[k] = v); return r }

let mapLinkCoords = url => {
  if (!url) return null
  let x = url.match(/c=(.*?), (.*?),/)
  if (x) {
    return x.slice(1, 3)
  } else {
    console.warn("bad map url", url)
    return null
  }
}

async function main() {
  let rows = (await db.list({ include_docs: true })).rows
  
  let oldLinks = object(rows.map(x => [x.doc.link, true]))
  console.log(oldLinks)
  
  let index = await get(
    "https://www.ss.com/lv/real-estate/flats/riga/today/hand_over/"
  )

  let links = hrefs($(".msga2 a", index))

  for (let link of links) {
    if (oldLinks[link]) {
      console.log(`skipping ${link}`)
      continue
    }
    
    let page = await get(`https://ss.com/${link}`)
    let flat = {
      link,
      table: object(
        $map(
          $(".ads_opt_name", page),
          el => [
            el.text().replace(":", ""),
            el.next().text().replace(" [Karte]", "")
          ]
        )
      ),
      imgurls: hrefs($(".pic_dv_thumbnail a", page)),
      price: $(".ads_price", page).text(),
      coords: mapLinkCoords($("#mnu_map", page).attr("onclick")),
      seen: (new Date).getTime(),
    }

    let gif = proc.execSync(`./mkgif ${flat.imgurls.join(" ")}`)
    
    console.log(flat, gif)

    await db.multipart.insert(
      flat,
      [{ name: "flat.gif", data: gif, content_type: "image/gif" }],
      uuid(),
    )
  }
}


main()
