const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// === Токены ===
const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; // Ваш Telegram ID

if (!TOKEN) throw new Error('Установите TELEGRAM_TOKEN');
if (!ADMIN_ID) console.warn('⚠️ Не установлен ADMIN_ID — /json edit будет доступен всем');

const bot = new TelegramBot(TOKEN, { polling: true });

// === Файл с данными ===
const DATA_FILE = path.join(__dirname, 'players.json');

// === Загрузка игроков ===
let players = [];
function loadPlayers() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      players = JSON.parse(data);
      console.log(`✅ Загружено ${players.length} игроков`);
    } else {
      players = [
        { username: "atemmax", balance: 660 },
        { username: "loloky", balance: 76 },
        { username: "hentera", balance: 1200 },
        { username: "chessmaster", balance: 200 },
        { username: "grandpaw", balance: 1800 }
      ];
      savePlayers();
      console.log('✅ Создан players.json');
    }
  } catch (err) {
    console.error('❌ Ошибка загрузки:', err);
    players = [];
  }
}

// === Сохранение в файл ===
function savePlayers() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(players, null, 2), 'utf8');
    console.log('💾 Данные сохранены');
  } catch (err) {
    console.error('❌ Ошибка сохранения:', err);
  }
}

// === Звания ===
const ranks = [
  { min: 1500, name: "Золотое", class: "gold" },
  { min: 1000, name: "Серебряное", class: "silver" },
  { min: 500, name: "Бронзовое", class: "bronze" },
  { min: 250, name: "Металлическое", class: "metal" },
  { min: 100, name: "Деревянное", class: "wood" },
  { min: 0, name: "Новичок", class: "wood" }
];

function getRank(balance) {
  for (let r of ranks) {
    if (balance >= r.min) return r;
  }
  return ranks[ranks.length - 1];
}

// === Загружаем при старте ===
loadPlayers();

// === Команда: /bal username ===
bot.onText(/\/bal\s+(\w+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const username = match[1].toLowerCase();

  const player = players.find(p => p.username.toLowerCase() === username);
  const rank = player ? getRank(player.balance) : null;

  if (player) {
    bot.sendMessage(chatId, `
📊 <b>Игрок:</b> ${player.username}
💰 <b>Баланс:</b> ${player.balance} усов
🎖️ <b>Звание:</b> ${rank.name}
    `.trim(), { parse_mode: 'HTML' });
  } else {
    bot.sendMessage(chatId, `❌ Игрок "${username}" не найден.`);
  }
});

// === Команда: /json view ===
bot.onText(/\/json\s+view/i, (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = String(msg.from.id) === ADMIN_ID;

  if (!isAdmin && ADMIN_ID) {
    bot.sendMessage(chatId, '❌ Доступ запрещён.');
    return;
  }

  try {
    const json = JSON.stringify(players, null, 2);
    const content = json.length > 4000
      ? `📄 JSON слишком большой (${json.length} символов). Посмотри на сайте.`
      : `\`\`\`json\n${json}\n\`\`\``;

    bot.sendMessage(chatId, content, { parse_mode: 'Markdown' });
  } catch (err) {
    bot.sendMessage(chatId, '❌ Ошибка чтения JSON');
  }
});

// === Команда: /json edit ===
bot.onText(/\/json\s+edit([\s\S]*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const isAdmin = String(msg.from.id) === ADMIN_ID;

  if (!isAdmin && ADMIN_ID) {
    bot.sendMessage(chatId, '❌ Только админ может редактировать JSON.');
    return;
  }

  const rawJson = match[1].trim();

  if (!rawJson) {
    bot.sendMessage(chatId, '📌 Используй: `/json edit {новый JSON}`');
    return;
  }

  try {
    const newPlayers = JSON.parse(rawJson);
    if (!Array.isArray(newPlayers)) {
      bot.sendMessage(chatId, '❌ Ожидался массив игроков.');
      return;
    }

    players = newPlayers;
    savePlayers();
    bot.sendMessage(chatId, `✅ JSON обновлён. Игроков: ${players.length}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Ошибка парсинга JSON:\n${err.message}`);
  }
});

// === Обработка Update balance ===
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (text?.startsWith('Update balance lichess ')) {
    const regex = /^Update balance lichess (\w+) ([+\-]?\d+)$/;
    const match = text.match(regex);

    if (!match) {
      bot.sendMessage(chatId, '❌ Формат: `Update balance lichess ник +100` или `-50`', { parse_mode: 'Markdown' });
      return;
    }

    const username = match[1].toLowerCase();
    const delta = parseInt(match[2]);

    const player = players.find(p => p.username.toLowerCase() === username);
    if (!player) {
      const newPlayer = { username, balance: delta };
      players.push(newPlayer);
      bot.sendMessage(chatId, `✅ Добавлен: ${username} (${delta} усов)`);
    } else {
      const oldBalance = player.balance;
      player.balance += delta;
      const newRank = getRank(player.balance);
      const oldRank = getRank(oldBalance);

      let msgText = `✅ ${username}: ${oldBalance} → ${player.balance} усов (${delta > 0 ? '+' : ''}${delta})`;

      if (newRank.name !== oldRank.name) {
        msgText += `\n🎉 Повышение! ${oldRank.name} → ${newRank.name}`;
      }

      bot.sendMessage(chatId, msgText);
    }

    savePlayers(); // Сохраняем после каждого изменения
  }
});

// === API и веб-страница ===
app.get('/api/players', (req, res) => {
  res.json(players);
});

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
