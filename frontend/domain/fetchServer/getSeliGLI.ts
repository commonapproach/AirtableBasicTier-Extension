// Fetch, cache, and parse SELI-GLI Turtle data for Theme, Outcome, Indicator
export interface SeliTheme {
	"@id": string;
	hasName: string;
}
export interface SeliOutcome {
	"@id": string;
	hasName: string;
	forTheme: string; // @id of Theme
	hasIndicator: string[]; // @ids of Indicators
}
export interface SeliIndicator {
	"@id": string;
	hasName: string;
	hasDescription?: string;
	forOutcome: string; // @id of Outcome
}

export interface SeliGLIData {
	themes: SeliTheme[];
	outcomes: SeliOutcome[];
	indicators: SeliIndicator[];
}

const SELI_GLI_URL = "https://codelist.commonapproach.org/SELI-GLI/SELI-GLI.ttl";
const SELI_GLI_GITHUB_FALLBACK_URL =
	"https://raw.githubusercontent.com/commonapproach/CodeLists/main/SELI-GLI/SELI-GLI.ttl";
const CACHE_KEY = "seli_gli_cache";
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

function parseTurtleToSeliGLI(ttl: string): SeliGLIData {
	// Dynamically extract base URI from @prefix : <...> .
	let baseUri = "https://codelist.commonapproach.org/codeLists/SELI/"; // fallback
	const baseUriMatch = ttl.match(/^@prefix\s*:\s*<([^>]+)>/m);
	if (baseUriMatch) {
		baseUri = baseUriMatch[1];
	}

	// Generic Turtle parser for cids: properties
	const themes: SeliTheme[] = [];
	const outcomes: SeliOutcome[] = [];
	const indicators: SeliIndicator[] = [];

	// Split into subject blocks (Theme, Outcome, Indicator, etc.)
	const subjectBlockRegex = /:(\w+)\s+a cids:(\w+)\s*;([\s\S]*?)(?=\n\s*:[\w]+\s+a cids:|$)/g;
	let m;
	while ((m = subjectBlockRegex.exec(ttl))) {
		const id = m[1];
		const type = m[2];
		const propsBlock = m[3];
		const props: Record<string, any> = {};
		// Add @id property with full URI (dynamically from baseUri)
		props["@id"] = baseUri + id;

		// Find all cids:property value pairs
		const propRegex = /cids:(\w+)\s+((?:"[^"]+")|(?:[:\w\d,\s]+))/g;
		let pm;
		while ((pm = propRegex.exec(propsBlock))) {
			const key = pm[1];
			let value = pm[2].trim();
			if (value.startsWith('"') && value.endsWith('"')) {
				// String value
				value = value.slice(1, -1);
			} else if (value.startsWith(":")) {
				// Reference(s), possibly comma-separated - convert to full URIs
				const refs = value.split(",").map((s) => baseUri + s.trim().replace(":", ""));
				value = refs.length === 1 ? refs[0] : refs;
			}
			props[key] = value;
		}

		// Assign to correct array based on type
		if (type === "Theme") {
			themes.push(props as SeliTheme);
		} else if (type === "Outcome") {
			// Ensure hasIndicator is always an array
			if (props.hasIndicator && !Array.isArray(props.hasIndicator)) {
				props.hasIndicator = [props.hasIndicator];
			}
			outcomes.push(props as SeliOutcome);
		} else if (type === "Indicator") {
			indicators.push(props as SeliIndicator);
		}
	}

	return { themes, outcomes, indicators };
}

export async function fetchAndParseSeliGLI(): Promise<SeliGLIData> {
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
	let data: SeliGLIData;

	// Try to fetch from primary URL first
	try {
		console.log(`Attempting to fetch SELI-GLI from primary URL: ${SELI_GLI_URL}`);
		const resp = await fetch(SELI_GLI_URL);

		if (!resp.ok) {
			throw new Error(`Primary fetch failed with status: ${resp.status}`);
		}

		ttl = await resp.text();
		data = parseTurtleToSeliGLI(ttl);

		console.log(
			`Successfully fetched SELI-GLI data from primary URL - Themes: ${data.themes.length}, Outcomes: ${data.outcomes.length}, Indicators: ${data.indicators.length}`
		);
	} catch (primaryError) {
		console.warn(`Primary SELI-GLI fetch failed:`, primaryError);

		// Try GitHub fallback
		try {
			console.log(`Attempting SELI-GLI fallback from GitHub: ${SELI_GLI_GITHUB_FALLBACK_URL}`);
			const fallbackResp = await fetch(SELI_GLI_GITHUB_FALLBACK_URL);

			if (!fallbackResp.ok) {
				throw new Error(`Fallback fetch failed with status: ${fallbackResp.status}`);
			}

			ttl = await fallbackResp.text();
			data = parseTurtleToSeliGLI(ttl);

			console.log(
				`Successfully fetched SELI-GLI data from GitHub fallback - Themes: ${data.themes.length}, Outcomes: ${data.outcomes.length}, Indicators: ${data.indicators.length}`
			);
		} catch (fallbackError) {
			console.error(`Both primary and fallback SELI-GLI fetch failed:`, fallbackError);

			// As a last resort, check if we have any cached data (even if expired)
			const lastResortCache = localStorage.getItem(CACHE_KEY);
			if (lastResortCache) {
				try {
					const parsedData = JSON.parse(lastResortCache);
					if (parsedData.data) {
						console.warn(`Using expired cached SELI-GLI data as fallback`);
						return parsedData.data;
					}
				} catch (cacheError) {
					console.error(`Failed to parse last resort SELI-GLI cache:`, cacheError);
				}
			}

			throw new Error(
				`All SELI-GLI fetch attempts failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
			);
		}
	}

	// Cache the successful data
	localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
	return data;
}
