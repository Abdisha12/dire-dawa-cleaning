const mysql = require("mysql2/promise");
require("dotenv").config();
const pool = mysql.createPool({
  host: process.env.DB_HOST||"localhost", port: parseInt(process.env.DB_PORT)||3306,
  user: process.env.DB_USER||"root", password: process.env.DB_PASSWORD||"",
  database: process.env.DB_NAME||"dire_dawa_cleaning",
  waitForConnections:true, connectionLimit:10, queueLimit:0,
  timezone:"+03:00", decimalNumbers:true
});
(async()=>{
  // During tests we avoid failing the process so unit tests that don't need DB can run.
  try{
    const c=await pool.getConnection(); console.log("✅  MySQL connected:",process.env.DB_NAME); c.release();
  } catch(e){
    if(process.env.NODE_ENV === "test") {
      console.warn("⚠️  MySQL connection failed (test mode) - continuing:", e.message);
    } else {
      console.error("❌  MySQL failed:",e.message); process.exit(1);
    }
  }
})();
module.exports=pool;
