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
    // === 1. Загружаем volt.txt с GitHub ===
    if (GITHUB_TOKEN && GITHUB_REPO) {
      const voltUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/volt.txt`;
      console.log('🔄 Попытка загрузки volt.txt с GitHub...');
      try {
        const response = await axios.get(voltUrl);
        const lines = response.data.split('\n');
        const playersMap = {};

        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.includes(':')) return;

          const [usernamePart, numbersPart] = trimmed.split(':');
          const username = usernamePart.trim();
          if (!username) return;

          // Ищем все числа с плюсом/минусом
          const numbers = numbersPart.match(/[+\-]?\d+/g) || [];
          const balance = numbers.reduce((sum, num) => sum + parseInt(num, 10), 0);

          playersMap[username] = { username, balance };
        });

        players = Object.values(playersMap);
        console.log(`✅ Загружено ${players.length} игроков из volt.txt`);
        return; // Успешно загрузили — выходим
      } catch (err) {
        if (err.response?.status === 404) {
          console.log('❌ volt.txt не найден на GitHub');
        } else {
          console.error('❌ Ошибка загрузки volt.txt:', err.message);
        }
      }
    }

    // === 2. Если не получилось — пробуем локальный players.json ===
    if (fs.existsSync(DATA_FILE)) {
      console.log('🔄 Загрузка players.json с локального диска...');
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      players = JSON.parse(data);
      console.log(`✅ Загружено ${players.length} игроков из локального players.json`);
      return;
    }

    // === 3. Если ничего нет — начальные данные ===
    console.log('🆕 Создание начальных данных...');
    players = [
      { username: "atemmax", balance: 660 },
      { username: "loloky", balance: 76 },
      { username: "hentera", balance: 1200 }
    ];
    await savePlayers();
    console.log('✅ Начальные данные созданы');
  } catch (err) {
    console.error('❌ Критическая ошибка загрузки:', err);
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
