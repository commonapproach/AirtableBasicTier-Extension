import * as RDF from "@rdfjs/types";
import * as jsonld from "jsonld";
import { Parser, Store } from "n3";
import { IntlShape } from "react-intl";
import SHACLValidator from "shacl-js";

/**
 * Converts an array of quads to a DatasetCore
 */
function quadsToDataset(quads: RDF.Quad[]): RDF.DatasetCore {
	const store = new Store(quads);
	return store;
}

export interface SHACLValidationResult {
	conforms: boolean;
	results: Array<{
		severity: string;
		focusNode: string;
		message: string;
		sourceShape: string;
	}>;
	summary: Record<string, number>;
}

/**
 * Loads JSON-LD data and converts it to RDF Dataset
 */
async function loadJsonLdToDataset(jsonLdData: any): Promise<RDF.DatasetCore> {
	try {
		const nquads = await jsonld.toRDF(jsonLdData, { format: "application/n-quads" });
		const parser = new Parser({ format: "N-Quads" });
		const quads = parser.parse(nquads as string);
		const dataset = quadsToDataset(quads);
		console.log(`[SHACL] Loaded ${dataset.size} quads from JSON-LD data`);
		return dataset;
	} catch (error: any) {
		console.error("[SHACL] Error converting JSON-LD to RDF:", error);
		throw new Error(`Failed to convert JSON-LD to RDF: ${error.message}`);
	}
}

/**
 * Loads Turtle data and converts it to RDF Dataset
 */
async function loadTurtleToDataset(turtleData: string): Promise<RDF.DatasetCore> {
	try {
		// Remove BOM if present
		if (turtleData.charCodeAt(0) === 0xfeff) {
			turtleData = turtleData.slice(1);
		}
		const parser = new Parser({ format: "text/turtle" });
		const quads = parser.parse(turtleData);
		return quadsToDataset(quads);
	} catch (error: any) {
		throw new Error(`Failed to parse Turtle data: ${error.message}`);
	}
}

/**
 * Loads ontology from URL - no fallbacks, fails if remote loading fails
 */
async function loadOntologyFromUrl(url: string): Promise<RDF.DatasetCore> {
	console.log(`[SHACL] Loading ontology from: ${url}`);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to load ontology from ${url}: HTTP ${response.status} ${response.statusText}`
		);
	}

	const text = await response.text();

	// Determine format based on URL or content-type
	let format = "application/rdf+xml";
	const contentType = response.headers.get("content-type");

	if (url.endsWith(".jsonld") || contentType?.includes("application/ld+json")) {
		// Handle JSON-LD context files by converting to RDF
		const jsonData = JSON.parse(text);
		return await loadJsonLdToDataset(jsonData);
	} else if (contentType?.includes("turtle") || url.endsWith(".ttl")) {
		format = "text/turtle";
	} else if (contentType?.includes("n-triples") || url.endsWith(".nt")) {
		format = "application/n-triples";
	}

	// Handle RDF/XML format - N3.js has limited support for RDF/XML in browsers
	if (format === "application/rdf+xml" || text.trim().startsWith("<?xml")) {
		console.warn(
			`[SHACL] RDF/XML format detected from ${url}. N3.js has limited RDF/XML support in browsers.`
		);

		// For now, return empty store since N3.js can't parse RDF/XML reliably in browsers
		// In a production environment, you might want to:
		// 1. Convert the .owl files to .ttl format and serve them instead
		// 2. Use a server-side conversion service
		// 3. Use a different RDF parser that supports RDF/XML in browsers
		console.warn(
			`[SHACL] Skipping ${url} due to RDF/XML format limitations. Consider converting to Turtle format.`
		);
		return new Store(); // Return empty store to continue validation without this ontology
	}

	const parser = new Parser({ format });
	const quads = parser.parse(text);
	console.log(`[SHACL] Successfully loaded ${url} (${quads.length} triples)`);
	return quadsToDataset(quads);
}

/**
 * Main SHACL validation function - clean version without fallbacks
 */
export async function validateWithSHACL(
	jsonLdData: any,
	shaclTurtleData: string,
	intl: IntlShape
): Promise<SHACLValidationResult> {
	console.log("Loading data graph...");
	const dataGraph = await loadJsonLdToDataset(jsonLdData);

	console.log("Loading SHACL graph...");
	const shaclGraph = await loadTurtleToDataset(shaclTurtleData);

	// Load ontologies from remote sources - try Turtle format first, then OWL
	const ontologySources = [
		"https://ontology.commonapproach.org/cids.ttl", // Try Turtle format first
		"https://ontology.commonapproach.org/sff-1.0.ttl", // Try Turtle format first
	];

	let combinedDataGraph = dataGraph;

	// Load and merge ontologies into data graph
	console.log("[SHACL] Loading ontology sources...");
	for (const source of ontologySources) {
		try {
			console.log(`[SHACL] Loading ontology from: ${source}`);
			const ontGraph = await loadOntologyFromUrl(source);

			// Only merge if we got triples
			if (ontGraph.size > 0) {
				// Merge ontology into data graph
				const mergedStore = new Store();
				for (const quad of combinedDataGraph) {
					mergedStore.add(quad);
				}
				for (const quad of ontGraph) {
					mergedStore.add(quad);
				}
				combinedDataGraph = mergedStore;
				console.log(
					`[SHACL] Successfully merged ontology from ${source} - graph now has ${combinedDataGraph.size} triples`
				);
			} else {
				console.warn(`[SHACL] Ontology from ${source} was empty, skipping merge`);
			}
		} catch (error: any) {
			console.warn(`[SHACL] Failed to load ontology from ${source}: ${error.message}`);
			console.warn(`[SHACL] Continuing validation without this ontology...`);
		}
	}

	console.log(`Final data graph has ${combinedDataGraph.size} triples.`);
	console.log(`SHACL graph has ${shaclGraph.size} triples.`);

	// Use shacl-js for validation
	// shacl-js expects N3.Store for both data and shapes
	// Convert DatasetCore to N3.Store if needed
	const dataStore =
		combinedDataGraph instanceof Store ? combinedDataGraph : new Store([...combinedDataGraph]);
	const shapesStore = shaclGraph instanceof Store ? shaclGraph : new Store([...shaclGraph]);

	let report;
	try {
		const validator = new SHACLValidator(shapesStore);
		report = validator.validate(dataStore);
	} catch (err) {
		console.error("[SHACL] SHACL-JS validation error:", err);
		throw new Error(
			"SHACL validation failed: " + (err instanceof Error ? err.message : String(err))
		);
	}

	if (!report || typeof report.conforms !== "function" || typeof report.results !== "function") {
		console.error("[SHACL] SHACL-JS returned an invalid or undefined report:", report);
		throw new Error(
			"SHACL validation could not be performed: SHACL-JS returned an invalid or undefined report."
		);
	}

	const conforms = report.conforms();
	const results = report.results();

	// Process results
	const processedResults = results.map((result: any) => ({
		severity: result.severity().value.split("#").pop() || "Unknown",
		focusNode: result.focusNode().value,
		message:
			result.message()?.[0]?.value ||
			intl.formatMessage({
				id: "validation.shacl.no.message",
				defaultMessage: "No message provided",
			}),
		sourceShape: result.sourceShape().value,
	}));

	// Create summary
	const summary = results.reduce((acc: Record<string, number>, curr: any) => {
		const msg = curr.message()?.[0]?.value || "Unknown message";
		acc[msg] = (acc[msg] || 0) + 1;
		return acc;
	}, {});

	// Log validation results
	console.log(`\nData conforms to shapes: ${conforms}`);

	if (!conforms) {
		console.log("--- Violation Summary ---");
		for (const [msg, count] of Object.entries(summary)) {
			console.log(`- ${msg} (${count})`);
		}

		console.log("\n--- Individual Violations ---");
		for (const res of results) {
			console.log("\n- Violation:");
			console.log(`  Severity: ${res.severity().value.split("#").pop()}`);
			console.log(`  Focus Node: ${res.focusNode().value}`);
			console.log(`  Message: ${res.message()?.[0]?.value || "No message"}`);
			console.log(`  Source Shape: ${res.sourceShape().value}`);
		}
	} else {
		console.log("✅ No violations found.");
	}

	return {
		conforms,
		results: processedResults,
		summary,
	};
}

/**
 * Formats SHACL validation results for display as individual warning messages
 */
export function formatSHACLValidationResults(
	validationResult: SHACLValidationResult,
	intl: IntlShape
): string[] {
	if (validationResult.conforms) {
		const successMessage = intl.formatMessage({
			id: "validation.shacl.success",
			defaultMessage: "✅ Data conforms to all SHACL shapes. No violations found.",
		});
		return [String(successMessage)];
	}

	const warnings: string[] = [];

	// Add each violation as a separate warning
	validationResult.results.forEach((violation, index) => {
		// Create a simple string message without rich text formatting to avoid type issues
		const warningMessage = intl.formatMessage(
			{
				id: "validation.shacl.violation.individual",
				defaultMessage: "❌ SHACL Violation #{index}: {severity} - {message} (Focus: {focusNode})",
			},
			{
				index: index + 1,
				severity: violation.severity,
				focusNode: violation.focusNode,
				message: violation.message,
			}
		);

		warnings.push(String(warningMessage));
	});

	return warnings;
}
