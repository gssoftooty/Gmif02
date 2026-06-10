var express = require('express');
var cors = require('cors');
var bcrypt = require('bcryptjs');
var { v4: uuidv4 } = require('uuid');
var path = require('path');
var { getDb, initDb, initSql } = require('./database');

var app = express();
var PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

var SQL_READY = initSql().then(function() {
  initDb();
});

/* ============================
   AUTH MIDDLEWARE
   ============================ */
function requireAuth(req, res, next) {
  var auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  var token = auth.substring(7);
  var db = getDb();
  var session = db.prepare(`SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')`).get(token);
  db.close();
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }
  req.user = session;
  next();
}

/* ============================
   AUTH ROUTES
   ============================ */
app.post('/api/login', function(req, res) {
  var { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  var db = getDb();

  var recent = db.prepare(`SELECT COUNT(*) as c FROM login_attempts WHERE username = ? AND attempted_at > datetime('now', '-15 minutes')`).get(username);
  if (recent.c >= 5) {
    db.close();
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  var user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    db.prepare('INSERT INTO login_attempts (username) VALUES (?)').run(username);
    db.close();
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  db.prepare('DELETE FROM login_attempts WHERE username = ?').run(username);

  var token = uuidv4();
  var expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, username, role, expires_at) VALUES (?, ?, ?, ?)').run(token, user.username, user.role, expiresAt);
  db.close();

  res.json({ token: token, username: user.username, role: user.role, expiresAt: expiresAt });
});

app.post('/api/logout', requireAuth, function(req, res) {
  var db = getDb();
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.headers.authorization.substring(7));
  db.close();
  res.json({ ok: true });
});

app.get('/api/session', requireAuth, function(req, res) {
  res.json({ username: req.user.username, role: req.user.role });
});

/* ============================
   USERS ROUTES
   ============================ */
app.get('/api/users', requireAuth, function(req, res) {
  var db = getDb();
  var users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all();
  db.close();
  res.json(users);
});

app.post('/api/users', requireAuth, function(req, res) {
  var { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must be 8+ chars with uppercase, lowercase, and digit' });
  }
  var db = getDb();
  var existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) { db.close(); return res.status(409).json({ error: 'Username already exists' }); }
  var hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(username, hash, role || 'editor');
  db.close();
  res.status(201).json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, function(req, res) {
  var db = getDb();
  var user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) { db.close(); return res.status(404).json({ error: 'Not found' }); }
  if (user.username === 'admin') { db.close(); return res.status(403).json({ error: 'Cannot delete superadmin' }); }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ ok: true });
});

app.put('/api/users/password', requireAuth, function(req, res) {
  var { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must be 8+ chars with uppercase, lowercase, and digit' });
  }
  var db = getDb();
  var user = db.prepare('SELECT * FROM users WHERE username = ?').get(req.user.username);
  if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
    db.close(); return res.status(401).json({ error: 'Current password is incorrect' });
  }
  var hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
  db.close();
  res.json({ ok: true });
});

/* ============================
   PROGRAMS ROUTES
   ============================ */
function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
}

app.get('/api/programs', function(req, res) {
  var db = getDb();
  var programs = db.prepare('SELECT * FROM programs ORDER BY sort_order').all();
  db.close();
  programs.forEach(function(p) { p.tags = parseTags(p.tags); });
  res.json(programs);
});

app.post('/api/programs', requireAuth, function(req, res) {
  var { title, description, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  var db = getDb();
  var maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM programs').get().next;
  db.prepare('INSERT INTO programs (title, description, tags, sort_order) VALUES (?, ?, ?, ?)').run(title, description || '', Array.isArray(tags) ? tags.join(', ') : (tags || ''), maxOrder);
  var id = db.prepare('SELECT last_insert_rowid() as id').get().id;
  db.close();
  res.status(201).json({ id: id });
});

app.put('/api/programs/:id', requireAuth, function(req, res) {
  var { title, description, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  var db = getDb();
  db.prepare('UPDATE programs SET title = ?, description = ?, tags = ? WHERE id = ?').run(title, description || '', Array.isArray(tags) ? tags.join(', ') : (tags || ''), req.params.id);
  db.close();
  res.json({ ok: true });
});

app.delete('/api/programs/:id', requireAuth, function(req, res) {
  var db = getDb();
  db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ ok: true });
});

/* ============================
   TEAM ROUTES
   ============================ */
app.get('/api/team', function(req, res) {
  var db = getDb();
  var team = db.prepare('SELECT * FROM team ORDER BY sort_order').all();
  db.close();
  res.json(team);
});

app.post('/api/team', requireAuth, function(req, res) {
  var { name, role, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  var db = getDb();
  var maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM team').get().next;
  db.prepare('INSERT INTO team (name, role, phone, email, sort_order) VALUES (?, ?, ?, ?, ?)').run(name, role || '', phone || '', email || '', maxOrder);
  var id = db.prepare('SELECT last_insert_rowid() as id').get().id;
  db.close();
  res.status(201).json({ id: id });
});

app.put('/api/team/:id', requireAuth, function(req, res) {
  var { name, role, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  var db = getDb();
  db.prepare('UPDATE team SET name = ?, role = ?, phone = ?, email = ? WHERE id = ?').run(name, role || '', phone || '', email || '', req.params.id);
  db.close();
  res.json({ ok: true });
});

app.delete('/api/team/:id', requireAuth, function(req, res) {
  var db = getDb();
  db.prepare('DELETE FROM team WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ ok: true });
});

/* ============================
   PAGE CONTENT ROUTES
   ============================ */
app.get('/api/page-content', function(req, res) {
  var db = getDb();
  var rows = db.prepare('SELECT key, value FROM page_content').all();
  db.close();
  var content = {};
  rows.forEach(function(r) { content[r.key] = r.value; });
  res.json(content);
});

app.put('/api/page-content', requireAuth, function(req, res) {
  var content = req.body;
  if (!content || typeof content !== 'object') return res.status(400).json({ error: 'Invalid content' });
  var db = getDb();
  var upsert = db.prepare('INSERT INTO page_content (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  var transaction = db.transaction(function() {
    for (var k in content) {
      upsert.run(k, String(content[k]));
    }
  });
  transaction();
  db.close();
  res.json({ ok: true });
});

app.put('/api/page-content/reset', requireAuth, function(req, res) {
  initDb();
  res.json({ ok: true });
});

/* ============================
   BLOG ROUTES
   ============================ */
app.get('/api/blog', function(req, res) {
  var db = getDb();
  var blog = db.prepare('SELECT * FROM blog ORDER BY sort_order').all();
  db.close();
  res.json(blog);
});

app.post('/api/blog', requireAuth, function(req, res) {
  var { title, excerpt, date, image } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  var db = getDb();
  var maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM blog').get().next;
  db.prepare('INSERT INTO blog (title, excerpt, date, image, sort_order) VALUES (?, ?, ?, ?, ?)').run(title, excerpt || '', date || '', image || '', maxOrder);
  var id = db.prepare('SELECT last_insert_rowid() as id').get().id;
  db.close();
  res.status(201).json({ id: id });
});

app.put('/api/blog/:id', requireAuth, function(req, res) {
  var { title, excerpt, date, image } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  var db = getDb();
  db.prepare('UPDATE blog SET title = ?, excerpt = ?, date = ?, image = ? WHERE id = ?').run(title, excerpt || '', date || '', image || '', req.params.id);
  db.close();
  res.json({ ok: true });
});

app.delete('/api/blog/:id', requireAuth, function(req, res) {
  var db = getDb();
  db.prepare('DELETE FROM blog WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ ok: true });
});

/* ============================
   GALLERY ROUTES
   ============================ */
app.get('/api/gallery', function(req, res) {
  var db = getDb();
  var gallery = db.prepare('SELECT * FROM gallery ORDER BY sort_order').all();
  db.close();
  res.json(gallery);
});

app.post('/api/gallery', requireAuth, function(req, res) {
  var { image, caption } = req.body;
  if (!image) return res.status(400).json({ error: 'Image URL required' });
  var db = getDb();
  var maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM gallery').get().next;
  db.prepare('INSERT INTO gallery (image, caption, sort_order) VALUES (?, ?, ?)').run(image, caption || '', maxOrder);
  var id = db.prepare('SELECT last_insert_rowid() as id').get().id;
  db.close();
  res.status(201).json({ id: id });
});

app.put('/api/gallery/:id', requireAuth, function(req, res) {
  var { image, caption } = req.body;
  if (!image) return res.status(400).json({ error: 'Image URL required' });
  var db = getDb();
  db.prepare('UPDATE gallery SET image = ?, caption = ? WHERE id = ?').run(image, caption || '', req.params.id);
  db.close();
  res.json({ ok: true });
});

app.delete('/api/gallery/:id', requireAuth, function(req, res) {
  var db = getDb();
  db.prepare('DELETE FROM gallery WHERE id = ?').run(req.params.id);
  db.close();
  res.json({ ok: true });
});

/* ============================
   DASHBOARD STATS
   ============================ */
app.get('/api/dashboard/stats', requireAuth, function(req, res) {
  var db = getDb();
  var programCount = db.prepare('SELECT COUNT(*) as c FROM programs').get().c;
  var teamCount = db.prepare('SELECT COUNT(*) as c FROM team').get().c;
  var userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  var blogCount = db.prepare('SELECT COUNT(*) as c FROM blog').get().c;
  var galleryCount = db.prepare('SELECT COUNT(*) as c FROM gallery').get().c;
  db.close();
  res.json({ programs: programCount, team: teamCount, users: userCount, blog: blogCount, gallery: galleryCount });
});

/* ============================
   STATIC FILES
   ============================ */
app.use(express.static(path.join(__dirname, '..')));

/* ============================
   START
   ============================ */
SQL_READY.then(function() {
  app.listen(PORT, function() {
    console.log('GMIF server running at http://localhost:' + PORT);
  });
}).catch(function(err) {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
