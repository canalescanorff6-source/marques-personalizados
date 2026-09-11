process.env.NODE_ENV='development';
process.env.ADMIN_TOTP_SECRET='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const {normalizeTotpSecret,verifyAdminTotpCode}=await import('../lib/mfa.ts');
const tests=[
  [verifyAdminTotpCode('287082',59_000)===1,'vetor RFC 6238 em 59s'],
  [verifyAdminTotpCode('081804',1_111_111_109_000)===37_037_036,'vetor RFC 6238 em 1111111109s'],
  [verifyAdminTotpCode('005924',1_234_567_890_000)===41_152_263,'vetor RFC 6238 em 1234567890s'],
  [verifyAdminTotpCode('000000',59_000)===null,'código incorreto é rejeitado'],
  [normalizeTotpSecret('gez dgnbv-gy3tqojq===')==='GEZDGNBVGY3TQOJQ','normalização Base32'],
];
const failed=tests.filter(([ok])=>!ok);for(const [ok,label] of tests)console.log(`${ok?'✓':'✗'} ${label}`);if(failed.length)process.exit(1);console.log(`MFA Self Test: OK (${tests.length} verificações).`);
