// Fetch, cache, and parse SELI-GLI-SFI Turtle data for Theme, Outcome, Indicator
// Mirrors getSeliGLI.ts but targets the SFI codelist URL.
export interface SeliTheme {
	"@id": string;
	hasName: string;
}
export interface SeliOutcome {
	"@id": string;
	hasName: string;
	forTheme: string;
	hasIndicator: string[];
	forOrganization?: string;
}
export interface SeliIndicator {
	"@id": string;
	hasName: string;
	hasDescription?: string;
	forOutcome: string;
	forOrganization?: string;
}
export interface SeliOrganization {
	"@id": string;
	hasLegalName: string;
}

export interface SeliGLISFIData {
	themes: SeliTheme[];
	outcomes: SeliOutcome[];
	indicators: SeliIndicator[];
	organization: SeliOrganization | null;
}

const SELI_GLI_SFI_URL = "https://codelist.commonapproach.org/SELI-GLI-SFI.ttl";
const SELI_GLI_SFI_GITHUB_FALLBACK_URL =
	"https://raw.githubusercontent.com/commonapproach/CodeLists/main/SELI-GLI-SFI.ttl";
const CACHE_KEY = "seli_gli_sfi_cache";
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

function parseTurtleToSeliGLISFI(ttl: string): SeliGLISFIData {
	const baseUriMatch = ttl.match(/@base\s*<([^>]+)>/);
	const baseUri = baseUriMatch
		? baseUriMatch[1]
		: "https://codelist.commonapproach.org/SELI-GLI-SFI";
	const fragmentBase = baseUri + "#";

	const cidsPrefixMatch = ttl.match(/@prefix\s+cids:\s*<([^>]+)>/);
	const cidsPrefix = cidsPrefixMatch
		? cidsPrefixMatch[1]
		: "https://ontology.commonapproach.org/cids#";

	let organization: SeliOrganization | null = null;
	const esdcMatch = ttl.match(/cids:esdc[\s\S]*?org:hasLegalName\s+"([^"]+)"/);
	if (esdcMatch) {
		organization = { "@id": `${cidsPrefix}esdc`, hasLegalName: esdcMatch[1] };
	}

	const themes: SeliTheme[] = [];
	const outcomes: SeliOutcome[] = [];
	const indicators: SeliIndicator[] = [];

	const blocks = ttl.split(/\n(?=:[\w]+\s*\n\s+a\s+cids:)/);

	for (const block of blocks) {
		const subjectMatch = block.match(/^:([\w]+)/);
		if (!subjectMatch) continue;
		const localId = subjectMatch[1];
		const fullId = fragmentBase + localId;

		const typeMatch = block.match(/a\s+cids:(Theme|Outcome|Indicator)[,\s;]/);
		if (!typeMatch) continue;
		const type = typeMatch[1];

		const nameMatch = block.match(/org:hasName\s+"([^"]+)"/);
		if (!nameMatch) continue;
		const hasName = nameMatch[1];

		const descMatch = block.match(/cids:hasDescription\s+"([^"]+)"/);
		const hasDescription = descMatch ? descMatch[1] : undefined;

		const forOrgMatch = block.match(/cids:forOrganization\s+cids:([\w]+)/);
		const forOrganization = forOrgMatch ? `${cidsPrefix}${forOrgMatch[1]}` : undefined;

		if (type === "Theme") {
			themes.push({ "@id": fullId, hasName });
		} else if (type === "Outcome") {
			const forThemeMatch = block.match(/cids:forTheme\s+:([\w]+)/);
			const forTheme = forThemeMatch ? fragmentBase + forThemeMatch[1] : "";

			const hasIndicatorMatch = block.match(/cids:hasIndicator\s+((?::([\w]+)(?:\s*,\s*)?)+)/);
			let hasIndicator: string[] = [];
			if (hasIndicatorMatch) {
				hasIndicator = [...hasIndicatorMatch[1].matchAll(/:([\w]+)/g)].map(
					(m) => fragmentBase + m[1]
				);
			}

			outcomes.push({ "@id": fullId, hasName, forTheme, hasIndicator, forOrganization });
		} else if (type === "Indicator") {
			const forOutcomeMatch = block.match(/cids:forOutcome\s+:([\w]+)/);
			const forOutcome = forOutcomeMatch ? fragmentBase + forOutcomeMatch[1] : "";

			indicators.push({ "@id": fullId, hasName, hasDescription, forOutcome, forOrganization });
		}
	}

	return { themes, outcomes, indicators, organization };
}

export async function fetchAndParseSeliGLISFI(): Promise<SeliGLISFIData> {
	// Check cache
	const cached = localStorage.getItem(CACHE_KEY);
	if (cached) {
		try {
			const parsed = JSON.parse(cached);
			if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_EXPIRATION) {
				return parsed.data;
			}
		} catch {
			// Invalid cache, ignore
		}
		localStorage.removeItem(CACHE_KEY);
	}

	let ttl: string;
	let data: SeliGLISFIData;

	// Try primary URL first
	try {
		console.log(`Attempting to fetch SELI-GLI-SFI from primary URL: ${SELI_GLI_SFI_URL}`);
		const resp = await fetch(SELI_GLI_SFI_URL);
		if (!resp.ok) {
			throw new Error(`Primary fetch failed with status: ${resp.status}`);
		}
		ttl = await resp.text();
		data = parseTurtleToSeliGLISFI(ttl);
		console.log(
			`Successfully fetched SELI-GLI-SFI from primary URL - Themes: ${data.themes.length}, Outcomes: ${data.outcomes.length}, Indicators: ${data.indicators.length}`
		);
	} catch (primaryError) {
		console.warn(`Primary SELI-GLI-SFI fetch failed:`, primaryError);

		// Try GitHub fallback
		try {
			console.log(
				`Attempting SELI-GLI-SFI fallback from GitHub: ${SELI_GLI_SFI_GITHUB_FALLBACK_URL}`
			);
			const fallbackResp = await fetch(SELI_GLI_SFI_GITHUB_FALLBACK_URL);
			if (!fallbackResp.ok) {
				throw new Error(`Fallback fetch failed with status: ${fallbackResp.status}`);
			}
			ttl = await fallbackResp.text();
			data = parseTurtleToSeliGLISFI(ttl);
			console.log(
				`Successfully fetched SELI-GLI-SFI from GitHub fallback - Themes: ${data.themes.length}, Outcomes: ${data.outcomes.length}, Indicators: ${data.indicators.length}`
			);
		} catch (fallbackError) {
			console.error(`Both primary and fallback SELI-GLI-SFI fetch failed:`, fallbackError);

			// Last resort: use any cached data even if expired
			const lastResortCache = localStorage.getItem(CACHE_KEY);
			if (lastResortCache) {
				try {
					const parsedData = JSON.parse(lastResortCache);
					if (parsedData.data) {
						console.warn(`Using expired cached SELI-GLI-SFI data as fallback`);
						return parsedData.data;
					}
				} catch (cacheError) {
					console.error(`Failed to parse last resort SELI-GLI-SFI cache:`, cacheError);
				}
			}

			throw new Error(
				`All SELI-GLI-SFI fetch attempts failed. Primary: ${(primaryError as Error).message}, Fallback: ${(fallbackError as Error).message}`
			);
		}
	}

	// Cache successful data
	localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
	return data;
}