import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDisplayDate } from './patientUtils';

/**
 * Draw MedWise logo on PDF canvas
 */
const drawMedWiseLogo = (doc, x, y, size = 16) => {
  doc.setFillColor(2, 132, 199); // #0284c7
  doc.roundedRect(x, y, size, size, 3, 3, 'F');

  doc.setFillColor(255, 255, 255);
  doc.circle(x + size / 2, y + size / 2, size * 0.28, 'F');

  doc.setFillColor(2, 132, 199);
  doc.circle(x + size / 2, y + size / 2, size * 0.16, 'F');
};

/**
 * Generate and download the comprehensive MedWise Clinical Decision Support Report PDF
 * @param {Object} prescription - Populated prescription object
 */
export const generatePrescriptionPdf = (prescription) => {
  if (!prescription) return;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  // Color palette
  const primaryColor = [2, 132, 199];    // #0284c7
  const darkColor = [15, 23, 42];        // slate-900
  const mediumColor = [71, 85, 105];     // slate-600
  const lightColor = [148, 163, 184];    // slate-400
  const bgLight = [248, 250, 252];       // slate-50

  const medwiseAnalysis = prescription.medwiseAnalysis || {};
  const audit = medwiseAnalysis.audit || {};
  const summary = audit.summary || {};
  const coverage = audit.coverage || {};
  const overallRec = medwiseAnalysis.overallRecommendation || prescription.medwiseChecks?.overallRecommendation;
  const rawStatus = typeof overallRec === 'object' ? String(overallRec?.status || '').toLowerCase() : String(overallRec || '').toLowerCase();
  const recMessage = typeof overallRec === 'object' ? overallRec?.message : String(overallRec || '');

  let outcomeCode = 'CLEARED';
  let outcomeBg = [220, 252, 231];
  let outcomeText = [21, 128, 61];

  if (rawStatus === 'review_required' || rawStatus.includes('review')) {
    outcomeCode = 'REVIEW RECOMMENDED';
    outcomeBg = [254, 243, 199];
    outcomeText = [146, 64, 14];
  } else if (rawStatus === 'unable_to_assess' || rawStatus.includes('incomplete')) {
    outcomeCode = 'ANALYSIS INCOMPLETE';
    outcomeBg = [239, 246, 255];
    outcomeText = [29, 78, 216];
  }

  // Helper for page overflow check
  const checkPageOverflow = (neededHeight = 15) => {
    if (currentY + neededHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  // ═══════════════════════════════════════════════════════════
  // 1. HEADER: Logo + MedWise Portal Branding
  // ═══════════════════════════════════════════════════════════
  drawMedWiseLogo(doc, margin, currentY, 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...primaryColor);
  doc.text('MEDWISE', margin + 18, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mediumColor);
  doc.text('Clinical Decision Support Portal', margin + 18, currentY + 11);

  // Right-aligned report title & prescription ID
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text(prescription.prescriptionId || 'RX-XXXXXX', pageWidth - margin, currentY + 5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...outcomeText);
  doc.text(`OUTCOME: ${outcomeCode}`, pageWidth - margin, currentY + 11, { align: 'right' });

  currentY += 16;

  // Divider line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // Report Title Subheader
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...darkColor);
  doc.text('CLINICAL DECISION SUPPORT REPORT', margin, currentY);
  
  const analysisTimeStr = medwiseAnalysis.checkedAt ? new Date(medwiseAnalysis.checkedAt).toLocaleString() : new Date().toLocaleString();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mediumColor);
  doc.text(`Analyzed: ${analysisTimeStr}`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 8;

  // ═══════════════════════════════════════════════════════════
  // 2. PATIENT CLINICAL CONTEXT & PRESCRIBER INFO
  // ═══════════════════════════════════════════════════════════
  const patientProfile = prescription.patientProfile || {};
  const doctorName = prescription.doctorName?.startsWith('Dr.') ? prescription.doctorName : `Dr. ${prescription.doctorName || ''}`;

  const infoData = [
    [
      `Patient Name: ${prescription.patientName || ''}`,
      `Prescriber: ${doctorName}`,
    ],
    [
      `PID: ${prescription.patientPid || ''}`,
      `Specialization: ${prescription.doctorSpecialization || 'General Medicine'}`,
    ],
    [
      `Age/Gender: ${prescription.patientAge != null ? `${prescription.patientAge} yrs` : 'Adult'} / ${prescription.patientGender || 'Unspecified'}`,
      `Prescription Date: ${formatDisplayDate(prescription.createdAt)}`,
    ],
    [
      `Blood Group: ${prescription.patientBloodGroup && prescription.patientBloodGroup !== 'Unknown' ? prescription.patientBloodGroup : 'Not Specified'}`,
      `Status: ${prescription.status || 'Draft'}`,
    ],
  ];

  if (patientProfile.hasNoKnownAllergies) {
    infoData.push([`Allergy Status: No known allergies (Assessed)`, `Doctor Decision: ${prescription.doctorDecision || 'Pending Decision'}`]);
  } else if (Array.isArray(patientProfile.allergies) && patientProfile.allergies.length > 0) {
    infoData.push([`Allergies: ${patientProfile.allergies.join(', ')}`, `Doctor Decision: ${prescription.doctorDecision || 'Pending Decision'}`]);
  } else {
    infoData.push([`Allergy Status: Uncompleted Allergy Assessment`, `Doctor Decision: ${prescription.doctorDecision || 'Pending Decision'}`]);
  }

  autoTable(doc, {
    startY: currentY,
    body: infoData,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: darkColor },
    columnStyles: {
      0: { fontStyle: 'bold', width: contentWidth / 2 },
      1: { fontStyle: 'bold', width: contentWidth / 2 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable.finalY + 6;

  // ═══════════════════════════════════════════════════════════
  // 3. OVERALL MEDWISE AUDIT & 8-STAGE COVERAGE
  // ═══════════════════════════════════════════════════════════
  checkPageOverflow(30);

  // Overall Audit Box
  doc.setFillColor(...outcomeBg);
  doc.roundedRect(margin, currentY, contentWidth, 16, 2, 2, 'F');
  doc.setDrawColor(...outcomeText);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, 16, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...outcomeText);
  doc.text(`Overall Audit Outcome: ${outcomeCode}`, margin + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkColor);
  const splitMessage = doc.splitTextToSize(`Assessment: ${recMessage}`, contentWidth - 8);
  doc.text(splitMessage, margin + 4, currentY + 11);

  currentY += 21;

  // Findings Metrics Breakdown
  const totalF = summary.totalFindings ?? 0;
  const critF = summary.criticalFindings ?? 0;
  const warnF = summary.warningFindings ?? 0;
  const incompF = summary.incompleteAssessments ?? 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...mediumColor);
  doc.text(`FINDINGS METRICS: Total (${totalF})  |  Critical (${critF})  |  Warnings (${warnF})  |  Incomplete (${incompF})`, margin, currentY);

  currentY += 6;

  // 8-Stage Analysis Coverage Table
  const missingAge = prescription?.patientAge == null || prescription?.patientAge === 0;
  const missingGender = !prescription?.patientGender || prescription?.patientGender === 'Unspecified';
  const missingAllergies = !patientProfile.hasNoKnownAllergies && (!Array.isArray(patientProfile.allergies) || patientProfile.allergies.length === 0);

  const coverageRows = [
    ['1. Patient Context', coverage.patientContext || (missingAge || missingGender ? 'INCOMPLETE' : 'COMPLETED')],
    ['2. Prescription Validation', coverage.prescriptionValidation || 'COMPLETED'],
    ['3. Dosage Analysis', coverage.dosageAnalysis || 'COMPLETED'],
    ['4. Drug–Drug Interaction', coverage.drugInteraction || 'COMPLETED'],
    ['5. Duplicate Medication', coverage.duplicateMedication || 'COMPLETED'],
    ['6. Allergy & Safety', coverage.allergySafety || (missingAllergies ? 'INCOMPLETE' : 'COMPLETED')],
    ['7. Patient-Specific CDS', coverage.patientSpecificCDS || 'COMPLETED'],
    ['8. Overall Audit', coverage.overallAudit || 'COMPLETED'],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Clinical Analysis Stage', 'Evaluation Coverage State']],
    body: coverageRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', width: contentWidth * 0.65 },
      1: { fontStyle: 'bold', width: contentWidth * 0.35 },
    },
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // ═══════════════════════════════════════════════════════════
  // 4. PRESCRIBED MEDICINES TABLE
  // ═══════════════════════════════════════════════════════════
  checkPageOverflow(30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.text('PRESCRIBED MEDICINES SUMMARY', margin, currentY);
  currentY += 4;

  const medicines = prescription.medicines || [];
  const medTableRows = medicines.map((med, idx) => [
    idx + 1,
    med.medicineName || med.genericName || 'Medicine',
    med.strength || med.dosage || 'N/A',
    med.frequency || '',
    med.duration || '',
    med.route || 'Oral',
    med.instructions || '',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Medicine', 'Strength/Dose', 'Frequency', 'Duration', 'Route', 'Instructions']],
    body: medTableRows,
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 2 },
    margin: { left: margin, right: margin },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // ═══════════════════════════════════════════════════════════
  // 5. DETAILED CLINICAL FINDINGS (IF ANY)
  // ═══════════════════════════════════════════════════════════
  const findingsList = audit.findings || [];
  if (findingsList.length > 0) {
    checkPageOverflow(30);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...darkColor);
    doc.text('DETAILED CLINICAL FINDINGS & EVIDENCE', margin, currentY);
    currentY += 4;

    const findingsTableRows = findingsList.map((f, idx) => [
      idx + 1,
      f.item || f.field || 'Clinical Finding',
      (f.severity || 'info').toUpperCase(),
      f.reason || f.message || '',
      f.clinicalConsideration || f.potentialConcern || '',
      f.evidenceSource || 'MedWise Database',
      f.doctorReviewRequired ? 'Yes' : 'No',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Finding Item', 'Severity', 'Explanation Reason', 'Clinical Consideration', 'Evidence Source', 'Review Req.']],
      body: findingsTableRows,
      theme: 'grid',
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { width: 8 },
        1: { fontStyle: 'bold', width: 35 },
        2: { fontStyle: 'bold', width: 20 },
        3: { width: 45 },
        4: { width: 40 },
        5: { width: 25 },
        6: { width: 12 },
      },
      margin: { left: margin, right: margin },
    });

    currentY = doc.lastAutoTable.finalY + 8;
  }

  // ═══════════════════════════════════════════════════════════
  // 6. CLINICAL DECISION SUPPORT DISCLAIMER
  // ═══════════════════════════════════════════════════════════
  checkPageOverflow(20);

  doc.setDrawColor(...lightColor);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...mediumColor);
  const disclaimerText = 'DISCLAIMER: MedWise provides automated clinical decision support analysis based on configured database guidelines. The prescribing physician remains sole decision-maker for all final diagnostic, dosage, and prescribing approvals.';
  const splitDisclaimer = doc.splitTextToSize(disclaimerText, contentWidth);
  doc.text(splitDisclaimer, margin, currentY);

  // Save PDF
  const filename = `${prescription.prescriptionId || 'MedWise-Report'}_CDS_Report.pdf`;
  doc.save(filename);
};
