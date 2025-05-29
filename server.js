import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { fromPath } from 'pdf2pic';
import libre from 'libreoffice-convert';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });
// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { fromPath } = require('pdf2pic');
const libre = require('libreoffice-convert');
const { PDFImage } = require('pdf-image');
const sharp = require('sharp');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

const PORT = process.env.PORT || 3000;

// Utility function: Convert DOCX to PDF
const convertToPDF = (inputPath) => {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath + '.pdf';
    fs.readFile(inputPath, (err, data) => {
      if (err) return reject(err);
      libre.convert(data, '.pdf', undefined, (err, done) => {
        if (err) return reject(err);
        fs.writeFile(outputPath, done, (err) => {
          if (err) return reject(err);
          resolve(outputPath);
        });
      });
    });
  });
};

// Utility function: Convert image to PDF
const imageToPDF = async (imagePath) => {
  const pdfDoc = await PDFDocument.create();
  const imageBytes = await fs.promises.readFile(imagePath);
  const extension = path.extname(imagePath).toLowerCase();
  let image;

  if (extension === '.jpg' || extension === '.jpeg') {
    image = await pdfDoc.embedJpg(imageBytes);
  } else if (extension === '.png') {
    image = await pdfDoc.embedPng(imageBytes);
  } else {
    throw new Error('Unsupported image format');
  }

  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

  const pdfBytes = await pdfDoc.save();
  const outputPath = imagePath + '.pdf';
  await fs.promises.writeFile(outputPath, pdfBytes);
  return outputPath;
};

app.post('/merge', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;
    const pdfBuffers = [];

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      let pdfPath;

      if (ext === '.pdf') {
        pdfPath = file.path;
      } else if (ext === '.docx' || ext === '.doc') {
        pdfPath = await convertToPDF(file.path);
      } else if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
        pdfPath = await imageToPDF(file.path);
      } else {
        return res.status(400).send('Unsupported file format: ' + file.originalname);
      }

      const buffer = await fs.promises.readFile(pdfPath);
      pdfBuffers.push(buffer);
    }

    // Merge all PDF buffers
    const mergedPdf = await PDFDocument.create();
    for (const buffer of pdfBuffers) {
      const pdf = await PDFDocument.load(buffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
    res.send(Buffer.from(mergedPdfBytes));

    // Cleanup
    files.forEach(file => fs.unlink(file.path, () => {}));
    pdfBuffers.forEach((buffer, index) => {
      const tempPath = files[index].path + '.pdf';
      if (fs.existsSync(tempPath)) fs.unlink(tempPath, () => {});
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to merge files');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
