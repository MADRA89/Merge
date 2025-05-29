// server.js
const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.static('public')); // Serve frontend files if needed

app.post('/merge', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;
    const mergedPdf = await PDFDocument.create();

    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === '.pdf') {
        const pdfBytes = fs.readFileSync(file.path);
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      } else {
        // For images (jpg, jpeg, png)
        const imgBytes = fs.readFileSync(file.path);
        let img;
        if (ext === '.jpg' || ext === '.jpeg') {
          img = await mergedPdf.embedJpg(imgBytes);
        } else if (ext === '.png') {
          img = await mergedPdf.embedPng(imgBytes);
        } else {
          // Skip unsupported files
          continue;
        }

        const page = mergedPdf.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }

      fs.unlinkSync(file.path); // Cleanup
    }

    const mergedPdfBytes = await mergedPdf.save();
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=merged.pdf',
    });
    res.send(mergedPdfBytes);
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to merge files.');
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('Server is running 🚀');
});

// Dynamic port for Render
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
