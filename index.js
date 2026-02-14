const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const socketIo = require('socket.io');
const dotenv = require('dotenv');

// ==========================
// CONFIGURACIÓN INICIAL
// ==========================

const app = express();
const server = http.createServer(app);

// Cargar variables de entorno
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config({ path: '.env.development' });
}

// ==========================
// CONFIGURACIÓN CORS
// ==========================

let corsOptions;

if (process.env.NODE_ENV === 'production') {
  corsOptions = {
    origin: [
      'https://friendsforlife.com.co',
      'https://www.friendsforlife.com.co',
      'https://emprendedores.friendsforlife.com.co',
      'https://admin.friendsforlife.com.co',
      'https://www.admin.friendsforlife.com.co',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
  };
} else {
  corsOptions = {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
  };
}

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ==========================
// REDIRECCIÓN DE SUBDOMINIOS
// ==========================
app.use((req, res, next) => {
  const host = req.hostname;
  // Redirige de 'emprender' a 'emprendedores'
  if (host.startsWith('emprender')) {
    const newHost = host.replace('emprender', 'emprendedores');
    const redirectUrl = `${req.protocol}://${newHost}${req.originalUrl}`;
    console.log(`🔄 Redirigiendo de ${host} a ${newHost}`);
    return res.redirect(301, redirectUrl);
  }
  next();
});

// ==========================
// SOCKET.IO
// ==========================

const io = socketIo(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('Cliente conectado');

  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// ==========================
// MIDDLEWARES
// ==========================

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================
// SERVIR FRONT SEGÚN SUBDOMINIO
// ==========================

const mainStatic = express.static(path.join(__dirname, 'public'));
const emprendedoresStatic = express.static(path.join(__dirname, 'emprendedores'));

app.use((req, res, next) => {
  const host = req.hostname;

  if (host.startsWith('emprendedores')) {
    return emprendedoresStatic(req, res, next);
  }

  return mainStatic(req, res, next);
});

// ==========================
// RUTAS API
// ==========================

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
app.use('/api/comments', require('./routes/comments'));

// ==========================
// CATCH-ALL PARA SPA
// ==========================

app.get('*', (req, res) => {
  const host = req.hostname;

  if (host.startsWith('emprendedores')) {
    return res.sendFile(
      path.join(__dirname, 'emprendedores', 'index.html')
    );
  }

  return res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

// ==========================
// INICIAR SERVIDOR
// ==========================

const port = process.env.PORT || 4000;

server.listen(port, '0.0.0.0', () => {
  console.log(`Servidor iniciado en puerto ${port}`);
});
