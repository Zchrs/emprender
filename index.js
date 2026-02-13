const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const socketIo = require('socket.io');
const dotenv = require('dotenv');

// Configuración de Express
const app = express();
const server = http.createServer(app); // Crea el servidor HTTP

// Cargar variables de entorno
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config({ path: '.env.development' });
}

// Configuración de CORS para Express
let corsOptions;
if (process.env.NODE_ENV === 'production') {
  corsOptions = {
    origin: [
      'https://friendsforlife.com.co',
      'https://www.friendsforlife.com.co',
      'https://admin.friendsforlife.com.co',
      'https://www.admin.friendsforlife.com.co',
      'https://ultrasystem-api.vercel.app',
      'https://www.ultrasystem-api.vercel.app',
      'https://ultrasystem-api.vercel.app',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
  };
} else {
  corsOptions = {
    origin: [
      'http://localhost:5173',
      'http://192.168.1.77:5173',
      'http://192.168.102.181:5173',
      'localhost:4173',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Para permitir el intercambio de cookies
    optionsSuccessStatus: 204,
  };
}

app.use(cors(corsOptions));

// Middleware para manejar las opciones preflight
app.options('*', cors(corsOptions));

// Configuración de socket.io con CORS
const io = socketIo(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Configuración de Express para leer y parsear el body
app.use(express.json());

// Configurar Express para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Definir rutas
app.use('/api/admin/auth', require('./routes/admin'));
app.use('/api/users/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/invitation', require('./routes/invitations'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/uploads', require('./routes/images'));
app.use('/api/images', require('./routes/images'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/ratings', require('./routes/ratings'));
app.use('/api/products/issues', require('./routes/IssueReports'));
app.use('/api/pqrs', require('./routes/pqrs'));
app.use('/api/likes', require('./routes/likes'));
app.use('/api/codes/registration/admin', require('./routes/regCodeAdmin'));
app.use('/api/accounts/recovery', require('./routes/recovery'));
app.use("/api/comments", require("./routes/comments"));

app.use(express.static('uploads'));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Configuración de socket.io
io.on('connection', (socket) => {
  console.log('Cliente conectado');

  // Aquí puedes manejar eventos de WebSocket

  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Escucha de peticiones en el puerto 8000 (o el que definas en .env)
const port = process.env.PORT || 4000;
server.listen(port, '0.0.0.0',() => {
  console.log(`Servidor iniciado en puerto ${port}`);
});