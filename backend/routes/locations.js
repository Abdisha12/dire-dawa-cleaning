const express=require("express");
const db=require("../config/db");
const {authenticate,requireRole}=require("../middleware/auth");
const validate=require("../middleware/validate");
const schemas=require("../middleware/schemas");
const router=express.Router();
router.use(authenticate);

// ── Kebeles ──────────────────────────────────────────────────
router.get("/kebeles",async(req,res,next)=>{
  try{
    const [rows]=await db.execute(
      `SELECT k.*,u.full_name AS collector_name,u.phone AS collector_phone,
              COUNT(sz.id) AS zone_count
       FROM kebeles k
       LEFT JOIN users u ON u.id=k.collector_id
       LEFT JOIN safer_zones sz ON sz.kebele_id=k.id
       GROUP BY k.id ORDER BY k.code`);
    res.json(rows);
  }catch(err){next(err);}
});

router.put("/kebeles/:id",requireRole("admin"),validate(schemas.updateKebele),async(req,res,next)=>{
  try{
    const {collectorId}=req.body;
    await db.execute("UPDATE kebeles SET collector_id=? WHERE id=?",[collectorId||null,req.params.id]);
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

// ── Safer Zones ───────────────────────────────────────────────
router.get("/safer-zones",async(req,res,next)=>{
  try{
    const {kebeleId}=req.query;
    // leaders only see their own zone
    if(req.user.role==="leader"){
      const [rows]=await db.execute(
        `SELECT sz.*,k.name AS kebele_name,k.code AS kebele_code,
                u.full_name AS leader_name,u.phone AS leader_phone,
                (SELECT COUNT(*) FROM workers w WHERE w.safer_zone_id=sz.id) AS worker_count,
                (SELECT COUNT(*) FROM tools t WHERE t.safer_zone_id=sz.id) AS tool_count
         FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id
         LEFT JOIN users u ON u.id=sz.leader_id
         WHERE sz.leader_id=?`,[req.user.id]);
      return res.json(rows);
    }
    let sql=`SELECT sz.*,k.name AS kebele_name,k.code AS kebele_code,
                    u.full_name AS leader_name,u.phone AS leader_phone,
                    (SELECT COUNT(*) FROM workers w WHERE w.safer_zone_id=sz.id) AS worker_count,
                    (SELECT COUNT(*) FROM tools t WHERE t.safer_zone_id=sz.id) AS tool_count
             FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id
             LEFT JOIN users u ON u.id=sz.leader_id WHERE 1=1`;
    const params=[];
    if(kebeleId){sql+=" AND sz.kebele_id=?";params.push(kebeleId);}
    sql+=" ORDER BY k.code,sz.name";
    const [rows]=await db.execute(sql,params);
    res.json(rows);
  }catch(err){next(err);}
});

router.get("/safer-zones/:id",async(req,res,next)=>{
  try{
    const [rows]=await db.execute(
      `SELECT sz.*,k.name AS kebele_name,k.code AS kebele_code,
              u.full_name AS leader_name,u.phone AS leader_phone
       FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id
       LEFT JOIN users u ON u.id=sz.leader_id WHERE sz.id=?`,[req.params.id]);
    if(!rows.length) return res.status(404).json({error:"Not found"});
    res.json(rows[0]);
  }catch(err){next(err);}
});

router.post("/safer-zones",requireRole("admin"),validate(schemas.createZone),async(req,res,next)=>{
  try{
    const {name,kebeleId,leaderId,description}=req.body;
    if(!name||!kebeleId) return res.status(400).json({error:"name and kebeleId required"});
    // unassign leader from previous zone first
    if(leaderId){
      await db.execute("UPDATE safer_zones SET leader_id=NULL WHERE leader_id=?",[leaderId]);
    }
    const [r]=await db.execute(
      "INSERT INTO safer_zones (name,kebele_id,leader_id,description) VALUES (?,?,?,?)",
      [name,kebeleId,leaderId||null,description||null]);
    res.status(201).json({id:r.insertId,name,kebeleId});
  }catch(err){
    if(err.code==="ER_DUP_ENTRY") return res.status(409).json({error:"Zone already exists in this kebele"});
    next(err);
  }
});

router.put("/safer-zones/:id",requireRole("admin"),validate(schemas.updateZone),async(req,res,next)=>{
  try{
    const {name,leaderId,description}=req.body;
    // unassign leader from other zone first
    if(leaderId){
      await db.execute("UPDATE safer_zones SET leader_id=NULL WHERE leader_id=? AND id!=?",[leaderId,req.params.id]);
    }
    await db.execute("UPDATE safer_zones SET name=?,leader_id=?,description=? WHERE id=?",
      [name,leaderId||null,description||null,req.params.id]);
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.delete("/safer-zones/:id",requireRole("admin"),async(req,res,next)=>{
  try{await db.execute("DELETE FROM safer_zones WHERE id=?",[req.params.id]);res.json({message:"Deleted"});}
  catch(err){next(err);}
});

// ── Businesses ────────────────────────────────────────────────
router.get("/businesses",async(req,res,next)=>{
  try{
    let sql=`SELECT b.*,sz.name AS safer_zone_name,k.name AS kebele_name,k.id AS kebele_id
             FROM businesses b
             JOIN safer_zones sz ON sz.id=b.safer_zone_id
             JOIN kebeles k ON k.id=sz.kebele_id WHERE 1=1`;
    const params=[];
    const {saferZoneId,kebeleId}=req.query;
    // leaders only see their zone
    if(req.user.role==="leader"){
      sql+=" AND sz.leader_id=?"; params.push(req.user.id);
    } else {
      if(saferZoneId){sql+=" AND b.safer_zone_id=?";params.push(saferZoneId);}
      if(kebeleId){sql+=" AND k.id=?";params.push(kebeleId);}
    }
    sql+=" ORDER BY k.code,sz.name,b.name";
    const [rows]=await db.execute(sql,params);
    res.json(rows);
  }catch(err){next(err);}
});

router.get("/businesses/:id",async(req,res,next)=>{
  try{
    const [rows]=await db.execute(
      `SELECT b.*,sz.name AS safer_zone_name,k.name AS kebele_name,k.id AS kebele_id
       FROM businesses b JOIN safer_zones sz ON sz.id=b.safer_zone_id JOIN kebeles k ON k.id=sz.kebele_id
       WHERE b.id=?`,[req.params.id]);
    if(!rows.length) return res.status(404).json({error:"Not found"});
    res.json(rows[0]);
  }catch(err){next(err);}
});

router.post("/businesses",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {name,ownerName,ownerFaydaId,ownerPhone,type,monthlyTarget,saferZoneId,notes}=req.body;
    if(!name||!ownerName||!saferZoneId) return res.status(400).json({error:"name,ownerName,saferZoneId required"});
    // leader can only add to own zone
    if(req.user.role==="leader"){
      const [zr]=await db.execute("SELECT id FROM safer_zones WHERE id=? AND leader_id=?",[saferZoneId,req.user.id]);
      if(!zr.length) return res.status(403).json({error:"Not your zone"});
    }
    const [r]=await db.execute(
      "INSERT INTO businesses (name,owner_name,owner_fayda_id,owner_phone,type,monthly_target,safer_zone_id,notes) VALUES (?,?,?,?,?,?,?,?)",
      [name,ownerName,ownerFaydaId||null,ownerPhone||null,type||"shop",monthlyTarget||0,saferZoneId,notes||null]);
    res.status(201).json({id:r.insertId});
  }catch(err){next(err);}
});

router.put("/businesses/:id",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {name,ownerName,ownerFaydaId,ownerPhone,type,monthlyTarget,saferZoneId,isActive,notes}=req.body;
    await db.execute(
      "UPDATE businesses SET name=?,owner_name=?,owner_fayda_id=?,owner_phone=?,type=?,monthly_target=?,safer_zone_id=?,is_active=?,notes=? WHERE id=?",
      [name,ownerName,ownerFaydaId||null,ownerPhone||null,type,monthlyTarget,saferZoneId,isActive?1:0,notes||null,req.params.id]);
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.delete("/businesses/:id",requireRole("admin"),async(req,res,next)=>{
  try{await db.execute("DELETE FROM businesses WHERE id=?",[req.params.id]);res.json({message:"Deleted"});}
  catch(err){next(err);}
});

module.exports=router;
