import { XMLParser } from "fast-xml-parser";

export interface CodeList {
	"@id": string;
	hasIdentifier: string;
	hasName: string;
	hasDescription?: string;
}

interface CacheItem {
	data: CodeList[];
	timestamp: number;
	expiresIn: number; // 24 hours in milliseconds
}

const inMemoryCache: { [key: string]: CodeList[] } = {};
const CACHE_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// GitHub fallback URLs mapping
const GITHUB_FALLBACK_URLS: { [key: string]: string } = {
	"https://codelist.commonapproach.org/ICNPOsector/ICNPOsector.owl":
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/ICNPOsector/ICNPOsector.owl",
	"https://codelist.commonapproach.org/StatsCanSector/StatsCanSector.owl":
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/StatsCanSector/StatsCanSector.owl",
	"https://codelist.commonapproach.org/PopulationServed/PopulationServed.owl":
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/PopulationServed/PopulationServed.owl",
	"https://codelist.commonapproach.org/ProvinceTerritory/ProvinceTerritory.owl":
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/ProvinceTerritory/ProvinceTerritory.owl",
	"https://codelist.commonapproach.org/OrgTypeGOC/OrgTypeGOC.owl":
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/OrgTypeGOC/OrgTypeGOC.owl",
	"https://codelist.commonapproach.org/Locality/LocalityStatsCan.owl":
		"https://raw.githubusercontent.com/commonapproach/CodeLists/main/Locality/LocalityStatsCan.owl",
};

function parseXmlToCodeList(xmlData: string): CodeList[] {
	const options = {
		ignoreAttributes: false,
	};

	const parser = new XMLParser(options);
	const jsonData = parser.parse(xmlData);

	const codeList: CodeList[] = [];
	const descriptions = jsonData["rdf:RDF"]["rdf:Description"] || [];
	let baseIdUrl = "";

	for (let desc of descriptions) {
		if (desc["vann:preferredNamespacePrefix"]) {
			baseIdUrl = desc["@_rdf:about"].replace("#dataset", "");
			continue;
		}

		if (!desc["cids:hasIdentifier"] && !desc["cids:hasName"]) {
			continue;
		}

		const sector: CodeList = {
			"@id": desc["@_rdf:about"].includes(baseIdUrl)
				? desc["@_rdf:about"]
				: baseIdUrl + desc["@_rdf:about"],
			hasIdentifier: desc["cids:hasIdentifier"] ? desc["cids:hasIdentifier"].toString() : "",
			hasName: desc["cids:hasName"]["#text"] ? desc["cids:hasName"]["#text"].toString() : "",
		};

		if (desc["cids:hasDescription"]) {
			sector.hasDescription = desc["cids:hasDescription"]["#text"]
				? desc["cids:hasDescription"]["#text"].toString()
				: "";
		} else if (desc["cids:hasDefinition"]) {
			sector.hasDescription = desc["cids:hasDefinition"]["#text"]
				? desc["cids:hasDefinition"]["#text"].toString()
				: "";
		}

		codeList.push(sector);
	}

	return codeList;
}

async function fetchAndParseCodeList(url: string): Promise<CodeList[]> {
	try {
		// Check if the data is already in the cache
		if (inMemoryCache[url] && inMemoryCache[url].length > 0) {
			return inMemoryCache[url];
		}

		// Check if the data is in the local storage
		const cachedData = localStorage.getItem(url);
		if (cachedData) {
			try {
				const parsedData = JSON.parse(cachedData);

				// Check if it's the new cache format with expiration
				if (parsedData.data && parsedData.timestamp && parsedData.expiresIn) {
					const now = Date.now();
					const isExpired = now - parsedData.timestamp > parsedData.expiresIn;

					if (!isExpired) {
						// Cache is still valid
						inMemoryCache[url] = parsedData.data;
						return parsedData.data;
					} else {
						// Cache expired, remove it
						localStorage.removeItem(url);
					}
				} else if (Array.isArray(parsedData)) {
					// Old cache format - invalidate it by removing from localStorage
					localStorage.removeItem(url);
				}
			} catch (error) {
				// Invalid JSON or corrupted cache, remove it
				localStorage.removeItem(url);
			}
		}

		let xmlData: string;
		let codeList: CodeList[] = [];

		// Try to fetch from primary URL first
		try {
			console.log(`Attempting to fetch from primary URL: ${url}`);
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Primary fetch failed with status: ${response.status}`);
			}

			xmlData = await response.text();
			codeList = parseXmlToCodeList(xmlData);

			console.log(`Successfully fetched ${codeList.length} items from primary URL`);
		} catch (primaryError) {
			console.warn(`Primary fetch failed for ${url}:`, primaryError);

			// Try GitHub fallback if available and no cached data exists
			const fallbackUrl = GITHUB_FALLBACK_URLS[url];
			if (fallbackUrl) {
				try {
					console.log(`Attempting fallback from GitHub: ${fallbackUrl}`);
					const fallbackResponse = await fetch(fallbackUrl);

					if (!fallbackResponse.ok) {
						throw new Error(`Fallback fetch failed with status: ${fallbackResponse.status}`);
					}

					xmlData = await fallbackResponse.text();
					codeList = parseXmlToCodeList(xmlData);

					console.log(`Successfully fetched ${codeList.length} items from GitHub fallback`);
				} catch (fallbackError) {
					console.error(`Both primary and fallback fetch failed for ${url}:`, fallbackError);
					throw new Error(
						`All fetch attempts failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
					);
				}
			} else {
				console.error(`No fallback URL available for ${url}`);
				throw primaryError;
			}
		}

		inMemoryCache[url] = codeList;

		// Save the data to the local storage with expiration if codeList is not empty and has less than 200kb
		if (codeList.length > 0) {
			const cacheItem: CacheItem = {
				data: codeList,
				timestamp: Date.now(),
				expiresIn: CACHE_EXPIRATION_TIME,
			};

			const serializedCache = JSON.stringify(cacheItem);
			if (serializedCache.length < 200000) {
				localStorage.setItem(url, serializedCache);
			}
		}

		return codeList;
	} catch (error) {
		console.error(`Error fetching or parsing ${url}:`, error);

		// As a last resort, check if we have any cached data (even if expired)
		const lastResortCache = localStorage.getItem(url);
		if (lastResortCache) {
			try {
				const parsedData = JSON.parse(lastResortCache);
				if (parsedData.data && Array.isArray(parsedData.data)) {
					console.warn(`Using expired cached data for ${url} as fallback`);
					return parsedData.data;
				}
			} catch (cacheError) {
				console.error(`Failed to parse last resort cache for ${url}:`, cacheError);
			}
		}

		return [];
	}
}

export async function getCodeListByTableName(tableName: string): Promise<CodeList[]> {
	let codeList: CodeList[] = [];
	switch (tableName) {
		case "Sector":
			codeList = await getAllSectors();
			break;
		case "PopulationServed":
			codeList = await getAllPopulationServed();
			break;
		case "ProvinceTerritory":
			codeList = await getAllProvinceTerritory();
			break;
		case "OrganizationType":
			codeList = await getAllOrganizationType();
			break;
		case "Locality":
			codeList = await getAllLocalities();
			break;
		default:
			throw new Error(`Table ${tableName} not found`);
	}

	return codeList;
}

export async function getAllSectors(): Promise<CodeList[]> {
	try {
		const icnpoSectors = await fetchAndParseCodeList(
			"https://codelist.commonapproach.org/ICNPOsector/ICNPOsector.owl"
		);
		const statsCanSectors = await fetchAndParseCodeList(
			"https://codelist.commonapproach.org/StatsCanSector/StatsCanSector.owl"
		);

		return [...icnpoSectors, ...statsCanSectors];
	} catch (error) {
		console.error("Error fetching sectors code list:", error);
		return [];
	}
}

export async function getAllPopulationServed(): Promise<CodeList[]> {
	try {
		const populationServed = await fetchAndParseCodeList(
			"https://codelist.commonapproach.org/PopulationServed/PopulationServed.owl"
		);

		return populationServed;
	} catch (error) {
		console.error("Error fetching PopulationServed code list:", error);
		return [];
	}
}

export async function getAllProvinceTerritory(): Promise<CodeList[]> {
	try {
		const provinceTerritory = await fetchAndParseCodeList(
			"https://codelist.commonapproach.org/ProvinceTerritory/ProvinceTerritory.owl"
		);

		return provinceTerritory;
	} catch (error) {
		console.error("Error fetching ProvinceTerritory code list:", error);
		return [];
	}
}

export async function getAllOrganizationType(): Promise<CodeList[]> {
	try {
		const organizationType = await fetchAndParseCodeList(
			"https://codelist.commonapproach.org/OrgTypeGOC/OrgTypeGOC.owl"
		);

		return organizationType;
	} catch (error) {
		console.error("Error fetching OrganizationType code list:", error);
		return [];
	}
}

export async function getAllLocalities(): Promise<CodeList[]> {
	try {
		const localities = await fetchAndParseCodeList(
			"https://codelist.commonapproach.org/Locality/LocalityStatsCan.owl"
		);

		return localities;
	} catch (error) {
		console.error("Error fetching Locality code list:", error);
		return [];
	}
}
