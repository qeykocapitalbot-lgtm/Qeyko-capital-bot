const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const axios = require('axios');
require('dotenv').config();

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  universe_domain: "googleapis.com"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebasedatabase.app`
});

const db = admin.firestore();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_GROUP_ID = parseInt(process.env.ADMIN_GROUP_ID);
const CLIENT_GROUP_LINK = process.env.CLIENT_GROUP_ID;
const BOT_USERNAME = process.env.BOT_USERNAME || 'qeyko_capital_bot';
const MINI_APP_URL = `https://qeykokapitalbot-lgtm.github.io/Qeyko-capital-bot/`;

const VIP_PLANS = [
  {id: 1, name: "Plan 1", deposit: 1.12, profit: 1.00},
  {id: 2, name: "Plan 2", deposit: 10, profit: 0.90},
  {id: 3, name: "Plan 3", deposit: 20, profit: 2.00},
  {id: 4, name: "Plan 4", deposit: 50, profit: 10.00}
];

const CRYPTO_ADDRESSES = {
  BEP20: '0x7fD50dAAfeA0a8Df3E4860ECC81939fFBaa11396',
  TRC20: 'TYDHcrwhGkRH68u2fWat72iJoNFqhoadHy',
  TRX: 'TYDHcrwhGkRH68u2fWat72iJoNFqhoadHy',
  BNB: '0x7fD50dAAfeA0a8Df3E4860ECC81939fFBaa11396',
  MATIC: '0x7fD50dAAfeA0a8Df3E4860ECC81939fFBaa11396'
};

async function getUserData(userId) {
  try {
    const doc = await db.collection('users').doc(String(userId)).get();
    return doc.exists ? doc.data() : null;
  } catch (err) {
    console.error('Get user error:', err);
    return null;
  }
}

async function saveUserData(userId, data) {
  try {
    await db.collection('users').doc(String(userId)).set(data, { merge: true });
  } catch (err) {
    console.error('Save user error:', err);
  }
}

async function notifyAdmin(message) {
  try {
    await bot.telegram.sendMessage(ADMIN_GROUP_ID, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Admin notification error:', err);
  }
}

bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const refParam = ctx.startPayload || '';
    let user = await getUserData(userId);
    
    if (!user) {
      user = {
        uid: String(userId),
        name: ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : ''),
        username: ctx.from.username || '',
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        refs: [],
        password: '',
        vipPlans: [],
        refBy: refParam || '',
        joinedAt: new Date().toISOString()
      };
      await saveUserData(userId, user);
      await notifyAdmin(`✅ <b>Nouvel utilisateur!</b>\n\nID: <code>${userId}</code>\nNom: <b>${user.name}</b>\nUsername: @${ctx.from.username}\nDate: ${new Date().toLocaleString()}`);
    }
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🚀 Ouvrir Mini App', web_app: { url: MINI_APP_URL + '?userId=' + userId } }],
        [{ text: '📞 Support', url: 'https://t.me/' + CLIENT_GROUP_LINK }],
        [{ text: '💬 Groupe', url: 'https://t.me/' + CLIENT_GROUP_LINK }]
      ]
    };
    
    await ctx.reply(`🎉 <b>Bienvenue dans Qeyko Capital!</b>\n\nBonjour <b>${user.name}</b>,\n\n💰 Solde: <b>$${user.balance.toFixed(2)}</b>\n📊 Statut: <b>Standard</b>\n\nCliquez sur le bouton ci-dessous pour accéder à la Mini App et commencer à investir!`, { 
      parse_mode: 'HTML', 
      reply_markup: keyboard 
    });
  } catch (err) {
    console.error('Start command error:', err);
    await ctx.reply('❌ Erreur. Essayez /start');
  }
});

bot.command('balance', async (ctx) => {
  try {
    const user = await getUserData(ctx.from.id);
    if (!user) return ctx.reply('❌ Utilisateur non trouvé. Tapez /start', { parse_mode: 'HTML' });
    
    const activePlans = (user.vipPlans || []).filter(p => p.active);
    const topPlan = activePlans.length ? VIP_PLANS.find(v => v.id === Math.max(...activePlans.map(p => p.planId))) : null;
    const vipLabel = topPlan ? topPlan.name : 'Standard';
    
    await ctx.reply(`💰 <b>Votre solde</b>\n\nSolde disponible: <b>$${(user.balance || 0).toFixed(2)}</b>\nTotal déposé: <b>$${(user.totalDeposited || 0).toFixed(2)}</b>\nTotal retiré: <b>$${(user.totalWithdrawn || 0).toFixed(2)}</b>\nStatut VIP: <b>${vipLabel}</b>\nFilleuls: <b>${(user.refs || []).length}</b>`, { 
      parse_mode: 'HTML' 
    });
  } catch (err) {
    console.error('Balance command error:', err);
    await ctx.reply('❌ Erreur', { parse_mode: 'HTML' });
  }
});

bot.command('deposit', async (ctx) => {
  try {
    const user = await getUserData(ctx.from.id);
    if (!user) return ctx.reply('❌ Utilisateur non trouvé. Tapez /start', { parse_mode: 'HTML' });
    
    const addresses = Object.entries(CRYPTO_ADDRESSES).map(([net, addr]) => `<code>${net}: ${addr}</code>`).join('\n');
    await ctx.reply(`💳 <b>Adresses de dépôt</b>\n\n${addresses}\n\n<i>Sélectionnez le bon réseau et envoyez votre crypto.</i>\n<i>Les dépôts sont vérifiés automatiquement dans les 15 minutes.</i>`, { 
      parse_mode: 'HTML' 
    });
  } catch (err) {
    console.error('Deposit command error:', err);
    await ctx.reply('❌ Erreur', { parse_mode: 'HTML' });
  }
});

bot.command('withdraw', async (ctx) => {
  try {
    const keyboard = {
      inline_keyboard: [
        [{ text: '🚀 Ouvrir Mini App', web_app: { url: MINI_APP_URL + '?userId=' + ctx.from.id } }]
      ]
    };
    await ctx.reply(`📤 <b>Effectuer un retrait</b>\n\nCliquez sur le bouton pour accéder à la page de retrait dans la Mini App.`, { 
      parse_mode: 'HTML', 
      reply_markup: keyboard 
    });
  } catch (err) {
    console.error('Withdraw command error:', err);
    await ctx.reply('❌ Erreur', { parse_mode: 'HTML' });
  }
});

bot.command('ref', async (ctx) => {
  try {
    const user = await getUserData(ctx.from.id);
    if (!user) return ctx.reply('❌ Utilisateur non trouvé. Tapez /start', { parse_mode: 'HTML' });
    
    const refLink = `https://t.me/${BOT_USERNAME}?start=${user.uid}`;
    await ctx.reply(`🔗 <b>Votre lien de parrainage</b>\n\n<code>${refLink}</code>\n\n👥 Filleuls: <b>${(user.refs || []).length}</b>\n💵 Commission: <b>10%</b> par premier dépôt\n\n<i>Partagez ce lien avec vos amis!</i>`, { 
      parse_mode: 'HTML' 
    });
  } catch (err) {
    console.error('Ref command error:', err);
    await ctx.reply('❌ Erreur', { parse_mode: 'HTML' });
  }
});

async function processAutoProfit() {
  try {
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(async (userDoc) => {
      const user = userDoc.data();
      if (!user.vipPlans || user.vipPlans.length === 0) return;
      
      const activePlans = user.vipPlans.filter(p => p.active);
      let totalProfit = 0;
      
      activePlans.forEach(plan => {
        const planConfig = VIP_PLANS.find(v => v.id === plan.planId);
        if (planConfig) totalProfit += planConfig.profit;
      });
      
      if (totalProfit > 0) {
        user.balance += totalProfit;
        await saveUserData(user.uid, user);
        
        try {
          await bot.telegram.sendMessage(user.uid, `💰 <b>Profit quotidien crédité!</b>\n\n📊 Montant: <b>$${totalProfit.toFixed(2)}</b>\n💼 Solde total: <b>$${user.balance.toFixed(2)}</b>\n\n<i>Vos profits ont été calculés automatiquement.</i>`, { 
            parse_mode: 'HTML' 
          });
        } catch (err) {
          console.log('User notification skipped:', err.message);
        }
      }
    });
  } catch (err) {
    console.error('Auto profit error:', err);
  }
}

setInterval(processAutoProfit, 24 * 60 * 60 * 1000);

bot.launch().then(() => {
  console.log('✅ Bot started successfully');
  console.log(`🤖 Bot: @${BOT_USERNAME}`);
  console.log(`🌐 Mini App: ${MINI_APP_URL}`);
  console.log(`📊 Firebase Project: ${process.env.FIREBASE_PROJECT_ID}`);
}).catch(err => {
  console.error('❌ Bot launch error:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { bot };
