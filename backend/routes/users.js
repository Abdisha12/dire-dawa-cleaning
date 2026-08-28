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

router.post("/",requireRole("admin"),validate(schemas.createUser),async(req,res,next)=>{
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

router.put("/:id",requireRole("admin"),validate(schemas.updateUser),async(req,res,next)=>{
  try{
    const {fullName,faydaId,phone,role,isActive}=req.body;
    const [old]=await db.execute("SELECT full_name,fayda_id,phone,role,is_active FROM users WHERE id=?",[req.params.id]);
    await db.execute("UPDATE users SET full_name=?,fayda_id=?,phone=?,role=?,is_active=? WHERE id=?",
      [fullName,faydaId||null,phone||null,role,isActive?1:0,req.params.id]);
    audit.log(req,"UPDATE","user",parseInt(req.params.id),old[0]||null,{fullName,faydaId,phone,role,isActive});
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.put("/:id/password",validate(schemas.changePassword),async(req,res,next)=>{
  try{
    const tid=parseInt(req.params.id);
    const isAdmin=req.user.role==="admin";
    const isSelf=req.user.id===tid;

    // Non-admins can only change their own password
    if(!isAdmin && !isSelf) return res.status(403).json({error:"Forbidden"});

    const {currentPassword,newPassword,confirmPassword}=req.body;
    if(!newPassword) return res.status(400).json({error:"New password required"});

    // Require current password for self-changes (admin resetting others is the only exception)
    if(isSelf) {
      if(!currentPassword) return res.status(400).json({error:"Current password required"});
      const [[user]]=await db.execute("SELECT password_hash FROM users WHERE id=?",[tid]);
      if(!user) return res.status(404).json({error:"User not found"});
      const match=await bcrypt.compare(currentPassword,user.password_hash);
      if(!match) return res.status(403).json({error:"Current password is incorrect"});
    }

    // Password validation
    if(newPassword.length<8) return res.status(400).json({error:"Min 8 characters"});
    if(!/[a-zA-Z]/.test(newPassword)) return res.status(400).json({error:"Must contain at least one letter"});
    if(!/[0-9]/.test(newPassword)) return res.status(400).json({error:"Must contain at least one number"});
    if(confirmPassword && newPassword!==confirmPassword) return res.status(400).json({error:"Passwords do not match"});

    await db.execute("UPDATE users SET password_hash=? WHERE id=?",[await bcrypt.hash(newPassword,10),tid]);
    audit.log(req,"PASSWORD_CHANGE","user",tid,null,{targetUserId:tid,adminReset:!isSelf&&isAdmin});
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
