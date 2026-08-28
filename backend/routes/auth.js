const express=require("express");
const bcrypt=require("bcryptjs");
const {v4:uuidv4}=require("uuid");
const db=require("../config/db");
const logger=require("../config/logger");
const audit=require("../services/auditService");
const {authenticate}=require("../middleware/auth");
const router=express.Router();
const HOURS=parseInt(process.env.SESSION_EXPIRY_HOURS)||8;

router.post("/login",async(req,res,next)=>{
  try{
    const {username,password}=req.body;
    if(!username||!password) return res.status(400).json({error:"Username and password required"});
    const [rows]=await db.execute("SELECT * FROM users WHERE username=? AND is_active=1",[username]);
    if(!rows.length) return res.status(401).json({error:"Invalid credentials"});
    const user=rows[0];
    if(!await bcrypt.compare(password,user.password_hash)) return res.status(401).json({error:"Invalid credentials"});
    const token=uuidv4();
    const exp=new Date(Date.now()+HOURS*3600000);
    await db.execute("INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)",[token,user.id,exp]);
    // Prune expired sessions to keep the table clean
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

router.post("/logout",authenticate,async(req,res,next)=>{
  try{
    const token=req.headers["x-session-token"]||req.headers["authorization"]?.replace("Bearer ","");
    await db.execute("DELETE FROM sessions WHERE id=?",[token]);
    res.json({message:"Logged out"});
  }catch(err){next(err);}
});

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
