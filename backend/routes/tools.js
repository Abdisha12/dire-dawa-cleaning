const express=require("express");
const db=require("../config/db");
const {authenticate,requireRole}=require("../middleware/auth");
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
    if(req.user.role==="leader"){sql+=" AND sz.leader_id=?";params.push(req.user.id);}
    else if(zoneId){sql+=" AND t.safer_zone_id=?";params.push(zoneId);}
    sql+=" ORDER BY t.category,t.name";
    const [rows]=await db.execute(sql,params);
    res.json(rows);
  }catch(err){next(err);}
});

router.post("/",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {name,category,quantity,conditionStatus,saferZoneId,notes,acquiredDate}=req.body;
    if(!name||!saferZoneId) return res.status(400).json({error:"name and saferZoneId required"});
    if(req.user.role==="leader"){
      const [zr]=await db.execute("SELECT id FROM safer_zones WHERE id=? AND leader_id=?",[saferZoneId,req.user.id]);
      if(!zr.length) return res.status(403).json({error:"Not your zone"});
    }
    const [r]=await db.execute(
      "INSERT INTO tools (name,category,quantity,condition_status,safer_zone_id,notes,acquired_date) VALUES (?,?,?,?,?,?,?)",
      [name,category||"equipment",quantity||1,conditionStatus||"good",saferZoneId,notes||null,acquiredDate||null]);
    res.status(201).json({id:r.insertId});
  }catch(err){next(err);}
});

router.put("/:id",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {name,category,quantity,conditionStatus,notes}=req.body;
    // Leader can only edit tools in their own zone
    if(req.user.role==="leader"){
      const [check]=await db.execute(
        "SELECT t.id FROM tools t JOIN safer_zones sz ON sz.id=t.safer_zone_id WHERE t.id=? AND sz.leader_id=?",
        [req.params.id,req.user.id]);
      if(!check.length) return res.status(403).json({error:"Not your zone's tool"});
    }
    await db.execute("UPDATE tools SET name=?,category=?,quantity=?,condition_status=?,notes=? WHERE id=?",
      [name,category,quantity,conditionStatus,notes||null,req.params.id]);
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.delete("/:id",requireRole("admin","collector"),async(req,res,next)=>{
  try{await db.execute("DELETE FROM tools WHERE id=?",[req.params.id]);res.json({message:"Deleted"});}
  catch(err){next(err);}
});

module.exports=router;
