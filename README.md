# OfferLock

<div align="center">

## Pin the Offer. Stake GEN. Claim Bait-and-Switch.

| **OfferLock Platform** |
|---|
| **Accept pins a version. Material amends need their own collateral. AI judges public evidence.** |

[![Live App](https://img.shields.io/badge/Live-offer--lock.vercel.app-0f172a?style=for-the-badge&logo=vercel)](https://offer-lock.vercel.app)
[![Contract](https://img.shields.io/badge/Contract-GenLayer_Python-1f6feb?style=for-the-badge)](#core-contract-api)
[![Frontend](https://img.shields.io/badge/Frontend-Next.js_+_TypeScript-111827?style=for-the-badge)](#project-structure)
[![Network](https://img.shields.io/badge/Network-GenLayer_Studionet-16a34a?style=for-the-badge)](#environment-variables)

</div>

---

## Overview

OfferLock is a transparent offer-commitment protocol where an employer locks internship / job terms on-chain and a named intern pins that version before any clock starts.

The protocol is designed to stop bait-and-switch with a strict accept-then-amend flow:

1. `publish_offer` locks role, pay, hours, location, and duties with a **base stake** plus a separate **performance bond** (**clock does not start**)
2. `accept_offer` pins that version; later amends **cannot overwrite** the intern’s accepted snapshot

This means internships cannot silently change after acceptance, and a claim cannot drain the original close-only stake.

## Core Value Proposition

- **Pinned terms:** accept records version + snapshot; history stays immutable
- **Material vs clarification:** only locked-field changes open a window and require item collateral
- **Allowlisted evidence:** the contract fetches public URLs; pasted HTML is not the source of truth
- **Due process before AI:** employer gets a reply window; fetch fail is `INCONCLUSIVE`, never a fake win
- **Item-scoped liability:** claims settle the disputed bag only; base stake returns on a clean close
- **Locked until paid:** a judged claim stays in custody through appeal; the employer cannot release the disputed bond or close until payout
- **Immutable first verdict:** one appeal stores a separate `appeal_verdict`; the original judgment is not rewritten

## Protocol Flow

1. **Employer publishes an offer** (named intern, locked fields, evidence hosts, base stake + performance bond)
2. **Intern accepts** and pins the current version — the clock starts here
3. **Employer may amend** — material change creates a new version + item collateral + claim window
4. **Intern files one claim** (`BREACH` of pinned terms or `AMEND` of a material change) with allowlisted URLs
5. **Employer may respond** during a 3-day window; `judge_claim` waits for a reply or expiry
6. **AI + validators bind** `verdict` and `confidence`; the caller pays gas / AI tx (no checker reward). Intern leave does not skip remaining windows.
7. **One appeal, then settle** — disputed pots stay locked until payout; base stake is untouched
8. **Employer releases unused item collateral** only after windows and unpaid claims are cleared, then `close_offer`

## Risk Controls

| Risk | Mitigation in OfferLock |
|------|-------------------------|
| Amend overwrites the accepted offer | Pin snapshot + version at `accept_offer` |
| Publish A, accept, switch to B, withdraw | No close / release while windows or claims are open or unpaid |
| Judged claim still unpaid | Lock stays until `settle_claim` / `judge_appeal` payout; appeal does not unlock |
| Intern leaves, employer yanks collateral | Leave blocks new claims; windows still run; release only after expiry |
| Anyone files a claim | Named intern who accepted; leave blocks new claims |
| Self-deal | Employer cannot name themselves or file the claim |
| Cheap claim vs a large pot | Claim stake ≥ item collateral; base pot isolated |
| Pasted HTML as “proof” | Contract fetches allowlisted public URLs |
| Private / localhost evidence | Host checks (loopback, RFC1918, link-local) |
| Fetch fail counted as a win | Forced `INCONCLUSIVE` |
| Instant AI before the employer can reply | 3-day response window |
| Stuck funds | Judge grace + settle after the appeal window |
| Prompt injection from pages | Evidence wrapped in `BEGIN_EVIDENCE` / `END_EVIDENCE` |
| Appeal erases the first judgment | First verdict stays on-chain; appeal is a separate field |

## Core Contract API

| Function | Type | Description |
|----------|------|-------------|
| `publish_offer` | write (payable) | Create offer; value = bond + base |
| `accept_offer` | write | Intern pins the current version |
| `leave_offer` | write | Intern leaves (no new claims) |
| `amend_offer` | write (payable) | Material vs clarification |
| `file_claim` | write (payable) | BREACH or AMEND |
| `respond_to_claim` | write | Employer reply |
| `cancel_claim` | write | Intern refund before judge |
| `judge_claim` | write | AI after reply or window (does not unlock pots) |
| `appeal_claim` | write (payable) | One appeal by the losing side |
| `judge_appeal` / `settle_claim` | write | Final payout; lock clears here; first verdict stays on-chain |
| `release_performance_bond` | write | After breach window; unpaid claims block |
| `release_amendment_collateral` | write | After amend window; unpaid claims block |
| `close_offer` | write | Return base stake when clean; unpaid claims block |
| `get_offer` / `get_all_offers` | view | Query offer state (includes pin fields) |
| `get_fairness_ledger` | view | Public verdict counts |

## Project Structure

```text
contracts/   # GenLayer intelligent contract (Python)
deploy/      # Contract deployment scripts
frontend/    # Next.js application (TypeScript)
tests/       # Contract/integration tests
```

## Environment Variables

Configure in `frontend/.env.local` (see `frontend/.env.example`):

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_CHAIN_NAME=GenLayer Studionet
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
```

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Deploy contract first, then update `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## Links

- Live app: [https://offer-lock.vercel.app](https://offer-lock.vercel.app)
- GitHub: [https://github.com/hoasine/offer-lock](https://github.com/hoasine/offer-lock)
- Local app: [http://localhost:3005](http://localhost:3005)
- Studionet contract: `0x5f807814c8F780090ceDa63DD6fA132fd986daa7`

## Disclaimer

Prototype/demo software. Not financial, legal, or employment advice.
