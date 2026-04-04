<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let profileName = $state(data.user.name ?? '');
	let passwordSubmitting = $state(false);
	let profileSubmitting = $state(false);
	let inviteSubmitting = $state(false);
	let renameSubmitting = $state(false);
	let leaveSubmitting = $state(false);

	const profileSuccess = $derived(form?.field === 'profile' && form?.success);
	const profileError = $derived(form?.field === 'profile' && !form?.success ? form?.message : null);
	const passwordSuccess = $derived(form?.field === 'password' && form?.success);
	const passwordError = $derived(
		form?.field === 'password' && !form?.success ? form?.message : null
	);
	const inviteSuccess = $derived(form?.field === 'invite' && form?.success);
	const inviteError = $derived(form?.field === 'invite' && !form?.success ? form?.message : null);
	const renameSuccess = $derived(form?.field === 'rename' && form?.success);
	const renameError = $derived(form?.field === 'rename' && !form?.success ? form?.message : null);
	const removeMemberError = $derived(
		form?.field === 'removeMember' && !form?.success ? form?.message : null
	);
	const transferError = $derived(
		form?.field === 'transfer' && !form?.success ? form?.message : null
	);
	const transferSuccess = $derived(form?.field === 'transfer' && form?.success);
	const leaveError = $derived(form?.field === 'leave' && !form?.success ? form?.message : null);

	// The current invite link — either freshly generated or from loaded data
	const currentHousehold = $derived(
		(form?.field === 'invite' && form?.success
			? form?.household
			: form?.field === 'rename' && form?.success
				? form?.household
				: null) ?? data.household
	);
	const inviteLink = $derived(
		currentHousehold?.inviteCode
			? `${$page.url.origin}/invite/${currentHousehold.inviteCode}`
			: null
	);

	let copied = $state(false);
	async function copyInviteLink() {
		if (!inviteLink) return;
		await navigator.clipboard.writeText(inviteLink);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	// Resolve streamed members into reactive state
	type Member = { id: string; name: string; role: 'owner' | 'member' };
	let resolvedMembers = $state<Member[]>([]);

	$effect(() => {
		const promise = data.members;
		promise.then((m) => { resolvedMembers = m; });
	});

	const isOwner = $derived(
		resolvedMembers.find((m) => m.id === data.user.id)?.role === 'owner'
	);

	let householdName = $state(data.household?.name ?? '');
	let editingName = $state(false);

	// For transfer ownership: track selected user
	let transferTargetId = $state('');
</script>

<svelte:head>
	<title>Settings — KeptNow</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-6 pb-28 pt-8">
	<h1 class="mb-8 font-[Cormorant_Garamond,serif] text-3xl font-bold text-[#1a1714]">Settings</h1>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">

	<!-- Profile Section -->
	<section class="rounded-2xl border border-[#e8e2d9] bg-white p-6 shadow-sm">
		<h2 class="mb-5 text-base font-semibold text-[#1a1714]">Profile</h2>

		<form
			method="post"
			action="?/updateProfile"
			use:enhance={() => {
				profileSubmitting = true;
				return async ({ update }) => {
					await update();
					profileSubmitting = false;
				};
			}}
			class="flex flex-col gap-4"
		>
			<div class="flex flex-col gap-1.5">
				<label for="name" class="text-sm font-medium text-[#3a3632]">Display name</label>
				<input
					id="name"
					name="name"
					type="text"
					bind:value={profileName}
					placeholder="Your name"
					required
					class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<label class="text-sm font-medium text-[#3a3632]">Email</label>
				<p class="rounded-lg border border-[#e8e2d9] bg-[#f8f6f3] px-3.5 py-2.5 text-sm text-[#8a8279]">
					{data.user.email}
				</p>
			</div>

			{#if profileError}
				<p class="text-sm text-red-600">{profileError}</p>
			{/if}

			{#if profileSuccess}
				<p class="text-sm text-green-700">Profile updated.</p>
			{/if}

			<div class="flex justify-end">
				<button
					type="submit"
					disabled={profileSubmitting}
					class="rounded-lg bg-[#c4a46a] px-4 py-2 text-sm font-semibold text-[#1a1714] shadow-sm transition-all duration-200 hover:bg-[#b8945a] disabled:opacity-50"
				>
					{profileSubmitting ? 'Saving…' : 'Save'}
				</button>
			</div>
		</form>
	</section>

	<!-- Password Section -->
	<section class="rounded-2xl border border-[#e8e2d9] bg-white p-6 shadow-sm md:row-start-1 md:col-start-2">
		<h2 class="mb-5 text-base font-semibold text-[#1a1714]">Change password</h2>

		<form
			method="post"
			action="?/changePassword"
			use:enhance={() => {
				passwordSubmitting = true;
				return async ({ update, result }) => {
					await update({ reset: result.type === 'success' });
					passwordSubmitting = false;
				};
			}}
			class="flex flex-col gap-4"
		>
			<div class="flex flex-col gap-1.5">
				<label for="currentPassword" class="text-sm font-medium text-[#3a3632]"
					>Current password</label
				>
				<input
					id="currentPassword"
					name="currentPassword"
					type="password"
					placeholder="••••••••"
					required
					class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<label for="newPassword" class="text-sm font-medium text-[#3a3632]">New password</label>
				<input
					id="newPassword"
					name="newPassword"
					type="password"
					placeholder="••••••••"
					required
					class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<label for="confirmPassword" class="text-sm font-medium text-[#3a3632]"
					>Confirm new password</label
				>
				<input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					placeholder="••••••••"
					required
					class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm text-[#1a1714] shadow-sm transition-all duration-200 outline-none placeholder:text-[#b5aea4] focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
				/>
			</div>

			{#if passwordError}
				<p class="text-sm text-red-600">{passwordError}</p>
			{/if}

			{#if passwordSuccess}
				<p class="text-sm text-green-700">Password changed successfully.</p>
			{/if}

			<div class="flex justify-end">
				<button
					type="submit"
					disabled={passwordSubmitting}
					class="rounded-lg bg-[#c4a46a] px-4 py-2 text-sm font-semibold text-[#1a1714] shadow-sm transition-all duration-200 hover:bg-[#b8945a] disabled:opacity-50"
				>
					{passwordSubmitting ? 'Updating…' : 'Update password'}
				</button>
			</div>
		</form>
	</section>

	<!-- Household Section -->
	{#if data.household}
		<section class="rounded-2xl border border-[#e8e2d9] bg-white p-6 shadow-sm md:col-span-2">
			<div class="mb-5 flex items-start justify-between gap-4">
				<div class="flex-1">
					<h2 class="mb-1 text-base font-semibold text-[#1a1714]">Household</h2>
					{#if isOwner && editingName}
						<form
							method="post"
							action="?/renameHousehold"
							use:enhance={() => {
								renameSubmitting = true;
								return async ({ update }) => {
									await update();
									renameSubmitting = false;
									editingName = false;
								};
							}}
							class="flex items-center gap-2"
						>
							<input
								name="name"
								type="text"
								bind:value={householdName}
								required
								class="rounded-lg border border-[#ddd6cc] bg-white px-3 py-1.5 text-sm text-[#1a1714] shadow-sm outline-none focus:border-[#c4a46a] focus:ring-2 focus:ring-[#c4a46a33]"
							/>
							<button
								type="submit"
								disabled={renameSubmitting}
								class="rounded-lg bg-[#c4a46a] px-3 py-1.5 text-xs font-semibold text-[#1a1714] hover:bg-[#b8945a] disabled:opacity-50"
							>
								{renameSubmitting ? 'Saving…' : 'Save'}
							</button>
							<button
								type="button"
								onclick={() => { editingName = false; householdName = data.household?.name ?? ''; }}
								class="rounded-lg border border-[#ddd6cc] px-3 py-1.5 text-xs font-medium text-[#3a3632] hover:bg-[#f8f6f3]"
							>
								Cancel
							</button>
						</form>
						{#if renameError}
							<p class="mt-1 text-xs text-red-600">{renameError}</p>
						{/if}
					{:else}
						<div class="flex items-center gap-2">
							<p class="text-sm text-[#8a8279]">{currentHousehold?.name ?? data.household.name}</p>
							{#if isOwner}
								<button
									type="button"
									onclick={() => { editingName = true; householdName = currentHousehold?.name ?? data.household?.name ?? ''; }}
									class="text-xs text-[#c4a46a] hover:underline"
								>
									Rename
								</button>
							{/if}
						</div>
						{#if renameSuccess}
							<p class="mt-1 text-xs text-green-700">Household renamed.</p>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Member list -->
			<div class="mb-5">
				<h3 class="mb-3 text-sm font-semibold text-[#3a3632]">Members</h3>
				{#if removeMemberError}
					<p class="mb-2 text-sm text-red-600">{removeMemberError}</p>
				{/if}
				{#if transferSuccess}
					<p class="mb-2 text-sm text-green-700">Ownership transferred.</p>
				{/if}
				{#if transferError}
					<p class="mb-2 text-sm text-red-600">{transferError}</p>
				{/if}
				<ul class="divide-y divide-[#f0ebe4]">
					{#each resolvedMembers as member}
						<li class="flex items-center justify-between py-2.5">
							<div>
								<span class="text-sm font-medium text-[#1a1714]">{member.name}</span>
								<span class="ml-2 rounded-full border border-[#e8e2d9] bg-[#f8f6f3] px-2 py-0.5 text-xs text-[#8a8279]">
									{member.role}
								</span>
								{#if member.id === data.user.id}
									<span class="ml-1 text-xs text-[#c4a46a]">(you)</span>
								{/if}
							</div>
							{#if isOwner && member.id !== data.user.id}
								<div class="flex gap-2">
									<form
										method="post"
										action="?/transferOwnership"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
											};
										}}
									>
										<input type="hidden" name="toUserId" value={member.id} />
										<button
											type="submit"
											class="text-xs text-[#8a8279] hover:text-[#c4a46a] hover:underline"
										>
											Make owner
										</button>
									</form>
									<form
										method="post"
										action="?/removeMember"
										use:enhance={() => {
											return async ({ update }) => {
												await update();
											};
										}}
									>
										<input type="hidden" name="memberId" value={member.id} />
										<button
											type="submit"
											class="text-xs text-red-400 hover:text-red-600 hover:underline"
										>
											Remove
										</button>
									</form>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			<!-- Invite link section (owner only) -->
			{#if isOwner}
				{#if inviteLink}
					<div class="mb-4">
						<label for="invite-link" class="mb-1.5 block text-sm font-medium text-[#3a3632]">Invite link</label>
						<div class="flex gap-2">
							<input
								id="invite-link"
								type="text"
								readonly
								value={inviteLink}
								class="flex-1 rounded-lg border border-[#ddd6cc] bg-[#f8f6f3] px-3.5 py-2.5 text-sm text-[#6b6560] outline-none"
							/>
							<button
								type="button"
								onclick={copyInviteLink}
								class="rounded-lg border border-[#ddd6cc] bg-white px-3.5 py-2.5 text-sm font-medium text-[#3a3632] transition-colors hover:bg-[#f8f6f3]"
							>
								{copied ? 'Copied!' : 'Copy'}
							</button>
						</div>
						{#if currentHousehold?.inviteExpiresAt}
							<p class="mt-1.5 text-xs text-[#8a8279]">
								Expires {new Date(currentHousehold.inviteExpiresAt).toLocaleDateString()}
							</p>
						{/if}
					</div>
				{/if}

				{#if inviteSuccess && !inviteLink}
					<p class="mb-4 text-sm text-green-700">Invite link generated.</p>
				{/if}

				{#if inviteError}
					<p class="mb-4 text-sm text-red-600">{inviteError}</p>
				{/if}

				<form
					method="post"
					action="?/generateInvite"
					use:enhance={() => {
						inviteSubmitting = true;
						return async ({ update }) => {
							await update();
							inviteSubmitting = false;
						};
					}}
				>
					<button
						type="submit"
						disabled={inviteSubmitting}
						class="rounded-lg bg-[#c4a46a] px-4 py-2 text-sm font-semibold text-[#1a1714] shadow-sm transition-all duration-200 hover:bg-[#b8945a] disabled:opacity-50"
					>
						{inviteSubmitting
							? 'Generating…'
							: inviteLink
								? 'Generate new link'
								: 'Generate invite link'}
					</button>
				</form>
				<p class="mt-2 text-xs text-[#8a8279]">
					Generating a new link invalidates the previous one. Links expire after 7 days.
				</p>
			{/if}

			<!-- Leave household -->
			<div class="mt-6 border-t border-[#f0ebe4] pt-4">
				{#if leaveError}
					<p class="mb-2 text-sm text-red-600">{leaveError}</p>
				{/if}
				<form
					method="post"
					action="?/leaveHousehold"
					use:enhance={() => {
						leaveSubmitting = true;
						return async ({ update }) => {
							await update();
							leaveSubmitting = false;
						};
					}}
				>
					<button
						type="submit"
						disabled={leaveSubmitting}
						class="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
					>
						{leaveSubmitting ? 'Leaving…' : 'Leave household'}
					</button>
				</form>
				{#if isOwner && resolvedMembers.length > 1}
					<p class="mt-1.5 text-xs text-[#8a8279]">
						Transfer ownership before leaving.
					</p>
				{/if}
			</div>
		</section>
	{/if}

	</div>
</main>
