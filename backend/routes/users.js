const express=require("express");
const bcrypt=require("bcryptjs");
const db=require("../config/db");
const audit=require("../services/auditService");
const {authenticate,requireRole}=require("../middleware/auth");
const validate=require("../middleware/validate");
const schemas=require("../middleware/schemas");
const router=express.Router();
router.use(authenticate);

router.get("/",requireRole("admin","collector"),async(req,res,next)=>{
  try{
    const {role}=req.query;
    let sql="SELECT id,username,full_name,fayda_id,phone,role,is_active,created_at FROM users WHERE 1=1";
    const params=[];
    let paramIdx=1;
    if(role){sql+=` AND role=$${paramIdx}`;params.push(role);paramIdx++;}
    sql+=" ORDER BY role,full_name";
    const result=await db.query(sql,params);
    res.json(result.rows);
  }catch(err){next(err);}
});

// Get all leaders (for assigning to zones)
router.get("/leaders",requireRole("admin","collector"),async(req,res,next)=>{
  try{
    const result=await db.query(
      `SELECT u.id,u.username,u.full_name,u.phone,
              sz.id AS zone_id, sz.name AS zone_name, k.name AS kebele_name
       FROM users u
       LEFT JOIN safer_zones sz ON sz.leader_id=u.id
       LEFT JOIN kebeles k ON k.id=sz.kebele_id
       WHERE u.role='leader' AND u.is_active=TRUE
       ORDER BY u.full_name`);
    res.json(result.rows);
  }catch(err){next(err);}
});

router.post("/",requireRole("admin"),validate(schemas.createUser),async(req,res,next)=>{
  try{
    const {username,password,fullName,faydaId,phone,role}=req.body;
    if(!username||!password||!fullName||!role) return res.status(400).json({error:"username,password,fullName,role required"});
    const hash=await bcrypt.hash(password,10);
    const r=await db.query(
      "INSERT INTO users (username,password_hash,full_name,fayda_id,phone,role) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [username,hash,fullName,faydaId||null,phone||null,role]);
    const insertedId=r.rows[0].id;
    audit.log(req,"CREATE","user",insertedId,null,{username,fullName,role});
    res.status(201).json({id:insertedId,username,fullName,role});
  }catch(err){
    if(err.code==="23505") return res.status(409).json({error:"Username or Fayda ID already exists"});
    next(err);
  }
});

router.put("/:id",requireRole("admin"),validate(schemas.updateUser),async(req,res,next)=>{
  try{
    const {fullName,faydaId,phone,role,isActive}=req.body;
    const oldResult=await db.query("SELECT full_name,fayda_id,phone,role,is_active FROM users WHERE id=$1",[req.params.id]);
    await db.query("UPDATE users SET full_name=$1,fayda_id=$2,phone=$3,role=$4,is_active=$5 WHERE id=$6",
      [fullName,faydaId||null,phone||null,role,isActive,req.params.id]);
    audit.log(req,"UPDATE","user",parseInt(req.params.id),oldResult.rows[0]||null,{fullName,faydaId,phone,role,isActive});
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.put("/:id/password",validate(schemas.changePassword),async(req,res,next)=>{
  try{
    const tid=parseInt(req.params.id);
    const isAdmin=req.user.role==="admin";
    const isSelf=req.user.id===tid;

    if(!isAdmin && !isSelf) return res.status(403).json({error:"Forbidden"});

    const {currentPassword,newPassword,confirmPassword}=req.body;
    if(!newPassword) return res.status(400).json({error:"New password required"});

    if(isSelf) {
      if(!currentPassword) return res.status(400).json({error:"Current password required"});
      const userResult=await db.query("SELECT password_hash FROM users WHERE id=$1",[tid]);
      if(!userResult.rows.length) return res.status(404).json({error:"User not found"});
      const match=await bcrypt.compare(currentPassword,userResult.rows[0].password_hash);
      if(!match) return res.status(403).json({error:"Current password is incorrect"});
    }

    if(newPassword.length<8) return res.status(400).json({error:"Min 8 characters"});
    if(!/[a-zA-Z]/.test(newPassword)) return res.status(400).json({error:"Must contain at least one letter"});
    if(!/[0-9]/.test(newPassword)) return res.status(400).json({error:"Must contain at least one number"});
    if(confirmPassword && newPassword!==confirmPassword) return res.status(400).json({error:"Passwords do not match"});

    await db.query("UPDATE users SET password_hash=$1 WHERE id=$2",[await bcrypt.hash(newPassword,10),tid]);
    audit.log(req,"PASSWORD_CHANGE","user",tid,null,{targetUserId:tid,adminReset:!isSelf&&isAdmin});
    res.json({message:"Password updated"});
  }catch(err){next(err);}
});

router.delete("/:id",requireRole("admin"),async(req,res,next)=>{
  try{
    if(parseInt(req.params.id)===req.user.id) return res.status(400).json({error:"Cannot delete yourself"});
    const oldResult=await db.query("SELECT username,full_name,role FROM users WHERE id=$1",[req.params.id]);
    await db.query("DELETE FROM users WHERE id=$1",[req.params.id]);
    audit.log(req,"DELETE","user",parseInt(req.params.id),oldResult.rows[0]||null,null);
    res.json({message:"Deleted"});
  }catch(err){next(err);}
});

module.exports=router;
