require('dotenv').config();

const path = require('path');

const { ensurePersistentUploads } = require('./src/utils/ensurePersistentUploads');
ensurePersistentUploads();

const express = require('express');
const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);

const db = require('./src/db');
const attachLocals = require('./src/middleware/locals');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');
const indexRoutes = require('./src/routes/index');
const adminRoutes = require('./src/routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionStore = new KnexSessionStore({
  knex: db,
  createtable: true,
  tablename: 'sessions'
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'tomstore-dev-secret',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

app.use(attachLocals);

app.use('/admin', adminRoutes);
app.use('/', indexRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TOMSTORE dang chay tai http://localhost:${PORT}`);
});
