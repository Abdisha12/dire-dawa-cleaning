const express=require("express");
const bcrypt=require("bcryptjs");
const {v4:uuidv4}=require("uuid");
const crypto=require("crypto");
const db=require("../config/db");
const logger=require("../config/logger");
const audit=require("../services/auditService");
const {authenticate}=require("../middleware/auth");
const validate=require("../middleware/validate");
const schemas=require("../middleware/schemas");
const router=express.Router();
const HOURS=parseInt(process.env.SESSION_EXPIRY_HOURS)||8;

// ── Failed login tracking (in-memory) ────────────────────────
// Resists brute-force without requiring schema changes.
// Resets on server restart — acceptable for lockout protection.
const MAX_FAILED=parseInt(process.env.LOGIN_MAX_FAILED)||5;
const LOCKOUT_MINUTES=parseInt(process.env.LOGIN_LOCKOUT_MINUTES)||15;
const failedLogins=new Map(); // key: username, value: { count, lockedUntil }

function recordFailedLogin(username){
  const entry=failedLogins.get(username)||{count:0,lockedUntil:null};
  entry.count++;
  if(entry.count>=MAX_FAILED){
    entry.lockedUntil=Date.now()+LOCKOUT_MINUTES*60*1000;
    logger.warn(`Account locked: ${username} (${MAX_FAILED} failed attempts, lockout ${LOCKOUT_MINUTES}m)`);
  }
  failedLogins.set(username,entry);
}

function isLocked(username){
  const entry=failedLogins.get(username);
  if(!entry) return false;
  if(entry.lockedUntil&&entry.lockedUntil>Date.now()) return true;
  // Lockout expired — reset
  if(entry.lockedUntil&&entry.lockedUntil<=Date.now()){
    failedLogins.delete(username);
  }
  return false;
}

function clearFailedLogins(username){
  failedLogins.delete(username);
}

// ── Login ─────────────────────────────────────────────────────
router.post("/login",validate(schemas.login),async(req,res,next)=>{
  try{
    const {username,password}=req.body;
    if(!username||!password) return res.status(400).json({error:"Username and password required"});

    // Check account lockout
    if(isLocked(username)){
      logger.warn(`Login blocked (locked account): ${username}`);
      return res.status(429).json({error:`Account temporarily locked. Try again in ${LOCKOUT_MINUTES} minutes.`});
    }

    const [rows]=await db.execute("SELECT * FROM users WHERE username=? AND is_active=1",[username]);
    if(!rows.length){
      recordFailedLogin(username);
      return res.status(401).json({error:"Invalid credentials"});
    }
    const user=rows[0];
    if(!await bcrypt.compare(password,user.password_hash)){
      recordFailedLogin(username);
      const remaining=MAX_FAILED-(failedLogins.get(username)?.count||0);
      if(remaining<=0){
        return res.status(429).json({error:`Account locked after ${MAX_FAILED} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`});
      }
      return res.status(401).json({error:"Invalid credentials"});
    }

    // Successful login — clear failed attempts
    clearFailedLogins(username);

    // Invalidate any existing sessions for this user (session fixation protection)
    await db.execute("DELETE FROM sessions WHERE user_id=?",[user.id]);

    // Create new session with cryptographically secure token
    const token=uuidv4();
    const exp=new Date(Date.now()+HOURS*3600000);
    await db.execute("INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)",[token,user.id,exp]);

    // Prune expired sessions
    await db.execute("DELETE FROM sessions WHERE expires_at<NOW()");

    // Get zone if leader
    let zone=null;
    if(user.role==="leader"){
      const [zrows]=await db.execute(
        "SELECT sz.id,sz.name,sz.kebele_id,k.name AS kebele_name FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id WHERE sz.leader_id=?",
        [user.id]);
      if(zrows.length) zone=zrows[0];
    }
    logger.info(`Login: ${username} (${user.role})`);
    req._auditUserId=user.id;
    audit.log(req,"LOGIN","session",null,null,{username:user.username,role:user.role});
    res.json({token,user:{id:user.id,username:user.username,fullName:user.full_name,role:user.role,phone:user.phone,zone}});
  }catch(err){next(err);}
});

// ── Logout — invalidate session ───────────────────────────────
router.post("/logout",authenticate,async(req,res,next)=>{
  try{
    const token=req.headers["x-session-token"]||req.headers["authorization"]?.replace("Bearer ","");
    await db.execute("DELETE FROM sessions WHERE id=?",[token]);
    logger.info(`Logout: ${req.user.username}`);
    audit.log(req,"LOGOUT","session",null,null,{username:req.user.username});
    res.json({message:"Logged out"});
  }catch(err){next(err);}
});

// ── Current user ──────────────────────────────────────────────
router.get("/me",authenticate,async(req,res)=>{
  const u=req.user;
  let zone=null;
  if(u.role==="leader"){
    const [zr]=await db.execute(
      "SELECT sz.id,sz.name,sz.kebele_id,k.name AS kebele_name FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id WHERE sz.leader_id=?",
      [u.id]);
    if(zr.length) zone=zr[0];
  }
  res.json({id:u.id,username:u.username,fullName:u.full_name,role:u.role,zone});
});

module.exports=router;
