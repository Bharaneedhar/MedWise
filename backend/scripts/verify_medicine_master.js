const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const Medicine = require('../src/models/Medicine');
const { searchMedicines, getMedicineById } = require('../src/controllers/medicineController');
const { seedMedicines, initialMedicines } = require('../scripts/seedMedicines');
const { protect } = require('../src/middleware/authMiddleware');

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.data = data;
    return res;
  };
  return res;
};

const runSuite = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for Medicine Master test suite.\n');

    // ========================================================
    // 1. MEDICINE MODEL VALIDATION AND SAVE
    // ========================================================
    console.log('=== 1. MEDICINE MODEL VALIDATION AND SAVE ===');
    const testMedData = {
      genericName: `TestMed_${Date.now()}`,
      brandNames: ['BrandAlpha', 'BrandBeta'],
      drugClass: 'Analgesic',
      therapeuticCategory: 'Pain Relief',
      description: 'Test medicine entity for schema verification.',
      activeIngredients: [
        { name: 'ActiveCompA', amount: 250, unit: 'mg' },
      ],
      dosageForms: ['Tablet'],
      availableStrengths: [
        { value: 250, unit: 'mg', dosageForm: 'Tablet' },
      ],
      routes: ['Oral'],
      dosageGuidelines: [
        {
          population: 'Adult',
          minimumDose: 250,
          minimumDoseUnit: 'mg',
          maximumSingleDose: 500,
          maximumSingleDoseUnit: 'mg',
          maximumDailyDose: 1000,
          maximumDailyDoseUnit: 'mg',
          frequencyGuidance: 'Every 8 hours',
          notes: 'Test dosage guideline',
        },
      ],
      warnings: ['Test warning statement'],
      contraindications: ['Test contraindication statement'],
      duplicateGroup: 'TESTMED',
      allergyKeywords: ['TestMed', 'CompA'],
      isActive: true,
    };

    const savedMed = await Medicine.create(testMedData);
    console.log(`1.1 Medicine Created: ${savedMed.genericName} (ID: ${savedMed._id})`);
    if (!savedMed._id || savedMed.brandNames.length !== 2 || savedMed.activeIngredients.length !== 1) {
      throw new Error('Medicine schema failed to save expected fields.');
    }
    await Medicine.deleteOne({ _id: savedMed._id });
    console.log('    Temporary test medicine cleaned up successfully.');

    // ========================================================
    // 2. SEED EXECUTION
    // ========================================================
    console.log('\n=== 2. SEED EXECUTION ===');
    const countAfterSeed1 = await seedMedicines();
    console.log(`2.1 Seed executed successfully. Total active medicines in DB: ${countAfterSeed1}`);

    // ========================================================
    // 3. VERIFY APPROXIMATELY 25 MEDICINES EXIST
    // ========================================================
    console.log('\n=== 3. VERIFY APPROXIMATELY 25 MEDICINES EXIST ===');
    const totalActive = await Medicine.countDocuments({ isActive: true });
    console.log(`3.1 Total Active Master Medicines: ${totalActive} (Expected: ~25)`);
    if (totalActive < 20 || totalActive > 35) {
      throw new Error(`Unexpected medicine count in database: ${totalActive}`);
    }
    console.log('    Verified: Medicine database populated with approximately 25 master records.');

    // ========================================================
    // 4 & 5. RUN SEED A SECOND TIME & VERIFY COUNT REMAINS SAME
    // ========================================================
    console.log('\n=== 4 & 5. RUN SEED SECOND TIME (IDEMPOTENCY VERIFICATION) ===');
    const countAfterSeed2 = await seedMedicines();
    console.log(`4.1 Second seed execution finished. Total in DB: ${countAfterSeed2}`);
    if (countAfterSeed1 !== countAfterSeed2) {
      throw new Error(`Idempotency failure: count changed from ${countAfterSeed1} to ${countAfterSeed2}`);
    }
    console.log('    Idempotency verified: Zero duplicate records created.');

    // ========================================================
    // 6. VERIFY GENERIC-NAME DUPLICATE PROTECTION
    // ========================================================
    console.log('\n=== 6. VERIFY GENERIC-NAME DUPLICATE PROTECTION ===');
    let duplicateBlocked = false;
    try {
      // Attempt to create a duplicate record with different casing ('paracetamol' vs existing 'Paracetamol')
      await Medicine.create({
        genericName: 'paracetamol',
        drugClass: 'Analgesic',
        isActive: true,
      });
    } catch (err) {
      duplicateBlocked = true;
      console.log(`6.1 Duplicate creation rejected as expected: ${err.message}`);
    }
    if (!duplicateBlocked) {
      throw new Error('Case-insensitive duplicate genericName was improperly allowed to insert!');
    }

    let uppercaseBlocked = false;
    try {
      // Attempt with uppercase casing ('PARACETAMOL')
      await Medicine.create({
        genericName: 'PARACETAMOL',
        drugClass: 'Analgesic',
        isActive: true,
      });
    } catch (err) {
      uppercaseBlocked = true;
      console.log(`6.2 Uppercase duplicate rejected as expected: ${err.message}`);
    }
    if (!uppercaseBlocked) {
      throw new Error('Uppercase duplicate genericName was improperly allowed to insert!');
    }
    console.log('    Generic-name duplicate protection verified.');

    // ========================================================
    // 7. SEARCH: "paracetamol"
    // ========================================================
    console.log('\n=== 7. SEARCH "paracetamol" ===');
    const reqGen = { query: { search: 'paracetamol' }, user: { role: 'doctor' } };
    const resGen = mockRes();
    await searchMedicines(reqGen, resGen);
    console.log(`7.1 Search "paracetamol" returned ${resGen.data.count} result(s)`);
    const foundParacetamol = resGen.data.medicines.find((m) => m.genericName.toLowerCase() === 'paracetamol');
    if (!foundParacetamol) throw new Error('Paracetamol not found by search query "paracetamol"');
    console.log(`    Found: ${foundParacetamol.genericName} (${foundParacetamol.drugClass})`);

    // ========================================================
    // 8. SEARCH CASE-INSENSITIVELY: "PARACETAMOL"
    // ========================================================
    console.log('\n=== 8. SEARCH CASE-INSENSITIVELY: "PARACETAMOL" ===');
    const reqUpper = { query: { search: 'PARACETAMOL' }, user: { role: 'doctor' } };
    const resUpper = mockRes();
    await searchMedicines(reqUpper, resUpper);
    console.log(`8.1 Search "PARACETAMOL" returned ${resUpper.data.count} result(s)`);
    const foundUpper = resUpper.data.medicines.find((m) => m.genericName.toLowerCase() === 'paracetamol');
    if (!foundUpper) throw new Error('Paracetamol not found by uppercase search "PARACETAMOL"');
    console.log(`    Found: ${foundUpper.genericName} (${foundUpper.drugClass})`);

    // ========================================================
    // 9. SEARCH BY BRAND: "crocin" and "calpol"
    // ========================================================
    console.log('\n=== 9. SEARCH BY BRAND: "crocin" AND "calpol" ===');
    const reqCrocin = { query: { search: 'crocin' }, user: { role: 'doctor' } };
    const resCrocin = mockRes();
    await searchMedicines(reqCrocin, resCrocin);
    console.log(`9.1 Search brand "crocin" returned ${resCrocin.data.count} result(s)`);
    const foundCrocin = resCrocin.data.medicines.find((m) => m.genericName === 'Paracetamol');
    if (!foundCrocin) throw new Error('Paracetamol not found by brand name "crocin"');
    console.log(`    Found: ${foundCrocin.genericName} via brand "crocin"`);

    const reqCalpol = { query: { search: 'calpol' }, user: { role: 'doctor' } };
    const resCalpol = mockRes();
    await searchMedicines(reqCalpol, resCalpol);
    console.log(`9.2 Search brand "calpol" returned ${resCalpol.data.count} result(s)`);
    const foundCalpol = resCalpol.data.medicines.find((m) => m.genericName === 'Paracetamol');
    if (!foundCalpol) throw new Error('Paracetamol not found by brand name "calpol"');
    console.log(`    Found: ${foundCalpol.genericName} via brand "calpol"`);

    // ========================================================
    // 10. SEARCH BY ACTIVE INGREDIENT: "Amoxicillin"
    // ========================================================
    console.log('\n=== 10. SEARCH BY ACTIVE INGREDIENT: "Amoxicillin" ===');
    const reqActive = { query: { search: 'Amoxicillin' }, user: { role: 'doctor' } };
    const resActive = mockRes();
    await searchMedicines(reqActive, resActive);
    console.log(`10.1 Search active ingredient "Amoxicillin" returned ${resActive.data.count} result(s)`);
    const amoxList = resActive.data.medicines.filter((m) => m.genericName.toLowerCase().includes('amoxicillin'));
    if (amoxList.length === 0) throw new Error('Amoxicillin not found by active ingredient');
    console.log(`    Found medicines: ${amoxList.map((m) => m.genericName).join(', ')}`);

    // ========================================================
    // 11. INACTIVE MEDICINE FILTERING
    // ========================================================
    console.log('\n=== 11. INACTIVE MEDICINE FILTERING ===');
    const inactiveMed = await Medicine.create({
      genericName: `InactiveDrug_${Date.now()}`,
      drugClass: 'Experimental',
      isActive: false,
    });
    const reqInactive = { query: { search: inactiveMed.genericName }, user: { role: 'doctor' } };
    const resInactive = mockRes();
    await searchMedicines(reqInactive, resInactive);
    console.log(`11.1 Search for inactive drug returned ${resInactive.data.count} result(s)`);
    if (resInactive.data.count !== 0) throw new Error('Inactive medicine was unexpectedly returned in search');
    await Medicine.deleteOne({ _id: inactiveMed._id });
    console.log('    Verified: Inactive medicine successfully excluded from results and cleaned up.');

    // ========================================================
    // 12. RETRIEVE A MEDICINE BY ID
    // ========================================================
    console.log('\n=== 12. RETRIEVE A MEDICINE BY ID ===');
    const paraRecord = await Medicine.findOne({ genericName: 'Paracetamol' });
    const reqById = { params: { id: paraRecord._id.toString() }, user: { role: 'doctor' } };
    const resById = mockRes();
    await getMedicineById(reqById, resById);
    console.log(`12.1 GetById statusCode: ${resById.statusCode} | Generic: ${resById.data.medicine.genericName}`);
    if (resById.statusCode !== 200 || !resById.data.medicine.activeIngredients || !resById.data.medicine.dosageGuidelines) {
      throw new Error('Failed to retrieve full medicine details by ID');
    }
    console.log(`    Active Ingredients: ${resById.data.medicine.activeIngredients.map((i) => `${i.name} ${i.amount}${i.unit}`).join(', ')}`);
    console.log(`    Available Strengths: ${resById.data.medicine.availableStrengths.length} strengths`);
    console.log(`    Dosage Guidelines: ${resById.data.medicine.dosageGuidelines.length} guideline(s)`);
    console.log(`    Warnings: ${resById.data.medicine.warnings.length} warning(s)`);
    console.log(`    Contraindications: ${resById.data.medicine.contraindications.length} item(s)`);

    // ========================================================
    // 13. INVALID MONGODB OBJECTID RETURNS HTTP 400
    // ========================================================
    console.log('\n=== 13. INVALID MONGODB OBJECTID RETURNS HTTP 400 ===');
    const reqInvalid = { params: { id: 'invalid-id-xyz' } };
    const resInvalid = mockRes();
    await getMedicineById(reqInvalid, resInvalid);
    console.log(`13.1 Invalid ID response: ${resInvalid.statusCode} - ${resInvalid.data.message}`);
    if (resInvalid.statusCode !== 400) throw new Error('Expected 400 for invalid ID');

    // ========================================================
    // 14. NON-EXISTENT MEDICINE ID RETURNS HTTP 404
    // ========================================================
    console.log('\n=== 14. NON-EXISTENT MEDICINE ID RETURNS HTTP 404 ===');
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const reqNotFound = { params: { id: nonExistentId } };
    const resNotFound = mockRes();
    await getMedicineById(reqNotFound, resNotFound);
    console.log(`14.1 Not Found response: ${resNotFound.statusCode} - ${resNotFound.data.message}`);
    if (resNotFound.statusCode !== 404) throw new Error('Expected 404 for non-existent ID');

    // ========================================================
    // 15. UNAUTHENTICATED REQUEST TO GET /api/medicines RETURNS HTTP 401
    // ========================================================
    console.log('\n=== 15. UNAUTHENTICATED REQUEST RETURNS HTTP 401 ===');
    const reqNoAuth = { headers: {} };
    const resNoAuth = mockRes();
    let nextCalled = false;
    await protect(reqNoAuth, resNoAuth, () => { nextCalled = true; });
    console.log(`15.1 Unauthenticated request rejected with status: ${resNoAuth.statusCode} (nextCalled=${nextCalled})`);
    if (resNoAuth.statusCode !== 401 || nextCalled) {
      throw new Error('protect middleware failed to block unauthenticated request');
    }

    console.log('\n======================================================');
    console.log('>>> ALL MEDICINE MASTER VERIFICATION TESTS PASSED! <<<');
    console.log('======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`\n[Test Error]: ${error.message}`);
    if (error.stack) console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
};

runSuite();
