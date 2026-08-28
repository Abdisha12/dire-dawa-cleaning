const express=require("express");
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const crypto=require("crypto");
const db=require("../config/db");
const audit=require("../services/auditService");
const {authenticate,requireRole}=require("../middleware/auth");
const validate=require("../middleware/validate");
const schemas=require("../middleware/schemas");
const {createFileFilter,validateUploadedFile,handleMulterError}=require("../middleware/uploadSecurity");
const router=express.Router();
router.use(authenticate);

const storage=multer.diskStorage({
  destination:(req,file,cb)=>{const d=path.join(__dirname,"../uploads/inspections");fs.mkdirSync(d,{recursive:true});cb(null,d);},
  filename:(req,file,cb)=>cb(null,`insp_${Date.now()}_${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname).toLowerCase()}`)
});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:createFileFilter("inspection")});

router.get("/",async(req,res,next)=>{
  try{
    const {kebeleId,zoneId,from,to,status}=req.query;
    let sql=`SELECT i.*,k.name AS kebele_name,k.code AS kebele_code,
                    sz.name AS zone_name,u.full_name AS inspector_name
             FROM inspections i JOIN kebeles k ON k.id=i.kebele_id
             LEFT JOIN safer_zones sz ON sz.id=i.safer_zone_id
             JOIN users u ON u.id=i.inspected_by WHERE 1=1`;
    const params=[];
    let paramIdx=1;
    if(req.user.role==="leader"){sql+=` AND sz.leader_id=$${paramIdx}`;params.push(req.user.id);paramIdx++;}
    else{
      if(kebeleId){sql+=` AND i.kebele_id=$${paramIdx}`;params.push(kebeleId);paramIdx++;}
      if(zoneId){sql+=` AND i.safer_zone_id=$${paramIdx}`;params.push(zoneId);paramIdx++;}
    }
    if(status){sql+=` AND i.status=$${paramIdx}`;params.push(status);paramIdx++;}
    if(from){sql+=` AND i.date>=$${paramIdx}`;params.push(from);paramIdx++;}
    if(to){sql+=` AND i.date<=$${paramIdx}`;params.push(to);paramIdx++;}
    sql+=" ORDER BY i.date DESC,k.code";
    const rowsResult=await db.query(sql,params);
    const rows=rowsResult.rows;
    for(const r of rows){
      const photosResult=await db.query("SELECT * FROM inspection_photos WHERE inspection_id=$1",[r.id]);
      r.photos=photosResult.rows;
    }
    res.json(rows);
  }catch(err){next(err);}
});

router.get("/:id",async(req,res,next)=>{
  try{
    const result=await db.query(
      `SELECT i.*,k.name AS kebele_name,sz.name AS zone_name,u.full_name AS inspector_name
       FROM inspections i JOIN kebeles k ON k.id=i.kebele_id
       LEFT JOIN safer_zones sz ON sz.id=i.safer_zone_id
       JOIN users u ON u.id=i.inspected_by WHERE i.id=$1`,[req.params.id]);
    if(!result.rows.length) return res.status(404).json({error:"Not found"});
    const photosResult=await db.query("SELECT * FROM inspection_photos WHERE inspection_id=$1",[req.params.id]);
    res.json({...result.rows[0],photos:photosResult.rows});
  }catch(err){next(err);}
});

router.post("/",requireRole("admin","collector","leader"),
  validate(schemas.createInspection),
  upload.array("photos",10),
  validateUploadedFile("inspection"),
  handleMulterError,
  async(req,res,next)=>{
  try{
    const {kebeleId,saferZoneId,date,status,notes}=req.body;
    if(!kebeleId||!date) return res.status(400).json({error:"kebeleId and date required"});
    if(req.user.role==="leader"){
      const zr=await db.query("SELECT id FROM safer_zones WHERE id=$1 AND leader_id=$2",[saferZoneId,req.user.id]);
      if(!zr.rows.length) return res.status(403).json({error:"Not your zone"});
    }
    const r=await db.query(
      "INSERT INTO inspections (kebele_id,safer_zone_id,date,status,notes,inspected_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [kebeleId,saferZoneId||null,date,status||"active",notes||null,req.user.id]);
    const insertedId=r.rows[0].id;
    if(req.files?.length){
      for(const f of req.files)
        await db.query("INSERT INTO inspection_photos (inspection_id,file_path) VALUES ($1,$2)",
          [insertedId,`/uploads/inspections/${f.filename}`]);
    }
    audit.log(req,"CREATE","inspection",insertedId,null,{kebeleId,saferZoneId,date,status:status||"active"});
    res.status(201).json({id:insertedId});
  }catch(err){
    if(err.code==="23505") return res.status(409).json({error:"Inspection already exists for this zone/date"});
    next(err);
  }
});

router.put("/:id",requireRole("admin","collector","leader"),
  validate(schemas.updateInspection),
  upload.array("photos",10),
  validateUploadedFile("inspection"),
  handleMulterError,
  async(req,res,next)=>{
  try{
    const {status,notes}=req.body;
    const oldResult=await db.query("SELECT status,notes FROM inspections WHERE id=$1",[req.params.id]);
    await db.query("UPDATE inspections SET status=$1,notes=$2 WHERE id=$3",[status,notes||null,req.params.id]);
    audit.log(req,"UPDATE","inspection",parseInt(req.params.id),oldResult.rows[0]||null,{status,notes});
    if(req.files?.length){
      for(const f of req.files)
        await db.query("INSERT INTO inspection_photos (inspection_id,file_path) VALUES ($1,$2)",
          [req.params.id,`/uploads/inspections/${f.filename}`]);
    }
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.delete("/photo/:photoId",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const result=await db.query("SELECT * FROM inspection_photos WHERE id=$1",[req.params.photoId]);
    if(!result.rows.length) return res.status(404).json({error:"Photo not found"});
    const full=path.join(__dirname,"..",result.rows[0].file_path);
    const resolved=path.resolve(full);
    const uploadsDir=path.resolve(__dirname,"../uploads/inspections");
    if(!resolved.startsWith(uploadsDir)) return res.status(400).json({error:"Invalid file path"});
    if(fs.existsSync(full)) fs.unlinkSync(full);
    await db.query("DELETE FROM inspection_photos WHERE id=$1",[req.params.photoId]);
    res.json({message:"Photo deleted"});
  }catch(err){next(err);}
});

router.delete("/:id",requireRole("admin","collector"),async(req,res,next)=>{
  try{
    const oldResult=await db.query("SELECT kebele_id,safer_zone_id,date,status FROM inspections WHERE id=$1",[req.params.id]);
    const photosResult=await db.query("SELECT file_path FROM inspection_photos WHERE inspection_id=$1",[req.params.id]);
    const uploadsDir=path.resolve(__dirname,"../uploads/inspections");
    for(const p of photosResult.rows){
      const f=path.join(__dirname,"..",p.file_path);
      if(path.resolve(f).startsWith(uploadsDir) && fs.existsSync(f)) fs.unlinkSync(f);
    }
    await db.query("DELETE FROM inspections WHERE id=$1",[req.params.id]);
    audit.log(req,"DELETE","inspection",parseInt(req.params.id),oldResult.rows[0]||null,null);
    res.json({message:"Deleted"});
  }catch(err){next(err);}
});

module.exports=router;
