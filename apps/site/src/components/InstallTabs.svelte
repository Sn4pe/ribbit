<script lang="ts">
const packageManagers = [
	{ id: "bun", label: "Bun", command: "bun add ribbit-canvas" },
	{ id: "npm", label: "npm", command: "npm install ribbit-canvas" },
	{ id: "pnpm", label: "pnpm", command: "pnpm add ribbit-canvas" },
	{ id: "yarn", label: "Yarn", command: "yarn add ribbit-canvas" },
] as const;

type PackageManager = (typeof packageManagers)[number];

let active = $state<PackageManager>(packageManagers[0]);
let copied = $state(false);

async function copy() {
	await navigator.clipboard.writeText(active.command);
	copied = true;
	setTimeout(() => (copied = false), 1500);
}
</script>

<div class="install-tabs">
	<div class="install-tabs__list" role="tablist" aria-label="Package manager">
		{#each packageManagers as manager}
			<button
				type="button"
				role="tab"
				aria-selected={active.id === manager.id}
				class:active={active.id === manager.id}
				onclick={() => (active = manager)}
			>{manager.label}</button>
		{/each}
	</div>
	<pre data-copy-ready><code>$ {active.command}</code><button type="button" class="install-tabs__copy" onclick={copy}>{copied ? "Copied" : "Copy"}</button></pre>
</div>
