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

		const response = await fetch(url);

		// Extract the XML data from the response
		const xmlData = await response.text();

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
			"https://codelist.commonapproach.org/codeLists/ICNPOsector.owl"
		);
		const statsCanSectors = await fetchAndParseCodeList(
			"https://codelist.commonapproach.org/codeLists/StatsCanSector.owl"
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
			"https://codelist.commonapproach.org/codeLists/PopulationServed.owl"
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
			"https://codelist.commonapproach.org/codeLists/ProvinceTerritory.owl"
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
			"https://codelist.commonapproach.org/codeLists/OrgTypeGOC.owl"
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
			"https://codelist.commonapproach.org/codeLists/LocalityStatsCan.owl"
		);

		return localities;
	} catch (error) {
		console.error("Error fetching Locality code list:", error);
		return [];
	}
}
