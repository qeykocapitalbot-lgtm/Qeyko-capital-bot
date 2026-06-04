const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const axios = require('axios');
require('dotenv').config();

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY.split('\\n').join('\n'),
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
const BOT_USERNAME = process.env.BOT_USERNAME || 'Qeyko_Capital_Bot';
const MINI_APP_URL = `https://qeykokapitalbot-lgtm.github.io/Qeyko-capital-bot/`;

// Lis tarif yo senkronize ak Mini App HTML la nèt kounye a
const VIP_PLANS = [
  {id: 1, name: "VIP 1", deposit: 5, profit: 0.20},
  {id: 2, name: "VIP 2", deposit: 10, profit: 1.00},
  {id: 3, name: "VIP 3", deposit: 15, profit: 2.10},
  {id: 4, name: "VIP 4", deposit: 30, profit: 3.00},
  {id: 5, name: "VIP 5", deposit: 60, profit: 10.00}
];

const CRYPTO_ADDRESSES = {
  'BEP20 (USDT)': '0x7fD50dAAfeA0a8Df3E4860ECC81939fFBaa11396',
  'BNB (BSC)': '0x7fD50dAAfeA0a8Df3E4860ECC81939fFBaa11396',
  'POLYGON (USDT)': '0x7fD50dAAfeA0a8Df3E4860ECC81939fFBaa11396',
  'TRON (USDT)': 'TYDHcrwhGkRH68u2fWat72iJoNFqhoadHy'
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

async function notifyUser(userId, message) {
  try {
    await bot.telegram.sendMessage(userId, message, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('User notification error:', err);
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
        vipPlans: {}, // Chanje an objè tankou nan Mini App la pou fasilite senkronizasyon an
        refBy: refParam || '',
        joinedAt: new Date().toISOString(),
        deposits: [],
        withdrawals: []
      };
      await saveUserData(userId, user);
      await notifyAdmin(`✅ <b>Nouvel utilisateur!</b>\n\nID: <code>${userId}</code>\nNom: <b>${user.name}</b>\nUsername: @${ctx.from.username}\nDate: ${new Date().toLocaleString()}`);
      
      if (refParam && refParam !== String(userId)) {
        const referrer = await getUserData(refParam);
        if (referrer) {
          referrer.refs = referrer.refs || [];
          referrer.refs.push({
            id: String(userId),
            name: user.name,
            joinedAt: new Date().toISOString()
          });
          await saveUserData(refParam, referrer);
        }
      }
    }
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '🚀 Ouvrir Mini App', web_app: { url: MINI_APP_URL + '?userId=' + userId } }],
        [{ text: '📊 Admin Panel', web_app: { url: MINI_APP_URL.replace('index.html', 'admin.html') + '?userId=' + userId } }],
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
    
    // Tcheke plan aktif yo nan fòma nouvo kòd la
    const activeVips = user.vipPlans || {};
    let vipLabel = 'Standard';
    const activeKeys = Object.keys(activeVips);
    if (activeKeys.length > 0) {
      const maxVip = Math.max(...activeKeys.map(k => parseInt(k)));
      const topPlan = VIP_PLANS.find(v => v.id === maxVip);
      if (topPlan) vipLabel = topPlan.name;
    }
    
    await ctx.reply(`💰 <b>Votre solde</b>\n\nSolde disponible: <b>$${(user.balance || 0).toFixed(2)}</b>\nTotal déposé: <b>$${(user.totalDeposited || 0).toFixed(2)}</b>\nTotal retiré: <b>$${(user.totalWithdrawn || 0).toFixed(2)}</b>\nStatut VIP: <b>${vipLabel}</b>\nFilleuls: <b>${(user.refs || []).length}</b>`, { 
      parse_mode: 'HTML' 
    });
  } catch (err) {
    console.error('Balance command error:', err);
  }
});

bot.command('deposit', async (ctx) => {
  try {
    const user = await getUserData(ctx.from.id);
    if (!user) return ctx.reply('❌ Utilisateur non trouvé. Tapez /start', { parse_mode: 'HTML' });
    
    const addresses = Object.entries(CRYPTO_ADDRESSES).map(([net, addr]) => `<b>${net}</b>:\n<code>${addr}</code>`).join('\n\n');
    await ctx.reply(`💳 <b>Adresses de dépôt</b>\n\n${addresses}\n\n<i>Sélectionnez le bon réseau et envoyez votre crypto.</i>\n<i>Les dépôts sont vérifiés automatiquement.</i>`, { 
      parse_mode: 'HTML' 
    });
  } catch (err) {
    console.error('Deposit command error:', err);
  }
});

bot.command('withdraw', async (ctx) => {
  try {
    const keyboard = {
      inline_keyboard: [
        [{ text: '🚀 Ouvrir Mini App', web_app: { url: MINI_APP_URL + '?userId=' + ctx.from.id } }]
      ]
    };
    await ctx.reply(`📤 <b>Effectuer un retrait</b>\n\nCliquez sur le bouton pour accéder à la page de retrait.`, { 
      parse_mode: 'HTML', 
      reply_markup: keyboard 
    });
  } catch (err) {
    console.error('Withdraw command error:', err);
  }
});

bot.command('ref', async (ctx) => {
  try {
    const user = await getUserData(ctx.from.id);
    if (!user) return ctx.reply('❌ Utilisateur non trouvé. Tapez /start', { parse_mode: 'HTML' });
    
    const refLink = `https://t.me/${BOT_USERNAME}?start=${user.uid}`;
    await ctx.reply(`🔗 <b>Votre lien de parrainage</b>\n\n<code>${refLink}</code>\n\n👥 Filleuls: <b>${(user.refs || []).length}</b>\n💵 Commission: <b>10%</b>\n\n<i>Partagez ce lien avec vos amis!</i>`, { 
      parse_mode: 'HTML' 
    });
  } catch (err) {
    console.error('Ref command error:', err);
  }
});

// Pwofi yo kalkile otomatikman sou sèvè a sèlman pou evite doub kredi
async function processAutoProfit() {
  try {
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(async (userDoc) => {
      const user = userDoc.data();
      if (!user.vipPlans || Object.keys(user.vipPlans).length === 0) return;
      
      let totalProfit = 0;
      const now = Date.now();
      let dataChanged = false;

      // Eskane tout plan VIP ki anndan objè a
      for (let vipId in user.vipPlans) {
        const machine = user.vipPlans[vipId];
        // Si 24 èdtan pase depi dènye peman an
        if (machine.nextPayout && now >= machine.nextPayout) {
          const planConfig = VIP_PLANS.find(v => v.id === parseInt(vipId));
          if (planConfig) {
            totalProfit += planConfig.profit;
            // Mizajou sik la pou pwochen 24h
            user.vipPlans[vipId].startTime = now;
            user.vipPlans[vipId].nextPayout = now + (24 * 60 * 60 * 1000);
            dataChanged = true;
          }
        }
      }
      
      if (totalProfit > 0 || dataChanged) {
        user.balance = (user.balance || 0) + totalProfit;
        await saveUserData(user.uid, user);
        
        if (totalProfit > 0) {
          await notifyUser(user.uid, `💰 <b>Profit quotidien crédité!</b>\n\n📊 Montant: <b>$${totalProfit.toFixed(2)}</b>\n💼 Solde: <b>$${user.balance.toFixed(2)}</b>`);
        }
      }
    });
  } catch (err) {
    console.error('Auto profit error:', err);
  }
}

// Otomasyon retrè k ap pase estati soti nan pending pou tounen completed
async function processWithdrawals() {
  try {
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(async (userDoc) => {
      const user = userDoc.data();
      if (!user.withdrawals || user.withdrawals.length === 0) return;
      
      let dataChanged = false;
      
      user.withdrawals.forEach((withdrawal, index) => {
        if (withdrawal.status === 'pending') {
          const createdAt = new Date(withdrawal.date).getTime();
          const now = new Date().getTime();
          const minutes = (now - createdAt) / 60000;
          
          if (minutes >= 3) {
            user.withdrawals[index].status = 'completed';
            dataChanged = true;
            
            notifyUser(user.uid, `✅ <b>Retrait complété!</b>\n\n💵 Montant: <b>$${withdrawal.amount.toFixed(2)}</b>\n📬 Adresse: <code>${withdrawal.addr.substring(0, 10)}...</code>\n⏰ Temps: ${new Date().toLocaleString()}`);
            
            notifyAdmin(`✅ <b>Retrait Complété</b>\n\nUtilisateur: ${user.name} (ID: ${user.uid})\nMontant: $${withdrawal.amount.toFixed(2)}\nAdresse: ${withdrawal.addr}`);
          }
        }
      });

      if (dataChanged) {
        await saveUserData(user.uid, user);
      }
    });
  } catch (err) {
    console.error('Withdrawal processing error:', err);
  }
}

// Kouri verifikasyon pwofi yo chak minit nan background nan pou si gen yon VIP ki fin fè 24h
setInterval(processAutoProfit, 60 * 1000);
setInterval(processWithdrawals, 60 * 1000);

bot.launch().then(() => {
  console.log('✅ Bot started successfully');
  console.log(`🤖 Bot: @${BOT_USERNAME}`);
  console.log(`🌐 Mini App: ${MINI_APP_URL}`);
}).catch(err => {
  console.error('❌ Bot launch error:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
