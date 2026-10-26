const { validatePrescriptionStructure, aggregatePrescriptionAudit } = require('../src/services/medwise/prescriptionAuditService');

function runPhase1AuditTests() {
  console.log('=== RUNNING MEDWISE PHASE 1 EXPLAINABLE PRESCRIPTION AUDIT TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✓ PASSED: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAILED: ${testName}`);
      failed++;
    }
  }

  // 1. Complete prescription test
  const completeRx = {
    patientId: '507f1f77bcf86cd799439011',
    patientName: 'John Doe',
    patientPid: 'PAT-1001',
    patientAge: 35,
    patientGender: 'Male',
    medicines: [
      {
        medicineName: 'Amoxicillin 500mg Capsule',
        genericName: 'Amoxicillin',
        strength: '500mg',
        dose: '1 Capsule',
        frequency: 'TDS',
        duration: '5 Days',
        route: 'Oral',
        instructions: 'After meals',
      },
    ],
  };
  const completeProfile = {
    hasNoKnownAllergies: true,
    allergies: [],
  };

  const findings1 = validatePrescriptionStructure(completeRx, completeProfile);
  assert(findings1.length === 0, '1. Complete prescription has 0 audit findings');

  const audit1 = aggregatePrescriptionAudit(
    {
      dosage: [{ status: 'within_guidance', severity: 'info', genericName: 'Amoxicillin', message: 'OK' }],
      interactions: { status: 'completed', findings: [] },
      duplicates: { status: 'no_duplicates_found', findings: [] },
      allergySafety: { status: 'completed', findings: [] },
    },
    { prescription: completeRx, patientProfile: completeProfile }
  );
  assert(audit1.overallRecommendation.status === 'cleared', '1. Complete prescription returns CLEARED outcome');

  // 2. Missing medicine field test (e.g. medicineName)
  const missingMedNameRx = {
    ...completeRx,
    medicines: [
      {
        strength: '500mg',
        dose: '1 Capsule',
        frequency: 'TDS',
        duration: '5 Days',
        route: 'Oral',
        instructions: 'After meals',
      },
    ],
  };
  const findings2 = validatePrescriptionStructure(missingMedNameRx, completeProfile);
  const medNameFinding = findings2.find((f) => f.field === 'medicineName');
  assert(Boolean(medNameFinding), '2. Missing medicine name produces medicineName finding');
  assert(medNameFinding?.status === 'Missing', '2. Finding status is Missing');

  // 3. Missing strength/dose/frequency/duration/route/instructions
  const incompleteMedFieldsRx = {
    ...completeRx,
    medicines: [
      {
        medicineName: 'Paracetamol',
        genericName: 'Paracetamol',
        // strength, dose, frequency, duration, route, instructions omitted
      },
    ],
  };
  const findings3 = validatePrescriptionStructure(incompleteMedFieldsRx, completeProfile);
  const fieldsTested = ['strength', 'dose', 'frequency', 'duration', 'route', 'instructions'];
  const missingFieldsFound = fieldsTested.every((field) => findings3.some((f) => f.field === field));
  assert(missingFieldsFound, '3. Missing strength/dose/frequency/duration/route/instructions all produced individual findings');
  assert(
    findings3.every((f) => f.item && f.field && f.status && f.reason && f.clinicalConsideration && f.severity),
    '3. All findings follow structured format (item, field, status, reason, clinicalConsideration, severity)'
  );

  // 4. Missing patient-required information (e.g. age missing, gender unspecified)
  const missingPatientDataRx = {
    ...completeRx,
    patientAge: 0,
    patientGender: 'Unspecified',
  };
  const findings4 = validatePrescriptionStructure(missingPatientDataRx, completeProfile);
  assert(findings4.some((f) => f.field === 'patientAge'), '4. Missing patient age produces patientAge finding');
  assert(findings4.some((f) => f.field === 'patientGender'), '4. Missing patient gender produces patientGender finding');

  // 5. Incomplete allergy assessment
  const incompleteAllergyProfile = {
    hasNoKnownAllergies: false,
    allergies: [],
  };
  const findings5 = validatePrescriptionStructure(completeRx, incompleteAllergyProfile);
  const allergyFinding = findings5.find((f) => f.field === 'allergies');
  assert(Boolean(allergyFinding), '5. Incomplete allergy assessment produces allergy finding');
  assert(allergyFinding?.status === 'Incomplete', '5. Allergy finding status is Incomplete');
  assert(allergyFinding?.reason === 'Patient allergy information has not been explicitly completed.', '5. Allergy finding reason matches expected');
  assert(allergyFinding?.clinicalConsideration === 'Complete the allergy assessment before relying on the full safety evaluation.', '5. Allergy finding clinical consideration matches expected');

  const audit5 = aggregatePrescriptionAudit(
    {
      dosage: [],
      interactions: { status: 'completed', findings: [] },
      duplicates: { status: 'no_duplicates_found', findings: [] },
      allergySafety: { status: 'completed', findings: [] },
    },
    { prescription: completeRx, patientProfile: incompleteAllergyProfile }
  );
  assert(audit5.overallRecommendation.status === 'unable_to_assess', '5. Incomplete allergy assessment results in unable_to_assess (ANALYSIS INCOMPLETE)');

  // 6. Explicit "No known allergies" must be treated as completed
  const explicitNoAllergiesProfile = {
    hasNoKnownAllergies: true,
    allergies: [],
  };
  const findings6 = validatePrescriptionStructure(completeRx, explicitNoAllergiesProfile);
  assert(!findings6.some((f) => f.field === 'allergies'), '6. Explicit "No known allergies" produces 0 allergy missing findings');

  // 7. Multiple missing fields
  const multipleMissingRx = {
    patientId: null,
    patientAge: 0,
    patientGender: '',
    medicines: [
      {
        medicineName: 'Ibuprofen',
      },
    ],
  };
  const findings7 = validatePrescriptionStructure(multipleMissingRx, incompleteAllergyProfile);
  assert(findings7.length >= 8, '7. Multiple missing fields produce structured findings for each item (found ' + findings7.length + ')');
  const audit7 = aggregatePrescriptionAudit(
    {
      dosage: [],
      interactions: null,
      duplicates: null,
      allergySafety: null,
    },
    { prescription: multipleMissingRx, patientProfile: incompleteAllergyProfile }
  );
  assert(audit7.overallRecommendation.status === 'unable_to_assess', '7. Multiple missing fields result in unable_to_assess outcome');

  console.log(`\nPHASE 1 AUDIT TEST RESULTS: ${passed} Passed, ${failed} Failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPhase1AuditTests();
