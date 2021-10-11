#!/usr/bin/env node

bot      = new (require("telegraf"))(process.env.BOT_TOKEN)
telegram = bot.telegram

config = {
  mikael: {
    telegram: 362441422,
  }
}

hoods = [
  "Centrs",
  "Āgenskalns",
  "Aplokciems",
  "Beberbeķi",
  "Berģi",
  "Bieķēnsala",
  "Bieriņi",
  "Bolderāja",
  "Bukulti",
  "Čiekurkalns",
  "Dārzciems",
  "Daugavgrīva",
  "Dreiliņi",
  "Dzegužkalns (Dzirciems)",
  "Iļģuciems",
  "Imanta",
  "Jaunciems",
  "Jaunmīlgrāvis",
  "Jugla",
  "Katlakalns",
  "Ķengarags",
  "Ķīpsala",
  "Kleisti",
  "Klīversala",
  "Krasta r-ns",
  "Krēmeri",
  "Mangaļi",
  "Mangaļsala",
  "Maskavas priekšpilsēta",
  "Mežaparks",
  "Mežciems",
  "Pļavnieki",
  "Purvciems",
  "Šampēteris-Pleskodāle",
  "Sarkandaugava",
  "Šķirotava",
  "Stacija-Tirgus",
  "Teika",
  "Torņakalns",
  "Vecāķi",
  "Vecdaugava",
  "Vecmīlgrāvis",
  "Vecrīga",
  "Voleri",
  "Zasulauks",
  "Ziepniekkalns",
  "Zolitūde",
  "VEF",
  "Cits",
]

chunk = (xs, n) =>
  xs.map((e, i) => (i % n == 0) ? xs.slice(i, i + n) : null).filter(e => e)

console.log(chunk(hoods, 5))

telegram.sendMessage(
  config.mikael.telegram,
  "Hello. Choose.",
  {
    reply_markup: {
      inline_keyboard: 
    }
  }
)
