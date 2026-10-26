const mongoose = require('mongoose');
const dotenv = require('dotenv');
const dns = require('node:dns');

dotenv.config({ path: __dirname + '/../.env' });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const User = require('../src/models/User');
const Medicine = require('../src/models/Medicine');
const DrugInteraction = require('../src/models/DrugInteraction');
const MedicineSafetyRule = require('../src/models/MedicineSafetyRule');

const { register } = require('../src/controllers/authController');
const { searchMedicines, getMedicineById } = require('../src/controllers/medicineController');
const {
  getMedicineInteractions,
  getMedicineSafetyRules,
  getMedicineDosageGuidelines,
} = require('../src/controllers/clinicalSafetyController');

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

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for Clinical Safety Foundation verification.\n');

    const timestamp = Date.now();

    // 1. REGISTER TEST USER (DOCTOR ROLE)
    console.log('=== 1. TEST AUTHENTICATED USER SETUP ===');
    const docRegReq = {
      body: {
        name: 'Dr. Safety Verifier',
        email: `doc.safety.${timestamp}@medwise.com`,
        password: 'password123',
        role: 'doctor',
      },
    };
    const docRegRes = mockRes();
    await register(docRegReq, docRegRes, (err) => { if (err) throw err; });
    const doctorUser = await User.findById(docRegRes.data.user.id);
    console.log('1.1 Doctor Registered:', doctorUser.name);

    // 2. MEDICINE MODEL & EXISTING SEARCH API FUNCTIONALITY
    console.log('\n=== 2. MEDICINE MODEL & SEARCH REGRESSION ===');
    const paracetamol = await Medicine.findOne({ genericName: 'Paracetamol', isActive: true });
    const amoxicillin = await Medicine.findOne({ genericName: 'Amoxicillin', isActive: true });

    if (!paracetamol || !amoxicillin) {
      throw new Error('Paracetamol and Amoxicillin must exist in Medicine Master Database. Run seed:medicines first.');
    }
    console.log('2.1 Retrived Medicines: Paracetamol (ID:', paracetamol._id, '), Amoxicillin (ID:', amoxicillin._id, ')');

    // Search regression
    const searchReq = { user: doctorUser, query: { search: 'para' } };
    const searchRes = mockRes();
    await searchMedicines(searchReq, searchRes, (err) => { if (err) throw err; });
    console.log('2.2 GET /api/medicines?search=para returned:', searchRes.data.count, 'results');
    if (searchRes.data.count === 0) throw new Error('Search regression failed for "para"');

    // 3. DRUG INTERACTION MODEL VALIDATION & DUPLICATE PROTECTION
    console.log('\n=== 3. DRUG INTERACTION MODEL VALIDATION & PAIR DEDUPING ===');

    // Test 3.1: Self-interaction prevention
    const selfInteraction = new DrugInteraction({
      medicineA: paracetamol._id,
      medicineB: paracetamol._id,
      interactionType: 'Drug-Drug',
      severity: 'Major',
      description: 'Self-interaction test',
    });
    let selfErr = null;
    try {
      await selfInteraction.validate();
    } catch (err) {
      selfErr = err;
    }
    console.log('3.1 Self-interaction validation rejected:', selfErr ? 'YES (' + selfErr.message + ')' : 'NO');
    if (!selfErr) throw new Error('Drug interaction between a medicine and itself must be rejected');

    // Test 3.2: Valid Interaction Creation & Pair Key Generation
    const interactionA = new DrugInteraction({
      medicineA: paracetamol._id,
      medicineB: amoxicillin._id,
      interactionType: 'Drug-Drug',
      severity: 'Minor',
      description: 'Test interaction pair',
    });
    await interactionA.validate();
    console.log('3.2 Interaction pair key generated:', interactionA.interactionPairKey);

    const sortedIds = [String(paracetamol._id), String(amoxicillin._id)].sort();
    const expectedPairKey = `${sortedIds[0]}_${sortedIds[1]}`;
    if (interactionA.interactionPairKey !== expectedPairKey) {
      throw new Error(`Pair key mismatch. Expected ${expectedPairKey}, got ${interactionA.interactionPairKey}`);
    }

    // Test 3.3: Order-independence pair key match
    const interactionB = new DrugInteraction({
      medicineA: amoxicillin._id,
      medicineB: paracetamol._id,
      interactionType: 'Drug-Drug',
      severity: 'Minor',
      description: 'Reverse order test',
    });
    await interactionB.validate();
    console.log('3.3 Reverse order pair key match:', interactionB.interactionPairKey === interactionA.interactionPairKey);
    if (interactionB.interactionPairKey !== interactionA.interactionPairKey) {
      throw new Error('Reverse medicine pair must produce identical pair key');
    }

    // 4. MEDICINE SAFETY RULE MODEL VALIDATION
    console.log('\n=== 4. MEDICINE SAFETY RULE MODEL VALIDATION ===');
    const safetyRule = new MedicineSafetyRule({
      medicine: amoxicillin._id,
      safetyType: 'allergy',
      trigger: 'Penicillin Hypersensitivity',
      severity: 'Life-Threatening',
      description: 'Cross-sensitivity to beta-lactams',
    });
    await safetyRule.validate();
    console.log('4.1 Safety Rule validated successfully:', safetyRule.safetyType, '| Trigger:', safetyRule.trigger);

    // Invalid safetyType enum test
    const invalidRule = new MedicineSafetyRule({
      medicine: amoxicillin._id,
      safetyType: 'invalid-type',
      trigger: 'Test Trigger',
    });
    let ruleErr = null;
    try {
      await invalidRule.validate();
    } catch (err) {
      ruleErr = err;
    }
    console.log('4.2 Invalid safetyType enum rejected:', ruleErr ? 'YES' : 'NO');
    if (!ruleErr) throw new Error('Invalid safetyType enum must be rejected by Mongoose validation');

    // 5. PROTECTED CLINICAL SAFETY ENDPOINTS
    console.log('\n=== 5. PROTECTED CLINICAL SAFETY READ-ONLY ENDPOINTS ===');

    // GET /api/medicines/:id/interactions
    const intReq = { user: doctorUser, params: { id: String(paracetamol._id) } };
    const intRes = mockRes();
    await getMedicineInteractions(intReq, intRes, (err) => { if (err) throw err; });
    console.log('5.1 GET /api/medicines/:id/interactions status:', intRes.statusCode, '| Count:', intRes.data.count);
    if (intRes.statusCode !== 200 || !Array.isArray(intRes.data.interactions)) {
      throw new Error('Interactions API endpoint failed');
    }

    // GET /api/medicines/:id/safety
    const safReq = { user: doctorUser, params: { id: String(amoxicillin._id) } };
    const safRes = mockRes();
    await getMedicineSafetyRules(safReq, safRes, (err) => { if (err) throw err; });
    console.log('5.2 GET /api/medicines/:id/safety status:', safRes.statusCode, '| Rules count:', safRes.data.safetyRulesCount);
    if (safRes.statusCode !== 200 || !Array.isArray(safRes.data.safetyRules)) {
      throw new Error('Safety Rules API endpoint failed');
    }

    // GET /api/medicines/:id/dosage-guidelines
    const dosReq = { user: doctorUser, params: { id: String(paracetamol._id) } };
    const dosRes = mockRes();
    await getMedicineDosageGuidelines(dosReq, dosRes, (err) => { if (err) throw err; });
    console.log('5.3 GET /api/medicines/:id/dosage-guidelines status:', dosRes.statusCode, '| Guidelines count:', dosRes.data.count);
    if (dosRes.statusCode !== 200 || !Array.isArray(dosRes.data.dosageGuidelines)) {
      throw new Error('Dosage Guidelines API endpoint failed');
    }

    // 6. CLEANUP TEST USER
    console.log('\n=== 6. CLEANUP TEST DATA ===');
    await User.findByIdAndDelete(doctorUser._id);
    console.log('Test cleanup complete.');

    console.log('\n======================================================');
    console.log('>>> ALL CLINICAL SAFETY FOUNDATION TESTS PASSED! <<<');
    console.log('======================================================');
    process.exit(0);
  } catch (error) {
    console.error('Clinical safety foundation verification error:', error);
    process.exit(1);
  }
};

runTest();
