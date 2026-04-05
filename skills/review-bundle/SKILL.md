---
name: review-bundle
description: "Full review of a bundle for contract compliance and composability"
trigger: "/review-bundle"
usage: "/review-bundle <bundle-name>"
---

# Review Bundle Skill

1. Loads full contract via `torque context --for`
2. Reads manifest.yml for interface contracts
3. Runs `torque validate` for automated checks
4. Reviews logic.js against contracts
5. Reports findings with fix instructions
