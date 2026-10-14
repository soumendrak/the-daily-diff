# An infographic for every story

Use the runtime's built-in image-generation tool only. The user explicitly selected **stop if unavailable**, with no OpenAI image API fallback. Do not ask for API keys, invoke an image SDK, use a placeholder, or silently publish fewer graphics.

1. Read the primary source and finish the story text first. Identify one useful mechanism, sequence, or relationship that the source supports.
2. Inspect a representative original Daily Diff infographic if one is available locally or from its CDN. Use it only as a visual style reference; never reuse its unrelated subject or facts.
3. Make one built-in generation call per distinct story. Produce a clean newspaper infographic with warm paper, dark ink, restrained accents, a clear title, readable labels, and a small number of connected elements. Do not make a collage to stand in for separate images.
4. For a brief, illustrate its narrow change directly. For example, a span-ingestion fix can show a conceptual delivery path and the need to verify arrival. Do not invent architecture details or before/after performance figures absent from the source. Label inferred guidance as conceptual/editorial.
5. Inspect the actual output with the runtime's image viewer. Check spelling, numerical claims, arrows, readability, factual scope, and source-versus-editorial distinction. Regenerate when needed. `reviewed: true` means this inspection happened; never set it merely because generation returned a file.
6. Copy the selected final PNG into `IMAGE_DIRECTORY/story-slug.png`. Use a standard 8-bit noninterlaced PNG; its shortest edge must be at least 512 pixels. Use the supplied `IMAGE_URL_PREFIX` in the draft, not a global generated-image path. Compute SHA-256 **after** copying the final file. Record its actual PNG `image_width` and `image_height` in the story so the reader reserves the correct proportions.
7. Store `image_provenance`: `kind: "generated-editorial"`, `generator: "built-in-imagegen"`, complete final `prompt`, `based_on` containing the primary evidence URL, `reviewed: true`, and `sha256`. The reader labels the graphic as AI-generated editorial work. It must never be presented as the publisher's own screenshot.

Example prompt structure (replace all bracketed inputs):

```text
Use case: infographic-diagram
Asset type: newspaper story infographic, a standalone PNG
Primary request: explain [one mechanism supported by the linked story]
Source-supported facts: [short factual list, no copied article passages]
Editorial guidance, explicitly conceptual: [optional operator check]
Style: warm newsprint, dark ink, restrained accent, generous spacing
Composition: a clear title and 3–5 labelled elements; readable at article width
Text (verbatim): [exact short title and labels]
Constraints: no invented metrics, no unsupported product architecture,
no fake screenshots, no unrelated logos; preserve source/editorial distinction
```

The runner validates file existence, PNG structure, dimensions, final hashes, and distinct assets. It cannot replace an agent's visual or factual review. An image-generation failure fails the edition; logs and the draft remain for diagnosis. Story length, signal score, and HN/News/GitHub category are never reasons to skip generation.
