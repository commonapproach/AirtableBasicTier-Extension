import { FieldType } from "@airtable/blocks/models";
import * as jsonld from "jsonld";
import { Options } from "jsonld";
import { IntlShape } from "react-intl";
import defaultContext from "./jsonld_context/default_context.json";
import sffContext from "./jsonld_context/sff_context.json";

/**
 * Handles the change event of a file input element.
 * Reads the selected file, checks if it has a ".jsonld" extension,
 * and if so, reads the file content as text and parses it as JSON.
 * Finally, calls the `onSuccess` callback function with the parsed JSON data.
 * @param event - The event object triggered by the file input element.
 * @param onSuccess - A callback function that will be called with the parsed JSON data.
 * @param onError - A callback function that will be called if an error occurs.
 * @returns Promise<void>
 */
export const handleFileChange = async (
	event: any,
	onSuccess: (data: any) => void,
	onError: (error: any) => void,
	intl: IntlShape
): Promise<void> => {
	const file = event.target.files[0];
	if (file && (file.name.endsWith(".jsonld") || file.name.endsWith(".json"))) {
		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const data = JSON.parse(e.target.result as any);
				onSuccess(data);
			} catch (error) {
				onError(
					new Error(
						intl.formatMessage({
							id: "import.messages.error.notValidJson",
							defaultMessage: "File is not a valid JSON/JSON-LD file.",
						})
					)
				);
			}
		};
		reader.readAsText(file);
	} else {
		onError(
			new Error(
				intl.formatMessage({
					id: "import.messages.error.notJson",
					defaultMessage: "File is not a JSON/JSON-LD file.",
				})
			)
		);
	}
};

/**
 * Downloads a JSON-LD file by converting the data into a JSON string,
 * creating a Blob object with the JSON string, and generating a download link for the Blob object.
 * When the link is clicked, the file is downloaded.
 *
 * @param data - The data to be downloaded as a JSON-LD file.
 * @param filename - The name of the downloaded file.
 * @returns void
 */
export function downloadJSONLD(data: any, filename: string): void {
	const jsonldString = JSON.stringify(data, null, 2);
	const blob = new Blob([jsonldString], { type: "application/ld+json" });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);

	URL.revokeObjectURL(url);
}

/**
 * Executes tasks in batches, where each task operates on a batch of items.
 * @param items - The array of items to be processed.
 * @param task - A function that processes a batch of items and returns a Promise.
 * @param batchSize - The number of items to process in each batch. (default: 50)
 */
export async function executeInBatches<T>(
	items: T[],
	task: (batch: T[]) => Promise<void>,
	batchSize: number = 50
): Promise<void> {
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		await task(batch);
	}
}

/**
 * Returns the actual field type based on the given type.
 * @param type - The type of the field.
 * @returns The actual field type.
 */
export function getActualFieldType(type: string): FieldType {
	switch (type) {
		case "string":
			return FieldType.SINGLE_LINE_TEXT;
		case "text":
			return FieldType.MULTILINE_TEXT;
		case "link":
			return FieldType.MULTIPLE_RECORD_LINKS;
		case "date":
			return FieldType.DATE;
		case "datetime":
			return FieldType.DATE_TIME;
		case "boolean":
			return FieldType.CHECKBOX;
		case "select":
			return FieldType.SINGLE_SELECT;
		case "multiselect":
			return FieldType.MULTIPLE_SELECTS;
		default:
			return FieldType.SINGLE_LINE_TEXT;
	}
}

const trustedDomains = [
	"ontology.commonapproach.org",
	"sparql.cwrc.ca",
	"www.w3.org",
	"xmlns.com",
	"www.opengis.net",
	"schema.org",
	"ontology.eil.utoronto.ca",
];

// Custom document loader
// Map of URLs to local context files
const localContexts: { [key: string]: any } = {
	"https://ontology.commonapproach.org/cids.jsonld": defaultContext,
	"https://ontology.commonapproach.org/sff-1.0.jsonld": sffContext,
};

/**
 * Custom document loader that enforces HTTPS, checks for trusted domains, and fetches JSON-LD context documents.
 *
 * @param url - The URL of the context document to load.
 * @returns A promise that resolves to an object containing the context document.
 * @throws Will throw an error if the URL is not trusted, if the request times out, or if there is a network/CORS issue.
 */
const customLoader: Options.DocLoader["documentLoader"] = async (url: string) => {
	// Check if we have a local context for this URL
	if (localContexts[url]) {
		return {
			contextUrl: undefined,
			documentUrl: url,
			document: localContexts[url],
		};
	}

	// Enforce HTTPS by rewriting the URL
	if (url.startsWith("http://")) {
		// eslint-disable-next-line no-param-reassign
		url = url.replace("http://", "https://");
	}

	// Check if the URL is in the trusted list
	const urlDomain = new URL(url).hostname;
	if (!trustedDomains.some((trustedDomain) => urlDomain.endsWith(trustedDomain))) {
		throw new Error(`URL not trusted: ${url}`);
	}

	try {
		// Fetch the context document using HTTPS
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000); // Set a timeout of 5 seconds

		const response = await fetch(url, { signal: controller.signal }); // Use AbortController's signal
		clearTimeout(timeoutId);
		if (!response.ok) {
			throw new Error(`Failed to load context from URL: ${url} (Status: ${response.status})`);
		}
		const document = await response.json();

		// Return the fetched document
		return {
			contextUrl: undefined, // No additional context
			documentUrl: url, // The URL of the document
			document, // The resolved JSON-LD context
		};
	} catch (error: any) {
		if (error.name === "AbortError") {
			throw new Error(`Request timed out while trying to load context from URL: ${url}`);
		} else if (error.message.includes("Failed to fetch")) {
			throw new Error(`CORS issue or network error while trying to load context from URL: ${url}`);
		} else {
			throw new Error(`Error loading context from URL: ${url} (${error.message})`);
		}
	}
};

// List of good context URLs.
const goodContexts = [
	"https://ontology.commonapproach.org/cids.jsonld",
	"https://ontology.commonapproach.org/sff-1.0.jsonld",
	"http://ontology.eil.utoronto.ca/cids/contexts/cidsContext.json", // try to keep compatibility with old CIDS ontology
	"https://ontology.commonapproach.org/contexts/cidsContext.json", // try to keep compatibility with old CIDS ontology
];

// Replace URL list to try to keep minimal compatibility with the old CIDS ontology.
const urlsToReplace = [
	"http://ontology.eil.utoronto.ca/cids/cids#",
	"http://ontology.commonapproach.org/owl/cids_v2.1.owl/cids#",
	"http://ontology.commonapproach.org/tove/organization#",
	"http://ontology.commonapproach.org/ISO21972/iso21972#",
	"https://www.w3.org/Submission/prov-json/schema#",
	"http://ontology.commonapproach.org/tove/icontact#",
];

/**
 * Processes a single JSON-LD object.
 * If the object already uses one of the good contexts, it is returned as-is.
 * Otherwise, it is expanded, compacted with the merged context, and then processed
 * to replace legacy URL portions.
 */
async function processJsonLdObject(obj: any): Promise<any[]> {
	// Check if the object's @context is already one of the good ones.
	let alreadyGood = false;
	if (obj["@context"]) {
		if (typeof obj["@context"] === "string") {
			alreadyGood = goodContexts.includes(obj["@context"]);
		} else if (Array.isArray(obj["@context"])) {
			alreadyGood = obj["@context"].some((c: string) => goodContexts.includes(c));
		}
	}

	if (alreadyGood) {
		// The object already uses a good context; return it as a single-element array.
		return [obj];
	} else {
		// Otherwise, process it:
		const expanded = await jsonld.expand(obj, { documentLoader: customLoader });
		const mergedContext = [
			defaultContext["@context"],
			sffContext["@context"],
		] as unknown as jsonld.ContextDefinition;
		const compacted = await jsonld.compact(expanded, mergedContext, {
			documentLoader: customLoader,
		});

		// The compacted document might contain an @graph.
		const instances = (compacted["@graph"] as any[]) || [compacted];

		// Apply URL replacement to each instance.
		return instances.map((instance) => replaceOldUrls(instance));
	}
}

/**
 * Iterates through the array of JSON-LD objects and processes each one individually.
 */
export async function parseJsonLd(jsonLdData: any[]): Promise<any[]> {
	const processedInstances: any[] = [];
	for (const obj of jsonLdData) {
		let results = await processJsonLdObject(obj);
		results = cleanupDuplicates(results);
		results = removeCidsPrefix(results);
		processedInstances.push(...results);
	}
	return processedInstances;
}

/**
 * Recursively replace legacy URLs in strings and object keys.
 * Only acts on keys that are full IRIs (i.e. start with "http://" or "https://").
 * If a key is not a full IRI (already compact), it is left unchanged.
 */
function replaceOldUrls(input: any): any {
	if (typeof input === "string") {
		for (const url of urlsToReplace) {
			if (input.startsWith(url)) {
				return input.replace(url, "cids:");
			}
		}
		return input;
	} else if (Array.isArray(input)) {
		return input.map((item) => replaceOldUrls(item));
	} else if (input !== null && typeof input === "object") {
		// If this is a "value object", flatten it.
		// eslint-disable-next-line no-prototype-builtins
		if (input.hasOwnProperty("@value")) {
			return replaceOldUrls(input["@value"]);
		}
		const newObj: any = {};
		for (const [key, value] of Object.entries(input)) {
			let newKey = key;
			// Process keys that appear to be full IRIs.
			if (key.startsWith("http://") || key.startsWith("https://")) {
				const matchedUrl = urlsToReplace.find((url) => key.startsWith(url));
				if (matchedUrl) {
					const parts = key.split("#");
					if (parts.length > 1 && parts[1].length > 0) {
						newKey = "cids:" + parts[1];
					}
				}
				newObj[newKey] = replaceOldUrls(value);
			} else {
				newObj[key] = replaceOldUrls(value);
			}
		}
		// Optionally, clean up duplicate keys if both "cids:relatesTo" and "relatesTo" exist.
		for (const key in newObj) {
			// eslint-disable-next-line no-prototype-builtins
			if (!key.includes(":") && newObj.hasOwnProperty("cids:" + key)) {
				delete newObj["cids:" + key];
			}
		}
		return newObj;
	}
	return input;
}

function cleanupDuplicates(obj: any): any {
	for (const key in obj) {
		if (["@context", "@id", "@type"].includes(key)) {
			continue;
		}
		if (!key.startsWith("cids:")) {
			const cidsKey = "cids:" + key;
			// eslint-disable-next-line no-prototype-builtins
			if (obj.hasOwnProperty(cidsKey)) {
				delete obj[cidsKey];
			}
		}
		if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
			obj[key] = cleanupDuplicates(obj[key]);
		}
	}
	return obj;
}

// recursively remove cids: prefix from keys
function removeCidsPrefix(obj: any): any {
	if (Array.isArray(obj)) {
		return obj.map((item) => removeCidsPrefix(item));
	} else if (obj !== null && typeof obj === "object") {
		const newObj: any = {};
		for (const [key, value] of Object.entries(obj)) {
			let newKey = key;
			if (key.startsWith("cids:")) {
				newKey = key.substring(5);
			}
			newObj[newKey] = removeCidsPrefix(value);
		}
		return newObj;
	}
	return obj;
}
