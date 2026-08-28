const db=require("../config/db");
const logger=require("../config/logger");

async function authenticate(req,res,next){
  try{
    const token=req.headers["x-session-token"]||req.headers["authorization"]?.replace("Bearer ","");
    if(!token) return res.status(401).json({error:"No session token"});
    const [rows]=await db.execute(
      `SELECT s.id AS sid, s.user_id, u.id, u.username, u.full_name, u.role, u.is_active
       FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.id=? AND s.expires_at>NOW() AND u.is_active=1`,[token]);
    if(!rows.length) return res.status(401).json({error:"Session expired or invalid"});
    req.user=rows[0];
    req.sessionId=token;
    next();
  }catch(err){logger.error("Auth error",{err:err.message});res.status(500).json({error:"Internal error"});}
}

function requireRole(...roles){
  return(req,res,next)=>{
    if(!req.user) return res.status(401).json({error:"Not authenticated"});
    if(!roles.includes(req.user.role)) return res.status(403).json({error:`Requires: ${roles.join(" or ")}`});
    next();
  };
}

// Leader can only access their own zone; collector/admin can access all
async function zoneAccess(req,res,next){
  if(req.user.role==="admin"||req.user.role==="collector") return next();
  if(req.user.role==="leader"){
    const zoneId=req.params.zoneId||req.body.saferZoneId||req.query.zoneId;
    if(!zoneId) return next();
    const [rows]=await db.execute("SELECT id FROM safer_zones WHERE id=? AND leader_id=?",[zoneId,req.user.id]);
    if(!rows.length) return res.status(403).json({error:"You can only access your own zone"});
  }
  next();
}

module.exports={authenticate,requireRole,zoneAccess};
