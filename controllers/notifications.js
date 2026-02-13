const mysqls = require("mysql2/promise");

    const db= await mysqls.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

const watchIssues = () => {
  const query = db.query('SELECT * FROM issues');
  
  query.on('result', (row) => {
    // Podrías usar triggers en MySQL o polling para detectar cambios
    // Esta es una implementación básica de polling
  });
  
  setInterval(() => {
    db.query('SELECT * FROM issues WHERE updated_at > ?', [lastCheck], (err, results) => {
      if (err) throw err;
      if (results.length > 0) {
        io.emit('issues_changed', { changes: results });
        lastCheck = new Date();
      }
    });
  }, 5000); // Chequea cada 5 segundos
}

module.exports = {
  watchIssues
};