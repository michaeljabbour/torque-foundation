---
name: explain-bundle
description: "Generate a complete explanation of a bundle for a new team member or AI agent"
trigger: "/explain-bundle"
usage: "/explain-bundle <bundle-name>"
---

# Explain Bundle Skill

1. Reads manifest.yml for full contract
2. Reads agent.md for domain context
3. Runs `torque context --for` for relationships
4. Generates explanation: domain model, interfaces, events, behavioral specs, anti-patterns
