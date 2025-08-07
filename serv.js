// serv.js — ПРОСТОЙ И ПРАВИЛЬНЫЙ
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

// 🔗 Прямые ссылки на RAW-файлы в GitHub
const VOLT_URL = 'https://raw.githubusercontent.com/ARTEM-web-hue/bolte-num/version-two/volt.txt';
const NAGRAD_URL = 'https://raw.githubusercontent.com/ARTEM-web-hue/bolte-num/version-two/nagrad.txt';

// Локальный файл для резерва (опционально)
const DATA_FILE = path.join(__dirname, 'players.json');

let players = [];

// === Загрузка данных из volt.txt ===
async function loadPlayers() {
  try {
    console.log('🔄 Загрузка данных из volt.txt и nagrad.txt...');

    // --- 1. Загружаем volt.txt ---
    const voltResponse = await axios.get(VOLT_URL + '?t=' + Date.now());
    const voltLines = voltResponse.data.split('\n');
    const playersMap = {};

    voltLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes(':')) return;

      const [usernamePart, numbersPart] = trimmed.split(':');
      const username = usernamePart.trim();
      if (!username) return;

      const numbers = numbersPart.match(/[+\-]?\d+/g) || [];
      const balance = numbers.reduce((sum, num) => sum + parseInt(num, 10), 0);

      // Инициализируем игрока с пустым массивом трофеев
      playersMap[username] = { username, balance, trophies: [] };
    });

    // --- 2. Загружаем nagrad.txt ---
    try {
      const nagradResponse = await axios.get(NAGRAD_URL + '?t=' + Date.now());
      const nagradLines = nagradResponse.data.split('\n');

      nagradLines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes(':')) return;

        const [usernamePart, trophiesPart] = trimmed.split(':');
        const username = usernamePart.trim();
        if (!username) return;

        const trophies = trophiesPart.trim().split(/\s+/).filter(t => t);

        if (playersMap[username]) {
          playersMap[username].trophies = trophies;
        } else {
          // Если игрока нет в volt.txt — создаём с нулевым балансом
          playersMap[username] = { username, balance: 0, trophies };
        }
      });
    } catch (err) {
      console.warn('⚠️ Не удалось загрузить nagrad.txt:', err.message);
    }

    players = Object.values(playersMap);
    console.log(`✅ Загружено ${players.length} игроков (${players.filter(p => p.trophies.length > 0).length} с трофеями)`);

    // Сохраняем локально
    fs.writeFileSync(DATA_FILE, JSON.stringify(players, null, 2), 'utf8');
    console.log('💾 Данные сохранены в players.json');
  } catch (err) {
    console.error('❌ Ошибка загрузки данных:', err.message);
    // fallback — попробуем локальный файл
    if (fs.existsSync(DATA_FILE)) {
      try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        players = JSON.parse(data);
        console.log(`✅ Загружено ${players.length} игроков из резерва`);
      } catch (e) {
        console.error('❌ Ошибка чтения players.json:', e);
        players = [];
      }
    } else {
      players = [
        { username: "atemmax", balance: 0, trophies: ["Медаль создателя сайта"] },
        { username: "Rondom12345678", balance: 0, trophies: ["Медаль создателя клуба"] }
      ];
    }
  }
}
// === Автообновление каждые 5 минут ===
setInterval(loadPlayers, 5 * 60 * 1000);

// === API для сайта ===
app.get('/api/players', (req, res) => {
  res.json(players);
});

// === Статика: index.html, /info и т.д. ===
app.use(express.static('public'));

// === /info — как у тебя ===
app.get('/info', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>ℹ️ О клубе "Сами с усами"</title>
  <style>
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d);
      color: white;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: rgba(0,0,0,0.3);
      padding: 20px;
      border-radius: 15px;
    }
    .btn {
      display: block; margin: 10px auto; width: 90%; padding: 15px;
      background: #2c3e50; color: white; text-decoration: none;
      border-radius: 10px; font-size: 18px;
    }
    .btn-main {
      background: #e67e22; font-weight: bold; font-size: 22px;
    }
    p { font-size: 18px; line-height: 1.6; }
    a { color: #f1c40f; }
  </style>
</head>
<body>
  <div class="container">
    <h1>ℹ️ О клубе "Сами с усами"</h1>
    <a href="https://lichess.org/@/Rondom12345678" class="btn">👑 Создатель</a>
    <a href="https://lichess.org/@/Breshko_Savva" class="btn">🤝 1 помощник</a>
    <a href="https://lichess.org/@/Mister204" class="btn">🤝 2 помощник</a>
    <a href="https://lichess.org/@/YaDeni" class="btn">💪 Тащер</a>
    <a href="https://lichess.org/@/atemmax" class="btn">🌟 Старый друг</a>
    <a href="https://lichess.org/team/dNnzQFa3" class="btn btn-main">🏆 Клуб</a>
    <p>Мы дружная команда! 100+ игроков за 13 дней!</p>
  </div>
</body>
</html>
  `);
});

// === Запуск ===
loadPlayers().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📊 Игроков: ${players.length}`);
  });
});
