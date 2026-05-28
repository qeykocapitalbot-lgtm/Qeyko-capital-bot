const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const axios = require('axios');
require('dotenv').config();

// Lide sèl blòk JSON Firebase nou mete sou Render la
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_GROUP_ID = parseInt(process.env.ADMIN_GROUP_ID);
const CLIENT_GROUP_LINK = process.env.CLIENT_GROUP_LINK;
const BOT_USERNAME = process.env.BOT_USERNAME;
const MINI_APP_URL = `https://${process.env.GH_USERNAME || 'qeykocapitalbot-lgtm'}.github.io`;

const VIP_PLANS = [
  {id: 1, name: "Plan 1", deposit: 1.12, profit: 1, roi: "89.3%"},
  {id: 2, name: "Plan 2", deposit: 10, profit: 0.9, roi: "9.0%"},
  {id: 3, name: "Plan 3", deposit: 20, profit: 2, roi: "10.0%"},
  {id: 4, name: "Plan 4", deposit: 50, profit: 10, roi: "20.0%"}
];

// Pou n asire bot la reponn sou Telegram lè moun fè /start
bot.start((ctx) => {
  ctx.reply(`Byenveni sou Live Crypto Bot! 🚀\n\nKlike sou bouton anba a pou w louvri Mini App a epi kòmanse envesti.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Louvri Aplikasyon 📱", web_app: { url: MINI_APP_URL } }]
      ]
    }
  });
});

// Lanse sèvè a
const PORT = process.env.PORT || 3000;
bot.launch().then(() => {
  console.log('Bot la lanse epi l ap kouri byen sou Telegram! 🚀');
}).catch((err) => {
  console.error('Erè lè bot la t ap lanse:', err);
});

// Pou anpeche bot la aksidan
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
