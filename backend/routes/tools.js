const express=require("express");
const db=require("../config/db");
const {authenticate,requireRole}=require("../middleware/auth");
const validate=require("../middleware/validate");
const schemas=require("../middleware/schemas");
const router=express.Router();
router.use(authenticate);

// ── Tools ────────────────────────────────────────────────────
router.get("/",async(req,res,next)=>{
  try{
    const {zoneId}=req.query;
    let sql=`SELECT t.*,sz.name AS zone_name,k.name AS kebele_name
             FROM tools t JOIN safer_zones sz ON sz.id=t.safer_zone_id
             JOIN kebeles k ON k.id=sz.kebele_id WHERE 1=1`;
    const params=[];
    let paramIdx=1;
    if(req.user.role==="leader"){sql+=` AND sz.leader_id=$${paramIdx}`;params.push(req.user.id);paramIdx++;}
    else if(zoneId){sql+=` AND t.safer_zone_id=$${paramIdx}`;params.push(zoneId);paramIdx++;}
    sql+=" ORDER BY t.category,t.name";
    const result=await db.query(sql,params);
    res.json(result.rows);
  }catch(err){next(err);}
});

router.post("/",requireRole("admin","collector","leader"),validate(schemas.createTool),async(req,res,next)=>{
  try{
    const {name,category,quantity,conditionStatus,saferZoneId,notes,acquiredDate}=req.body;
    if(!name||!saferZoneId) return res.status(400).json({error:"name and saferZoneId required"});
    if(req.user.role==="leader"){
      const zr=await db.query("SELECT id FROM safer_zones WHERE id=$1 AND leader_id=$2",[saferZoneId,req.user.id]);
      if(!zr.rows.length) return res.status(403).json({error:"Not your zone"});
    }
    const r=await db.query(
      "INSERT INTO tools (name,category,quantity,condition_status,safer_zone_id,notes,acquired_date) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [name,category||"equipment",quantity||1,conditionStatus||"good",saferZoneId,notes||null,acquiredDate||null]);
    res.status(201).json({id:r.rows[0].id});
  }catch(err){next(err);}
});

router.put("/:id",requireRole("admin","collector","leader"),validate(schemas.updateTool),async(req,res,next)=>{
  try{
    const {name,category,quantity,conditionStatus,notes}=req.body;
    if(req.user.role==="leader"){
      const check=await db.query(
        "SELECT t.id FROM tools t JOIN safer_zones sz ON sz.id=t.safer_zone_id WHERE t.id=$1 AND sz.leader_id=$2",
        [req.params.id,req.user.id]);
      if(!check.rows.length) return res.status(403).json({error:"Not your zone's tool"});
    }
    await db.query("UPDATE tools SET name=$1,category=$2,quantity=$3,condition_status=$4,notes=$5 WHERE id=$6",
      [name,category,quantity,conditionStatus,notes||null,req.params.id]);
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.delete("/:id",requireRole("admin","collector"),async(req,res,next)=>{
  try{await db.query("DELETE FROM tools WHERE id=$1",[req.params.id]);res.json({message:"Deleted"});}
  catch(err){next(err);}
});

module.exports=router;
