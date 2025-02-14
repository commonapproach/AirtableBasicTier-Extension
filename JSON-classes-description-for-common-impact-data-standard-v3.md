# JSON classes description for common impact data standard version 3.0

This document describes the JSON classes for the Common Impact Data Standard (CIDS) version 3.0 basic tier. The intention of this document is to provide a guide for developers to understand the structure of the CIDS ontology and how to represent data in JSON format. The classes described in this document will be used in the development of the AirTable Extension and the Excel Add-in.

## Classes

The following classes are part of the CIDS ontology and are part of the basic tier of the standard.

### cids:Organization

```json
{
	"@context": [
		"https://ontology.commonapproach.org/cids.jsonld",
		"https://ontology.commonapproach.org/sff-1.0.jsonld"
	],
	"@type": "cids:Organization",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/",
	"org:hasLegalName": "<ORGANIZATION_NAME>",
	"ic:hasAddress": [
		"<ADDRESS_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/Address/<ADDRESS_ID>",
		"..."
	],
	"hasOutcome": [
		"<OUTCOME_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/Outcome/<NAME_OF_OUTCOME>",
		"..."
	],
	"hasIndicator": [
		"<INDICATOR_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/Indicator/<INDICATOR_NAME>",
		"..."
	]
}
```

#### Data Types:

- @context - constant, string or array, required;
- @type - string, required;
- @id - string, unique, URI, required;
- org:hasLegalName - string, required on export / warning on import, default value "";
- ic:hasAddress - strings array, default value [];
- hasIndicator - strings array, default value [];
- hasOutcome - strings array, default value [];

#### Accepted field names on import:

- Organization Name: org:hasLegalName or hasLegalName
- Address: ic:hasAddress or hasAddress

### cids:Theme

```json
{
	"@context": [
		"https://ontology.commonapproach.org/cids.jsonld",
		"https://ontology.commonapproach.org/sff-1.0.jsonld"
	],
	"@type": "cids:Theme",
	"@id": "<URI_FORMAT_ID>",
	"hasName": "<THEME_NAME>",
	"hasDescription": "<THEME_DESCRIPTION>",
	"hasCode": "<REFERENCE_FOR_A_CODE_INSTANCE>",
	"relatesTo": ["<THEME_ID>", "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Theme/<THEME_NAME>", "..."]
}
```

#### Data Types:

- @context - constant, string or array, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasName - string, required on export / warning on import, default value "";
- hasDescription - string, default value "";
- hasCode - string array, default value [];
- relatesTo - strings array, default value [];

### cids:Outcome

```json
{
  "@context": [
		"https://ontology.commonapproach.org/cids.jsonld",
		"https://ontology.commonapproach.org/sff-1.0.jsonld"
	],
  "@type": "cids:Outcome",
  "@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Outcome/<OUTCOME_NAME_URI_FORMAT>",
  "hasName": "<OUTCOME_NAME>",
  "hasDescription": "<OUTCOME_DESCRIPTION>",
  "forTheme": [ "<THEME_ID>", ... ],
  "forOrganization": "<ORGANIZATION_ID>",
  "hasIndicator": [ "<INDICATOR_ID>", "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Indicator/<INDICATOR_NAME>", "..." ]
}
```

#### Data Types:

- @context - constant, string or array, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasName - string, required on export / warning on import, default value "";
- hasDescription - string, default value "";
- forTheme - strings array, warning, default value [];
- forOrganization - string, required on export / warning on import, default value "";

### cids:Indicator

```json
{
   "@context": [
		"https://ontology.commonapproach.org/cids.jsonld",
		"https://ontology.commonapproach.org/sff-1.0.jsonld"
	],
   "@type": "cids:Indicator",
   "@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Indicator/<INDICATOR_NAME_URI_FORMAT>",
   "hasName": "<INDICATOR_NAME>",
   "hasDescription": "<INDICATOR_DESCRIPTION>",
   "forOrganization": "<ORGANIZATION_ID>",
   "forOutcome": [ "<OUTCOME_ID>", ... ],
   "hasIndicatorReport": [
	   "<INDICATOR_REPORT_ID>",
	   "http://<ORGANIZATION_NAME_URL_FORMAT>.org/IndicatorReport/<INDICATOR_NAME_URI_FORMAT>/<INDICATOR_REPORT_REFERENCE>",
	   "..."
   ],
   "i72:unit_of_measure": "<STRING>"
}
```

#### Data Types:

- @context - constant, string or array, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasName - string, required on export / warning on import, default value "";
- hasDescription - string, default value "";
- forOrganization - string, required on export / warning on import, default value "";
- forOutcome - strings array, warning, default value [];
- hasIndicatorReport - strings array, warning, default value [];
- i72:unit_of_measure - string, required on export / warning on import, default value "";

### cids:IndicatorReport

```json
{
	"@context": [
		"https://ontology.commonapproach.org/cids.jsonld",
		"https://ontology.commonapproach.org/sff-1.0.jsonld"
	],
	"@type": "cids:IndicatorReport",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/IndicatorReport/<INDICATOR_NAME_URI_FORMAT>/<IDICATOR_REPORT_REFERENCE>",
	"hasName": "<INDICATOR_REPORT_NAME>",
	"hasComment": "<INDICATOR_REPORT_COMMENTS>",
	"i72:unit_of_measure": "<STRING>",
	"i72:value": {
		"@context": [
		"https://ontology.commonapproach.org/cids.jsonld",
		"https://ontology.commonapproach.org/sff-1.0.jsonld"
	],
		"@type": "i72:Measure",
		"i72:numerical_value": "<NUMERICAL_VALUE_AS_STRING>"
	},
	"prov:startedAtTime": "<DATE_TIME_IN_XSD_DATE_TIME_FORMAT>", //“YYYY-MM-DDThh:mm:ss[Z| (+|-)hh:mm]”
	"prov:endedAtTime": "<DATE_TIME_IN_XSD_DATE_TIME_FORMAT>",
	"forIndicator": "<INDICATOR_ID>"
}
```

#### Data Types:

- @context - constant, string or array, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasName - string, required on export / warning on import, default value "";
- hasComment - string, default value "";
- i72:unit_of_measure - string, required on export / warning on import, default value "";
- i72:value - object, default value class with all fields empty;
- i72:value.i72:numerical_value - string, default value "";
- prov:startedAtTime - string, required on export / warning on import, default value "";
- prov:endedAtTime - string, required on export / warning on import, default value "";
- forIndicator - string, required on export / warning on import, default value "";

#### Accepted field names on import:

- i72:value - i72:value or value
- i72:numerical_value - i72:numerical_value or numerical_value
- i72:unit_of_measure - i72:unit_of_measure or unit_of_measure
- prov:startedAtTime - prov:startedAtTime or startedAtTime
- prov:endedAtTime - prov:endedAtTime or endedAtTime

### ic:Address

```json
{
	"@context": [
		"https://ontology.commonapproach.org/cids.jsonld",
		"https://ontology.commonapproach.org/sff-1.0.jsonld"
	],
	"@type": "ic:Address",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Address/<ADDRESS_ID>",
	"ic:hasStreet": "<STREET_NAME>",
	"ic:hasStreetType": "<ONE_OF_{ic:avenue, ic:boulevard, ic:circle, ic:crescent, ic:drive, ic:road, ic:street}>",
	"ic:hasStreetNumber": "<STREET_NUMBER>",
	"ic:hasStreetDirection": "<ONE_OF_{ic:east, ic:north, ic:south, ic:west}>",
	"ic:hasUnitNumber": "<UNIT_NUMBER>",
	"ic:hasCity": "<CITY_NAME>",
	"ic:hasState": "<STATE_2_LETTER_CODE>",
	"ic:hasPostalCode": "<POSTAL_CODE>",
	"ic:hasCountry": "<COUNTRY_2_LETTER_CODE>"
}
```

#### Data Types:

- @context - constant, string or array, required;
- @type - string, required;
- @id - string, unique, URI, required;
- ic:hasStreet - string, required on export / warning on import, default value "";
- ic:hasStreetType - string, required on export / warning on import, default value "";
- ic:hasStreetNumber - string, required on export / warning on import, default value "";
- ic:hasStreetDirection - string, required on export / warning on import, default value "";
- ic:hasUnitNumber - string, required on export / warning on import, default value "";
- ic:hasCity - string, required on export / warning on import, default value "";
- ic:hasProvince - string, required on export / warning on import, default value "";
- ic:hasPostalCode - string, required on export / warning on import, default value "";
- ic:hasCountry - string, required on export / warning on import, default value "";

#### Accepted field names on import:

- All fields on ic:Address object will be accept with or without the ic: prefix

**Note:** All numbers should be represented as strings.
