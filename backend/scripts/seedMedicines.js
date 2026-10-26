const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');
const path = require('path');

// Configure environment and DNS resolution for Atlas
dotenv.config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const Medicine = require('../src/models/Medicine');

const initialMedicines = [
  // ================= PAIN / FEVER =================
  {
    genericName: 'Paracetamol',
    brandNames: ['Crocin', 'Calpol', 'Dolo 650', 'Pacimol'],
    drugClass: 'Analgesic / Antipyretic',
    therapeuticCategory: 'Pain Relief & Fever',
    description: 'Analgesic and antipyretic agent indicated for mild-to-moderate pain and reduction of fever.',
    activeIngredients: [
      { name: 'Paracetamol', amount: 500, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Syrup', 'Suspension', 'Injection'],
    availableStrengths: [
      { value: 500, unit: 'mg', dosageForm: 'Tablet' },
      { value: 650, unit: 'mg', dosageForm: 'Tablet' },
      { value: 120, unit: 'mg/5ml', dosageForm: 'Syrup' },
      { value: 250, unit: 'mg/5ml', dosageForm: 'Suspension' },
    ],
    routes: ['Oral', 'Intravenous'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 500,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 1000,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 4000,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Every 4–6 hours as needed',
        notes: 'Do not exceed 4000 mg in 24 hours to prevent hepatotoxicity.',
      },
    ],
    warnings: [
      'Use with caution in patients with hepatic impairment or chronic alcoholism.',
      'Do not exceed maximum daily dosage of 4g to avoid liver toxicity.',
    ],
    contraindications: [
      'Hypersensitivity to paracetamol.',
      'Severe active liver disease.',
    ],
    duplicateGroup: 'PARACETAMOL',
    allergyKeywords: ['Paracetamol', 'Acetaminophen', 'APAP'],
    isActive: true,
  },
  {
    genericName: 'Ibuprofen',
    brandNames: ['Brufen', 'Advil', 'Ibugesic'],
    drugClass: 'Non-Steroidal Anti-Inflammatory Drug (NSAID)',
    therapeuticCategory: 'Pain Relief & Anti-inflammatory',
    description: 'Non-steroidal anti-inflammatory drug providing analgesic, antipyretic, and anti-inflammatory relief.',
    activeIngredients: [
      { name: 'Ibuprofen', amount: 400, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Capsule', 'Suspension'],
    availableStrengths: [
      { value: 200, unit: 'mg', dosageForm: 'Tablet' },
      { value: 400, unit: 'mg', dosageForm: 'Tablet' },
      { value: 600, unit: 'mg', dosageForm: 'Tablet' },
      { value: 100, unit: 'mg/5ml', dosageForm: 'Suspension' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 200,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 800,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 2400,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Every 6–8 hours with food',
        notes: 'Administer with meals or milk to minimize gastrointestinal discomfort.',
      },
    ],
    warnings: [
      'Risk of GI ulceration, bleeding, and perforation.',
      'Use with caution in renal disease, hypertension, and heart failure.',
    ],
    contraindications: [
      'Active peptic ulcer or GI bleeding.',
      'History of asthma or allergic reaction triggered by aspirin or other NSAIDs.',
      'Severe renal or hepatic failure.',
    ],
    duplicateGroup: 'IBUPROFEN',
    allergyKeywords: ['Ibuprofen', 'NSAID', 'Aspirin sensitive'],
    isActive: true,
  },
  {
    genericName: 'Aspirin',
    brandNames: ['Disprin', 'Ecosprin', 'Bayer Aspirin'],
    drugClass: 'Salicylate / Antiplatelet',
    therapeuticCategory: 'Cardiovascular & Pain Relief',
    description: 'Cyclooxygenase inhibitor used at low doses for secondary prevention of thrombotic events and at higher doses for pain.',
    activeIngredients: [
      { name: 'Aspirin', amount: 75, unit: 'mg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 75, unit: 'mg', dosageForm: 'Tablet' },
      { value: 150, unit: 'mg', dosageForm: 'Tablet' },
      { value: 325, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 75,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 325,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 325,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily after breakfast for antiplatelet effect',
        notes: 'Low dose recommended for cardio-protection.',
      },
    ],
    warnings: [
      'Increased risk of upper gastrointestinal bleeding.',
      'Contraindicated in children with febrile viral illness due to Reye syndrome risk.',
    ],
    contraindications: [
      'Active peptic ulceration.',
      'Hemophilia or other bleeding disorders.',
      'Children under 16 years with viral symptoms.',
    ],
    duplicateGroup: 'ASPIRIN',
    allergyKeywords: ['Aspirin', 'Salicylates', 'NSAID'],
    isActive: true,
  },
  {
    genericName: 'Diclofenac',
    brandNames: ['Voveran', 'Voltaren', 'Dynapar'],
    drugClass: 'Non-Steroidal Anti-Inflammatory Drug (NSAID)',
    therapeuticCategory: 'Pain Relief & Musculoskeletal',
    description: 'Potent NSAID with marked anti-inflammatory, analgesic, and antipyretic properties.',
    activeIngredients: [
      { name: 'Diclofenac Sodium', amount: 50, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Gel', 'Injection'],
    availableStrengths: [
      { value: 50, unit: 'mg', dosageForm: 'Tablet' },
      { value: 75, unit: 'mg', dosageForm: 'Tablet' },
      { value: 75, unit: 'mg/3ml', dosageForm: 'Injection' },
    ],
    routes: ['Oral', 'Intramuscular', 'Topical'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 50,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 75,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 150,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Two to three times daily after food',
        notes: 'Use lowest effective dose for shortest duration possible.',
      },
    ],
    warnings: [
      'Cardiovascular thrombotic risk with extended high-dose therapy.',
      'Risk of acute kidney injury and GI mucosal damage.',
    ],
    contraindications: [
      'Active gastrointestinal ulcers or bleeding.',
      'Severe heart failure or post-CABG surgery.',
    ],
    duplicateGroup: 'DICLOFENAC',
    allergyKeywords: ['Diclofenac', 'NSAID'],
    isActive: true,
  },

  // ================= ANTIBIOTICS =================
  {
    genericName: 'Amoxicillin',
    brandNames: ['Mox', 'Novamox', 'Amoxil'],
    drugClass: 'Aminopenicillin Antibiotic',
    therapeuticCategory: 'Antibacterial',
    description: 'Moderate-spectrum beta-lactam bactericidal antibiotic targeting gram-positive and selected gram-negative pathogens.',
    activeIngredients: [
      { name: 'Amoxicillin Trihydrate', amount: 500, unit: 'mg' },
    ],
    dosageForms: ['Capsule', 'Tablet', 'Suspension'],
    availableStrengths: [
      { value: 250, unit: 'mg', dosageForm: 'Capsule' },
      { value: 500, unit: 'mg', dosageForm: 'Capsule' },
      { value: 125, unit: 'mg/5ml', dosageForm: 'Suspension' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 250,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 1000,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 3000,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Every 8 hours or every 12 hours depending on infection severity',
        notes: 'Complete entire prescribed antimicrobial course.',
      },
    ],
    warnings: [
      'Clostridioides difficile-associated diarrhea may occur during or after treatment.',
      'Adjust dosage in patients with severe renal impairment.',
    ],
    contraindications: [
      'History of serious hypersensitivity reaction to penicillin or beta-lactam antibiotics.',
    ],
    duplicateGroup: 'AMOXICILLIN',
    allergyKeywords: ['Amoxicillin', 'Penicillin', 'Beta-lactam', 'Ampicillin'],
    isActive: true,
  },
  {
    genericName: 'Azithromycin',
    brandNames: ['Azithral', 'Zithromax', 'Azee'],
    drugClass: 'Macrolide Antibiotic',
    therapeuticCategory: 'Antibacterial',
    description: 'Azalide subclass macrolide antibiotic inhibiting microbial protein synthesis with long tissue half-life.',
    activeIngredients: [
      { name: 'Azithromycin Dihydrate', amount: 500, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Suspension', 'Injection'],
    availableStrengths: [
      { value: 250, unit: 'mg', dosageForm: 'Tablet' },
      { value: 500, unit: 'mg', dosageForm: 'Tablet' },
      { value: 200, unit: 'mg/5ml', dosageForm: 'Suspension' },
    ],
    routes: ['Oral', 'Intravenous'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 250,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 500,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 500,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily 1 hour before or 2 hours after meals',
        notes: 'Standard 3 to 5 day regimen depending on infection indication.',
      },
    ],
    warnings: [
      'May prolong QT interval and provoke torsades de pointes in susceptible individuals.',
      'Caution in patients with severe hepatic dysfunction.',
    ],
    contraindications: [
      'Hypersensitivity to azithromycin, erythromycin, or any macrolide antibiotic.',
      'History of cholestatic jaundice associated with prior azithromycin use.',
    ],
    duplicateGroup: 'AZITHROMYCIN',
    allergyKeywords: ['Azithromycin', 'Macrolide', 'Erythromycin', 'Clarithromycin'],
    isActive: true,
  },
  {
    genericName: 'Ciprofloxacin',
    brandNames: ['Cifran', 'Ciplox', 'Cipro'],
    drugClass: 'Fluoroquinolone Antibiotic',
    therapeuticCategory: 'Antibacterial',
    description: 'Broad-spectrum bactericidal fluoroquinolone inhibiting bacterial DNA gyrase and topoisomerase IV.',
    activeIngredients: [
      { name: 'Ciprofloxacin Hydrochloride', amount: 500, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Eye/Ear Drops', 'Injection'],
    availableStrengths: [
      { value: 250, unit: 'mg', dosageForm: 'Tablet' },
      { value: 500, unit: 'mg', dosageForm: 'Tablet' },
      { value: 750, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral', 'Intravenous', 'Ophthalmic'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 250,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 750,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 1500,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Every 12 hours with plenty of fluids',
        notes: 'Avoid concurrent administration with antacids, iron, or calcium.',
      },
    ],
    warnings: [
      'Black box warning for tendinitis and tendon rupture.',
      'May exacerbate muscle weakness in patients with myasthenia gravis.',
    ],
    contraindications: [
      'Hypersensitivity to ciprofloxacin or quinolones.',
      'Concurrent administration of tizanidine.',
    ],
    duplicateGroup: 'CIPROFLOXACIN',
    allergyKeywords: ['Ciprofloxacin', 'Fluoroquinolone', 'Quinolone', 'Ofloxacin', 'Levofloxacin'],
    isActive: true,
  },
  {
    genericName: 'Doxycycline',
    brandNames: ['Doxicip', 'Vibramycin', 'Doxt-SL'],
    drugClass: 'Tetracycline Antibiotic',
    therapeuticCategory: 'Antibacterial',
    description: 'Broad-spectrum bacteriostatic tetracycline antibiotic for respiratory, skin, and atypical infections.',
    activeIngredients: [
      { name: 'Doxycycline Hyclate', amount: 100, unit: 'mg' },
    ],
    dosageForms: ['Capsule', 'Tablet'],
    availableStrengths: [
      { value: 100, unit: 'mg', dosageForm: 'Capsule' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 100,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 100,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 200,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: '100 mg every 12 hours on day 1, then 100 mg once or twice daily',
        notes: 'Take with a full glass of water and remain upright for 30 minutes to prevent esophageal irritation.',
      },
    ],
    warnings: [
      'Photosensitivity reactions upon sun exposure.',
      'Tooth discoloration when used in tooth development stages (pregnancy / children < 8 years).',
    ],
    contraindications: [
      'Hypersensitivity to tetracyclines.',
      'Pregnancy and nursing mothers unless alternative treatments unavailable.',
    ],
    duplicateGroup: 'DOXYCYCLINE',
    allergyKeywords: ['Doxycycline', 'Tetracycline', 'Minocycline'],
    isActive: true,
  },
  {
    genericName: 'Amoxicillin and Clavulanate',
    brandNames: ['Augmentin', 'Clavam', 'Moxikind-CV', 'Amoxyclav'],
    drugClass: 'Antibiotic (Penicillin / Beta-lactamase Inhibitor)',
    therapeuticCategory: 'Antibacterial Combination',
    description: 'Synergistic combination of amoxicillin and clavulanate potassium providing bactericidal coverage against beta-lactamase producing organisms.',
    activeIngredients: [
      { name: 'Amoxicillin Trihydrate', amount: 500, unit: 'mg' },
      { name: 'Potassium Clavulanate', amount: 125, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Oral Suspension'],
    availableStrengths: [
      { value: 625, unit: 'mg', dosageForm: 'Tablet' },
      { value: 375, unit: 'mg', dosageForm: 'Tablet' },
      { value: 1000, unit: 'mg', dosageForm: 'Tablet' },
      { value: 228.5, unit: 'mg/5ml', dosageForm: 'Oral Suspension' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 375,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 1000,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 3000,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Every 8–12 hours at the start of a meal',
        notes: 'Administer at the start of a meal to reduce gastrointestinal side effects and enhance clavulanate absorption.',
      },
    ],
    warnings: [
      'Hepatic dysfunction and cholestatic jaundice have been reported with clavulanate.',
      'Serious hypersensitivity reactions (anaphylaxis) may occur in penicillin-sensitive patients.',
    ],
    contraindications: [
      'History of serious hypersensitivity to beta-lactam antibiotics.',
      'Previous history of amoxicillin/clavulanate-associated jaundice or hepatic impairment.',
    ],
    duplicateGroup: 'AMOXICILLIN_CLAVULANATE',
    allergyKeywords: ['Amoxicillin', 'Clavulanate', 'Penicillin', 'Beta-lactam'],
    isActive: true,
  },

  // ================= GASTROINTESTINAL =================
  {
    genericName: 'Omeprazole',
    brandNames: ['Omez', 'Prilosec', 'Ocid'],
    drugClass: 'Proton Pump Inhibitor (PPI)',
    therapeuticCategory: 'Gastrointestinal & Acid Reduction',
    description: 'Gastric parietal cell H+/K+ ATPase inhibitor suppressing gastric basal and stimulated acid secretion.',
    activeIngredients: [
      { name: 'Omeprazole', amount: 20, unit: 'mg' },
    ],
    dosageForms: ['Capsule', 'Tablet'],
    availableStrengths: [
      { value: 20, unit: 'mg', dosageForm: 'Capsule' },
      { value: 40, unit: 'mg', dosageForm: 'Capsule' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 20,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 40,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 80,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily 30–60 minutes before breakfast',
        notes: 'Swallow whole, do not crush or chew delayed-release beads.',
      },
    ],
    warnings: [
      'Long-term therapy may reduce vitamin B12, magnesium, and bone mineral density.',
      'Increased risk of Clostridioides difficile infection.',
    ],
    contraindications: [
      'Hypersensitivity to omeprazole or substituted benzimidazoles.',
      'Concomitant administration with rilpivirine.',
    ],
    duplicateGroup: 'OMEPRAZOLE',
    allergyKeywords: ['Omeprazole', 'PPI', 'Benzimidazole'],
    isActive: true,
  },
  {
    genericName: 'Pantoprazole',
    brandNames: ['Pantocid', 'Pan 40', 'Protonix'],
    drugClass: 'Proton Pump Inhibitor (PPI)',
    therapeuticCategory: 'Gastrointestinal & Acid Reduction',
    description: 'Proton pump inhibitor used to treat GERD, erosive esophagitis, and hypersecretory conditions.',
    activeIngredients: [
      { name: 'Pantoprazole Sodium', amount: 40, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Injection'],
    availableStrengths: [
      { value: 40, unit: 'mg', dosageForm: 'Tablet' },
      { value: 40, unit: 'mg', dosageForm: 'Injection' },
    ],
    routes: ['Oral', 'Intravenous'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 40,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 40,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 80,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily before morning meal',
        notes: 'Tablet should be swallowed whole.',
      },
    ],
    warnings: [
      'Hypomagnesemia with prolonged use (> 3 months).',
      'Acute interstitial nephritis reported rarely.',
    ],
    contraindications: [
      'Known hypersensitivity to pantoprazole or other PPIs.',
    ],
    duplicateGroup: 'PANTOPRAZOLE',
    allergyKeywords: ['Pantoprazole', 'PPI', 'Benzimidazole'],
    isActive: true,
  },
  {
    genericName: 'Ondansetron',
    brandNames: ['Emeset', 'Zofran', 'Vomikind'],
    drugClass: '5-HT3 Receptor Antagonist',
    therapeuticCategory: 'Antiemetic',
    description: 'Selective 5-HT3 receptor antagonist preventing nausea and vomiting induced by chemotherapy or surgery.',
    activeIngredients: [
      { name: 'Ondansetron Hydrochloride', amount: 4, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Syrup', 'Injection'],
    availableStrengths: [
      { value: 4, unit: 'mg', dosageForm: 'Tablet' },
      { value: 8, unit: 'mg', dosageForm: 'Tablet' },
      { value: 2, unit: 'mg/ml', dosageForm: 'Injection' },
    ],
    routes: ['Oral', 'Intravenous'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 4,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 8,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 24,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Every 8 hours as needed for nausea',
        notes: 'Can be given 30 minutes before meal or procedure.',
      },
    ],
    warnings: [
      'Dose-dependent QT prolongation; use with caution in congenital long QT syndrome.',
      'Potential serotonin syndrome when used with other serotonergic agents.',
    ],
    contraindications: [
      'Hypersensitivity to ondansetron.',
      'Concomitant use with apomorphine.',
    ],
    duplicateGroup: 'ONDANSETRON',
    allergyKeywords: ['Ondansetron', '5-HT3 antagonist'],
    isActive: true,
  },

  // ================= DIABETES =================
  {
    genericName: 'Metformin',
    brandNames: ['Glycomet', 'Glucophage', 'Obimet'],
    drugClass: 'Biguanide Antidiabetic',
    therapeuticCategory: 'Diabetes Management',
    description: 'First-line oral biguanide that decreases hepatic glucose production and improves insulin sensitivity.',
    activeIngredients: [
      { name: 'Metformin Hydrochloride', amount: 500, unit: 'mg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 500, unit: 'mg', dosageForm: 'Tablet' },
      { value: 850, unit: 'mg', dosageForm: 'Tablet' },
      { value: 1000, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 500,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 1000,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 2550,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Twice daily with morning and evening meals',
        notes: 'Titrate slowly to reduce gastrointestinal adverse effects.',
      },
    ],
    warnings: [
      'Black box warning for lactic acidosis, particularly in renal dysfunction.',
      'Withhold prior to iodinated contrast radiological procedures.',
    ],
    contraindications: [
      'Severe renal impairment (eGFR < 30 mL/min/1.73 m2).',
      'Acute or chronic metabolic acidosis, including diabetic ketoacidosis.',
    ],
    duplicateGroup: 'METFORMIN',
    allergyKeywords: ['Metformin', 'Biguanide'],
    isActive: true,
  },
  {
    genericName: 'Glimepiride',
    brandNames: ['Amaryl', 'Glimy', 'Zoryl'],
    drugClass: 'Second-Generation Sulfonylurea',
    therapeuticCategory: 'Diabetes Management',
    description: 'Potent sulfonylurea that stimulates pancreatic beta-cell insulin secretion.',
    activeIngredients: [
      { name: 'Glimepiride', amount: 1, unit: 'mg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 1, unit: 'mg', dosageForm: 'Tablet' },
      { value: 2, unit: 'mg', dosageForm: 'Tablet' },
      { value: 4, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 1,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 8,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 8,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily with breakfast or the first main meal',
        notes: 'Monitor blood glucose to prevent hypoglycemic episodes.',
      },
    ],
    warnings: [
      'High risk of hypoglycemia, particularly in elderly or renal impairment.',
      'Potential weight gain.',
    ],
    contraindications: [
      'Hypersensitivity to glimepiride or other sulfonylureas/sulfonamides.',
      'Diabetic ketoacidosis.',
    ],
    duplicateGroup: 'GLIMEPIRIDE',
    allergyKeywords: ['Glimepiride', 'Sulfonylurea', 'Sulfa drugs'],
    isActive: true,
  },

  // ================= CARDIOVASCULAR =================
  {
    genericName: 'Amlodipine',
    brandNames: ['Amlong', 'Norvasc', 'Stamlo'],
    drugClass: 'Dihydropyridine Calcium Channel Blocker',
    therapeuticCategory: 'Cardiovascular & Antihypertensive',
    description: 'Long-acting dihydropyridine calcium channel blocker inhibiting transmembrane calcium influx in vascular smooth muscle.',
    activeIngredients: [
      { name: 'Amlodipine Besylate', amount: 5, unit: 'mg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 2.5, unit: 'mg', dosageForm: 'Tablet' },
      { value: 5, unit: 'mg', dosageForm: 'Tablet' },
      { value: 10, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 2.5,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 10,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 10,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily with or without food',
        notes: 'Peripheral edema is a common dose-related side effect.',
      },
    ],
    warnings: [
      'Symptomatic hypotension may occur, especially in severe aortic stenosis.',
      'Peripheral dependent edema occurs in 5–10% of patients.',
    ],
    contraindications: [
      'Severe hypotension.',
      'Hypersensitivity to amlodipine.',
    ],
    duplicateGroup: 'AMLODIPINE',
    allergyKeywords: ['Amlodipine', 'Calcium channel blocker'],
    isActive: true,
  },
  {
    genericName: 'Losartan',
    brandNames: ['Losacar', 'Cozaar', 'Repace'],
    drugClass: 'Angiotensin II Receptor Blocker (ARB)',
    therapeuticCategory: 'Cardiovascular & Antihypertensive',
    description: 'Selective competitive angiotensin II receptor antagonist causing vasodilation and aldosterone reduction.',
    activeIngredients: [
      { name: 'Losartan Potassium', amount: 50, unit: 'mg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 25, unit: 'mg', dosageForm: 'Tablet' },
      { value: 50, unit: 'mg', dosageForm: 'Tablet' },
      { value: 100, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 25,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 100,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 100,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily or in two divided doses',
        notes: 'Assess renal function and serum potassium periodically.',
      },
    ],
    warnings: [
      'Fetal toxicity: discontinue immediately upon pregnancy detection.',
      'Risk of hyperkalemia when combined with potassium supplements or spironolactone.',
    ],
    contraindications: [
      'Hypersensitivity to losartan.',
      'Second and third trimesters of pregnancy.',
      'Concomitant use of aliskiren in patients with diabetes.',
    ],
    duplicateGroup: 'LOSARTAN',
    allergyKeywords: ['Losartan', 'ARB', 'Angiotensin receptor blocker'],
    isActive: true,
  },
  {
    genericName: 'Telmisartan',
    brandNames: ['Telma', 'Micardis', 'Telvas'],
    drugClass: 'Angiotensin II Receptor Blocker (ARB)',
    therapeuticCategory: 'Cardiovascular & Antihypertensive',
    description: 'Non-peptide angiotensin II receptor antagonist with longest half-life in class (> 24 hours).',
    activeIngredients: [
      { name: 'Telmisartan', amount: 40, unit: 'mg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 20, unit: 'mg', dosageForm: 'Tablet' },
      { value: 40, unit: 'mg', dosageForm: 'Tablet' },
      { value: 80, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 20,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 80,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 80,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily morning or evening',
        notes: 'Provides sustained 24-hour blood pressure control.',
      },
    ],
    warnings: [
      'Black box warning for fetotoxicity during pregnancy.',
      'Hyperkalemia risk in patients with chronic kidney disease.',
    ],
    contraindications: [
      'Pregnancy and breastfeeding.',
      'Biliary obstructive disorders.',
    ],
    duplicateGroup: 'TELMISARTAN',
    allergyKeywords: ['Telmisartan', 'ARB', 'Angiotensin blocker'],
    isActive: true,
  },
  {
    genericName: 'Atorvastatin',
    brandNames: ['Atorva', 'Lipitor', 'Storvas'],
    drugClass: 'HMG-CoA Reductase Inhibitor (Statin)',
    therapeuticCategory: 'Cardiovascular & Lipid-Lowering',
    description: 'HMG-CoA reductase inhibitor lowering low-density lipoprotein cholesterol (LDL-C) and cardiovascular risk.',
    activeIngredients: [
      { name: 'Atorvastatin Calcium', amount: 20, unit: 'mg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 10, unit: 'mg', dosageForm: 'Tablet' },
      { value: 20, unit: 'mg', dosageForm: 'Tablet' },
      { value: 40, unit: 'mg', dosageForm: 'Tablet' },
      { value: 80, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 10,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 80,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 80,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily at night or with evening meal',
        notes: 'Check baseline liver transaminases prior to initiation.',
      },
    ],
    warnings: [
      'Myopathy and rhabdomyolysis risk, aggravated by concomitant CYP3A4 inhibitors.',
      'Transient elevation in hepatic transaminases.',
    ],
    contraindications: [
      'Active liver disease or unexplained persistent transaminase elevations.',
      'Pregnancy and lactation.',
    ],
    duplicateGroup: 'ATORVASTATIN',
    allergyKeywords: ['Atorvastatin', 'Statin', 'HMG-CoA inhibitor'],
    isActive: true,
  },

  // ================= RESPIRATORY =================
  {
    genericName: 'Salbutamol',
    brandNames: ['Asthalin', 'Ventolin', 'ProAir'],
    drugClass: 'Short-Acting Beta-2 Agonist (SABA)',
    therapeuticCategory: 'Respiratory & Bronchodilator',
    description: 'Selective beta-2 adrenergic agonist relieving bronchospasm in asthma and COPD.',
    activeIngredients: [
      { name: 'Salbutamol Sulfate', amount: 2, unit: 'mg' },
    ],
    dosageForms: ['Inhaler', 'Tablet', 'Syrup', 'Nebulizer Solution'],
    availableStrengths: [
      { value: 100, unit: 'mcg/puff', dosageForm: 'Inhaler' },
      { value: 2, unit: 'mg', dosageForm: 'Tablet' },
      { value: 4, unit: 'mg', dosageForm: 'Tablet' },
      { value: 2, unit: 'mg/5ml', dosageForm: 'Syrup' },
    ],
    routes: ['Inhalation', 'Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 100,
        minimumDoseUnit: 'mcg',
        maximumSingleDose: 200,
        maximumSingleDoseUnit: 'mcg',
        maximumDailyDose: 800,
        maximumDailyDoseUnit: 'mcg',
        frequencyGuidance: '1–2 puffs every 4–6 hours as needed for acute wheeze/shortness of breath',
        notes: 'Rinse mouth after inhalation if using combination corticosteroid devices.',
      },
    ],
    warnings: [
      'Paradoxical bronchospasm may occur with inhaler formulations.',
      'Tremors, palpitations, and hypokalemia at high doses.',
    ],
    contraindications: [
      'Hypersensitivity to salbutamol or albuterol.',
    ],
    duplicateGroup: 'SALBUTAMOL',
    allergyKeywords: ['Salbutamol', 'Albuterol', 'Beta agonist'],
    isActive: true,
  },
  {
    genericName: 'Montelukast',
    brandNames: ['Montair', 'Singulair', 'Romilast'],
    drugClass: 'Leukotriene Receptor Antagonist (LTRA)',
    therapeuticCategory: 'Respiratory & Antiasthmatic',
    description: 'Cysteinyl leukotriene CysLT1 receptor antagonist used for chronic asthma maintenance and allergic rhinitis.',
    activeIngredients: [
      { name: 'Montelukast Sodium', amount: 10, unit: 'mg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 4, unit: 'mg', dosageForm: 'Tablet' },
      { value: 5, unit: 'mg', dosageForm: 'Tablet' },
      { value: 10, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 10,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 10,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 10,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: '10 mg once daily taken in the evening',
        notes: 'Not indicated for the reversal of acute bronchospasm.',
      },
    ],
    warnings: [
      'Black box warning for neuropsychiatric events (agitation, depression, sleep disturbances).',
    ],
    contraindications: [
      'Hypersensitivity to montelukast.',
    ],
    duplicateGroup: 'MONTELUKAST',
    allergyKeywords: ['Montelukast', 'Leukotriene antagonist'],
    isActive: true,
  },
  {
    genericName: 'Cetirizine',
    brandNames: ['Cetzine', 'Zyrtec', 'Alerid'],
    drugClass: 'Second-Generation Antihistamine',
    therapeuticCategory: 'Allergy & Antihistaminic',
    description: 'Non-sedating selective peripheral H1 receptor antagonist for seasonal allergic rhinitis and chronic urticaria.',
    activeIngredients: [
      { name: 'Cetirizine Hydrochloride', amount: 10, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Syrup'],
    availableStrengths: [
      { value: 5, unit: 'mg', dosageForm: 'Tablet' },
      { value: 10, unit: 'mg', dosageForm: 'Tablet' },
      { value: 5, unit: 'mg/5ml', dosageForm: 'Syrup' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 5,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 10,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 10,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily in the evening',
        notes: 'Dose adjustment recommended in moderate to severe renal impairment.',
      },
    ],
    warnings: [
      'Mild somnolence can occur; caution when operating machinery or driving.',
      'Additive CNS depression when combined with alcohol or sedatives.',
    ],
    contraindications: [
      'Hypersensitivity to cetirizine, hydroxyzine, or piperazine derivatives.',
      'End-stage renal disease (CrCl < 10 mL/min).',
    ],
    duplicateGroup: 'CETIRIZINE',
    allergyKeywords: ['Cetirizine', 'Hydroxyzine', 'Antihistamine'],
    isActive: true,
  },

  // ================= OTHER COMMON MEDICINES =================
  {
    genericName: 'Levothyroxine',
    brandNames: ['Thyronorm', 'Synthroid', 'Eltroxin'],
    drugClass: 'Synthetic Thyroid Hormone',
    therapeuticCategory: 'Endocrine & Thyroid Replacement',
    description: 'Synthetic levo-isomer of thyroxine (T4) used for thyroid hormone replacement therapy in hypothyroidism.',
    activeIngredients: [
      { name: 'Levothyroxine Sodium', amount: 50, unit: 'mcg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 25, unit: 'mcg', dosageForm: 'Tablet' },
      { value: 50, unit: 'mcg', dosageForm: 'Tablet' },
      { value: 75, unit: 'mcg', dosageForm: 'Tablet' },
      { value: 100, unit: 'mcg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 25,
        minimumDoseUnit: 'mcg',
        maximumSingleDose: 200,
        maximumSingleDoseUnit: 'mcg',
        maximumDailyDose: 200,
        maximumDailyDoseUnit: 'mcg',
        frequencyGuidance: 'Once daily on an empty stomach 30–60 minutes before breakfast with a full glass of water',
        notes: 'Narrow therapeutic index: avoid brand-switching without TSH monitoring.',
      },
    ],
    warnings: [
      'Do not use for the treatment of obesity or weight loss.',
      'May aggravate subclinical cardiac disease or arrhythmias.',
    ],
    contraindications: [
      'Uncorrected adrenal insufficiency.',
      'Acute myocardial infarction or acute myocarditis.',
    ],
    duplicateGroup: 'LEVOTHYROXINE',
    allergyKeywords: ['Levothyroxine', 'Thyroxine', 'T4'],
    isActive: true,
  },
  {
    genericName: 'Furosemide',
    brandNames: ['Lasix', 'Frusol'],
    drugClass: 'Loop Diuretic',
    therapeuticCategory: 'Cardiovascular & Diuretic',
    description: 'Short-acting potent loop diuretic inhibiting sodium and chloride reabsorption in the ascending limb of Henle.',
    activeIngredients: [
      { name: 'Furosemide', amount: 40, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Injection'],
    availableStrengths: [
      { value: 20, unit: 'mg', dosageForm: 'Tablet' },
      { value: 40, unit: 'mg', dosageForm: 'Tablet' },
      { value: 20, unit: 'mg/2ml', dosageForm: 'Injection' },
    ],
    routes: ['Oral', 'Intravenous'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 20,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 80,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 160,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once or twice daily, preferable morning dose to avoid nocturia',
        notes: 'Monitor serum electrolytes, especially potassium and magnesium.',
      },
    ],
    warnings: [
      'Profound diuresis leading to water and electrolyte depletion.',
      'Ototoxicity with rapid high-dose IV administration.',
    ],
    contraindications: [
      'Anuria.',
      'Hypersensitivity to furosemide or sulfonamides.',
      'Severe sodium and volume depletion.',
    ],
    duplicateGroup: 'FUROSEMIDE',
    allergyKeywords: ['Furosemide', 'Loop diuretic', 'Sulfa drugs'],
    isActive: true,
  },
  {
    genericName: 'Clopidogrel',
    brandNames: ['Deplatt', 'Plavix', 'Clopilet'],
    drugClass: 'P2Y12 Platelet Inhibitor',
    therapeuticCategory: 'Cardiovascular & Antiplatelet',
    description: 'Thienopyridine class antiplatelet agent that irreversibly inhibits the platelet P2Y12 adenosine diphosphate receptor.',
    activeIngredients: [
      { name: 'Clopidogrel Bisulfate', amount: 75, unit: 'mg' },
    ],
    dosageForms: ['Tablet'],
    availableStrengths: [
      { value: 75, unit: 'mg', dosageForm: 'Tablet' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 75,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 300,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 300,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: '75 mg once daily with or without food',
        notes: 'Loading dose of 300-600 mg may be used in acute coronary syndrome.',
      },
    ],
    warnings: [
      'Black box warning: diminished antiplatelet effect in CYP2C19 poor metabolizers.',
      'Bleeding risk increased when combined with NSAIDs or anticoagulants.',
    ],
    contraindications: [
      'Active pathological bleeding (e.g., peptic ulcer or intracranial hemorrhage).',
      'Severe hypersensitivity to clopidogrel.',
    ],
    duplicateGroup: 'CLOPIDOGREL',
    allergyKeywords: ['Clopidogrel', 'P2Y12 inhibitor', 'Thienopyridine'],
    isActive: true,
  },
  {
    genericName: 'Prednisolone',
    brandNames: ['Omnacortil', 'Prelone', 'Wysolone'],
    drugClass: 'Glucocorticoid / Corticosteroid',
    therapeuticCategory: 'Anti-inflammatory & Immunosuppressive',
    description: 'Synthetic glucocorticoid with potent anti-inflammatory and immunosuppressive actions.',
    activeIngredients: [
      { name: 'Prednisolone', amount: 10, unit: 'mg' },
    ],
    dosageForms: ['Tablet', 'Syrup'],
    availableStrengths: [
      { value: 5, unit: 'mg', dosageForm: 'Tablet' },
      { value: 10, unit: 'mg', dosageForm: 'Tablet' },
      { value: 20, unit: 'mg', dosageForm: 'Tablet' },
      { value: 5, unit: 'mg/5ml', dosageForm: 'Syrup' },
    ],
    routes: ['Oral'],
    dosageGuidelines: [
      {
        population: 'Adult',
        minimumDose: 5,
        minimumDoseUnit: 'mg',
        maximumSingleDose: 60,
        maximumSingleDoseUnit: 'mg',
        maximumDailyDose: 60,
        maximumDailyDoseUnit: 'mg',
        frequencyGuidance: 'Once daily with morning breakfast to mimic circadian cortisol peak',
        notes: 'Taper gradually following prolonged systemic therapy to prevent adrenal crisis.',
      },
    ],
    warnings: [
      'HPA axis suppression, opportunistic infections, osteopenia with prolonged use.',
      'May cause hyperglycemia, fluid retention, and mood alterations.',
    ],
    contraindications: [
      'Untreated systemic fungal infections.',
      'Administration of live vaccines during immunosuppressive therapy.',
    ],
    duplicateGroup: 'PREDNISOLONE',
    allergyKeywords: ['Prednisolone', 'Corticosteroid', 'Steroid', 'Prednisone'],
    isActive: true,
  },
];

const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

const seedMedicines = async () => {
  const isMain = require.main === module;
  let didConnect = false;
  try {
    if (mongoose.connection.readyState === 0) {
      console.log('[MedWise Seed] Connecting to database...');
      const conn = await mongoose.connect(process.env.MONGODB_URI);
      console.log(`[MedWise Seed] Connected to MongoDB: ${conn.connection.host}`);
      didConnect = true;
    }

    console.log(`[MedWise Seed] Upserting ${initialMedicines.length} clinical master medicines...`);

    let insertedCount = 0;
    let updatedCount = 0;

    for (const medData of initialMedicines) {
      const normalizedName = medData.genericName.trim();
      const escaped = escapeRegex(normalizedName);

      // Case-insensitive lookup to reliably detect existing records regardless of casing
      const existing = await Medicine.findOne({
        genericName: { $regex: new RegExp(`^${escaped}$`, 'i') },
      });

      if (existing) {
        await Medicine.updateOne(
          { _id: existing._id },
          { $set: { ...medData, genericName: existing.genericName } }
        );
        updatedCount++;
      } else {
        await Medicine.create({ ...medData, genericName: normalizedName });
        insertedCount++;
      }
    }

    const totalInDb = await Medicine.countDocuments({ isActive: true });
    console.log(`\n[MedWise Seed] Success!`);
    console.log(`- Seeded/Processed: ${initialMedicines.length} medicines (${insertedCount} new, ${updatedCount} updated)`);
    console.log(`- Total Active Master Medicines in DB: ${totalInDb}`);
    console.log(`- No unrelated collections were altered.`);

    if (didConnect) {
      await mongoose.disconnect();
      console.log('[MedWise Seed] Database connection closed cleanly.');
    }

    if (isMain) {
      process.exit(0);
    }
    return totalInDb;
  } catch (error) {
    console.error(`[MedWise Seed Error]: ${error.message}`);
    if (didConnect) {
      await mongoose.disconnect();
    }
    if (isMain) {
      process.exit(1);
    }
    throw error;
  }
};

if (require.main === module) {
  seedMedicines();
}

module.exports = { initialMedicines, seedMedicines };
