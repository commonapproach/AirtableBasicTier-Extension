// Fetch, cache, and parse SELI-GLI Turtle data for Theme, Outcome, Indicator
export interface SeliTheme {
	id: string;
	hasName: string;
}
export interface SeliOutcome {
	id: string;
	hasName: string;
	forTheme: string; // id of Theme
	hasIndicator: string[]; // ids of Indicators
}
export interface SeliIndicator {
	id: string;
	hasName: string;
	hasDescription?: string;
	forOutcome: string; // id of Outcome
}

export interface SeliGLIData {
	themes: SeliTheme[];
	outcomes: SeliOutcome[];
	indicators: SeliIndicator[];
}

const SELI_GLI_URL = "https://codelist.commonapproach.org/codeLists/SELI-GLI.ttl";
const CACHE_KEY = "seli_gli_cache";
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

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

	// Fetch Turtle
	const resp = await fetch(SELI_GLI_URL);
	const ttl = await resp.text();

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
		const props: Record<string, any> = { id };

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
				// Reference(s), possibly comma-separated
				const refs = value.split(",").map((s) => s.trim().replace(":", ""));
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

	const data: SeliGLIData = { themes, outcomes, indicators };
	localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
	return data;
}
