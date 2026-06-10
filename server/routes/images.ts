import type { Express } from "express";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { requireAuth } from "../auth";
import { audit } from "../audit";
import { storage } from "../storage";
import { imageAssets, imageStudies, patients } from "../../shared/schema";

// Image assets are served only through this authenticated route, never a public
// static directory. Opening a full original is audited as a PHI read. Thumbnails
// in the grid are auth gated but not individually audited, to keep the trail
// meaningful rather than flooded by every grid tile.
export function registerImageRoutes(app: Express) {
  app.get("/api/images/:assetId", requireAuth, async (req, res) => {
    const assetId = Number(req.params.assetId);
    const asset = await db.query.imageAssets.findFirst({
      where: eq(imageAssets.id, assetId),
    });
    if (!asset) return res.status(404).json({ error: "Image not found" });
    const study = await db.query.imageStudies.findFirst({
      where: eq(imageStudies.id, asset.studyId),
    });
    if (!study || !req.user!.clinicIds.includes(study.clinicId)) {
      return res.status(404).json({ error: "Image not found" });
    }
    if (asset.kind === "original") {
      await audit(req, {
        action: "view_image",
        entityType: "image_study",
        entityId: study.id,
        clinicId: study.clinicId,
        detail: { type: study.type, kind: asset.kind },
      });
    }
    try {
      const buf = await storage.get(asset.storagePath);
      res.setHeader("Content-Type", asset.mimeType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buf);
    } catch {
      res.status(404).json({ error: "File missing" });
    }
  });

  // Drag and drop import. The client posts a data URL plus the capture context.
  // The server stores the original, derives a thumbnail, and files the study,
  // linking it to the active visit when one is provided.
  app.post("/api/studies/import", requireAuth, async (req, res) => {
    const { patientId, dataUrl, type, toothNumbers, visitId, sequenceRole } = req.body ?? {};
    if (!patientId || !dataUrl) {
      return res.status(400).json({ error: "patientId and dataUrl are required" });
    }
    const patient = await db.query.patients.findFirst({ where: eq(patients.id, Number(patientId)) });
    if (!patient || !req.user!.clinicIds.includes(patient.clinicId)) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const match = /^data:(.+?);base64,(.+)$/.exec(String(dataUrl));
    if (!match) return res.status(400).json({ error: "Expected a base64 data URL" });
    const mime = match[1];
    const input = Buffer.from(match[2], "base64");

    let meta: sharp.Metadata;
    try {
      meta = await sharp(input).metadata();
    } catch {
      return res.status(400).json({ error: "Unreadable image" });
    }
    const original = await sharp(input).png().toBuffer();
    const thumbnail = await sharp(input).resize({ width: 360 }).png().toBuffer();

    const [study] = await db
      .insert(imageStudies)
      .values({
        patientId: patient.id,
        clinicId: patient.clinicId,
        visitId: visitId ? Number(visitId) : null,
        type: type ?? "periapical",
        capturedAt: new Date(),
        capturedBy: req.user!.id,
        deviceLabel: "Imported",
        bodySite: Array.isArray(toothNumbers) && toothNumbers.length ? `Tooth ${toothNumbers[0]}` : "Imported",
        toothNumbers: Array.isArray(toothNumbers) ? toothNumbers.map(Number) : null,
        sequenceRole: sequenceRole ?? null,
        status: "unreviewed",
      })
      .returning();

    const base = `studies/${study.id}`;
    const orig = await storage.put(`${base}/original.png`, original);
    const thumb = await storage.put(`${base}/thumb.png`, thumbnail);
    await db.insert(imageAssets).values([
      { studyId: study.id, filename: "original.png", mimeType: "image/png", width: meta.width ?? 0, height: meta.height ?? 0, kind: "original", storagePath: orig.storagePath, byteSize: orig.byteSize, checksum: orig.checksum },
      { studyId: study.id, filename: "thumb.png", mimeType: "image/png", width: 360, height: Math.round((360 / (meta.width ?? 360)) * (meta.height ?? 360)), kind: "thumbnail", storagePath: thumb.storagePath, byteSize: thumb.byteSize, checksum: thumb.checksum },
    ]);

    await audit(req, { action: "import_image", entityType: "image_study", entityId: study.id, clinicId: patient.clinicId, detail: { mime } });
    res.json({ studyId: study.id });
  });
}
