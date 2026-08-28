const express=require("express");
const db=require("../config/db");
const audit=require("../services/auditService");
const {authenticate,requireRole}=require("../middleware/auth");
const validate=require("../middleware/validate");
const schemas=require("../middleware/schemas");
const router=express.Router();
router.use(authenticate);

// ── State machine: valid transitions ──────────────────────────
const VALID_TRANSITIONS = {
  draft:     ["submitted"],
  submitted: ["reviewed"],
  reviewed:  ["approved"],
};

function canTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

const ROLE_TRANSITIONS = {
  draft_to_submitted: ["admin", "collector", "leader"],
  submitted_to_reviewed: ["admin", "collector"],
  reviewed_to_approved: ["admin"],
};

// Leader submits, collector reviews
router.get("/",async(req,res,next)=>{
  try{
    const {month,year,status,zoneId}=req.query;
    let sql=`SELECT zr.*,sz.name AS zone_name,k.name AS kebele_name,
                    u.full_name AS leader_name,r.full_name AS reviewer_name
             FROM zone_reports zr
             JOIN safer_zones sz ON sz.id=zr.safer_zone_id
             JOIN kebeles k ON k.id=sz.kebele_id
             JOIN users u ON u.id=zr.submitted_by
             LEFT JOIN users r ON r.id=zr.reviewed_by
             WHERE 1=1`;
    const params=[];
    let paramIdx=1;
    if(req.user.role==="leader"){sql+=` AND sz.leader_id=$${paramIdx}`;params.push(req.user.id);paramIdx++;}
    else if(zoneId){sql+=` AND zr.safer_zone_id=$${paramIdx}`;params.push(zoneId);paramIdx++;}
    if(month){sql+=` AND zr.report_month=$${paramIdx}`;params.push(month);paramIdx++;}
    if(year){sql+=` AND zr.report_year=$${paramIdx}`;params.push(year);paramIdx++;}
    if(status){sql+=` AND zr.status=$${paramIdx}`;params.push(status);paramIdx++;}
    sql+=" ORDER BY zr.report_date DESC";
    const result=await db.query(sql,params);
    res.json(result.rows);
  }catch(err){next(err);}
});

router.get("/:id",async(req,res,next)=>{
  try{
    const result=await db.query(
      `SELECT zr.*,sz.name AS zone_name,k.name AS kebele_name,
              u.full_name AS leader_name,r.full_name AS reviewer_name
       FROM zone_reports zr JOIN safer_zones sz ON sz.id=zr.safer_zone_id
       JOIN kebeles k ON k.id=sz.kebele_id JOIN users u ON u.id=zr.submitted_by
       LEFT JOIN users r ON r.id=zr.reviewed_by WHERE zr.id=$1`,[req.params.id]);
    if(!result.rows.length) return res.status(404).json({error:"Not found"});
    res.json(result.rows[0]);
  }catch(err){next(err);}
});

// Leader creates/submits report for their zone
router.post("/",requireRole("admin","collector","leader"),validate(schemas.createZoneReport),async(req,res,next)=>{
  try{
    const {saferZoneId,reportDate,reportMonth,reportYear,workersPresent,workersAbsent,
           collectionTotal,issuesReported,actionsTaken,toolsStatus}=req.body;
    if(!saferZoneId||!reportDate) return res.status(400).json({error:"saferZoneId and reportDate required"});
    if(req.user.role==="leader"){
      const zr=await db.query("SELECT id FROM safer_zones WHERE id=$1 AND leader_id=$2",[saferZoneId,req.user.id]);
      if(!zr.rows.length) return res.status(403).json({error:"Not your zone"});
    }
    const month=reportMonth||new Date(reportDate).getMonth()+1;
    const year=reportYear||new Date(reportDate).getFullYear();
    const r=await db.query(
      `INSERT INTO zone_reports
       (safer_zone_id,report_date,report_month,report_year,submitted_by,status,
        workers_present,workers_absent,collection_total,issues_reported,actions_taken,tools_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [saferZoneId,reportDate,month,year,req.user.id,"draft",
       workersPresent||0,workersAbsent||0,collectionTotal||0,
       issuesReported||null,actionsTaken||null,toolsStatus||null]);
    const insertedId=r.rows[0].id;
    audit.log(req,"CREATE","zone_report",insertedId,null,{saferZoneId,reportDate,status:"draft",workersPresent,workersAbsent,collectionTotal});
    res.status(201).json({id:insertedId,status:"draft"});
  }catch(err){
    if(err.code==="23505") return res.status(409).json({error:"A report already exists for this zone/month/year"});
    next(err);
  }
});

router.put("/:id",requireRole("admin","collector","leader"),validate(schemas.updateZoneReport),async(req,res,next)=>{
  try{
    const {workersPresent,workersAbsent,collectionTotal,issuesReported,actionsTaken,toolsStatus,status}=req.body;
    if(req.user.role==="leader"){
      const check=await db.query(
        `SELECT zr.id FROM zone_reports zr JOIN safer_zones sz ON sz.id=zr.safer_zone_id
         WHERE zr.id=$1 AND sz.leader_id=$2`,[req.params.id,req.user.id]);
      if(!check.rows.length) return res.status(403).json({error:"Not your zone's report"});
    }

    const currentResult=await db.query("SELECT status FROM zone_reports WHERE id=$1",[req.params.id]);
    const current=currentResult.rows[0];
    if(!current) return res.status(404).json({error:"Report not found"});

    let newStatus = current.status;
    if(status && status !== current.status) {
      if(!canTransition(current.status, status)) {
        return res.status(400).json({
          error:`Invalid transition: ${current.status} → ${status}. Allowed: ${VALID_TRANSITIONS[current.status]?.join(", ")||"none"}`
        });
      }
      const transitionKey=`${current.status}_to_${status}`;
      const allowedRoles=ROLE_TRANSITIONS[transitionKey];
      if(allowedRoles && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({error:`Role '${req.user.role}' cannot transition from ${current.status} to ${status}`});
      }
      newStatus = status;
    }

    await db.query(
      `UPDATE zone_reports SET workers_present=$1,workers_absent=$2,collection_total=$3,
       issues_reported=$4,actions_taken=$5,tools_status=$6,status=$7 WHERE id=$8`,
      [workersPresent,workersAbsent,collectionTotal,issuesReported||null,actionsTaken||null,toolsStatus||null,newStatus,req.params.id]);
    audit.log(req,"UPDATE","zone_report",parseInt(req.params.id),{status:current.status},{workersPresent,workersAbsent,collectionTotal,status:newStatus});
    res.json({message:"Updated",status:newStatus});
  }catch(err){next(err);}
});

// Collector reviews / approves report
router.put("/:id/review",requireRole("admin","collector"),validate(schemas.reviewZoneReport),async(req,res,next)=>{
  try{
    const {status,reviewerNotes}=req.body;
    if(!["reviewed","approved"].includes(status))
      return res.status(400).json({error:"status must be reviewed or approved"});

    const currentResult=await db.query("SELECT status FROM zone_reports WHERE id=$1",[req.params.id]);
    const current=currentResult.rows[0];
    if(!current) return res.status(404).json({error:"Report not found"});

    if(!canTransition(current.status, status)) {
      return res.status(400).json({
        error:`Invalid transition: ${current.status} → ${status}. Allowed: ${VALID_TRANSITIONS[current.status]?.join(", ")||"none"}`
      });
    }

    const transitionKey=`${current.status}_to_${status}`;
    const allowedRoles=ROLE_TRANSITIONS[transitionKey];
    if(allowedRoles && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({error:`Role '${req.user.role}' cannot transition from ${current.status} to ${status}`});
    }

    await db.query(
      "UPDATE zone_reports SET status=$1,reviewed_by=$2,reviewed_at=NOW(),reviewer_notes=$3 WHERE id=$4",
      [status,req.user.id,reviewerNotes||null,req.params.id]);
    audit.log(req,"APPROVE","zone_report",parseInt(req.params.id),{status:current.status},{status,reviewerNotes});
    res.json({message:`Report ${status}`});
  }catch(err){next(err);}
});

router.delete("/:id",requireRole("admin"),async(req,res,next)=>{
  try{
    const oldResult=await db.query("SELECT safer_zone_id,report_date,status FROM zone_reports WHERE id=$1",[req.params.id]);
    await db.query("DELETE FROM zone_reports WHERE id=$1",[req.params.id]);
    audit.log(req,"DELETE","zone_report",parseInt(req.params.id),oldResult.rows[0]||null,null);
    res.json({message:"Deleted"});
  }catch(err){next(err);}
});

module.exports=router;
