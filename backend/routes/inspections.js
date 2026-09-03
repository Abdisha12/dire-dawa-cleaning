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
    const {kebeleId,zoneId,from,to,status,search}=req.query;
    const page = Math.max(1, parseInt(String(req.query.page || "0"), 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "0"), 10) || 0));
    const hasPagination = page > 0 && limit > 0;
    const searchTerm = (search || "").trim();
    let baseSql=` FROM inspections i JOIN kebeles k ON k.id=i.kebele_id LEFT JOIN safer_zones sz ON sz.id=i.safer_zone_id JOIN users u ON u.id=i.inspected_by WHERE 1=1`;
    // Build where for count/data
    let sqlBase = baseSql;
    const paramsBase=[];
    let idxBase=1;
    if(req.user.role==="leader"){ sqlBase+=` AND sz.leader_id=$${idxBase}`; paramsBase.push(req.user.id); idxBase++; }
    else if(req.user.role==="collector"){
      const kebeleRes = await db.query("SELECT id FROM kebeles WHERE collector_id=$1", [req.user.id]);
      const assignedKebele = kebeleRes.rows[0]?.id || null;
      if(!assignedKebele){
        if(!hasPagination) return res.json([]);
        return res.json({ data: [], total: 0, page: 1, pages: 0 });
      }
      sqlBase+=` AND i.kebele_id=$${idxBase}`; paramsBase.push(assignedKebele); idxBase++;
      if(zoneId){ sqlBase+=` AND i.safer_zone_id=$${idxBase}`; paramsBase.push(zoneId); idxBase++; }
      // ignore client kebeleId (locked)
    }
    else{
      if(kebeleId){ sqlBase+=` AND i.kebele_id=$${idxBase}`; paramsBase.push(kebeleId); idxBase++; }
      if(zoneId){ sqlBase+=` AND i.safer_zone_id=$${idxBase}`; paramsBase.push(zoneId); idxBase++; }
    }
    if(status){ sqlBase+=` AND i.status=$${idxBase}`; paramsBase.push(status); idxBase++; }
    if(from){ sqlBase+=` AND i.date>=$${idxBase}`; paramsBase.push(from); idxBase++; }
    if(to){ sqlBase+=` AND i.date<=$${idxBase}`; paramsBase.push(to); idxBase++; }
    if(searchTerm){
      sqlBase+=` AND (k.name ILIKE $${idxBase} OR sz.name ILIKE $${idxBase} OR u.full_name ILIKE $${idxBase} OR i.notes ILIKE $${idxBase})`;
      paramsBase.push(`%${searchTerm}%`);
      idxBase++;
    }
    if(!hasPagination){
      const sql=`SELECT i.*,k.name AS kebele_name,k.code AS kebele_code,sz.name AS zone_name,u.full_name AS inspector_name${sqlBase} ORDER BY i.date DESC,k.code`;
      const rowsResult=await db.query(sql,paramsBase);
      const rows=rowsResult.rows;
      for(const r of rows){
        const photosResult=await db.query("SELECT * FROM inspection_photos WHERE inspection_id=$1",[r.id]);
        r.photos=photosResult.rows;
      }
      return res.json(rows);
    }
    const countSql=`SELECT COUNT(*)::int AS total${sqlBase}`;
    const countRes=await db.query(countSql, paramsBase);
    const total = countRes.rows[0]?.total || 0;
    const pages = Math.max(1, Math.ceil(total / limit));
    const offset=(page-1)*limit;
    const dataSql=`SELECT i.*,k.name AS kebele_name,k.code AS kebele_code,sz.name AS zone_name,u.full_name AS inspector_name${sqlBase} ORDER BY i.date DESC,k.code LIMIT $${idxBase} OFFSET $${idxBase+1}`;
    const dataParams=[...paramsBase, limit, offset];
    const rowsResult=await db.query(dataSql,dataParams);
    const rows=rowsResult.rows;
    for(const r of rows){
      const photosResult=await db.query("SELECT * FROM inspection_photos WHERE inspection_id=$1",[r.id]);
      r.photos=photosResult.rows;
    }
    res.json({ data: rows, total, page, pages });
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
    const {kebeleId,saferZoneId,date,status,notes,latitude,longitude}=req.body;
    if(!kebeleId||!date) return res.status(400).json({error:"kebeleId and date required"});
    if(req.user.role==="collector"){
      const kebeleRes = await db.query("SELECT id FROM kebeles WHERE collector_id=$1", [req.user.id]);
      const assignedKebele = kebeleRes.rows[0]?.id || null;
      if(!assignedKebele) return res.status(403).json({error:"No kebele assigned"});
      if(String(kebeleId) !== String(assignedKebele)) return res.status(403).json({error:"Kebele does not match your assigned kebele"});
      if(saferZoneId){
        const zc = await db.query("SELECT id FROM safer_zones WHERE id=$1 AND kebele_id=$2", [saferZoneId, assignedKebele]);
        if(!zc.rows.length) return res.status(403).json({error:"Zone does not belong to your kebele"});
      }
    }
    if(req.user.role==="leader"){
      const zr=await db.query("SELECT id FROM safer_zones WHERE id=$1 AND leader_id=$2",[saferZoneId,req.user.id]);
      if(!zr.rows.length) return res.status(403).json({error:"Not your zone"});
    }
    const hasLocation = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;
    const r = hasLocation
      ? await db.query(
          "INSERT INTO inspections (kebele_id,safer_zone_id,date,status,notes,inspected_by,location) VALUES ($1,$2,$3,$4,$5,$6,ST_SetSRID(ST_MakePoint($7,$8),4326)) RETURNING id",
          [kebeleId,saferZoneId||null,date,status||"active",notes||null,req.user.id, parseFloat(longitude), parseFloat(latitude)])
      : await db.query(
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
    const {status,notes,latitude,longitude}=req.body;
    const oldResult=await db.query("SELECT status,notes FROM inspections WHERE id=$1",[req.params.id]);
    if (!oldResult.rows.length) return res.status(404).json({error:"Not found"});
    const hasLocation = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;
    if (hasLocation) {
      await db.query(
        "UPDATE inspections SET status=$1,notes=$2,location=ST_SetSRID(ST_MakePoint($3,$4),4326) WHERE id=$5",
        [status,notes||null, parseFloat(longitude), parseFloat(latitude), req.params.id]);
    } else {
      await db.query("UPDATE inspections SET status=$1,notes=$2 WHERE id=$3",[status,notes||null,req.params.id]);
    }
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
