const express=require("express");
const bcrypt=require("bcryptjs");
const db=require("../config/db");
const audit=require("../services/auditService");
const {authenticate,requireRole}=require("../middleware/auth");
const router=express.Router();
router.use(authenticate);

router.get("/",requireRole("admin","collector"),async(req,res,next)=>{
  try{
    const {role}=req.query;
    let sql="SELECT id,username,full_name,fayda_id,phone,role,is_active,created_at FROM users WHERE 1=1";
    const params=[];
    if(role){sql+=" AND role=?";params.push(role);}
    sql+=" ORDER BY role,full_name";
    const [rows]=await db.execute(sql,params);
    res.json(rows);
  }catch(err){next(err);}
});

// Get all leaders (for assigning to zones)
router.get("/leaders",requireRole("admin","collector"),async(req,res,next)=>{
  try{
    const [rows]=await db.execute(
      `SELECT u.id,u.username,u.full_name,u.phone,
              sz.id AS zone_id, sz.name AS zone_name, k.name AS kebele_name
       FROM users u
       LEFT JOIN safer_zones sz ON sz.leader_id=u.id
       LEFT JOIN kebeles k ON k.id=sz.kebele_id
       WHERE u.role="leader" AND u.is_active=1
       ORDER BY u.full_name`);
    res.json(rows);
  }catch(err){next(err);}
});

router.post("/",requireRole("admin"),async(req,res,next)=>{
  try{
    const {username,password,fullName,faydaId,phone,role}=req.body;
    if(!username||!password||!fullName||!role) return res.status(400).json({error:"username,password,fullName,role required"});
    const hash=await bcrypt.hash(password,10);
    const [r]=await db.execute(
      "INSERT INTO users (username,password_hash,full_name,fayda_id,phone,role) VALUES (?,?,?,?,?,?)",
      [username,hash,fullName,faydaId||null,phone||null,role]);
    audit.log(req,"CREATE","user",r.insertId,null,{username,fullName,role});
    res.status(201).json({id:r.insertId,username,fullName,role});
  }catch(err){
    if(err.code==="ER_DUP_ENTRY") return res.status(409).json({error:"Username or Fayda ID already exists"});
    next(err);
  }
});

router.put("/:id",requireRole("admin"),async(req,res,next)=>{
  try{
    const {fullName,faydaId,phone,role,isActive}=req.body;
    const [old]=await db.execute("SELECT full_name,fayda_id,phone,role,is_active FROM users WHERE id=?",[req.params.id]);
    await db.execute("UPDATE users SET full_name=?,fayda_id=?,phone=?,role=?,is_active=? WHERE id=?",
      [fullName,faydaId||null,phone||null,role,isActive?1:0,req.params.id]);
    audit.log(req,"UPDATE","user",parseInt(req.params.id),old[0]||null,{fullName,faydaId,phone,role,isActive});
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.put("/:id/password",async(req,res,next)=>{
  try{
    const tid=parseInt(req.params.id);
    if(req.user.role!=="admin"&&req.user.id!==tid) return res.status(403).json({error:"Forbidden"});
    const {password}=req.body;
    if(!password||password.length<6) return res.status(400).json({error:"Min 6 characters"});
    await db.execute("UPDATE users SET password_hash=? WHERE id=?",[await bcrypt.hash(password,10),tid]);
    audit.log(req,"PASSWORD_CHANGE","user",tid,null,{targetUserId:tid});
    res.json({message:"Password updated"});
  }catch(err){next(err);}
});

router.delete("/:id",requireRole("admin"),async(req,res,next)=>{
  try{
    if(parseInt(req.params.id)===req.user.id) return res.status(400).json({error:"Cannot delete yourself"});
    const [old]=await db.execute("SELECT username,full_name,role FROM users WHERE id=?",[req.params.id]);
    await db.execute("DELETE FROM users WHERE id=?",[req.params.id]);
    audit.log(req,"DELETE","user",parseInt(req.params.id),old[0]||null,null);
    res.json({message:"Deleted"});
  }catch(err){next(err);}
});

module.exports=router;
