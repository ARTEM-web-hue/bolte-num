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
if (!ADMIN_ID) console.warn('⚠️ Не установлен ADMIN_ID — команды /nule и /com будут доступны всем');

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

// === НОВАЯ КОМАНДА: /nule ===
bot.onText(/\/nule/i, (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = String(msg.from.id) === ADMIN_ID;

  if (!isAdmin && ADMIN_ID) {
    bot.sendMessage(chatId, '❌ Только админ может обнулить балансы.');
    return;
  }

  const count = players.length;
  players.forEach(p => p.balance = 0);
  savePlayers();

  bot.sendMessage(chatId, `✅ Балансы всех ${count} игроков обнулены.`);
});

// === НОВАЯ КОМАНДА: /com ===
bot.onText(/\/com/i, (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = String(msg.from.id) === ADMIN_ID;

  let helpText = `
🎮 <b>Команды бота:</b>

🔹 <code>Update balance lichess ник +100</code>
   Обновить баланс игрока

🔹 <code>/bal ник</code>
   Посмотреть баланс игрока
`;

  if (isAdmin || !ADMIN_ID) {
    helpText += `
🔐 <b>Админские команды:</b>

🔹 <code>/json view</code>
   Посмотреть JSON данных

🔹 <code>/json edit [...]</code>
   Заменить всех игроков

🔹 <code>/nule</code>
   Обнулить балансы всех игроков

🔹 <code>/com</code>
   Показать эту справку
`;
  }

  bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
});

// === Обработка Update balance ===
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = msg.text?.trim();

  // === Проверка на админа (если ADMIN_ID задан) ===
  const isAdmin = userId === ADMIN_ID;
  if (text?.startsWith('Update balance lichess ')) {
    if (ADMIN_ID && !isAdmin) {
      bot.sendMessage(chatId, '❌ Обновлять баланс может только администратор.');
      return;
    }

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
// === Страница /info ===
app.get('/info', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ℹ️ О клубе "Сами с усами"</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d);
      color: #fff;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    h1 {
      text-shadow: 2px 2px 5px rgba(0,0,0,0.5);
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: rgba(0, 0, 0, 0.3);
      padding: 20px;
      border-radius: 15px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .btn {
      display: block;
      width: 90%;
      margin: 10px auto;
      padding: 15px;
      background: #2c3e50;
      color: white;
      text-decoration: none;
      font-size: 18px;
      border-radius: 10px;
      transition: 0.3s;
    }
    .btn:hover {
      background: #34495e;
      transform: scale(1.02);
    }
    .btn-main {
      background: #e67e22;
      font-size: 22px;
      font-weight: bold;
    }
    .btn-main:hover {
      background: #d35400;
    }
    p {
      font-size: 18px;
      line-height: 1.6;
    }
    a {
      color: #f1c40f;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ℹ️ О клубе "Сами с усами"</h1>

    <a href="https://lichess.org/@/Rondom12345678" class="btn">👑 Создатель клуба</a>
    <a href="https://lichess.org/@/Breshko_Savva" class="btn">🤝 1 помощник клуба</a>
    <a href="https://lichess.org/@/Mister204" class="btn">🤝 2 помощник клуба</a>
    <a href="https://lichess.org/@/YaDeni" class="btn">💪 Тащер клуба</a>
    <a href="https://lichess.org/@/atemmax" class="btn">🌟 Старый друг много делал для 1 клуба</a>

    <a href="https://lichess.org/team/dNnzQFa3" class="btn btn-main">🏆 Клуб</a>

    <p>
      Каждому игроку мы рады у нас куча всего! Читайте описание дальше и вы всё поймёте!
    </p>
    <p>
      Мы очень дружная команда!!! У нас 100+ игроков за 13 дней!
    </p>
    <p>
      Наш клуб старый, у него есть старые друзья:
      <a href="https://lichess.org/team/NW5eTSTC">NW5eTSTC</a>
    </p>
    <p>
      1 клуб: <a href="https://lichess.org/team/2Jic5G62">2Jic5G62</a><br>
      вот 2: <a href="https://lichess.org/team/r2jBMkqQ">r2jBMkqQ</a><br>
      вот 3: <a href="https://lichess.org/team/EQeKftyd">EQeKftyd</a><br>
      вот 4 он жив!: <a href="https://lichess.org/team/fAEHcVRb">fAEHcVRb</a><br>
      вот 5: <a href="https://lichess.org/team/3WtxMOsQ">3WtxMOsQ</a>
    </p>
    <p>
      И остался наш клуб — 6 версия, но был еще один клуб, в котором я сохранил описание нашего 1 ссу.
    </p>
    <p>
      Мне жаль, что наш клуб столько пережил. Но мы не умрём — на всегда!
    </p>
  </div>
</body>
</html>
  `);
});
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
