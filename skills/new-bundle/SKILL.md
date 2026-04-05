---
name: new-bundle
description: "Scaffold and design a new bundle from a one-line description"
trigger: "/new-bundle"
usage: "/new-bundle <name> <description>"
---

# New Bundle Skill

1. Runs `torque generate bundle <name>`
2. Designs manifest.yml with full interface contracts
3. Generates logic.js skeleton from manifest
4. Generates behavioral tests
5. Runs `torque validate`
