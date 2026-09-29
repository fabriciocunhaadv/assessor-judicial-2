import { Router } from "express";
import multer from "multer";
import { HttpError } from "../lib/httpError.js";
import { requirePermission } from "../middleware/requireRole.js";
import { extrairPdf } from "../services/pdfService.js";

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 150 * 1024 * 1024 } });
export const pdfRouter = Router();

pdfRouter.post("/extrair", requirePermission("minuta:gerar"), upload.single("arquivo"), async (req, res) => {
  if (!req.file || req.file.mimetype !== "application/pdf") throw new HttpError(400, "Envie um arquivo PDF no campo 'arquivo'.");
  res.json(await extrairPdf(req.file.buffer));
});
