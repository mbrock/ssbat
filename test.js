#!/usr/bin/env node

redis    = new (require("ioredis"))
db       = require("nano")(process.env.COUCHDB_URL).db.use("flats")
acctDb   = require("nano")(process.env.COUCHDB_URL).db.use("flat-accounts")
bot      = new (require("telegraf"))(process.env.BOT_TOKEN)
telegram = bot.telegram
distance = require("gps-distance")
emoji    = x => require("node-emoji").get(x)
twilio   = new (require("twilio"))(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)

all = (...fs) => x => fs.every(f => f(x))
any = (...fs) => x => fs.some(f => f(x))

monthlyPrice = flat => {
  let x = flat.price.match(/^(.+?) €\/mēn/)
  if (x) {
    return x[1] || Infinity
  } else {
    return Infinity
  }
}

area = flat => +flat.table["Platība"]

rentBelow = x => flat =>
  monthlyPrice(flat) <= x

inRadius = (m, [lat, lon]) => flat =>
  m >= 1000 * distance(lat, lon, +flat.coords[0], +flat.coords[1])

inArea = area => flat =>
  flat.table.Rajons == area

inAreas = (...areas) => any(...areas.map(x => inArea(x)))

places = {
  niceplace: [56.952787, 24.123302],
  ziedondarzs: [56.956157, 24.140640],
}

config = {
  mikael: {
    telegram: 362441422,
    hoods: [
      "Centrs",
      "Maskavas priekšpilsēta",
    ],
    filter: all(
      rentBelow(500),
      any(
        inRadius(1.5, places.niceplace),
        inRadius(1.2, places.ziedondarzs),
      ),
    ),
  },

  krisjanis: {
    telegram: -310463864,
    hoods: [
      "Centrs", "Čiekurkalns", "Mežaparks",
      "Teika", "Purvciems", "VEF",
      "Maskavas priekšpilsēta",
    ],
    filter: all(
      rentBelow(300),
      inAreas(
        "centrs", "Čiekurkalns", "Mežaparks",
        "Teika", "Purvciems", "VEF",
        "Maskavas priekšpilsēta",
      )
    ),
  },
}

flats = {}
changes = []
handling = false

accts = {}
acctChanges = []
acctHandling = false

acctName = acct => `${acct.telegram.first_name} ${acct.telegram.last_name}`

filterAcct = key => flat => {
  let acct = accts[key]

  if (acctName(acct) == "Murphy Monsanto") {
    if ((monthlyPrice(flat) / area(flat) <= 7)
        && area(flat) >= 45
        && inAreas(...accts[key].hoods)(flat)) {
      console.log(`${flat.table.Iela} ${flat.price} ${flat.table["Platība"]} sqm`)
      console.log(`https://ss.lv${flat.link}`)
      console.log("")
      return true
    }

  } else {
    if (rentBelow(accts[key].maxRent)(flat)) {
      if (inAreas(...accts[key].hoods)(flat))
        return true
      if (accts[key].proximity) {
        if (
          inRadius(accts[key].proximity.radius, [
            accts[key].proximity.latitude,
            accts[key].proximity.longitude
          ])(flat)
        ) {
          return true
        }
      }
    }
  }

  return false
}

async function getOld () {
  let rows = (await db.list({ include_docs: true })).rows
  for (let row of rows) {
    if (row.doc.table) {
      // console.log(`old flat: ${row.doc._id} (${row.doc.table.Iela})`)
      flats[row.doc._id] = row.doc
    }
  }
}

async function getOldAccts () {
  let rows = (await acctDb.list({ include_docs: true })).rows
  for (let row of rows) {
    if (row.doc.telegram) {
      accts[row.doc._id] = row.doc
    }
  }
  // console.log(JSON.stringify(accts, null, 2))
}

async function go () {
  await getOldAccts()
  db.follow({ since: 0, include_docs: true }, (error, change) => {
    if (!error) {
      changes.push(change)
      handle()
    }
  })
}

go()

// acctDb.follow({ since: "now", include_docs: true }, (error, change) => {
//   if (!error) {
//     acctChanges.push(change)
//     acctHandle()
//   }
// })

async function acctHandle () {
  while (acctChanges.length > 0 && !acctHandling) {
    acctHandling = true
    let change = acctChanges.shift()
    
    if (!change.deleted && change.doc.telegram) {
      let acct = change.doc
      accts[acct._id] = acct
      console.log(JSON.stringify(acct, null, 2))
    }

    acctHandling = false
  }
}

async function handle () {
  while (changes.length > 0 && !handling) {
    handling = true
    let change = changes.shift()

    if (!change.deleted && change.doc.coords) {
      let flat = change.doc
      flats[flat._id] = flat
      for (let key of Object.keys(accts)) {
        if (!filterAcct(key)(flat))
          continue
        // console.log(`${new Date}: telling ${key} about ${flat.table.Iela}`)
        if (accts[key].sms) {
          let body = `ssbot found: ${flat.table.Istabas} rooms, ${flat.table["Platība"]} m2, ${flat.table.Rajons} (${flat.table.Iela}) -- ${flat.price}.`
          // console.log(`Texting ${accts[key].sms}: ${body}`)
          // await twilio.messages.create({
          //   from: process.env.TWILIO_NUMBER,
          //   to: accts[key].sms,
          //   body: body,
          // })
        }
        if (accts[key].telegram) {
          // await telegram.sendAnimation(
          //   accts[key].telegram.id,
          //   `https://db.riga.wtf/flats/${flat._id}/flat.gif`, {
          //     caption: `${flat.price}, ${flat.table.Rajons}, ${flat.table["Sērija"]}`
          //   }
          // )
          // await telegram.sendVenue(
          //   accts[key].telegram.id,
          //   +flat.coords[0],
          //   +flat.coords[1],
          //   `${flat.table.Istabas} ist., ${flat.table["Platība"]} m²`,
          //   flat.table.Iela,
          //   {
          //     reply_markup: {
          //       inline_keyboard: [
          //         [
          //           {
          //             text: emoji("thumbsup"),
          //             callback_data: `yes:${flat._id}`
          //           },
          //           {
          //             text: emoji("link"),
          //             url: `https://ss.lv/${flat.link}`
          //           }
          //         ]
          //       ]
          //     }
          //   }
          // )
        }
      }
    }
    
    handling = false
  }
}

