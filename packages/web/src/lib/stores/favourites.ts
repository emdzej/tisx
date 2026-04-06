import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { VehicleContext } from './vehicle';

// ── Types ──────────────────────────────────────────────────────────────────

export type FavouriteVehicle = {
	/** Unique id for list management */
	id: string;
	/** Optional user-provided label (e.g. "Dad's E46") */
	label: string;
	/** Full vehicle context to restore */
	vehicle: VehicleContext;
	/** ISO timestamp when added */
	addedAt: string;
};

export type FavouriteDocument = {
	/** Unique id for list management */
	id: string;
	/** Optional user-provided label */
	label: string;
	/** Document id (INFOOBJ_ID) */
	docId: number;
	/** Document title from DB */
	title: string;
	/** Document code (INFOOBJ_KZ) */
	code: string | null;
	/** Doc type id */
	docTypeId: number;
	/** Vehicle context at the time the favourite was saved (if any) */
	vehicle: VehicleContext | null;
	/** ISO timestamp when added */
	addedAt: string;
};

export type FavouritesData = {
	vehicles: FavouriteVehicle[];
	documents: FavouriteDocument[];
};

// ── Storage ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'tisx-favourites';

function loadFromStorage(): FavouritesData {
	if (!browser) return { vehicles: [], documents: [] };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { vehicles: [], documents: [] };
		const parsed = JSON.parse(raw) as Partial<FavouritesData>;
		return {
			vehicles: Array.isArray(parsed.vehicles) ? parsed.vehicles : [],
			documents: Array.isArray(parsed.documents) ? parsed.documents : [],
		};
	} catch {
		return { vehicles: [], documents: [] };
	}
}

function saveToStorage(data: FavouritesData) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Store ──────────────────────────────────────────────────────────────────

const store = writable<FavouritesData>(loadFromStorage());

// Auto-persist on every change
store.subscribe((value) => saveToStorage(value));

/** Read-only access to the favourites store */
export const favourites = { subscribe: store.subscribe };

export const favouriteVehicles = derived(store, ($s) => $s.vehicles);
export const favouriteDocuments = derived(store, ($s) => $s.documents);
export const favouriteCount = derived(store, ($s) => $s.vehicles.length + $s.documents.length);

// ── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Vehicle favourites ─────────────────────────────────────────────────────

export function addFavouriteVehicle(vehicle: VehicleContext, label = ''): void {
	store.update((s) => ({
		...s,
		vehicles: [
			...s.vehicles,
			{ id: uid(), label, vehicle, addedAt: new Date().toISOString() },
		],
	}));
}

export function removeFavouriteVehicle(id: string): void {
	store.update((s) => ({
		...s,
		vehicles: s.vehicles.filter((v) => v.id !== id),
	}));
}

export function renameFavouriteVehicle(id: string, label: string): void {
	store.update((s) => ({
		...s,
		vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, label } : v)),
	}));
}

/** Check if a vehicle context (by seriesId+modelId+engineId) is already favourited */
export function isVehicleFavourited(vehicle: VehicleContext): boolean {
	let result = false;
	store.subscribe((s) => {
		result = s.vehicles.some(
			(v) =>
				v.vehicle.seriesId === vehicle.seriesId &&
				v.vehicle.modelId === vehicle.modelId &&
				v.vehicle.engineId === vehicle.engineId,
		);
	})();
	return result;
}

// ── Document favourites ────────────────────────────────────────────────────

export function addFavouriteDocument(
	doc: { docId: number; title: string; code: string | null; docTypeId: number },
	vehicle: VehicleContext | null,
	label = '',
): void {
	store.update((s) => ({
		...s,
		documents: [
			...s.documents,
			{
				id: uid(),
				label,
				docId: doc.docId,
				title: doc.title,
				code: doc.code,
				docTypeId: doc.docTypeId,
				vehicle: vehicle && vehicle.seriesId ? { ...vehicle } : null,
				addedAt: new Date().toISOString(),
			},
		],
	}));
}

export function removeFavouriteDocument(id: string): void {
	store.update((s) => ({
		...s,
		documents: s.documents.filter((d) => d.id !== id),
	}));
}

export function renameFavouriteDocument(id: string, label: string): void {
	store.update((s) => ({
		...s,
		documents: s.documents.map((d) => (d.id === id ? { ...d, label } : d)),
	}));
}

/** Check if a document (by docId) is already favourited */
export function isDocumentFavourited(docId: number): boolean {
	let result = false;
	store.subscribe((s) => {
		result = s.documents.some((d) => d.docId === docId);
	})();
	return result;
}

// ── Export / Import ────────────────────────────────────────────────────────

export function exportFavourites(): string {
	let data: FavouritesData = { vehicles: [], documents: [] };
	store.subscribe((s) => {
		data = s;
	})();
	return JSON.stringify(data, null, 2);
}

export function importFavourites(json: string): { success: boolean; error?: string } {
	try {
		const parsed = JSON.parse(json) as Partial<FavouritesData>;
		if (!parsed || typeof parsed !== 'object') {
			return { success: false, error: 'Invalid JSON structure' };
		}
		const vehicles = Array.isArray(parsed.vehicles) ? parsed.vehicles : [];
		const documents = Array.isArray(parsed.documents) ? parsed.documents : [];

		// Basic validation
		for (const v of vehicles) {
			if (!v.id || !v.vehicle?.seriesId) {
				return { success: false, error: 'Invalid vehicle entry in data' };
			}
		}
		for (const d of documents) {
			if (!d.id || !d.docId) {
				return { success: false, error: 'Invalid document entry in data' };
			}
		}

		store.set({ vehicles, documents });
		return { success: true };
	} catch {
		return { success: false, error: 'Failed to parse JSON' };
	}
}
