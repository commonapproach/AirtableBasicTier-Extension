import { XMLParser } from "fast-xml-parser";

interface Sector {
	"@id": string;
	hasIdentifier: string;
	hasName: string;
	hasDescription?: string;
}

async function fetchAndParseSectorList(url: string): Promise<Sector[]> {
	try {
		// Fetch the OWL file via AllOrigins
		// Temporarily disabled due to CORS issues while testing
		const response = await fetch(url);

		// Extract the XML data from the response
		const xmlData = await response.text();

		const options = {
			ignoreAttributes: false,
		};

		const parser = new XMLParser(options);
		const jsonData = parser.parse(xmlData);

		const sectors: Sector[] = [];
		const descriptions = jsonData["rdf:RDF"]["rdf:Description"] || [];

		for (let desc of descriptions) {
			if (!desc["cids:hasIdentifier"]) {
				continue;
			}

			const sector: Sector = {
				"@id": desc["@_rdf:about"],
				hasIdentifier: desc["cids:hasIdentifier"] ? desc["cids:hasIdentifier"].toString() : "",
				hasName: desc["cids:hasName"]["#text"] ? desc["cids:hasName"]["#text"].toString() : "",
			};

			if (desc["cids:hasDescription"]) {
				sector.hasDescription = desc["cids:hasDescription"]["#text"]
					? desc["cids:hasDescription"]["#text"].toString()
					: "";
			}

			sectors.push(sector);
		}

		return sectors;
	} catch (error) {
		console.error(`Error fetching or parsing ${url}:`, error);
		return [];
	}
}

export async function getAllSectors(): Promise<Sector[]> {
	try {
		const icnpoSectors = await fetchAndParseSectorList(
			"https://codelist.commonapproach.org/codeLists/ICNPOsector.owl"
		);
		const statsCanSectors = await fetchAndParseSectorList(
			"https://codelist.commonapproach.org/codeLists/StatsCanSector.owl"
		);

		return [...icnpoSectors, ...statsCanSectors];
	} catch (error) {
		console.error("Error fetching sectors:", error);
		return [];
	}
}
