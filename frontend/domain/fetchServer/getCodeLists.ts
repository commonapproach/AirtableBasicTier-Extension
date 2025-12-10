import { XMLParser } from "fast-xml-parser";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CodeList {
	"@id": string;
	"@type"?: string;
	hasIdentifier: string;
	hasName: string;
	hasDescription?: string;
}

interface CacheItem {
	data: CodeList[];
	timestamp: number;
	expiresIn: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours

/** Primary codelist URLs from commonapproach.org - Updated Dec 2025 */
const CODELIST_URLS = {
	ESDCSector: "https://codelist.commonapproach.org/ESDCSector.ttl",
	PopulationServed: "https://codelist.commonapproach.org/PopulationServed.ttl",
	ProvinceTerritory: "https://codelist.commonapproach.org/ProvinceTerritory.ttl",
	OrganizationType: "https://codelist.commonapproach.org/OrgTypeGOC.ttl",
	Locality: "https://codelist.commonapproach.org/LocalityStatsCan.ttl",
	CorporateRegistrar: "https://codelist.commonapproach.org/CanadianCorporateRegistries.ttl",
} as const;

/** GitHub fallback URLs for redundancy */
const GITHUB_FALLBACK_URLS: Record<string, string> = {
	[CODELIST_URLS.ESDCSector]: 
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/ESDCSector.ttl",
	[CODELIST_URLS.PopulationServed]: 
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/PopulationServed.ttl",
	[CODELIST_URLS.ProvinceTerritory]: 
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/ProvinceTerritory.ttl",
	[CODELIST_URLS.OrganizationType]: 
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/OrgTypeGOC.ttl",
	[CODELIST_URLS.Locality]: 
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/LocalityStatsCan.ttl",
	[CODELIST_URLS.CorporateRegistrar]: 
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/CanadianCorporateRegistries.ttl",
};

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

const inMemoryCache: Record<string, CodeList[]> = {};

function getCachedData(url: string): CodeList[] | null {
	if (inMemoryCache[url]?.length > 0) {
		console.log(`✅ Cache hit (memory): ${url}`);
		return inMemoryCache[url];
	}

	const cachedData = localStorage.getItem(url);
	if (!cachedData) {
		return null;
	}

	try {
		const parsedData = JSON.parse(cachedData) as CacheItem;

		if (!parsedData.data || !parsedData.timestamp || !parsedData.expiresIn) {
			localStorage.removeItem(url);
			return null;
		}

		const isExpired = Date.now() - parsedData.timestamp > parsedData.expiresIn;
		if (isExpired) {
			localStorage.removeItem(url);
			return null;
		}

		console.log(`✅ Cache hit (localStorage): ${url}`);
		inMemoryCache[url] = parsedData.data;
		return parsedData.data;
	} catch (error) {
		localStorage.removeItem(url);
		return null;
	}
}

function setCachedData(url: string, data: CodeList[]): void {
	if (!data || data.length === 0) {
		return;
	}

	inMemoryCache[url] = data;

	const cacheItem: CacheItem = {
		data,
		timestamp: Date.now(),
		expiresIn: CACHE_EXPIRATION_TIME,
	};

	try {
		localStorage.setItem(url, JSON.stringify(cacheItem));
		console.log(`💾 Cached ${data.length} entries for ${url}`);
	} catch (error) {
		console.warn(`⚠️ Failed to cache in localStorage:`, error);
	}
}

export function clearCodeListCache(tableName?: string): void {
	if (tableName) {
		const urlMap: Record<string, string> = {
			Sector: CODELIST_URLS.ESDCSector,
			PopulationServed: CODELIST_URLS.PopulationServed,
			Locality: CODELIST_URLS.Locality,
			ProvinceTerritory: CODELIST_URLS.ProvinceTerritory,
			OrganizationType: CODELIST_URLS.OrganizationType,
			CorporateRegistrar: CODELIST_URLS.CorporateRegistrar,
		};

		const url = urlMap[tableName];
		if (url) {
			delete inMemoryCache[url];
			localStorage.removeItem(url);
			console.log(`🗑️ Cleared cache for ${tableName}`);
		}
	} else {
		Object.keys(inMemoryCache).forEach(key => delete inMemoryCache[key]);
		Object.keys(localStorage).forEach(key => {
			if (key.includes('codelist.commonapproach.org')) {
				localStorage.removeItem(key);
			}
		});
		console.log("🗑️ Cleared all codelist caches");
	}
}

// ============================================================================
// XML PARSER (for .owl files - kept for backward compatibility)
// ============================================================================

function parseXmlToCodeList(xmlData: string): CodeList[] {
	const parser = new XMLParser({ ignoreAttributes: false });
	const jsonData = parser.parse(xmlData);

	const codeList: CodeList[] = [];
	const descriptions = jsonData["rdf:RDF"]?.["rdf:Description"] || [];
	let baseIdUrl = "";

	const descArray = Array.isArray(descriptions) ? descriptions : [descriptions];

	for (const desc of descArray) {
		if (desc["vann:preferredNamespacePrefix"]) {
			baseIdUrl = desc["@_rdf:about"]?.replace("#dataset", "") || "";
			continue;
		}

		if (!desc["cids:hasIdentifier"] && !desc["cids:hasName"]) {
			continue;
		}

		const entry: CodeList = {
			"@id": desc["@_rdf:about"]?.includes(baseIdUrl)
				? desc["@_rdf:about"]
				: baseIdUrl + desc["@_rdf:about"],
			hasIdentifier: desc["cids:hasIdentifier"]?.toString() || "",
			hasName: desc["cids:hasName"]?.["#text"]?.toString() || "",
		};

		if (desc["cids:hasDescription"]?.["#text"]) {
			entry.hasDescription = desc["cids:hasDescription"]["#text"].toString();
		} else if (desc["cids:hasDefinition"]?.["#text"]) {
			entry.hasDescription = desc["cids:hasDefinition"]["#text"].toString();
		}

		codeList.push(entry);
	}

	return codeList;
}

// ============================================================================
// TURTLE PARSER (for .ttl files) - TESTED AND VERIFIED
// ============================================================================

function parseTurtleToCodeList(ttlData: string, sourceUrl: string): CodeList[] {
	const codeList: CodeList[] = [];
	
	// Extract base URI from @base declaration
	let baseUri = "";
	const baseMatch = ttlData.match(/@base\s*<([^>]+)>/m);
	if (baseMatch) {
		baseUri = baseMatch[1];
	}
	
	// Get default prefix URI (the : prefix)
	// Handle relative prefix like <#> by combining with base
	const defaultPrefixMatch = ttlData.match(/@prefix\s*:\s*<([^>]+)>/m);
	let defaultPrefixUri = "";
	if (defaultPrefixMatch) {
		if (defaultPrefixMatch[1] === '#') {
			// Relative prefix - combine with base
			defaultPrefixUri = baseUri + '#';
		} else {
			defaultPrefixUri = defaultPrefixMatch[1];
		}
	} else {
		defaultPrefixUri = baseUri + '#';
	}

	// Collect all named prefixes for resolving URIs
	const prefixes: Record<string, string> = {};
	const prefixRegex = /@prefix\s+([a-zA-Z0-9_-]+):\s*<([^>]+)>/gm;
	let prefixMatch;
	while ((prefixMatch = prefixRegex.exec(ttlData)) !== null) {
		prefixes[prefixMatch[1]] = prefixMatch[2];
	}

	console.log(`\n=== Parsing TTL: ${sourceUrl} ===`);
	console.log(`Base URI: ${baseUri}`);
	console.log(`Default prefix URI: ${defaultPrefixUri}`);

	const lines = ttlData.split('\n');
	let currentEntry: CodeList | null = null;
	let currentBlock = '';

	for (let i = 0; i < lines.length; i++) {
		const originalLine = lines[i];
		const trimmedLine = originalLine.trim();

		// Skip empty lines, comments, and declarations
		if (!trimmedLine || trimmedLine.startsWith('#') || 
			trimmedLine.startsWith('@prefix') || trimmedLine.startsWith('@base')) {
			continue;
		}

		// KEY: Check if line starts at column 0 (no leading whitespace)
		// Entity definitions start at column 0, predicates are indented
		const startsAtColumn0 = originalLine.length > 0 && 
								originalLine[0] !== ' ' && 
								originalLine[0] !== '\t';

		let isNewEntity = false;
		let entityId = "";
		let entityIdentifier = "";

		if (startsAtColumn0) {
			// Skip the <> empty base reference (ontology metadata block)
			if (trimmedLine.startsWith('<>')) {
				continue;
			}

			// Pattern 1: Default prefix entity - :LocalName
			// Examples: ":Other", ":ca", ":ab"
			const defaultMatch = trimmedLine.match(/^:([a-zA-Z0-9_-]+)/);
			if (defaultMatch) {
				isNewEntity = true;
				entityIdentifier = defaultMatch[1];
				entityId = defaultPrefixUri + entityIdentifier;
			}

			// Pattern 2: Named prefix entity - prefix:LocalName
			// Examples: "iriscategory:Agriculture"
			if (!isNewEntity) {
				const namedMatch = trimmedLine.match(/^([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)/);
				if (namedMatch && prefixes[namedMatch[1]]) {
					isNewEntity = true;
					entityIdentifier = namedMatch[2];
					entityId = prefixes[namedMatch[1]] + entityIdentifier;
				}
			}

			// Pattern 3: Full URL entity - <https://...>
			if (!isNewEntity) {
				const urlMatch = trimmedLine.match(/^<(https?:\/\/[^>]+)>/);
				if (urlMatch) {
					isNewEntity = true;
					entityId = urlMatch[1];
					// Extract identifier from URL
					const parts = entityId.split(/[/#]/);
					entityIdentifier = parts[parts.length - 1] || entityId;
				}
			}
		}

		if (isNewEntity) {
			// Save previous entry if it has required data
			if (currentEntry && currentEntry.hasName) {
				codeList.push(currentEntry);
				console.log(`  ✅ ${codeList.length}: ${currentEntry.hasIdentifier} → "${currentEntry.hasName}"`);
			}

			// Start new entry
			currentEntry = {
				"@id": entityId,
				hasIdentifier: entityIdentifier,
				hasName: "",
			};
			currentBlock = trimmedLine;
		} else if (currentEntry) {
			// Continue building current entry's block (indented predicate lines)
			currentBlock += ' ' + trimmedLine;
			
			// Extract org:hasIdentifier (overrides parsed identifier)
			const idMatch = currentBlock.match(/org:hasIdentifier\s+"([^"]+)"/);
			if (idMatch) {
				currentEntry.hasIdentifier = idMatch[1];
			}
			
			// Extract org:hasName (primary)
			const nameMatch = currentBlock.match(/org:hasName\s+"([^"]+)"/);
			if (nameMatch) {
				currentEntry.hasName = nameMatch[1];
			}
			
			// Extract cids:hasDescription
			const descMatch = currentBlock.match(/cids:hasDescription\s+"([^"]+)"/);
			if (descMatch) {
				currentEntry.hasDescription = descMatch[1];
			}
		}
	}

	// Don't forget the last entry
	if (currentEntry && currentEntry.hasName) {
		codeList.push(currentEntry);
		console.log(`  ✅ ${codeList.length}: ${currentEntry.hasIdentifier} → "${currentEntry.hasName}"`);
	}

	console.log(`📊 Total parsed: ${codeList.length} entries`);
	console.log(`=== End Parsing ===\n`);

	return codeList;
}

// ============================================================================
// FETCH AND PARSE
// ============================================================================

async function fetchAndParseCodeList(url: string): Promise<CodeList[]> {
	try {
		const cachedData = getCachedData(url);
		if (cachedData) {
			return cachedData;
		}

		console.log(`🌐 Fetching: ${url}`);
		let data: string;
		let codeList: CodeList[] = [];

		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			data = await response.text();
			console.log(`✅ Fetch successful (${(data.length / 1024).toFixed(2)} KB)`);
		} catch (primaryError) {
			console.warn(`⚠️ Primary fetch failed: ${(primaryError as Error).message}`);

			const fallbackUrl = GITHUB_FALLBACK_URLS[url];
			if (!fallbackUrl) {
				throw new Error(`No fallback URL available for ${url}`);
			}

			console.log(`🔄 Trying GitHub fallback: ${fallbackUrl}`);
			const fallbackResponse = await fetch(fallbackUrl);
			if (!fallbackResponse.ok) {
				throw new Error(`Fallback HTTP ${fallbackResponse.status}`);
			}
			data = await fallbackResponse.text();
			console.log(`✅ Fallback successful`);
		}

		// Parse based on file extension
		if (url.endsWith('.ttl')) {
			codeList = parseTurtleToCodeList(data, url);
		} else if (url.endsWith('.owl')) {
			codeList = parseXmlToCodeList(data);
		} else {
			throw new Error(`Unsupported file format for ${url}`);
		}

		if (codeList.length > 0) {
			setCachedData(url, codeList);
		} else {
			console.warn(`⚠️ Warning: Parsed 0 entries from ${url}`);
		}

		return codeList;
	} catch (error) {
		console.error(`❌ Failed to fetch and parse ${url}:`, error);
		throw error;
	}
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function getAllSectors(): Promise<CodeList[]> {
	try {
		console.log("\n🌍 === FETCHING ESDC SECTORS === 🌍");
		const sectors = await fetchAndParseCodeList(CODELIST_URLS.ESDCSector);
		console.log(`✨ Total Sectors: ${sectors.length}\n`);
		return sectors;
	} catch (error) {
		console.error("❌ Error in getAllSectors():", error);
		return [];
	}
}

export async function getAllPopulationServed(): Promise<CodeList[]> {
	try {
		return await fetchAndParseCodeList(CODELIST_URLS.PopulationServed);
	} catch (error) {
		console.error("❌ Error fetching PopulationServed:", error);
		return [];
	}
}

export async function getAllProvinceTerritory(): Promise<CodeList[]> {
	try {
		return await fetchAndParseCodeList(CODELIST_URLS.ProvinceTerritory);
	} catch (error) {
		console.error("❌ Error fetching ProvinceTerritory:", error);
		return [];
	}
}

export async function getAllOrganizationType(): Promise<CodeList[]> {
	try {
		return await fetchAndParseCodeList(CODELIST_URLS.OrganizationType);
	} catch (error) {
		console.error("❌ Error fetching OrganizationType:", error);
		return [];
	}
}

export async function getAllLocalities(): Promise<CodeList[]> {
	try {
		return await fetchAndParseCodeList(CODELIST_URLS.Locality);
	} catch (error) {
		console.error("❌ Error fetching Locality:", error);
		return [];
	}
}

export async function getAllCorporateRegistrars(): Promise<CodeList[]> {
	try {
		return await fetchAndParseCodeList(CODELIST_URLS.CorporateRegistrar);
	} catch (error) {
		console.error("❌ Error fetching CorporateRegistrar:", error);
		return [];
	}
}

export async function getCodeListByTableName(tableName: string): Promise<CodeList[]> {
	const urlMap: Record<string, string> = {
		Sector: CODELIST_URLS.ESDCSector,
		PopulationServed: CODELIST_URLS.PopulationServed,
		Locality: CODELIST_URLS.Locality,
		ProvinceTerritory: CODELIST_URLS.ProvinceTerritory,
		OrganizationType: CODELIST_URLS.OrganizationType,
		CorporateRegistrar: CODELIST_URLS.CorporateRegistrar,
	};

	const url = urlMap[tableName];
	if (!url) {
		throw new Error(`No codelist URL found for table: ${tableName}`);
	}

	return fetchAndParseCodeList(url);
}