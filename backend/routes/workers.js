const express=require("express");
const db=require("../config/db");
const audit=require("../services/auditService");
const {authenticate,requireRole}=require("../middleware/auth");
const router=express.Router();
router.use(authenticate);

function parseCustomAttrs(rows){
  return rows.map(r=>{
    if(r.custom_attributes && typeof r.custom_attributes==="string"){
      try{ r.custom_attributes=JSON.parse(r.custom_attributes); }catch(e){}
    }
    return r;
  });
}

function leaderZoneFilter(user){
  return user.role==="leader"?" AND sz.leader_id="+user.id:" ";
}

router.get("/summary/stats",async(req,res,next)=>{
  try{
    const y=req.query.year||new Date().getFullYear();
    const m=req.query.month||new Date().getMonth()+1;
    const first=`${y}-${String(m).padStart(2,"0")}-01`;
    const last=new Date(y,m,0).toISOString().slice(0,10);
    let sql=`SELECT w.*,sz.name AS zone_name,k.name AS kebele_name,
                    COUNT(CASE WHEN a.present=1 THEN 1 END) AS days_present,
                    COUNT(CASE WHEN a.present=0 THEN 1 END) AS days_absent,
                    COALESCE(SUM(a.bonus),0) AS total_bonus,
                    COUNT(CASE WHEN a.present=1 THEN 1 END)*w.daily_wage+COALESCE(SUM(a.bonus),0) AS gross_wage
             FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id
             LEFT JOIN kebeles k ON k.id=sz.kebele_id
             LEFT JOIN attendance a ON a.worker_id=w.id AND a.date BETWEEN ? AND ?
             WHERE w.is_active=1`;
    const params=[first,last];
    if(req.user.role==="leader"){sql+=" AND sz.leader_id=?";params.push(req.user.id);}
    else if(req.query.zoneId){sql+=" AND w.safer_zone_id=?";params.push(req.query.zoneId);}
    sql+=" GROUP BY w.id ORDER BY sz.name,w.full_name";
    const [rows]=await db.execute(sql,params);
    res.json(parseCustomAttrs(rows));
  }catch(err){next(err);}
});

router.post("/attendance/bulk",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {date,records}=req.body;
    if(!date||!Array.isArray(records)||!records.length)
      return res.status(400).json({error:"date and records[] required"});
    for(const r of records){
      await db.execute(
        `INSERT INTO attendance (worker_id,date,present,bonus,recorded_by) VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE present=VALUES(present),bonus=VALUES(bonus)`,[r.workerId,date,r.present?1:0,r.bonus||null,req.user.id]);
    }
    audit.log(req,"CREATE","attendance",null,null,{date,count:records.length});
    res.json({message:`Saved ${records.length} records`});
  }catch(err){next(err);}
});

router.get("/",async(req,res,next)=>{
  try{
    let sql=`SELECT w.*,sz.name AS zone_name,k.name AS kebele_name
             FROM workers w LEFT JOIN safer_zones sz ON sz.id=w.safer_zone_id
             LEFT JOIN kebeles k ON k.id=sz.kebele_id WHERE 1=1`;
    const params=[];
    if(req.user.role==="leader"){sql+=" AND sz.leader_id=?";params.push(req.user.id);}
    else if(req.query.zoneId){sql+=" AND w.safer_zone_id=?";params.push(req.query.zoneId);}
    sql+=" ORDER BY sz.name,w.full_name";
    const [rows]=await db.execute(sql,params);
    res.json(parseCustomAttrs(rows));
  }catch(err){next(err);}
});

router.post("/",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {fullName,contact,faydaId,dailyWage,saferZoneId,customAttributes}=req.body;
    if(!fullName) return res.status(400).json({error:"fullName required"});
    if(req.user.role==="leader"){
      const [zr]=await db.execute("SELECT id FROM safer_zones WHERE id=? AND leader_id=?",[saferZoneId,req.user.id]);
      if(!zr.length) return res.status(403).json({error:"Not your zone"});
    }
    const attrs = customAttributes ? JSON.stringify(customAttributes) : null;
    const [r]=await db.execute(
      "INSERT INTO workers (full_name,contact,fayda_id,daily_wage,safer_zone_id,custom_attributes) VALUES (?,?,?,?,?,?)",
      [fullName,contact||null,faydaId||null,dailyWage||250,saferZoneId||null,attrs]);
    audit.log(req,"CREATE","worker",r.insertId,null,{fullName,contact,dailyWage,saferZoneId});
    res.status(201).json({id:r.insertId});
  }catch(err){
    if(err.code==="ER_DUP_ENTRY") return res.status(409).json({error:"Fayda ID already exists"});
    next(err);
  }
});

router.put("/:id",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {fullName,contact,faydaId,dailyWage,saferZoneId,isActive,customAttributes}=req.body;
    const [old]=await db.execute("SELECT full_name,contact,daily_wage,safer_zone_id,is_active FROM workers WHERE id=?",[req.params.id]);
    const attrs = customAttributes ? JSON.stringify(customAttributes) : null;
    await db.execute("UPDATE workers SET full_name=?,contact=?,fayda_id=?,daily_wage=?,safer_zone_id=?,is_active=?,custom_attributes=? WHERE id=?",
      [fullName,contact||null,faydaId||null,dailyWage,saferZoneId||null,isActive?1:0,attrs,req.params.id]);
    audit.log(req,"UPDATE","worker",parseInt(req.params.id),old[0]||null,{fullName,contact,dailyWage,saferZoneId,isActive});
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.delete("/:id",requireRole("admin","collector"),async(req,res,next)=>{
  try{
    const [old]=await db.execute("SELECT full_name,safer_zone_id FROM workers WHERE id=?",[req.params.id]);
    await db.execute("DELETE FROM workers WHERE id=?",[req.params.id]);
    audit.log(req,"DELETE","worker",parseInt(req.params.id),old[0]||null,null);
    res.json({message:"Deleted"});
  }
  catch(err){next(err);}
});

router.get("/:id/attendance",async(req,res,next)=>{
  try{
    const {from,to}=req.query;
    let sql="SELECT a.*,u.full_name AS recorder_name FROM attendance a JOIN users u ON u.id=a.recorded_by WHERE a.worker_id=?";
    const params=[req.params.id];
    if(from){sql+=" AND a.date>=?";params.push(from);}
    if(to){sql+=" AND a.date<=?";params.push(to);}
    sql+=" ORDER BY a.date DESC";
    const [rows]=await db.execute(sql,params);
    res.json(rows);
  }catch(err){next(err);}
});

router.get("/:id/salary",async(req,res,next)=>{
  try{
    const [rows]=await db.execute(
      "SELECT sp.*,u.full_name AS paid_by_name FROM salary_payments sp JOIN users u ON u.id=sp.paid_by WHERE sp.worker_id=? ORDER BY sp.paid_at DESC",
      [req.params.id]);
    res.json(rows);
  }catch(err){next(err);}
});

router.post("/:id/salary",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const {amount,paidAt,periodFrom,periodTo,notes}=req.body;
    if(!amount||!paidAt||!periodFrom||!periodTo) return res.status(400).json({error:"amount,paidAt,periodFrom,periodTo required"});
    const [r]=await db.execute(
      "INSERT INTO salary_payments (worker_id,amount,paid_at,period_from,period_to,notes,paid_by) VALUES (?,?,?,?,?,?,?)",
      [req.params.id,amount,paidAt,periodFrom,periodTo,notes||null,req.user.id]);
    audit.log(req,"CREATE","salary",r.insertId,null,{workerId:req.params.id,amount,periodFrom,periodTo});
    res.status(201).json({id:r.insertId});
  }catch(err){next(err);}
});

module.exports=router;
