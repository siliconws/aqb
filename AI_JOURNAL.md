# AI Usage Journal

## Tool(s) used
- GitHub Copilot Chat (GPT-5.3-Codex)
- VS Code workspace tools (file read/search, patching)

## Interaction Log

| # | What I asked the AI | Quality of AI response (1-5) | Accepted? | My reasoning |
|---|---------------------|------------------------------|-----------|--------------|
| 1 | Create the three starter source files from the assessment prompt. | 5 | Yes | Correct paths and content. |
| 2 | Compare requirements vs code and identify what is missing before coding. | 5 | Yes | Gaps were identified correctly. |
| 3 | Add dashboard support for missing-in-bank/missing-in-local and expandable details. | 4 | Partial | UI added, but historical detail persistence still pending. |
| 4 | Add requirement-trace comments in code for JSON bank intake. | 5 | Yes | Added at the correct code points. |
| 5 | Add TODO markers only for unresolved requirement gaps. | 5 | Yes | TODOs were added without behavior changes. |
| 6 | Draft concise commit messages for staged changes. | 5 | Yes | Messages matched the changes. |

## Reflection

**Bugs AI found correctly** (that you then verified):
- Amount-only matching in reconciler is unsafe and can produce false matches.
- API route had SQL injection risk via interpolated SQL strings. <<== Assumption only
- API leaked stack traces in error responses.
- Dashboard polling lacked cleanup and had delayed initial fetch behavior.
- Historical detail drill-down was not truly backed by persisted data.

**Bugs AI missed or got wrong**:
- It assumed in-file auth updates were needed until scope was clarified.

**AI-generated code you rejected** (with reason):
- Full auth rewrite in route handler (not in current scope because project assumption says auth is already handled elsewhere).

**The moment you most doubted the AI output and how you verified it**:
I doubted whether expandable dashboard details were real historical data. I checked the GET mapping and found `bankOnly`/`systemOnly` were hardcoded as empty arrays.

**What you know that the AI does not** (domain/architecture insight the AI could not have):
I know the team’s environment assumptions outside these files (auth and surrounding modules already working). The AI cannot confirm those without explicit project context.
