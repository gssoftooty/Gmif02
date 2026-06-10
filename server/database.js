var initSqlJs = require('sql.js');
var path = require('path');
var bcrypt = require('bcryptjs');
var fs = require('fs');

var DB_PATH = path.join(__dirname, 'gmif.db');
var SQL;

/* Wrapper classes to mimic better-sqlite3 API */

function DbWrapper(sqlDb) {
  this._db = sqlDb;
}

DbWrapper.prototype.prepare = function(sql) {
  return new StmtWrapper(this._db, sql);
};

DbWrapper.prototype.exec = function(sql) {
  this._db.run(sql);
};

DbWrapper.prototype.transaction = function(fn) {
  var self = this;
  return function() {
    self._db.run('BEGIN');
    try {
      fn.apply(self, arguments);
      self._db.run('COMMIT');
    } catch (e) {
      self._db.run('ROLLBACK');
      throw e;
    }
  };
};

DbWrapper.prototype.close = function() {
  var data = this._db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  this._db.close();
};

function StmtWrapper(sqlDb, sql) {
  this._db = sqlDb;
  this._sql = sql;
}

StmtWrapper.prototype.get = function() {
  var params = arguments.length > 0 ? Array.prototype.slice.call(arguments) : undefined;
  if (params && params.length > 0) {
    var stmt = this._db.prepare(this._sql);
    stmt.bind(params);
    if (stmt.step()) {
      var row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }
  var rows = this._db.exec(this._sql);
  if (rows.length > 0 && rows[0].values.length > 0) {
    var row = {};
    rows[0].columns.forEach(function(col, i) {
      row[col] = rows[0].values[0][i];
    });
    return row;
  }
  return undefined;
};

StmtWrapper.prototype.all = function() {
  var params = arguments.length > 0 ? Array.prototype.slice.call(arguments) : undefined;
  if (params && params.length > 0) {
    var stmt = this._db.prepare(this._sql);
    stmt.bind(params);
    var results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
  var rows = this._db.exec(this._sql);
  if (rows.length === 0) return [];
  return rows[0].values.map(function(vals) {
    var row = {};
    rows[0].columns.forEach(function(col, i) {
      row[col] = vals[i];
    });
    return row;
  });
};

StmtWrapper.prototype.run = function() {
  var params = arguments.length > 0 ? Array.prototype.slice.call(arguments) : undefined;
  if (params && params.length > 0) {
    this._db.run(this._sql, params);
  } else {
    this._db.run(this._sql);
  }
  var rid = 0;
  var r = this._db.exec('SELECT last_insert_rowid() as id');
  if (r.length > 0 && r[0].values.length > 0) rid = r[0].values[0][0];
  return { changes: this._db.getRowsModified(), lastInsertRowid: rid };
};

/* Database access */

function getDb() {
  if (fs.existsSync(DB_PATH)) {
    var buf = fs.readFileSync(DB_PATH);
    var sqlDb = new SQL.Database(buf);
  } else {
    var sqlDb = new SQL.Database();
  }
  return new DbWrapper(sqlDb);
}

function initDb() {
  if (!SQL) throw new Error('SQL library not initialized');
  var db = getDb();

  db.exec('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT "editor", created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.exec('CREATE TABLE IF NOT EXISTS programs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT "", tags TEXT DEFAULT "", sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.exec('CREATE TABLE IF NOT EXISTS team (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT DEFAULT "", phone TEXT DEFAULT "", email TEXT DEFAULT "", sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.exec('CREATE TABLE IF NOT EXISTS page_content (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT DEFAULT "")');
  db.exec('CREATE TABLE IF NOT EXISTS blog (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, excerpt TEXT DEFAULT "", date TEXT DEFAULT "", image TEXT DEFAULT "", sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.exec('CREATE TABLE IF NOT EXISTS gallery (id INTEGER PRIMARY KEY AUTOINCREMENT, image TEXT NOT NULL, caption TEXT DEFAULT "", sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.exec('CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
  db.exec('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, role TEXT DEFAULT "editor", created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL)');

  if (!fs.existsSync(path.join(__dirname, 'gmif_seeded.txt'))) {
    var adminHash = bcrypt.hashSync('Gmif@2025', 10);
    var editorHash = bcrypt.hashSync('Editor@123', 10);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', adminHash, 'superadmin');
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('editor', editorHash, 'editor');

    var defaultPageContent = {
      home_announcement: '★ Registered Non-Profit under Companies Act 2013 | Serving communities since 2000',
      home_hero_badge: 'Est. 2000',
      home_hero_heading: 'Building Resilient<br>Communities Together',
      home_hero_text: 'Green Mount India Foundation (GMIF) empowers vulnerable families through food security, education, healthcare, and sustainable development programs across rural India.',
      home_about_tag: 'Who We Are',
      home_about_heading: 'About <span class="text-accent">GMIF</span>',
      home_about_p1: 'Green Mount India Foundation (GMIF) is a Non-Profit Company incorporated under the Companies Act 2013. We design and implement community-centered interventions focused on food security, education, healthcare, environment, and social welfare.',
      home_about_p2: 'Our work reaches vulnerable families, women, children, the elderly, and persons with disabilities through sustainable, locally-led programs that create lasting change.',
      home_vision: 'A just and resilient society where every person enjoys access to nutritious food, quality education, healthcare, and a wholesome environment.',
      home_mission: 'To alleviate hunger and poverty, strengthen rural health and sanitation, promote inclusive education & vocational skills, empower women and senior citizens.',
      home_cta_heading: 'Partner With Us',
      home_cta_text: 'We welcome partnerships, volunteers, and donors. Join us in building resilient communities.',
      about_heading: 'About Us',
      about_p1: 'Green Mount India Foundation (GMIF) is a Non-Profit Company incorporated under the Companies Act 2013.',
      about_p2: 'Our work reaches vulnerable families, women, children, the elderly, and persons with disabilities.',
      about_vision: 'A just and resilient society where every person enjoys access to nutritious food, quality education, healthcare, and a wholesome environment.',
      about_mission: 'To alleviate hunger and poverty, strengthen rural health and sanitation, promote inclusive education & vocational skills, empower women and senior citizens.',
      about_cta_heading: 'Join Our Mission',
      about_cta_text: 'We welcome partnerships, volunteers, and donors. Together we can build resilient communities.',
      contact_heading: 'Contact Us',
      contact_address: 'No.143/K-B, Elk Hill Road, Bombay Castle, Ooty, Nilgiris, TN - 643 001',
      contact_phone: '+91-83000-93040',
      contact_email: 'greenmount.india@outlook.com',
      contact_hours_weekdays: 'Mon-Fri: 9 AM - 6 PM',
      contact_hours_sat: 'Saturday: 9 AM - 4 PM',
      contact_cta_heading: 'Partner With Us',
      contact_cta_text: 'We welcome partnerships, volunteers, and donors. Join us in building resilient communities.',
      blog_heading: 'Our Blog',
      blog_tag: 'Latest Updates',
      blog_section_heading: 'News & Stories',
      blog_cta_heading: 'Stay Connected',
      blog_cta_text: 'Follow our journey and be part of the change.',
      gallery_heading: 'Photo Gallery',
      gallery_tag: 'Our Work in Action',
      gallery_section_heading: 'Moments That Inspire',
      gallery_cta_heading: 'See the Difference',
      gallery_cta_text: 'Every picture tells a story of transformation.'
    };
    var insertPc = db.prepare('INSERT OR IGNORE INTO page_content (key, value) VALUES (?, ?)');
    for (var k in defaultPageContent) {
      insertPc.run(k, defaultPageContent[k]);
    }

    var defaultPrograms = [
      ['Food Security', 'Community Kitchens, food distribution, nutrition awareness & school meal support.', 'Hunger Relief, Nutrition'],
      ['Education & Skills', 'Early-childhood education, scholarships, remedial tutoring & vocational training.', 'Scholarships, Vocational'],
      ['Health & Sanitation', 'Rural health camps, sanitation drives, maternal & child health support.', 'Health Camps, Sanitation'],
      ['Women & Elderly Support', 'Affordable hostel facilities for women, daycare for the elderly, women empowerment.', 'Empowerment, Care'],
      ['Environment', 'Tree-planting, water conservation, protection of native flora & fauna.', 'Conservation, Sustainability'],
      ['Heritage & Culture', 'Restoration of heritage sites, community libraries, and cultural events.', 'Heritage, Culture']
    ];
    var insertProg = db.prepare('INSERT INTO programs (title, description, tags, sort_order) VALUES (?, ?, ?, ?)');
    defaultPrograms.forEach(function(p, i) { insertProg.run(p[0], p[1], p[2], i); });

    var defaultTeam = [
      ['Ganesh Ramalingam', 'Chairman', '+91-83000-93040', 'greenmount.india@outlook.com'],
      ['Vijay Kumar Gandhi', 'Director', '+91 94430 37879', 'greenmount.india@outlook.com'],
      ['Yuvraj Sevanan', 'Director', '+91-83000-93040', 'greenmount.india@outlook.com']
    ];
    var insertTeam = db.prepare('INSERT INTO team (name, role, phone, email, sort_order) VALUES (?, ?, ?, ?, ?)');
    defaultTeam.forEach(function(t, i) { insertTeam.run(t[0], t[1], t[2], t[3], i); });

    var defaultBlog = [
      ['Community Kitchen Program Launch', 'GMIF launched a community kitchen serving 200+ families in the Nilgiris.', 'Jan 15, 2025', 'https://upload.wikimedia.org/wikipedia/commons/5/55/Keeti_ooty_tamilnadu_-_panoramio.jpg'],
      ['Education Scholarship Drive', 'Annual scholarship drive awarded 50 deserving students.', 'Dec 5, 2024', 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Ooty_Valley.jpg'],
      ['Health Camp Success Story', 'Free health camp provided check-ups to 300+ rural residents.', 'Nov 12, 2024', 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Mist_Flow_in_Glenmorgan_Tea_estate_valley%2C_Ooty.jpg']
    ];
    var insertBlog = db.prepare('INSERT INTO blog (title, excerpt, date, image, sort_order) VALUES (?, ?, ?, ?, ?)');
    defaultBlog.forEach(function(b, i) { insertBlog.run(b[0], b[1], b[2], b[3], i); });

    var defaultGallery = [
      ['https://upload.wikimedia.org/wikipedia/commons/1/18/Nilgiri_hills_view_from_Doddabetta_Peak.jpg', 'Nilgiri Hills - Doddabetta Peak'],
      ['https://upload.wikimedia.org/wikipedia/commons/5/55/Keeti_ooty_tamilnadu_-_panoramio.jpg', 'Keeti Valley, Ooty'],
      ['https://upload.wikimedia.org/wikipedia/commons/a/a2/Ooty_Valley.jpg', 'Ooty Valley View'],
      ['https://upload.wikimedia.org/wikipedia/commons/a/a8/Mist_Flow_in_Glenmorgan_Tea_estate_valley%2C_Ooty.jpg', 'Glenmorgan Tea Estate']
    ];
    var insertGal = db.prepare('INSERT INTO gallery (image, caption, sort_order) VALUES (?, ?, ?)');
    defaultGallery.forEach(function(g, i) { insertGal.run(g[0], g[1], i); });

    fs.writeFileSync(path.join(__dirname, 'gmif_seeded.txt'), 'seeded');
  }

  db.close();
}

function initSql() {
  return initSqlJs({
    locateFile: function(file) {
      return path.join(__dirname, 'node_modules', 'sql.js', 'dist', file);
    }
  }).then(function(sqlLib) {
    SQL = sqlLib;
  });
}

module.exports = { getDb, initDb, initSql };