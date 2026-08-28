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
    const result=await db.query(
      `SELECT k.*,u.full_name AS collector_name,u.phone AS collector_phone,
              COUNT(sz.id) AS zone_count
       FROM kebeles k
       LEFT JOIN users u ON u.id=k.collector_id
       LEFT JOIN safer_zones sz ON sz.kebele_id=k.id
       GROUP BY k.id ORDER BY k.code`);
    res.json(result.rows);
  }catch(err){next(err);}
});

router.put("/kebeles/:id",requireRole("admin"),validate(schemas.updateKebele),async(req,res,next)=>{
  try{
    const {collectorId}=req.body;
    await db.query("UPDATE kebeles SET collector_id=$1 WHERE id=$2",[collectorId||null,req.params.id]);
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

// ── Safer Zones ───────────────────────────────────────────────
router.get("/safer-zones",async(req,res,next)=>{
  try{
    const {kebeleId}=req.query;
    if(req.user.role==="leader"){
      const result=await db.query(
        `SELECT sz.*,k.name AS kebele_name,k.code AS kebele_code,
                u.full_name AS leader_name,u.phone AS leader_phone,
                (SELECT COUNT(*) FROM workers w WHERE w.safer_zone_id=sz.id) AS worker_count,
                (SELECT COUNT(*) FROM tools t WHERE t.safer_zone_id=sz.id) AS tool_count
         FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id
         LEFT JOIN users u ON u.id=sz.leader_id
         WHERE sz.leader_id=$1`,[req.user.id]);
      return res.json(result.rows);
    }
    let sql=`SELECT sz.*,k.name AS kebele_name,k.code AS kebele_code,
                    u.full_name AS leader_name,u.phone AS leader_phone,
                    (SELECT COUNT(*) FROM workers w WHERE w.safer_zone_id=sz.id) AS worker_count,
                    (SELECT COUNT(*) FROM tools t WHERE t.safer_zone_id=sz.id) AS tool_count
             FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id
             LEFT JOIN users u ON u.id=sz.leader_id WHERE 1=1`;
    const params=[];
    let paramIdx=1;
    if(kebeleId){sql+=` AND sz.kebele_id=$${paramIdx}`;params.push(kebeleId);paramIdx++;}
    sql+=" ORDER BY k.code,sz.name";
    const result=await db.query(sql,params);
    res.json(result.rows);
  }catch(err){next(err);}
});

router.get("/safer-zones/:id",async(req,res,next)=>{
  try{
    const result=await db.query(
      `SELECT sz.*,k.name AS kebele_name,k.code AS kebele_code,
              u.full_name AS leader_name,u.phone AS leader_phone
       FROM safer_zones sz JOIN kebeles k ON k.id=sz.kebele_id
       LEFT JOIN users u ON u.id=sz.leader_id WHERE sz.id=$1`,[req.params.id]);
    if(!result.rows.length) return res.status(404).json({error:"Not found"});
    res.json(result.rows[0]);
  }catch(err){next(err);}
});

router.post("/safer-zones",requireRole("admin"),validate(schemas.createZone),async(req,res,next)=>{
  try{
    const {name,kebeleId,leaderId,description}=req.body;
    if(!name||!kebeleId) return res.status(400).json({error:"name and kebeleId required"});
    if(leaderId){
      await db.query("UPDATE safer_zones SET leader_id=NULL WHERE leader_id=$1",[leaderId]);
    }
    const r=await db.query(
      "INSERT INTO safer_zones (name,kebele_id,leader_id,description) VALUES ($1,$2,$3,$4) RETURNING id",
      [name,kebeleId,leaderId||null,description||null]);
    res.status(201).json({id:r.rows[0].id,name,kebeleId});
  }catch(err){
    if(err.code==="23505") return res.status(409).json({error:"Zone already exists in this kebele"});
    next(err);
  }
});

router.put("/safer-zones/:id",requireRole("admin"),validate(schemas.updateZone),async(req,res,next)=>{
  try{
    const {name,leaderId,description}=req.body;
    if(leaderId){
      await db.query("UPDATE safer_zones SET leader_id=NULL WHERE leader_id=$1 AND id!=$2",[leaderId,req.params.id]);
    }
    await db.query("UPDATE safer_zones SET name=$1,leader_id=$2,description=$3 WHERE id=$4",
      [name,leaderId||null,description||null,req.params.id]);
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.delete("/safer-zones/:id",requireRole("admin"),async(req,res,next)=>{
  try{await db.query("DELETE FROM safer_zones WHERE id=$1",[req.params.id]);res.json({message:"Deleted"});}
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
    let paramIdx=1;
    const {saferZoneId,kebeleId}=req.query;
    if(req.user.role==="leader"){
      sql+=` AND sz.leader_id=$${paramIdx}`; params.push(req.user.id); paramIdx++;
    } else {
      if(saferZoneId){sql+=` AND b.safer_zone_id=$${paramIdx}`;params.push(saferZoneId);paramIdx++;}
      if(kebeleId){sql+=` AND k.id=$${paramIdx}`;params.push(kebeleId);paramIdx++;}
    }
    sql+=" ORDER BY k.code,sz.name,b.name";
    const result=await db.query(sql,params);
    res.json(result.rows);
  }catch(err){next(err);}
});

router.get("/businesses/:id",async(req,res,next)=>{
  try{
    const result=await db.query(
      `SELECT b.*,sz.name AS safer_zone_name,k.name AS kebele_name,k.id AS kebele_id
       FROM businesses b JOIN safer_zones sz ON sz.id=b.safer_zone_id JOIN kebeles k ON k.id=sz.kebele_id
       WHERE b.id=$1`,[req.params.id]);
    if(!result.rows.length) return res.status(404).json({error:"Not found"});
    res.json(result.rows[0]);
  }catch(err){next(err);}
});

router.post("/businesses",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {name,ownerName,ownerFaydaId,ownerPhone,type,monthlyTarget,saferZoneId,notes}=req.body;
    if(!name||!ownerName||!saferZoneId) return res.status(400).json({error:"name,ownerName,saferZoneId required"});
    if(req.user.role==="leader"){
      const zr=await db.query("SELECT id FROM safer_zones WHERE id=$1 AND leader_id=$2",[saferZoneId,req.user.id]);
      if(!zr.rows.length) return res.status(403).json({error:"Not your zone"});
    }
    const r=await db.query(
      "INSERT INTO businesses (name,owner_name,owner_fayda_id,owner_phone,type,monthly_target,safer_zone_id,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
      [name,ownerName,ownerFaydaId||null,ownerPhone||null,type||"shop",monthlyTarget||0,saferZoneId,notes||null]);
    res.status(201).json({id:r.rows[0].id});
  }catch(err){next(err);}
});

router.put("/businesses/:id",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {name,ownerName,ownerFaydaId,ownerPhone,type,monthlyTarget,saferZoneId,isActive,notes}=req.body;
    await db.query(
      "UPDATE businesses SET name=$1,owner_name=$2,owner_fayda_id=$3,owner_phone=$4,type=$5,monthly_target=$6,safer_zone_id=$7,is_active=$8,notes=$9 WHERE id=$10",
      [name,ownerName,ownerFaydaId||null,ownerPhone||null,type,monthlyTarget,saferZoneId,isActive,notes||null,req.params.id]);
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.delete("/businesses/:id",requireRole("admin"),async(req,res,next)=>{
  try{await db.query("DELETE FROM businesses WHERE id=$1",[req.params.id]);res.json({message:"Deleted"});}
  catch(err){next(err);}
});

module.exports=router;
