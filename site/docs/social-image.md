# Sidequest social image

`src/app/opengraph-image.tsx` renders the shared 1200 × 630 PNG. The layout keeps the wordmark, headline, product names, and waitlist link above y=480. The bottom 150 pixels contain no essential text, so X's title overlay does not cover the supporting copy. The transparent 3D coin sits on the right, clear of the headline and title area.

The renderer reads `public/og/mario-coin.png` from the local project and embeds it as a data URL. It does not fetch an external image host. The image route uses the Node runtime and preserves the existing file-based Open Graph metadata. X uses the same image with the existing `summary_large_image` card setting.

## Coin asset

The coin was generated with the built-in Imagegen tool and a transparent background. The original alpha channel is preserved. The asset is a Mario-style gold collectible with a central vertical slot, not a logo or an image of Mario.

Final generation prompt:

> Use case: stylized-concept. Asset type: transparent 3D coin illustration for the right side of Sidequest's black Open Graph social card. Primary request: a single iconic Super Mario gold coin rendered as a premium 3D game collectible. Subject: one thick golden coin with the classic single tall recessed rectangular vertical slot in the center of its face, a raised circular border, and a neatly ridged visible side edge. No letter M, no dollar sign, no face, no text. Style: polished, playful 3D videogame render, simple iconic geometry, warm yellow gold, sculpted metallic material, soft amber edge shading and crisp highlights. Composition: isolated full coin centered in a square canvas with 12% transparent margin, face turned about 20 degrees toward the left so the right-hand thickness is visible, slight clockwise tilt of 10 degrees, almost frontal so the central slot is clearly readable. Lighting: large soft key light from upper left, clean golden rim highlights, enough contrast to read against pure black. Background: genuinely transparent with alpha, no background scene, no ground plane, no cast shadow outside the object. Constraints: exactly one coin, entire coin visible, clean edges, no extra objects, no lettering, no watermark.

## Verification

Render the actual image route and inspect both the full card and a preview with X's bottom title overlay. Run lint and the production build to check that the renderer can read and embed the local PNG. Existing shared links may keep X's cached image until X fetches the page again.
