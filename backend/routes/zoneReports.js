const express=require("express");
const db=require("../config/db");
const audit=require("../services/auditService");
const {authenticate,requireRole}=require("../middleware/auth");
const validate=require("../middleware/validate");
const schemas=require("../middleware/schemas");
const router=express.Router();
router.use(authenticate);

// ── State machine: valid transitions ──────────────────────────
// draft → submitted → reviewed → approved
// Only these transitions are allowed. Any other is rejected.
const VALID_TRANSITIONS = {
  draft:     ["submitted"],
  submitted: ["reviewed"],
  reviewed:  ["approved"],
};

function canTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Role-based transition permissions
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
    if(req.user.role==="leader"){sql+=" AND sz.leader_id=?";params.push(req.user.id);}
    else if(zoneId){sql+=" AND zr.safer_zone_id=?";params.push(zoneId);}
    if(month){sql+=" AND zr.report_month=?";params.push(month);}
    if(year){sql+=" AND zr.report_year=?";params.push(year);}
    if(status){sql+=" AND zr.status=?";params.push(status);}
    sql+=" ORDER BY zr.report_date DESC";
    const [rows]=await db.execute(sql,params);
    res.json(rows);
  }catch(err){next(err);}
});

router.get("/:id",async(req,res,next)=>{
  try{
    const [rows]=await db.execute(
      `SELECT zr.*,sz.name AS zone_name,k.name AS kebele_name,
              u.full_name AS leader_name,r.full_name AS reviewer_name
       FROM zone_reports zr JOIN safer_zones sz ON sz.id=zr.safer_zone_id
       JOIN kebeles k ON k.id=sz.kebele_id JOIN users u ON u.id=zr.submitted_by
       LEFT JOIN users r ON r.id=zr.reviewed_by WHERE zr.id=?`,[req.params.id]);
    if(!rows.length) return res.status(404).json({error:"Not found"});
    res.json(rows[0]);
  }catch(err){next(err);}
});

// Leader creates/submits report for their zone
router.post("/",requireRole("admin","collector","leader"),validate(schemas.createZoneReport),async(req,res,next)=>{
  try{
    const {saferZoneId,reportDate,reportMonth,reportYear,workersPresent,workersAbsent,
           collectionTotal,issuesReported,actionsTaken,toolsStatus}=req.body;
    if(!saferZoneId||!reportDate) return res.status(400).json({error:"saferZoneId and reportDate required"});
    if(req.user.role==="leader"){
      const [zr]=await db.execute("SELECT id FROM safer_zones WHERE id=? AND leader_id=?",[saferZoneId,req.user.id]);
      if(!zr.length) return res.status(403).json({error:"Not your zone"});
    }
    const month=reportMonth||new Date(reportDate).getMonth()+1;
    const year=reportYear||new Date(reportDate).getFullYear();
    // Always create as draft — status is set by server, not client
    const [r]=await db.execute(
      `INSERT INTO zone_reports
       (safer_zone_id,report_date,report_month,report_year,submitted_by,status,
        workers_present,workers_absent,collection_total,issues_reported,actions_taken,tools_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [saferZoneId,reportDate,month,year,req.user.id,"draft",
       workersPresent||0,workersAbsent||0,collectionTotal||0,
       issuesReported||null,actionsTaken||null,toolsStatus||null]);
    audit.log(req,"CREATE","zone_report",r.insertId,null,{saferZoneId,reportDate,status:"draft",workersPresent,workersAbsent,collectionTotal});
    res.status(201).json({id:r.insertId,status:"draft"});
  }catch(err){
    if(err.code==="ER_DUP_ENTRY") return res.status(409).json({error:"A report already exists for this zone/month/year"});
    next(err);
  }
});

router.put("/:id",requireRole("admin","collector","leader"),validate(schemas.updateZoneReport),async(req,res,next)=>{
  try{
    const {workersPresent,workersAbsent,collectionTotal,issuesReported,actionsTaken,toolsStatus,status}=req.body;
    // Leader can only update their own zone's report
    if(req.user.role==="leader"){
      const [check]=await db.execute(
        `SELECT zr.id FROM zone_reports zr JOIN safer_zones sz ON sz.id=zr.safer_zone_id
         WHERE zr.id=? AND sz.leader_id=?`,[req.params.id,req.user.id]);
      if(!check.length) return res.status(403).json({error:"Not your zone's report"});
    }

    // Fetch current status for state machine validation
    const [[current]]=await db.execute("SELECT status FROM zone_reports WHERE id=?",[req.params.id]);
    if(!current) return res.status(404).json({error:"Report not found"});

    // If client requests a status change, validate the transition
    let newStatus = current.status;
    if(status && status !== current.status) {
      if(!canTransition(current.status, status)) {
        return res.status(400).json({
          error:`Invalid transition: ${current.status} → ${status}. Allowed: ${VALID_TRANSITIONS[current.status]?.join(", ")||"none"}`
        });
      }
      // Check role authorization for this transition
      const transitionKey=`${current.status}_to_${status}`;
      const allowedRoles=ROLE_TRANSITIONS[transitionKey];
      if(allowedRoles && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({error:`Role '${req.user.role}' cannot transition from ${current.status} to ${status}`});
      }
      newStatus = status;
    }

    await db.execute(
      `UPDATE zone_reports SET workers_present=?,workers_absent=?,collection_total=?,
       issues_reported=?,actions_taken=?,tools_status=?,status=? WHERE id=?`,
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

    // Fetch current status for state machine validation
    const [[current]]=await db.execute("SELECT status FROM zone_reports WHERE id=?",[req.params.id]);
    if(!current) return res.status(404).json({error:"Report not found"});

    // Validate transition
    if(!canTransition(current.status, status)) {
      return res.status(400).json({
        error:`Invalid transition: ${current.status} → ${status}. Allowed: ${VALID_TRANSITIONS[current.status]?.join(", ")||"none"}`
      });
    }

    // Check role authorization
    const transitionKey=`${current.status}_to_${status}`;
    const allowedRoles=ROLE_TRANSITIONS[transitionKey];
    if(allowedRoles && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({error:`Role '${req.user.role}' cannot transition from ${current.status} to ${status}`});
    }

    await db.execute(
      "UPDATE zone_reports SET status=?,reviewed_by=?,reviewed_at=NOW(),reviewer_notes=? WHERE id=?",
      [status,req.user.id,reviewerNotes||null,req.params.id]);
    audit.log(req,"APPROVE","zone_report",parseInt(req.params.id),{status:current.status},{status,reviewerNotes});
    res.json({message:`Report ${status}`});
  }catch(err){next(err);}
});

router.delete("/:id",requireRole("admin"),async(req,res,next)=>{
  try{
    const [old]=await db.execute("SELECT safer_zone_id,report_date,status FROM zone_reports WHERE id=?",[req.params.id]);
    await db.execute("DELETE FROM zone_reports WHERE id=?",[req.params.id]);
    audit.log(req,"DELETE","zone_report",parseInt(req.params.id),old[0]||null,null);
    res.json({message:"Deleted"});
  }catch(err){next(err);}
});

module.exports=router;
