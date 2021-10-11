#!/usr/bin/env node

uuid     = require("uuid/v1")
db       = require("nano")(process.env.COUCHDB_URL).db.use("flat-accounts")
bot      = new (require("telegraf"))(process.env.BOT_TOKEN)
telegram = bot.telegram
emoji    = x => require("node-emoji").get(x)
hoods    = require("./hoods.js")

chunks = (xs, n) =>
  xs.map((e, i) => (i % n == 0) ? xs.slice(i, i + n) : null).filter(e => e)

keyboard = (xs, n, f) =>
  chunks(xs, n).map(
    ys => ys.map(x => ({
      text: f(x)[0],
      callback_data: f(x)[1],
    }))
  )

hoodKeyboard = id =>
  keyboard(hoods, 3, x => [
    accts[id].hoods.includes(x) ? `${emoji("ok_hand")} ${x}` : x,
    `hood:${x}`
  ])

webhook = "3190bed0-d201-11e8-9097-d113c2b43eeb"
telegram.setWebhook(`https://bot.riga.wtf/${webhook}`)
bot.startWebhook(`/${webhook}`, null, 5000)

accts = {}
revs = {}

ctxConfigKey = ctx => {
  let id = ctx.from.id
  return Object.keys(accts).find(
    x => accts[x].telegram.id == id
  )
}

sleep = secs =>
   new Promise((resolve, reject) => {
    setTimeout(() => resolve(true), secs * 1000.0)
  })

bot.command("start", async ctx => {
  let id = uuid()
  
  let acct = {
    _id: id,
    telegram: ctx.from,
    hoods: [],
  }
  
  let result = await db.insert(acct)
  if (result.ok) {
    ctx.reply(
      `${emoji("robot_face")} Hello and welcome!`
    )

    accts[id] = acct
    revs[id] = result.rev
    await sleep(2)
    askAboutRent(ctx)
  }
})

bot.command("hoods", ctx => askAboutHoods(ctx))
bot.command("rent", ctx => askAboutRent(ctx))

bot.action(/^maxrent:(.*)$/, async ctx => {
  let rent = +ctx.match[1]
  let key = ctxConfigKey(ctx)

  accts[key].maxRent = rent
  await db.insert(accts[key])
  
  ctx.answerCbQuery(`Okay, ${rent} euros per month.`)
  if (accts[key].hoods.length == 0) {
    await sleep(1)
  
    ctx.reply("Now let's choose your favorite hoods.")
    await sleep(2)
    askAboutHoods(ctx)
    
    ctx.reply("Let me know when you're done.", {
      reply_markup: {
        inline_keyboard: [[
          { text: emoji("ok_hand"), callback_data: "hoods_ok" }
        ]]
      }
    })
  }
})

bot.action(/^hoods_ok$/, async ctx => {
  ctx.answerCbQuery("Excellent!")
  ctx.reply(
    `${emoji("joy_cat")} I'll let you know as soon as a flat comes up!`
  )
})

bot.action(/^yes:(.*)$/, async ctx => {
  let key = ctxConfigKey(ctx)
  let x = ctx.callbackQuery
  let address = x.message.venue.address

  let acct = accts[key]
  if (!acct.liked)
    acct.liked = []

  if (!acct.liked.includes(ctx.match[1])) {
    acct.liked.push(ctx.match[1])

    console.log(`saving ${key}: ${JSON.stringify(acct)}`)
    await db.insert(accts[key])
  }
  
  ctx.answerCbQuery(`${emoji("thumbsup")} ${address}`)
  // ctx.reply(
  //   `${x.from.first_name} ${emoji("thumbsup")} ` +
  //     `[${address}](https://ss.lv/${flat.link})`,
  //   {
  //     parse_mode: "Markdown"
  //   }
  // )
})

askAboutRent = ctx => {
  ctx.reply(
    `What's your max rent price?`, {
      reply_markup: {
        inline_keyboard: keyboard(
          [200, 300, 400, 500, 600, 700], 3,
          x => [`${x} €`, `maxrent:${x}`]
        )
      }
    }
  )
}

askAboutHoods = ctx => {
  let key = ctxConfigKey(ctx)
  ctx.reply(
    `Here are the hoods I know about:`, {
      reply_markup: {
        inline_keyboard: hoodKeyboard(key)
      }
    }
  )
}

bot.command("hoods", ctx => askAboutHoods(ctx))

bot.on("location", ctx => {
  let msg = ctx.update.message
  console.log(msg)
  let [lat, lon] = [msg.location.latitude, msg.location.longitude]
  let button = (m, s) => ({
    text: `Within ${s}`,
    callback_data: `near:${m}m:lat:${lat}:lon:${lon}`,
  })
  ctx.reply(
    `Aha, you wanna live here? ${emoji("house_buildings")}`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            button(100, "100 m"),
            button(500, "500 m"),
          ],
          [
            button(1000, "1 km"),
            button(2000, "2 km"),
          ]
        ]
      }
    }
  )
})

bot.action(/^near:(.*)m:lat:(.*):lon:(.*)$/, async ctx => {
  let radius = +ctx.match[1]
  let latitude = +ctx.match[2]
  let longitude = +ctx.match[3]

  let key = ctxConfigKey(ctx)
  accts[key].proximity = {
    radius, latitude, longitude
  }

  await db.insert(accts[key])
  
  ctx.answerCbQuery(`${emoji("thumbsup")}`)
})

bot.action(/^hood:(.*)$/, async ctx => {
  let hood = ctx.match[1]
  
  console.log(ctx.callbackQuery)
  console.log(ctxConfigKey(ctx))

  let key = ctxConfigKey(ctx)
  if (accts[key].hoods.includes(hood)) {
    ctx.answerCbQuery(`${emoji("thumbsdown")} ${hood}`)
    accts[key].hoods = accts[key].hoods.filter(x => x != hood)
  } else {
    ctx.answerCbQuery(`${emoji("heart")} ${hood}`)
    accts[key].hoods.push(hood)
  }

  await db.insert(accts[key])
  console.log(key, "updated")
  
  ctx.editMessageReplyMarkup({
    inline_keyboard: hoodKeyboard(key)
  })
})

changes = []
handling = false

db.follow({ include_docs: true }, (error, change) => {
  if (!error) {
    changes.push(change)
    handle()
  }
})

async function handle () {
  while (changes.length > 0 && !handling) {
    handling = true
    let change = changes.shift()

    if (change.deleted) {
      delete accts[change.id]
    } else if (change.doc.telegram) {
      let acct = change.doc
      accts[change.id] = acct
      revs[change.id] = change.rev
    }
    
    handling = false
  }
}

