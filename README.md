# Orbikt-care-A Task 8 KDF benchmark

This public repository exists only to stage the synthetic browser benchmark for
Task 8 physical-device calibration. It contains no Orbikt-care-A application
source, application records, long-term-care data, production encryption code,
production KDF profile, analytics, telemetry, backend, cookies, authentication,
or credentials.

The page uses browser Web Crypto with:

- PBKDF2 / HMAC-SHA-256
- 300,000, 600,000, and 1,200,000 iterations
- synthetic 32-byte input
- a fresh 16-byte salt for every derivation
- a non-extractable 256-bit AES-GCM derived key
- 5 unrecorded warmups and 25 sequential samples per candidate per session
- deriveKey-only timing with median, nearest-rank p95, minimum, maximum, raw samples, and failures

The page has no automatic result upload or storage. Use the explicit local JSON
download after completing Session 1 and Session 2, then return the exported text
to the private Orbikt-care-A project owner for evidence recording. This benchmark
does not select or approve a production KDF profile.
