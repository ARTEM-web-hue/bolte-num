// server.js
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Добавлено для работы с GitHub API

const app = express();
const PORT = process.env.PORT || 10000;

// === Токены и админы ===
const TOKEN = process.env.TELEGRAM_TOKEN;

// Поддержка нескольких админов
const ADMIN_IDS = (process.env.ADMIN_IDS || process.env.ADMIN_ID || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

// === GitHub Settings for Auto-Save ===
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Новый: PAT
const GITHUB_REPO = process.env.GITHUB_REPO;   // Новый: username/repo, e.g., ARTEM-web-hue/bolte-num
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || 'players.json'; // Новый: путь в репо
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'; // Новый: ветка

let githubFileSha = null; // Будем хранить SHA последнего коммита файла

if (!TOKEN) throw new Error('Установите TELEGRAM_TOKEN');
// Исправлено: используем ADMIN_IDS.length
if (ADMIN_IDS.length === 0) console.warn('⚠️ Не установлены ADMIN_IDS — команды будут доступны всем');

// Проверка GitHub настроек
if (GITHUB_TOKEN && GITHUB_REPO) {
  console.log(`💾 Автосохранение в GitHub включено: ${GITHUB_REPO}/${GITHUB_FILE_PATH} (ветка: ${GITHUB_BRANCH})`);
} else if (GITHUB_TOKEN || GITHUB_REPO) {
  console.warn('⚠️ Для автосохранения в GitHub нужны обе переменные: GITHUB_TOKEN и GITHUB_REPO');
}

const bot = new TelegramBot(TOKEN, { polling: true });

// === Файл с данными (локально для быстрого доступа) ===
const DATA_FILE = path.join(__dirname, 'players.json');

// === Загрузка игроков ===
let players = [];
async function loadPlayers() {
  try {
    // 1. Попробуем загрузить с GitHub
    if (GITHUB_TOKEN && GITHUB_REPO) {
      console.log('🔄 Попытка загрузки players.json с GitHub...');
      try {
        const response = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`, {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
          },
          params: {
            ref: GITHUB_BRANCH
          }
        });
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        players = JSON.parse(content);
        githubFileSha = response.data.sha; // Сохраняем SHA
        console.log(`✅ Загружено ${players.length} игроков с GitHub (SHA: ${githubFileSha.substring(0, 7)})`);
        // Также сохраняем локально для быстродействия
        fs.writeFileSync(DATA_FILE, content, 'utf8');
        return;
      } catch (githubErr) {
        if (githubErr.response && githubErr.response.status === 404) {
          console.log('ℹ️ Файл players.json не найден на GitHub. Будет создан новый.');
        } else {
          console.error('❌ Ошибка загрузки с GitHub:', githubErr.response?.data || githubErr.message);
        }
      }
    }

    // 2. Если GitHub недоступен или файл не найден, пробуем локальный файл
    if (fs.existsSync(DATA_FILE)) {
      console.log('🔄 Загрузка players.json с локального диска...');
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      players = JSON.parse(data);
      console.log(`✅ Загружено ${players.length} игроков с локального диска`);
    } else {
      // 3. Если и локального файла нет, используем начальные данные
      console.log('🆕 Создание начального списка игроков...');
      players = [
        { username: "atemmax", balance: 660 },
        { username: "loloky", balance: 76 },
        { username: "hentera", balance: 1200 },
        { username: "chessmaster", balance: 200 },
        { username: "grandpaw", balance: 1800 }
      ];
      await savePlayers(); // Сохраняем в первый раз
      console.log('✅ Создан начальный players.json');
    }
  } catch (err) {
    console.error('❌ Критическая ошибка загрузки данных:', err);
    players = []; // fallback
  }
}

// === Сохранение в файл (и в GitHub, если настроено) ===
async function savePlayers() {
  try {
    const jsonData = JSON.stringify(players, null, 2);
    
    // 1. Всегда сохраняем локально
    fs.writeFileSync(DATA_FILE, jsonData, 'utf8');
    console.log('💾 Данные сохранены локально');

    // 2. Если настроено, сохраняем в GitHub
    if (GITHUB_TOKEN && GITHUB_REPO) {
      const contentBase64 = Buffer.from(jsonData).toString('base64');
      
      // Определяем сообщение коммита
      const playerCount = players.length;
      const totalBalance = players.reduce((sum, p) => sum + p.balance, 0);
      const commitMessage = `Update players.json: ${playerCount} players, total ${totalBalance} usov`;

      const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
      
      const data = {
        message: commitMessage,
        content: contentBase64,
        branch: GITHUB_BRANCH
      };

      // Если файл уже существовал, нужно указать его SHA для обновления
      if (githubFileSha) {
        data.sha = githubFileSha;
      }

      try {
        const response = await axios.put(url, data, {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
          }
        });
        
        githubFileSha = response.data.content.sha; // Обновляем SHA
        console.log(`☁️ Данные сохранены в GitHub (новый SHA: ${githubFileSha.substring(0, 7)})`);
      } catch (githubErr) {
        console.error('❌ Ошибка сохранения в GitHub:', githubErr.response?.data || githubErr.message);
        // Не прерываем основной поток, если GitHub не отвечает
      }
    }
  } catch (err) {
    console.error('❌ Критическая ошибка сохранения данных:', err);
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
loadPlayers().then(() => {
  console.log("🏁 Инициализация завершена. Бот готов.");
});

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
  const userId = String(msg.from.id);
  const isAdmin = ADMIN_IDS.includes(userId);

  // Исправлено: правильная проверка
  if (ADMIN_IDS.length > 0 && !isAdmin) {
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
  const userId = String(msg.from.id);
  const isAdmin = ADMIN_IDS.includes(userId);

  // Исправлено: правильная проверка
  if (ADMIN_IDS.length > 0 && !isAdmin) {
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
    savePlayers(); // Используем асинхронную версию
    bot.sendMessage(chatId, `✅ JSON обновлён. Игроков: ${players.length}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Ошибка парсинга JSON:\n${err.message}`);
  }
});

// === НОВАЯ КОМАНДА: /nule ===
bot.onText(/\/nule/i, (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const isAdmin = ADMIN_IDS.includes(userId);

  // Исправлено: правильная проверка
  if (ADMIN_IDS.length > 0 && !isAdmin) {
    bot.sendMessage(chatId, '❌ Только админ может обнулить балансы.');
    return;
  }

  const count = players.length;
  players.forEach(p => p.balance = 0);
  savePlayers(); // Используем асинхронную версию

  bot.sendMessage(chatId, `✅ Балансы всех ${count} игроков обнулены.`);
});

// === НОВАЯ КОМАНДА: /com ===
bot.onText(/\/com/i, (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const isAdmin = ADMIN_IDS.includes(userId);

  let helpText = `
🎮 <b>Команды бота:</b>

🔹 <code>Update balance lichess ник +100</code>
   Обновить баланс игрока

🔹 <code>/bal ник</code>
   Посмотреть баланс игрока
`;

  // Исправлено: правильная проверка для отображения админских команд
  if (isAdmin || ADMIN_IDS.length === 0) {
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
  const userId = String(msg.from.id); // Убедиться, что это есть
  const text = msg.text?.trim();

  // === Проверка на админа (если ADMIN_IDS задан) ===
  // Исправлено: правильная проверка
  const isAdmin = ADMIN_IDS.includes(userId);
  if (text?.startsWith('Update balance lichess ')) {
    // Исправлено: правильная проверка
    if (ADMIN_IDS.length > 0 && !isAdmin) {
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

    savePlayers(); // Используем асинхронную версию
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
