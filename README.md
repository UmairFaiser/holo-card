# Holographic card

Vanilla HTML, CSS, and WebGL. No dependencies, build step, or external requests. Download all seven files into one folder and open `index.html`.

## Files

- `index.html`: artwork, editable labels, and foil canvas.
- `style.css`: layout, frame, typography, and perspective.
- `script.js`: reflected lighting, fixed facets, spring motion, and input.
- `portrait.svg`: embedded generated portrait.
- `aave.svg`: transparent vector reconstruction of the reference badge.
- `cat.svg`: compact transparent vector traced from the reference.
- `README.md`: these instructions.

## Reflection and motion

The pointer changes the card's target tilt. A critically damped spring advances its orientation while preserving velocity on reversal. The shader uses that same orientation to rotate the surface and its fixed facet normals, then reflects the view direction into a stationary curved rainbow light environment. The light is not positioned at the pointer. There are no recorded lighting patches, texture lookups, or separate cursor glow.

The rainbow environment is an artistic approximation of the supplied recording, not a full wave-optics hologram simulation or an exact reconstruction. The portrait is a generated recreation rather than the original source asset. Both badges are vector reconstructions. Label geometry, badge placement, colors, and spacing were matched to the supplied reference.

## Customize

Edit `.identity` and `.caption` or replace the portrait. Shader `density` and `size` control facets; `phase`, `band`, and `hue` define the fixed light environment. `frequency` sets the spring response; `tiltDegrees` sets the rotation limits. Keep the shader's tilt angles and camera distance consistent with the CSS perspective and `render()` transform.

## Interaction and checks

Move over the card, or focus with Tab and use arrow keys. Escape and pointer exit return it to rest. Touch release resets it. Reduced motion uses a static orientation and immediate state changes. Without WebGL, the artwork remains visible. Rendering stops after settling or when hidden.

The current model was visually compared against the original recording, including matched pointer-history replay. Desktop diagonal motion, reversal, and exit were exercised. Automated checks verified equivalent spring motion at 60 and 120 Hz, continuous velocity on retargeting, return to rest, and idle shutdown. Physical touch and other browsers remain unverified.

The cleanup was checked against the previous implementation: 124 exact state and rendering-call comparisons passed, including keyboard, pointer, reduced-motion, visibility, and WebGL fallback/restoration paths. Resting browser screenshots were pixel-identical. Stylesheet and script query versions prevent stale preview assets; update them when replacing these files on a cached server.
