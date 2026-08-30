# Obsidian Liftosaur Plugin - Development Plan for OpenCode

This document contains a sequential list of prompts to feed into OpenCode to build an Obsidian plugin that integrates Liftoscript from Liftosaur.

## Phase 1: Project Initialization

*   **Prompt 1:** Initialize a new Obsidian plugin project in TypeScript. Create the minimum required files: a standard `main.ts` plugin class, a `manifest.json`, and a `package.json`.
*   **Prompt 2:** Set up the build pipeline using esbuild. Configure the script so it compiles the TypeScript codebase into a single `main.js` file that Obsidian can load.

## Phase 2: Parser & Data Integration

*   **Prompt 3:** Translate the `LiftoscriptEvaluator` logic from the Liftosaur open-source repository into a standalone utility class named `parser.ts` within this project.
*   **Prompt 4:** Create a static JSON exercise database module. Then, implement Obsidian's `EditorSuggest` class to provide an autocomplete dropdown menu for exercise names when typing inside the editor.

## Phase 3: UI & Sync-Safe State

*   **Prompt 5:** Register a `MarkdownPostProcessor` that intercepts ````liftoscript` code blocks. Render these blocks into an interactive HTML UI containing checkboxes for sets and a visual countdown timer for rests.
*   **Prompt 6:** Configure the countdown timer to run strictly in memory without updating the markdown file every second. Frequent file modifications will disrupt real-time sync operations with tools like self-hosted LiveSync[cite: 1] or cause continuous commit loops if using Obsidian Git[cite: 1].
*   **Prompt 7:** Create a notification utility function that triggers when the in-memory rest timer reaches zero. This function must execute two actions simultaneously: 
    1. Display a visual alert using Obsidian's native `Notice` API (e.g., `new Notice('Rest complete!')`).
    2. Play a short alert chime using the HTML5 `Audio` API. 
    Crucially, embed a lightweight audio asset directly inside the TypeScript code as a Base64 encoded data URI string (e.g., `new Audio('data:audio/mp3;base64,...')`). Do not attempt to load the audio from a separate `.mp3` file in the user's vault. This ensures the plugin remains entirely self-contained and cross-platform.

## Phase 4: Progression & Frontmatter

*   **Prompt 8:** Bind the UI checkboxes to Obsidian's `Vault.modify()` API so checking off a set updates the raw text.
*   **Prompt 9:** Create a summarization function that runs when a workout is marked as complete. It should parse the active note's completed ````liftoscript` blocks to calculate total session metrics, such as total volume (weight × reps), number of completed sets, and overall workout duration.
*   **Prompt 10:** Integrate Obsidian's `processFrontMatter` API from the `app.fileManager` class. Use this to automatically inject or update the calculated session metrics into the active note's YAML frontmatter. Ensure the keys are formatted clearly (e.g., `total_volume`, `session_duration`) so they can be easily queried by the Dataview community plugin.
*   **Prompt 11:** Utilize the ported Liftosaur evaluation logic to process the completed sets from the active note. For any exercise with a progress tag like `progress: lp(5lb)`, calculate the required weight or repetition increase for the next session based on successful completion.
*   **Prompt 12:** Register a new Obsidian plugin command titled 'Generate Next Workout'. This command must create a new markdown file in the current directory, populate it with the baseline YAML structure, and insert the newly calculated ````liftoscript` blocks with the incremented progressive overload weights applied. Ensure the command is registered using `this.addCommand()` with a clear `id` and `name` so that it is instantly searchable and executable from the Obsidian Command Palette. Do not bind any hardcoded hotkeys within the code.
*   **Prompt 13:** Ensure the 'Generate Next Workout' command also appends a markdown backlink in the newly created file pointing to the previous workout note, establishing a continuous, clickable chain of your historical workout progression.
