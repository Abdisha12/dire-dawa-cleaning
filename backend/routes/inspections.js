const express=require("express");
const multer=require("multer");
const path=require("path");
const fs=require("fs");
const db=require("../config/db");
const audit=require("../services/auditService");
const {authenticate,requireRole}=require("../middleware/auth");
const {createFileFilter,validateUploadedFile,handleMulterError}=require("../middleware/uploadSecurity");
const router=express.Router();
router.use(authenticate);

const storage=multer.diskStorage({
  destination:(req,file,cb)=>{const d=path.join(__dirname,"../uploads/inspections");fs.mkdirSync(d,{recursive:true});cb(null,d);},
  filename:(req,file,cb)=>cb(null,`insp_${Date.now()}_${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
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
    if(req.user.role==="leader"){sql+=" AND sz.leader_id=?";params.push(req.user.id);}
    else{
      if(kebeleId){sql+=" AND i.kebele_id=?";params.push(kebeleId);}
      if(zoneId){sql+=" AND i.safer_zone_id=?";params.push(zoneId);}
    }
    if(status){sql+=" AND i.status=?";params.push(status);}
    if(from){sql+=" AND i.date>=?";params.push(from);}
    if(to){sql+=" AND i.date<=?";params.push(to);}
    sql+=" ORDER BY i.date DESC,k.code";
    const [rows]=await db.execute(sql,params);
    for(const r of rows){
      const [photos]=await db.execute("SELECT * FROM inspection_photos WHERE inspection_id=?",[r.id]);
      r.photos=photos;
    }
    res.json(rows);
  }catch(err){next(err);}
});

router.get("/:id",async(req,res,next)=>{
  try{
    const [rows]=await db.execute(
      `SELECT i.*,k.name AS kebele_name,sz.name AS zone_name,u.full_name AS inspector_name
       FROM inspections i JOIN kebeles k ON k.id=i.kebele_id
       LEFT JOIN safer_zones sz ON sz.id=i.safer_zone_id
       JOIN users u ON u.id=i.inspected_by WHERE i.id=?`,[req.params.id]);
    if(!rows.length) return res.status(404).json({error:"Not found"});
    const [photos]=await db.execute("SELECT * FROM inspection_photos WHERE inspection_id=?",[req.params.id]);
    res.json({...rows[0],photos});
  }catch(err){next(err);}
});

router.post("/",requireRole("admin","collector","leader"),
  upload.array("photos",10),
  validateUploadedFile("inspection"),
  handleMulterError,
  async(req,res,next)=>{
  try{
    const {kebeleId,saferZoneId,date,status,notes}=req.body;
    if(!kebeleId||!date) return res.status(400).json({error:"kebeleId and date required"});
    if(req.user.role==="leader"){
      const [zr]=await db.execute("SELECT id FROM safer_zones WHERE id=? AND leader_id=?",[saferZoneId,req.user.id]);
      if(!zr.length) return res.status(403).json({error:"Not your zone"});
    }
    const [r]=await db.execute(
      "INSERT INTO inspections (kebele_id,safer_zone_id,date,status,notes,inspected_by) VALUES (?,?,?,?,?,?)",
      [kebeleId,saferZoneId||null,date,status||"active",notes||null,req.user.id]);
    if(req.files?.length){
      for(const f of req.files)
        await db.execute("INSERT INTO inspection_photos (inspection_id,file_path) VALUES (?,?)",
          [r.insertId,`/uploads/inspections/${f.filename}`]);
    }
    audit.log(req,"CREATE","inspection",r.insertId,null,{kebeleId,saferZoneId,date,status:status||"active"});
    res.status(201).json({id:r.insertId});
  }catch(err){
    if(err.code==="ER_DUP_ENTRY") return res.status(409).json({error:"Inspection already exists for this zone/date"});
    next(err);
  }
});

router.put("/:id",requireRole("admin","collector","leader"),
  upload.array("photos",10),
  validateUploadedFile("inspection"),
  handleMulterError,
  async(req,res,next)=>{
  try{
    const {status,notes}=req.body;
    const [old]=await db.execute("SELECT status,notes FROM inspections WHERE id=?",[req.params.id]);
    await db.execute("UPDATE inspections SET status=?,notes=? WHERE id=?",[status,notes||null,req.params.id]);
    audit.log(req,"UPDATE","inspection",parseInt(req.params.id),old[0]||null,{status,notes});
    if(req.files?.length){
      for(const f of req.files)
        await db.execute("INSERT INTO inspection_photos (inspection_id,file_path) VALUES (?,?)",
          [req.params.id,`/uploads/inspections/${f.filename}`]);
    }
    res.json({message:"Updated"});
  }catch(err){next(err);}
});

router.delete("/photo/:photoId",requireRole("admin","collector","leader"),async(req,res,next)=>{
  try{
    const [rows]=await db.execute("SELECT * FROM inspection_photos WHERE id=?",[req.params.photoId]);
    if(!rows.length) return res.status(404).json({error:"Photo not found"});
    const full=path.join(__dirname,"..",rows[0].file_path);
    // Path traversal guard
    const resolved=path.resolve(full);
    const uploadsDir=path.resolve(__dirname,"../uploads/inspections");
    if(!resolved.startsWith(uploadsDir)) return res.status(400).json({error:"Invalid file path"});
    if(fs.existsSync(full)) fs.unlinkSync(full);
    await db.execute("DELETE FROM inspection_photos WHERE id=?",[req.params.photoId]);
    res.json({message:"Photo deleted"});
  }catch(err){next(err);}
});

router.delete("/:id",requireRole("admin","collector"),async(req,res,next)=>{
  try{
    const [old]=await db.execute("SELECT kebele_id,safer_zone_id,date,status FROM inspections WHERE id=?",[req.params.id]);
    const [photos]=await db.execute("SELECT file_path FROM inspection_photos WHERE inspection_id=?",[req.params.id]);
    const uploadsDir=path.resolve(__dirname,"../uploads/inspections");
    for(const p of photos){
      const f=path.join(__dirname,"..",p.file_path);
      // Path traversal guard
      if(path.resolve(f).startsWith(uploadsDir) && fs.existsSync(f)) fs.unlinkSync(f);
    }
    await db.execute("DELETE FROM inspections WHERE id=?",[req.params.id]);
    audit.log(req,"DELETE","inspection",parseInt(req.params.id),old[0]||null,null);
    res.json({message:"Deleted"});
  }catch(err){next(err);}
});

module.exports=router;
