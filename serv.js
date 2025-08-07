// server.js
const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

// 🔗 Ссылки на файлы в твоём репозитории (RAW!)
const VOLT_URL = 'https://raw.githubusercontent.com/ARTEM-web-hue/bolte-num/main/volt.txt';
const NAGRAD_URL = 'https://raw.githubusercontent.com/ARTEM-web-hue/bolte-num/main/nagrad.txt';

let players = [];

// Функция загрузки и парсинга данных
async function loadPlayers() {
  try {
    const [voltRes, nagradRes] = await Promise.all([
      axios.get(VOLT_URL).catch(() => ({ data: '' })),
      axios.get(NAGRAD_URL).catch(() => ({ data: '' }))
    ]);

    const voltLines = voltRes.data.split('\n');
    const nagradLines = nagradRes.data.split('\n');

    const playersMap = {};

    // Парсим volt.txt: суммируем все числа
    voltLines.forEach(line => {
      const match = line.trim().match(/^(\w+):\s*(.+)$/);
      if (match) {
        const username = match[1];
        const numbers = match[2].match(/[+\-]?\d+/g) || [];
        const balance = numbers.reduce((sum, num) => sum + parseInt(num), 0);
        playersMap[username] = { username, balance, trophies: [] };
      }
    });

    // Парсим nagrad.txt: добавляем трофеи
    nagradLines.forEach(line => {
      const match = line.trim().match(/^(\w+):\s*(.+)$/);
      if (match) {
        const username = match[1];
        const trophies = match[2].trim().split(/\s+/).filter(t => t);
        if (playersMap[username]) {
          playersMap[username].trophies = trophies;
        } else if (trophies.length > 0) {
          playersMap[username] = { username, balance: 0, trophies };
        }
      }
    });

    players = Object.values(playersMap);
    console.log(`✅ Загружено ${players.length} игроков`);
  } catch (err) {
    console.error('❌ Ошибка загрузки данных:', err.message);
    players = []; // fallback
  }
}

// Первая загрузка
loadPlayers();

// Обновление каждые 5 минут
setInterval(loadPlayers, 5 * 60 * 1000);

// === API для сайта ===
app.get('/api/players', (req, res) => {
  res.json(players);
});

// === Статика: index.html, /info и т.д. ===
app.use(express.static('public'));

// === /info — уже знаешь ===
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

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
