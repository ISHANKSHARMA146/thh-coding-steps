# Security audit prompt (extracted from anthropics/claude-code-security-review, `claudecode/prompts.py`, MIT)

Extracted verbatim in substance from the audit prompt template and the hard exclusion rules in `findings_filter.py`. JSON output schema dropped; the THH pipeline uses its own report format.

## Objective

Perform a security-focused review to identify HIGH-CONFIDENCE security vulnerabilities that could have real exploitation potential. Focus ONLY on security implications newly added by this change. Do not comment on pre-existing security concerns.

## Critical instructions

1. MINIMIZE FALSE POSITIVES: only flag issues where you are more than 80 percent confident of actual exploitability.
2. AVOID NOISE: skip theoretical issues, style concerns, or low-impact findings.
3. FOCUS ON IMPACT: prioritise vulnerabilities that could lead to unauthorized access, data breaches, or system compromise.

## Categories to examine

**Input validation:** SQL injection via unsanitized input; command injection in system calls or subprocesses; XXE in XML parsing; template injection; NoSQL injection; path traversal in file operations.

**Authentication and authorization:** authentication bypass logic; privilege escalation paths; session management flaws; JWT token vulnerabilities; authorization logic bypasses.

**Crypto and secrets:** hardcoded API keys, passwords, tokens; weak cryptographic algorithms; improper key storage; cryptographic randomness issues; certificate validation bypasses.

**Injection and code execution:** remote code execution via deserialization; pickle injection; YAML deserialization; eval injection; XSS (reflected, stored, DOM-based).

**Data exposure:** sensitive data logging or storage; PII handling violations; API endpoint data leakage; debug information exposure.

Even if something is only exploitable from the local network, it can still be HIGH severity.

## Methodology

Phase 1, repository context: identify the security frameworks and libraries in use, the established sanitization and validation patterns, the project's security model.
Phase 2, comparative analysis: compare the new code against those patterns; flag deviations and new attack surfaces.
Phase 3, vulnerability assessment: examine each modified file; trace data flow from user input to sensitive operations; look for privilege boundaries crossed unsafely; identify injection points and unsafe deserialization.

Each finding: file, line, severity, category, description, exploit scenario, recommendation, confidence.

## Severity

- HIGH: directly exploitable, leading to RCE, data breach, or authentication bypass.
- MEDIUM: requires specific conditions but has significant impact.
- LOW: defense-in-depth or lower-impact.

## Confidence

- 0.9 to 1.0: certain exploit path identified, tested if possible.
- 0.8 to 0.9: clear vulnerability pattern with known exploitation methods.
- 0.7 to 0.8: suspicious pattern requiring specific conditions.
- Below 0.7: do not report.

Focus on HIGH and MEDIUM. Better to miss some theoretical issues than flood the report with false positives. Each finding should be something a security engineer would confidently raise in a PR review.

## Hard exclusions (do not report on the security axis)

- Denial of service or resource exhaustion (memory, CPU, unbounded loops or recursion).
- Missing rate limiting or "add rate limiting" suggestions.
- Resource, file, connection, or memory leak "potential" (the maintainability axis owns leaks, with evidence).
- Open redirect unless a concrete exploit path is shown.
- Memory-safety classes that do not apply to Python or TypeScript (buffer overflow, use-after-free, integer overflow).
- Regex injection or regex denial of service.
- SSRF without a demonstrated attacker-controlled URL reaching an internal target.
- Secrets stored on disk (the THH standards rules on secrets and `.env` cover this; report those as standards findings, not security findings).
- Lack of input validation on non-security-critical fields without a proven problem.

THH note: these exclusions narrow the security axis only. Rate limiting, secrets handling and resource cleanup remain reviewable under the THH standards and the maintainability dimension.
