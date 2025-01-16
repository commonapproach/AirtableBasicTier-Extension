import { FieldType } from "@airtable/blocks/models";
import * as jsonld from "jsonld";
import { Options } from "jsonld";
import { IntlShape } from "react-intl";
import { contextUrl } from "./domain/models";

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
/**
 * Custom document loader that enforces HTTPS, checks for trusted domains, and fetches JSON-LD context documents.
 *
 * @param url - The URL of the context document to load.
 * @returns A promise that resolves to an object containing the context document.
 * @throws Will throw an error if the URL is not trusted, if the request times out, or if there is a network/CORS issue.
 */
const customLoader: Options.DocLoader["documentLoader"] = async (url: string) => {
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

/**
 * Parses JSON-LD data and returns an array of instances.
 *
 * This function expands the JSON-LD data if it is an array, and then compacts it using teh common approach context.
 * It uses a custom document loader for both expanding and compacting the JSON-LD data.
 *
 * @param jsonLdData - The JSON-LD data to be parsed. It can be an array or an object.
 * @returns An array of instances extracted from the compacted JSON-LD data.
 * @throws Will throw an error if there is an issue with parsing the JSON-LD data.
 */
export async function parseJsonLd(jsonLdData: any) {
	try {
		// Expand JSON-LD if needed
		const expandedData = Array.isArray(jsonLdData)
			? await jsonld.expand(jsonLdData, { documentLoader: customLoader })
			: jsonLdData;

		// Compact JSON-LD using the CIDS context
		const compactedData = await jsonld.compact(
			expandedData,
			{
				"@context": contextUrl,
			},
			{
				documentLoader: customLoader,
			}
		);

		const instances = (compactedData["@graph"] as any[]) || [];

		return instances;
	} catch (error: any) {
		throw new Error(`Error parsing JSON-LD: ${error.message}`);
	}
}
