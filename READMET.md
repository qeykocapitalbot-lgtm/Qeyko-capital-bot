# 🚀 Qeyko Capital Bot - Installation & Deployment Guide

**Telegram Mini App pour investissements cryptographiques avec Firebase, Moralis, et TronGrid**

---

## 📋 Table des matières

1. [Fonctionnalités](#fonctionnalités)
2. [Prérequis](#prérequis)
3. [Installation locale](#installation-locale)
4. [Configuration Firebase](#configuration-firebase)
5. [Déploiement sur Render](#déploiement-sur-render)
6. [Configuration Mini App Telegram](#configuration-mini-app-telegram)
7. [Utilisation](#utilisation)
8. [Troubleshooting](#troubleshooting)

---

## ✨ Fonctionnalités

✅ **Mini App Telegram** - Interface web interactive en français (blanc & vert)
✅ **4 Pages principales:**
   - 🏠 Accueil (balance, plans VIP)
   - 📤 Retrait (withdrawal BEP20)
   - 👥 Amis (système de parrainage)
   - 👤 Moi (profil utilisateur)

✅ **Plans VIP (4 niveaux)**
   - Plan 1: $1.12 → $1/24h
   - Plan 2: $10 → $0.90/24h
   - Plan 3: $20 → $2/24h
   - Plan 4: $50 → $10/24h

✅ **Blockchain Integration**
   - Moralis API (BEP20, BNB, MATIC)
   - TronGrid (TRC20, TRX)
   - Automatic deposit verification

✅ **Système de Profit Automatique** - Calcul quotidien 24h/24

✅ **Système d'Affiliation** - 10% commission sur premier dépôt

✅ **Firebase Firestore** - Base de données complète

---

## 📦 Prérequis

### Comptes nécessaires:
- ✅ GitHub account
- ✅ Render account (https://render.com)
- ✅ Firebase project (https://firebase.google.com)
- ✅ Telegram Bot Token (@BotFather)
- ✅ Moralis API Key (https://moralis.io)
- ✅ TronGrid API Key (https://www.trongrid.io)

---

## 🖥️ Installation locale

### 1. Cloner le repository
```bash
git clone https://github.com/qeykokapitalbot-lgtm/Qeyko-capital-bot.git
cd Qeyko-capital-bot
