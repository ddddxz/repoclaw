<div align="center">

<img src="./apps/bot/public/images/logo.jpg" width="120" alt="RepoClaw Logo" style="border-radius: 24px; box-shadow: 0 10px 30px rgba(0,242,254,0.3);" />

# 🐾 RepoClaw

**Autonomous GitHub Issue Reproducer & Minimal Test Synthesizer**  
*The digital maintainer that turns ambiguous bug reports into verified, minimal test cases.*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/ddddxz/repoclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/ddddxz/repoclaw/actions/workflows/ci.yml)
[![GitHub Stars](https://img.shields.io/github/stars/ddddxz/repoclaw?style=social)](https://github.com/ddddxz/repoclaw)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ddddxz/repoclaw/pulls)
[![Node.js](https://img.shields.io/badge/node.js-22%20LTS-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/docker-zero--trust%20sandbox-2496ED.svg)](https://www.docker.com/)
[![Install RepoClaw](https://img.shields.io/badge/Install%20on-GitHub%20App-2ea44f?style=flat&logo=github)](https://github.com/apps/repoclaw-app)
[![Web Dashboard](https://img.shields.io/badge/dashboard-live%20observability-9d4edd.svg)](http://localhost:3000/dashboard)

**English** | [简体中文](./README.md)

</div>

---

## 💡 Why RepoClaw? (The Pain Point)

In open-source software development, maintainers are overwhelmed daily by incoming bug reports:
- **Pain Point 1: Vague reports without reproduction**: >60% of issues contain only an unformatted traceback or screenshot without a standalone test script.
- **Pain Point 2: Costly back-and-forth communication**: Maintainers repeatedly ask *"Can you provide a minimal reproduction script?"*, dragging out discussions over days or weeks.
- **Pain Point 3: Time drain**: Manually cloning, configuring environments, and attempting reproduction takes 20–45 minutes per bug.

**RepoClaw eliminates this friction.** It acts as an autonomous digital co-maintainer directly inside your repository. Maintainers trigger it simply with a ChatOps command:

```markdown
@repoclaw repro
```

**RepoClaw takes over instantly:**
1. **< 1.5s immediate feedback**: Reacts with 👀 to acknowledge the task and queues it;
2. **Zero-trust sandboxing**: Spins up an isolated, network-disabled (`NetworkMode: none`), read-only mounted container with a 30s hard timeout;
3. **Self-healing reflection agent**: Extracts error signatures via LLM, synthesizes a reproduction script, captures runtime tracebacks, and automatically self-corrects up to 3 rounds (inspired by SWE-bench / DeepSeek Harness);
4. **Automated write-back & labeling**: Labels the issue as `[reproduced]`, replies with a formatted collapsible markdown report, and upgrades the reaction to 🚀.

---

## 🎬 ChatOps in Action

```
[Maintainer]: @repoclaw repro Please help reproduce this zero division error

[RepoClaw]: (Reacts with 👀 in < 1.5s, verifies maintainer role, queues job in BullMQ)

[RepoClaw Bot]: (Executes in Docker sandbox, self-heals, and replies:)
```

<details open>
<summary><b>🤖 RepoClaw Bug Reproduction Report (Verified)</b></summary>

### 🎯 Summary
- **Target Exception**: `ZeroDivisionError`
- **Status**: ✅ **Verified & Reproduced**
- **Reflection Iterations**: 1 round
- **Total Duration**: 3,420 ms

### 💻 Minimal Reproduction Script (`repro.py`)
```python
import sys
sys.path.insert(0, '/workspace')
from my_package.calculator import calculate

# Triggers ZeroDivisionError
calculate(10, 0)
```

<details>
<summary><b>🔍 View Captured Traceback in Sandbox</b></summary>

```text
Traceback (most recent call last):
  File "/scratch/repro.py", line 6, in <module>
    calculate(10, 0)
  File "/workspace/my_package/calculator.py", line 4, in calculate
    return a / b
ZeroDivisionError: division by zero
```
</details>

---
*Synthesized and verified autonomously by [RepoClaw](https://github.com/ddddxz/repoclaw)*
</details>

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    User["GitHub Maintainer"] -->|"@repoclaw repro"| Webhook["GitHub Webhook Gateway"]
    Webhook --> Auth{"Auth (OWNER / MEMBER)"}
    
    Auth -->|"Unauthorized"| Deny["Block with friendly warning"]
    Auth -->|"Authorized"| Feedback["Immediate 👀 Reaction (under 1.5s)"]
    
    Feedback --> Queue[("BullMQ + Redis Task Queue")]
    
    subgraph Worker["RepoClaw Worker Service"]
        Queue --> Consumer["Worker Process"]
        Consumer --> GitClone["Shallow clone target repo"]
        Consumer --> Core["Agent Self-Healing State Machine"]
        
        subgraph Sandbox["Zero-Trust Sandbox"]
            Core --> Runner["Docker Sandbox Runner"]
            Runner --> Container["Isolated Container (No-net/RO-mount/Anti-Fork-Bomb)"]
        end
        
        Container --> Matcher["Traceback Extraction & Matcher"]
        Matcher -->|"Mismatch & Retriable"| Core
        Matcher -->|"Verified / Max Retries"| Octokit["GitHub Write-back Engine"]
    end
    
    Octokit --> Done["Comment test script + label [reproduced] + add 🚀"]
    Consumer --> DB[("SQLite Audit Log Trail")]
```

---

## 🌐 Built-in Web Portal & Live Observability Dashboard

Beyond the native ChatOps interface in GitHub issue comments, RepoClaw natively hosts a high-tech dark-themed web portal directly on port 3000 via Probot Express:

- **Developer Landing Portal (`http://localhost:3000/`)**: Showcases architectural diagrams, zero-trust sandbox concepts, and a one-click "⚡ Install to GitHub" button.
- **Live Task Dashboard (`http://localhost:3000/dashboard`)**:
  - **4 Global KPIs**: Total reproduction tasks, Verified rate (%), average duration, and cumulative reflection iterations.
  - **Live Stream Table**: Real-time filtering by repository with glowing status badges (`VERIFIED`, `UNVERIFIED`, `FAILED`).
  - **Interactive Detail Drawer**: Expand any task to inspect its **minimal reproduction script (with 1-click copy)**, **captured raw traceback**, and the **full lifecycle audit trail**.
- **Health Check Probe (`http://localhost:3000/healthz`)**: Readiness and liveness endpoint for Docker & K8s.

---

## ✨ Key Features & User Value

- 🤖 **Zero-Context-Switch ChatOps**: Maintainers never leave GitHub—simply comment `@repoclaw repro` on any issue.
- 🔒 **Enterprise-Grade Zero-Trust Isolation**: Air-gapped container (`NetworkMode: none`), read-only repo mount (`:ro`), 64MB memory tmpfs, strict `PidsLimit: 64` (anti-fork-bomb), and 30s hard SIGKILL.
- 🧠 **Autonomous Self-Healing Loop**: Dynamic reflection loop that inspects error tracebacks and adjusts imports or inputs up to 3 rounds to isolate the genuine bug.
- 🏷️ **Automated Triage & Labeling**: Automatically applies `[reproduced]` tag and outputs a minimal standalone reproducible test script ready to copy into `tests/`.
- 🌐 **Built-in Dark-Themed Live Dashboard**: Track reproduction success rates, execution duration, and audit logs with zero extra configuration.
- 🐳 **Effortless Deployment**: Install via 1-click GitHub App, or self-host completely with `docker compose up -d`.

---

## 🔒 Zero-Trust Security Sandbox

Executing untrusted code from GitHub issues is risky. RepoClaw employs defense-in-depth:
1. **Air-gapped Network**: `NetworkMode: "none"` eliminates SSRF and external egress.
2. **Read-Only Code Mount**: Target repo is mounted with `:ro`.
3. **Ephemeral Execution**: Scripts run in 64MB memory tmpfs destroyed upon completion.
4. **Anti-Fork Bomb**: Strictly enforced `PidsLimit: 64` to prevent OS process table exhaustion.
5. **Hard Timeout**: 30-second hard kill with OS-level `SIGKILL`.
6. **Least Privilege**: Runs as unprivileged non-root user (`User: "1000:1000"`).

---

## 🚀 Quick Start (Docker Compose)

```bash
git clone https://github.com/ddddxz/repoclaw.git
cd repoclaw
cp .env.example .env

# Edit .env with your GitHub App credentials and API keys
docker compose up -d
```

---

## 🛠️ Testing

```bash
pnpm install
pnpm -r build
pnpm -r test
```

> Includes **75 automated tests** (unit tests + multi-language real-world integration tests) covering Python/TypeScript/Java AST symbol extraction, zero-trust sandbox containment, multi-language traceback regex matching, ChatOps role authorization, and real-world reproduction across Hermes, DeepSeek, Fastjson, and Dubbo.

---

## 📄 License

MIT © RepoClaw Contributors
