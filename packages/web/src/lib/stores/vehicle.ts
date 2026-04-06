import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type VehicleContext = {
	seriesId: string;
	seriesName: string;
	modelId: string;
	modelName: string;
	engineId: string;
	engineName: string;
	/** Comma-separated KAROSSERIE_IDs resolved from TFZGTYP */
	bodyIds: string;
	/** Comma-separated GETRIEBE_IDs resolved from TFZGTYP */
	gearboxIds: string;
	/** Human-readable body type names (e.g. ["SAL", "TOUR"]) */
	bodyNames: string[];
	/** Human-readable gearbox type names (e.g. ["AUT", "MECH"]) */
	gearboxNames: string[];
	/** Comma-separated ANTRIEB_IDs resolved from TFZGTYP */
	driveIds: string;
	/** Human-readable drive type names (e.g. ["4WD", "HECK"]) */
	driveNames: string[];
	/** Model year or year range (e.g. "1998" or "1998-2005") */
	modelYear: string;
	/** Production date from VIN lookup (YYYYMM format), empty if not from VIN */
	productionDate: string;
};

const STORAGE_KEY = 'tisx-vehicle';

const empty: VehicleContext = {
	seriesId: '',
	seriesName: '',
	modelId: '',
	modelName: '',
	engineId: '',
	engineName: '',
	bodyIds: '',
	gearboxIds: '',
	bodyNames: [],
	gearboxNames: [],
	driveIds: '',
	driveNames: [],
	modelYear: '',
	productionDate: '',
};

function loadFromStorage(): VehicleContext {
	if (!browser) return { ...empty };
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...empty };
		const parsed = JSON.parse(raw);
		return { ...empty, ...parsed };
	} catch {
		return { ...empty };
	}
}

export const vehicle = writable<VehicleContext>(loadFromStorage());

// Persist to sessionStorage on every change
vehicle.subscribe((value) => {
	if (!browser) return;
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
});

/** Whether a vehicle is currently selected (at minimum series is set) */
export const hasVehicle = derived(vehicle, ($v) => !!$v.seriesId);

/** Summary string for display, e.g. "E46 / 330i / M54" */
export const vehicleSummary = derived(vehicle, ($v) => {
	if (!$v.seriesId) return '';
	const parts = [
		$v.seriesName || $v.seriesId,
		$v.modelName || $v.modelId,
		$v.engineName || $v.engineId,
	].filter(Boolean);
	return parts.join(' / ');
});

/** Build a URLSearchParams query string fragment for API calls, e.g. "?series=11013&model=..." */
export function buildVehicleQuery(v: VehicleContext): string {
	const params = new URLSearchParams();
	if (v.seriesId) params.set('series', v.seriesId);
	if (v.modelId) params.set('model', v.modelId);
	if (v.engineId) params.set('engine', v.engineId);
	if (v.bodyIds) params.set('body', v.bodyIds);
	if (v.gearboxIds) params.set('gearbox', v.gearboxIds);
	const query = params.toString();
	return query ? `?${query}` : '';
}

export function setVehicle(ctx: Partial<VehicleContext>) {
	vehicle.update((current) => ({ ...current, ...ctx }));
}

export function clearVehicle() {
	vehicle.set({ ...empty });
}
