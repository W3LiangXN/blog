const express = require('express');
const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
      'Access-Control-Allow-Headers',
      '*'  // 同时允许大写和小写的 HTMX 请求头
  );
  
  if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
  }
  next();
});

app.get('/api/users', (req, res) => {
    // 返回JSON数据
    res.json([
        { id: 1, name: "张三", email: "zhang@example.com" },
        { id: 2, name: "李四", email: "li@example.com" },
        { id: 3, name: "王五", email: "wang@example.com" }
    ]);
});

app.get('/users', (req, res) => {
  // 用户数据
  const users = [
      { id: 1, name: "张三", email: "zhang@example.com" },
      { id: 2, name: "李四", email: "li@example.com" },
      { id: 3, name: "王五", email: "wang@example.com" }
  ];
  
  // 直接返回HTML片段！关键区别在这里
  let html = '<ul>';
  users.forEach(user => {
      html += `<li>${user.name} (${user.email})</li>`;
  });
  html += '</ul>';
  
  res.send(html);
});

app.listen(6300);
