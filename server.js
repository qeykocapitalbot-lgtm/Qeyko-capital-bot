const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const axios = require('axios');
require('dotenv').config();

// ============================================================
// FIREBASE INIT
// ============================================================
const serviceAccount = require('./firebase-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebasedatabase.app`
});
const db = admin.firestore();

// ============================================================
// TELEGRAM BOT INIT
// ============================================================
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_GROUP_ID = parseInt(process.env.ADMIN_GROUP_ID);
const CLIENT_GROUP_LINK = process.env.CLIENT_GROUP_ID; // ex: Qeykocapitalbot
const BOT_USERNAME = 'qeyko_capital_bot';
const MINI_APP_URL = `https://qeykokapitalbot-lgtm.github.io/Qeyko-capital-bot/`;

// ============================================================
// CONFIG
// ============================================================
const VIP_PLANS = [
  { id: 1, name: "Plan 1", deposit: 1.12, profit: 1.00 },
  { id: 2, name: "Plan 2", deposit: 10, profit: 0.90 },
  { id: 3, name: "Plan 3", deposit: 20, profit: 2.00 },
  { id: 4, name: "Plan 4", deposit: 50, profit: 10.00 },
];

const CRYPTO_ADDRESSES = {
  BEP20: '0x7fD50dAAfeA0a8Df3E4860ECC81939fFBaa11396',
  TRC20: 'TYDHcrwhGkRH68u2fWat72iJoNFqhoadHy',
  TRX: 'TYDHcrwhGkRH68u2fWat72iJoNFqhoadHy',
  BNB: '0x7fD50dAAfeA0a8Df3E4860ECC81939fFBaa11396',
  MATIC: '0x7fD50dAAfeA0a8Df3E4860ECC81939fFBaa11396'
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function getUserData(userId) {
  const doc = await db.collection('users').doc(String(userId)).get();
  return doc.exists ? doc.data() : null;
}

async function saveUserData(userId, data) {
  await db.collection('users').doc(String(userId)).set(data, { merge: true });
}

async function notifyAdmin(message) {
  try {
    await bot.telegram.sendMessage(ADMIN_GROUP_ID, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Admin notification error:', err);
  }
}

async function checkBlockchainDeposit(address, network) {
  try {
    // MORALIS - Check BEP20/BSC deposits
    if (network === 'BEP20' || network === 'BNB' || network === 'MATIC') {
      const response = await axios.get(
        `https://api.moralis.io/api/v2/${address}/erc20/transfers`,
        {
          headers: { 'X-API-Key': process.env.MORALIS_API_KEY }
        }
      );
      return response.data.result || [];
    }

    // TRONGRID - Check TRX/TRC20 deposits
    if (network === 'TRC20' || network === 'TRX') {
      const response = await axios.get(
        `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`,
        { timeout: 5000 }
      );
      return response.data.data || [];
    }

    return [];
  } catch (err) {
    console.error('Blockchain check error:', err.message);
    return [];
  }
}

async function processAutoProfit() {
  try {
    const usersSnap = await db.collection('users').get();
    
    usersSnap.forEach(async (userDoc) => {
      const user = userDoc.data();
      
      if (!user.vipPlans || user.vipPlans.length === 0) return;

      // Get active plans
      const activePlans = user.vipPlans.filter(p => p.active);
      let totalProfit = 0;

      activePlans.forEach(plan => {
        const planConfig = VIP_PLANS.find(v => v.id === plan.planId);
        if (planConfig) totalProfit += planConfig.profit;
      });

      if (totalProfit > 0) {
        user.balance += totalProfit;
        await saveUserData(user.uid, user);

        // Notify user
        try {
          await bot.telegram.sendMessage(
            user.uid,
            `💰 <b>Profit quotidien crédité!</b>\n\n` +
            `📊 Montant: <b>$${totalProfit.toFixed(2)}</b>\n` +
            `💼 Solde total: <b>$${user.balance.toFixed(2)}</b>\n\n` +
            `<i>Vos profits ont été calculés automatiquement.</i>`,
            { parse_mode: 'HTML' }
          );
        } catch (err) {
          console.log('User notification skipped:', err.message);
        }
      }
    });
  } catch (err) {
    console.error('Auto profit error:', err);
  }
}

// ============================================================
// BOT COMMANDS
// ============================================================

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const refParam = ctx.startPayload || '';

  let user = await getUserData(userId);

  if (!user) {
    // New user
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

    // Credit referrer
    if (refParam && refParam !== String(userId)) {
      const referrer = await getUserData(refParam);
      if (referrer) {
        if (!referrer.refs) referrer.refs = [];
        referrer.refs.push({
          id: String(userId),
          name: user.name,
          joinedAt: new Date().toISOString()
        });
        await saveUserData(refParam, referrer);

        // Notify referrer
        await bot.telegram.sendMessage(
          refParam,
          `👥 <b>Nouvel filleul!</b>\n\n` +
          `Nom: <b>${user.name}</b>\n` +
          `ID: <code>${userId}</code>\n\n` +
          `<i>Il recevra une commission de 10% lors de son premier dépôt.</i>`,
          { parse_mode: 'HTML' }
        );
      }
    }

    await notifyAdmin(
      `✅ <b>Nouvel utilisateur!</b>\n\n` +
      `ID: <code>${userId}</code>\n` +
      `Nom: <b>${user.name}</b>\n` +
      `Prénom: @${ctx.from.username}\n` +
      `Rejointe: ${new Date().toLocaleString()}`
    );
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '🚀 Ouvrir Mini App', web_app: { url: MINI_APP_URL + '?userId=' + userId } }],
      [{ text: '📞 Support', url: 'https://t.me/' + CLIENT_GROUP_LINK }],
      [{ text: '💬 Groupe', url: 'https://t.me/' + CLIENT_GROUP_LINK }]
    ]
  };

  await ctx.reply(
    `🎉 <b>Bienvenue dans Qeyko Capital!</b>\n\n` +
    `Bonjour <b>${user.name}</b>,\n\n` +
    `💰 Solde: <b>$${user.balance.toFixed(2)}</b>\n` +
    `📊 Statut: <b>Standard</b>\n\n` +
    `Cliquez sur le bouton ci-dessous pour accéder à la Mini App et commencer à investir!`,
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
});

bot.command('balance', async (ctx) => {
  const user = await getUserData(ctx.from.id);
  if (!user) return ctx.reply('❌ Utilisateur non trouvé. Tapez /start');

  const activePlans = (user.vipPlans || []).filter(p => p.active);
  const topPlan = activePlans.length ? VIP_PLANS.find(v => v.id === Math.max(...activePlans.map(p => p.planId))) : null;
  const vipLabel = topPlan ? topPlan.name : 'Standard';

  await ctx.reply(
    `💰 <b>Votre solde</b>\n\n` +
    `Solde disponible: <b>$${(user.balance || 0).toFixed(2)}</b>\n` +
    `Total déposé: <b>$${(user.totalDeposited || 0).toFixed(2)}</b>\n` +
    `Total retiré: <b>$${(user.totalWithdrawn || 0).toFixed(2)}</b>\n` +
    `Statut VIP: <b>${vipLabel}</b>\n` +
    `Filleuls: <b>${(user.refs || []).length}</b>`,
    { parse_mode: 'HTML' }
  );
});

bot.command('deposit', async (ctx) => {
  const user = await getUserData(ctx.from.id);
  if (!user) return ctx.reply('❌ Utilisateur non trouvé. Tapez /start');

  const addresses = Object.entries(CRYPTO_ADDRESSES)
    .map(([net, addr]) => `<code>${net}: ${addr}</code>`)
    .join('\n');

  await ctx.reply(
    `💳 <b>Adresses de dépôt</b>\n\n` +
    addresses + '\n\n' +
    `<i>Sélectionnez le bon réseau et envoyez votre crypto.</i>\n` +
    `<i>Les dépôts sont vérifiés automatiquement dans les 15 minutes.</i>`,
    { parse_mode: 'HTML' }
  );
});

bot.command('withdraw', async (ctx) => {
  const keyboard = {
    inline_keyboard: [
      [{ text: '🚀 Ouvrir Mini App', web_app: { url: MINI_APP_URL + '?userId=' + ctx.from.id } }]
    ]
  };
  await ctx.reply(
    `📤 <b>Effectuer un retrait</b>\n\n` +
    `Cliquez sur le bouton pour accéder à la page de retrait dans la Mini App.`,
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
});

bot.command('ref', async (ctx) => {
  const user = await getUserData(ctx.from.id);
  if (!user) return ctx.reply('❌ Utilisateur non trouvé. Tapez /start');

  const refLink = `https://t.me/${BOT_USERNAME}?start=${user.uid}`;

  await ctx.reply(
    `🔗 <b>Votre lien de parrainage</b>\n\n` +
    `<code>${refLink}</code>\n\n` +
    `👥 Filleuls: <b>${(user.refs || []).length}</b>\n` +
    `💵 Commission: <b>10%</b> par premier dépôt\n\n` +
    `<i>Partagez ce lien avec vos amis!</i>`,
    { parse_mode: 'HTML' }
  );
});

// ============================================================
// WEBHOOK (For deposit notifications via blockchain monitoring)
// ============================================================

// This would be called by an external webhook service (Moralis/TronGrid)
// when a deposit is detected

async function handleDepositWebhook(req, res) {
  try {
    const { address, amount, network, txHash } = req.body;

    // Find user with this address
    const usersSnap = await db.collection('users').where('depositAddress', '==', address).get();
    
    if (usersSnap.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userDoc = usersSnap.docs[0];
    const user = userDoc.data();

    // Update balance
    user.balance += parseFloat(amount);
    user.totalDeposited = (user.totalDeposited || 0) + parseFloat(amount);

    await saveUserData(user.uid, user);

    // Notify user
    await bot.telegram.sendMessage(
      user.uid,
      `✅ <b>Dépôt reçu!</b>\n\n` +
      `Montant: <b>$${amount}</b>\n` +
      `Réseau: <b>${network}</b>\n` +
      `Solde: <b>$${user.balance.toFixed(2)}</b>\n\n` +
      `<code>${txHash}</code>`,
      { parse_mode: 'HTML' }
    );

    // Notify admin
    await notifyAdmin(
      `💰 <b>Nouveau dépôt!</b>\n\n` +
      `Utilisateur: <b>${user.name}</b> (${user.uid})\n` +
      `Montant: <b>$${amount}</b>\n` +
      `Réseau: <b>${network}</b>\n` +
      `Solde: <b>$${user.balance.toFixed(2)}</b>`
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ============================================================
// CRON JOB - Auto Profit every 24h
// ============================================================

setInterval(processAutoProfit, 24 * 60 * 60 * 1000); // 24 hours

// ============================================================
// START BOT
// ============================================================

bot.launch().then(() => {
  console.log('✅ Bot started successfully');
  console.log(`🤖 Bot: @${BOT_USERNAME}`);
  console.log(`🌐 Mini App: ${MINI_APP_URL}`);
}).catch(err => {
  console.error('❌ Bot launch error:', err);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { bot, handleDepositWebhook };
