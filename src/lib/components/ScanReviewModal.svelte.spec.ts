import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ScanReviewModal from './ScanReviewModal.svelte';
import type { ExtractedFoodItem } from '$lib/domain/receipt/types.js';

function makeItem(overrides: Partial<ExtractedFoodItem> = {}): ExtractedFoodItem {
	return {
		name: 'Milk',
		canonicalName: 'milk',
		storageLocation: 'fridge',
		quantity: { value: 1, unit: 'count' },
		expirationDate: new Date('2026-04-10'),
		...overrides
	};
}

describe('ScanReviewModal', () => {
	it('renders all items with checkboxes', async () => {
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk' }), makeItem({ name: 'Eggs' })],
			onsubmit: vi.fn(),
			oncancel: vi.fn()
		});

		await expect.element(page.getByRole('checkbox', { name: /include milk/i })).toBeInTheDocument();
		await expect.element(page.getByRole('checkbox', { name: /include eggs/i })).toBeInTheDocument();
	});

	it('items are checked by default', async () => {
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk' })],
			onsubmit: vi.fn(),
			oncancel: vi.fn()
		});

		const checkbox = page.getByRole('checkbox', { name: /include milk/i });
		await expect.element(checkbox).toBeChecked();
	});

	it('unchecking an item removes it from submission', async () => {
		const onsubmit = vi.fn();
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk' }), makeItem({ name: 'Eggs' })],
			onsubmit,
			oncancel: vi.fn()
		});

		await page.getByRole('checkbox', { name: /include milk/i }).click();
		await page.getByRole('button', { name: /add \d+ item/i }).click();

		expect(onsubmit).toHaveBeenCalledOnce();
		const submitted = onsubmit.mock.calls[0][0] as Array<{ name: string }>;
		expect(submitted.map((i) => i.name)).toEqual(['Eggs']);
	});

	it('items are collapsed by default (edit fields not visible)', async () => {
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk' })],
			onsubmit: vi.fn(),
			oncancel: vi.fn()
		});

		await expect.element(page.getByRole('textbox', { name: /name/i })).not.toBeInTheDocument();
	});

	it('tapping an item expands editable fields', async () => {
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk' })],
			onsubmit: vi.fn(),
			oncancel: vi.fn()
		});

		await page.getByText('Milk').click();

		await expect.element(page.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
	});

	it('tapping an expanded item collapses it', async () => {
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk' })],
			onsubmit: vi.fn(),
			oncancel: vi.fn()
		});

		await page.getByText('Milk').click();
		await expect.element(page.getByRole('textbox', { name: /name/i })).toBeInTheDocument();

		await page.getByText('Milk').click();
		await expect.element(page.getByRole('textbox', { name: /name/i })).not.toBeInTheDocument();
	});

	it('editing fields and submitting emits updated values', async () => {
		const onsubmit = vi.fn();
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk', quantity: { value: 1, unit: 'count' } })],
			onsubmit,
			oncancel: vi.fn()
		});

		await page.getByText('Milk').click();

		const nameInput = page.getByRole('textbox', { name: /name/i });
		await nameInput.fill('Whole Milk');

		await page.getByRole('button', { name: /add 1 item/i }).click();

		expect(onsubmit).toHaveBeenCalledOnce();
		const submitted = onsubmit.mock.calls[0][0] as Array<{ name: string }>;
		expect(submitted[0].name).toBe('Whole Milk');
	});

	it('Add Items button shows checked count', async () => {
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk' }), makeItem({ name: 'Eggs' }), makeItem({ name: 'Butter' })],
			onsubmit: vi.fn(),
			oncancel: vi.fn()
		});

		await expect
			.element(page.getByRole('button', { name: /add 3 items/i }))
			.toBeInTheDocument();

		await page.getByRole('checkbox', { name: /include milk/i }).click();

		await expect
			.element(page.getByRole('button', { name: /add 2 items/i }))
			.toBeInTheDocument();
	});

	it('Add Items button is disabled when no items are checked', async () => {
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk' })],
			onsubmit: vi.fn(),
			oncancel: vi.fn()
		});

		await page.getByRole('checkbox', { name: /include milk/i }).click();

		const button = page.getByRole('button', { name: /add 0 items/i });
		await expect.element(button).toBeDisabled();
	});

	it('Cancel button calls oncancel', async () => {
		const oncancel = vi.fn();
		render(ScanReviewModal, {
			items: [makeItem()],
			onsubmit: vi.fn(),
			oncancel
		});

		await page.getByRole('button', { name: /cancel/i }).click();

		expect(oncancel).toHaveBeenCalledOnce();
	});

	it('only one item can be expanded at a time', async () => {
		render(ScanReviewModal, {
			items: [makeItem({ name: 'Milk' }), makeItem({ name: 'Eggs' })],
			onsubmit: vi.fn(),
			oncancel: vi.fn()
		});

		await page.getByText('Milk').click();
		await expect.element(page.getByRole('textbox', { name: /name/i })).toBeInTheDocument();

		await page.getByText('Eggs').click();
		// Milk collapsed, Eggs expanded — only one name input visible
		const nameInput = page.getByRole('textbox', { name: /name/i });
		await expect.element(nameInput).toBeInTheDocument();
	});

	it('submit emits correct shape for all fields', async () => {
		const onsubmit = vi.fn();
		render(ScanReviewModal, {
			items: [
				makeItem({
					name: 'Bread',
					canonicalName: 'bread',
					storageLocation: 'pantry',
					quantity: { value: 2, unit: 'count' },
					expirationDate: new Date('2026-04-15')
				})
			],
			onsubmit,
			oncancel: vi.fn()
		});

		await page.getByRole('button', { name: /add 1 item/i }).click();

		expect(onsubmit).toHaveBeenCalledOnce();
		const submitted = onsubmit.mock.calls[0][0] as Array<{
			name: string;
			canonicalName: string | null;
			storageLocation: string;
			quantityValue: number;
			quantityUnit: string;
			expirationDate: string | null;
		}>;
		expect(submitted[0]).toMatchObject({
			name: 'Bread',
			canonicalName: 'bread',
			storageLocation: 'pantry',
			quantityValue: 2,
			quantityUnit: 'count',
			expirationDate: '2026-04-15'
		});
	});
});
