# JSON classes description for common impact data standard version 3.0 Social Finance Fund Companion Module

This document describes the JSON classes to be added in the AirTable extension and Excel add-in for the Social Finance Fund Companion Module (SFF) which will extend the Common Impact Data Standard (CIDS) version 3.0 basic tier in order to meet the reporting requirements of Canada's Social Finance Fund. The intention of this document is to provide a guide for developers to understand the structure of the new classes of the SSF module according to the ontology and how to represent data in JSON format.

## Classes

The following classes are part of the SFF module.

### cids:OrganizationProfile

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:OrganizationProfile",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/OrganizationProfile/<ORGANIZATION_NAME_URI_FORMAT>",
	"forOrganization": "<ORGANIZATION_ID>",
	"hasPrimaryContact": [
		"<PERSON_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/Person/<PERSON_NAME>",
		"..."
	],
	"hasManagementTeamProfile": [
		"<TEAM_PROFILE_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/TeamProfile/<TEAM_PROFILE_NAME>",
		"..."
	],
	"hasBoardProfile": [
		"<BOARD_PROFILE_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/TeamProfile/<BOARD_PROFILE_NAME>",
		"..."
	],
	"sectorServed": [
		"<SECTOR_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/Sector/<SECTOR_NAME>",
		"..."
	],
	"localityServed": [
		"<LOCALITY_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/Locality/<LOCALITY_NAME>",
		"..."
	],
	"provinceTerritoryServed": [
		"<PROVINCE_TERRITORY_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/ProvinceTerritory/<PROVINCE_TERRITORY_NAME>",
		"..."
	],
	"primaryPopulationServed": [
		"<STAKEHOLDER_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/PolulationServed/<STAKEHOLDER_NAME>",
		"..."
	],
	"organizationType": "<ORGANIZATION_TYPE_ID>",
	"servesEDG": [
		"<EDG_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/EquityDeservingGroup/<EDG_NAME>",
		"..."
	],
	"hasFundingStatus": [
		"<FUNDING_STATUS_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/FundingStatus/<FUNDING_STATUS_NAME>",
		"..."
	],
	"reportedDate": "<DATE>"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- forOrganization - string, required on export / warning on import, default value "";
- hasPrimaryContact - strings array, warning, default value [];
- hasManagementTeamProfile - strings array, warning, default value [];
- hasBoardProfile - strings array, warning, default value [];
- sectorServed - strings array, warning, default value [];
- localityServed - strings array, warning, default value [];
- provinceTerritoryServed - strings array, warning, default value [];
- primaryPopulationServed - strings array, warning, default value [];
- organizationType - string, required on export / warning on import, default value "";
- servesEDG - strings array, warning, default value [];
- hasFundingStatus - strings array, warning, default value [];
- reportedDate - string, required on export / warning on import, default value "";

### cids:ImpactReport

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:ImpactReport",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/ImpactReport/<IMPACT_REPORT_NAME_URI_FORMAT>",
	"hasName": "<IMPACT_REPORT_NAME>",
	"forOrganization": "<ORGANIZATION_ID>",
	"prov:startedAtTime": "<DATE_TIME_IN_XSD_DATE_TIME_FORMAT>", //“YYYY-MM-DDThh:mm:ss[Z| (+|-)hh:mm]”
	"prov:endedAtTime": "<DATE_TIME_IN_XSD_DATE_TIME_FORMAT>"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasName - string, required on export / warning on import, default value "";
- forOrganization - string, required on export / warning on import, default value "";
- prov:startedAtTime - string, required on export / warning on import, default value "";
- prov:endedAtTime - string, required on export / warning on import, default value "";

#### Accepted field names on import:

- prov:startedAtTime - prov:startedAtTime or startedAtTime
- prov:endedAtTime - prov:endedAtTime or endedAtTime

### cids:FundingStatus

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:FundingStatus",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/FundingStatus/<FUNDING_STATUS_NAME_URI_FORMAT>",
	"forFunderId": "<ORGANIZATION_ID>",
	"forFunder": "<ORGANIZATION_NAME>",
	"hasFundingState": "<FUNDING_STATE_CODE>",
	"hasDescription": "<FUNDING_STATUS_DESCRIPTION>",
	"reportedDate": "<DATE>"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- forFunderId - string, warning, default value "";
- forFunder - string, default value "";
- hasFundingState - string, required, default value "";
- hasDescription - string, default value "";
- reportedDate - string, default value "";

### cids:TeamProfile

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:TeamProfile",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/TeamProfile/<TEAM_PROFILE_NAME_URI_FORMAT>",
	"hasTeamSize": "<NUMBER_OF_MEMBERS>",
	"hasEDGSize": "<NUMBER_OF_EDG_MEMBERS>",
	"hasEDGProfile": [
		"<EDG_PROFILE_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/EquityDeservingGroupProfile/<EDG_PROFILE_NAME>",
		"..."
	],
	"hasComment": "<TEAM_PROFILE_COMMENTS>",
	"reportedDate": "<DATE>"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasTeamSize - string, required on export / warning on import, default value "";
- hasEDGSize - string, default value "";
- hasEDGProfile - strings array, default value [];
- hasComment - string, default value "";
- reportedDate - string, required on export / warning on import, default value "";

### cids:EDGProfile

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:EDGProfile",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/EquityDeservingGroupProfile/<EDG_PROFILE_NAME_URI_FORMAT>",
	"forEDG": "<EQUITY_DESERVING_GROUP_ID>",
	"hasSize": "<NUMBER_OF_MEMBERS>",
	"reportedDate": "<DATE>"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- forEDG - string, required on export / warning on import, default value "";
- hasSize - string, required on export / warning on import, default value "";
- reportedDate - string, required on export / warning on import, default value "";

### cids:EquityDeservingGroup

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:EquityDeservingGroup",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/EquityDeservingGroup/<EDG_NAME_URI_FORMAT>",
	"hasDescription": "<EDG_DESCRIPTION>",
	"hasCharacteristic": [
		"<CHARACTERISTIC_ID>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/Characteristic/<CHARACTERISTIC_NAME>",
		"..."
	],
	"isDefined": "boolean"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasCharacteristic - strings array, warning, default value [];
- hasDescription - string, default value "";
- isDefined - boolean, default value false;

### cids:Person

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:Person",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Person/<PERSON_NAME_URI_FORMAT>",
	"foaf:givenName": "<FIRST_NAME>",
	"foaf:familyName": "<LAST_NAME>",
	"ic:hasEmail": "<EMAIL>"
}
```

#### Data Types:

- hasPrimaryContact.foaf:givenName - string, required on export / warning on import, default value "";
- hasPrimaryContact.foaf:familyName - string, required on export / warning on import, default value "";
- hasPrimaryContact.ic:hasEmail - string, warning, default value "";

#### Accepted field names on import:

- foaf:givenName or givenName
- foaf:familyName or familyName
- ic:hasEmail or hasEmail

### cids:Characteristic

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:Characteristic",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Characteristic/<CHARACTERISTIC_NAME_URI_FORMAT>",
	"hasName": "<CHARACTERISTIC_NAME>",
	"hasValue": "<CHARACTERISTIC_VALUE>",
	"hasCode": [
		"<CHARACTERISTIC_CODE>",
		"http://<ORGANIZATION_NAME_URL_FORMAT>.org/Code/<CHARACTERISTIC_CODE_NAME>",
		"..."
	]
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- hasCode - strings array, warning, default value [];
- hasName - string, required on export / warning on import, default value "";
- hasValue - string, warning, default value "";

### cids:{CodeList Name}

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:<CODE_LIST_NAME>",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/CodeList/<CODE_NAME_URI_FORMAT>",
	"instance": "<CODE_REFERENCE>",
	"hasName": "<CODE_NAME>"
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- instance - string, required on export / warning on import, default value "";
- hasName - string, required on export / warning on import, default value "";

### cids:Code

```json
{
	"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
	"@type": "cids:Code",
	"@id": "http://<ORGANIZATION_NAME_URL_FORMAT>.org/Code/<CODE_NAME_URI_FORMAT>",
	"definedBy": "<ORGANIZATION_ID>",
	"hasSpecification": "<URL_FOR_SPECIFICATION>",
	"org:hasIdentifier": "<CODE_IDENTIFIER>",
	"hasName": "<CODE_NAME>",
	"hasDescription": "<CODE_DESCRIPTION>",
	"schema:codeValue": "<CODE_VALUE>",
	"i72:value": {
		"@context": "https://ontology.commonapproach.org/contexts/cidsContext.json",
		"@type": "i72:Measure",
		"i72:numerical_value": "<NUMERICAL_VALUE_AS_STRING>",
		"i72:unit_of_measure": "<STRING>"
	}
}
```

#### Data Types:

- @context - constant, string, required;
- @type - string, required;
- @id - string, unique, URI, required;
- definedBy - string, required on export / warning on import, default value "";
- hasSpecification - string, required on export / warning on import, default value "";
- org:hasIdentifier - string, required on export / warning on import, default value "";
- hasName - string, required on export / warning on import, default value "";
- hasDescription - string, required on export / warning on import, default value "";
- schema:codeValue - string, required on export / warning on import, default value "";
- i72:value - object, default value class with all fields empty;
- i72:value.i72:numerical_value - string, default value "";
- i72:value.i72:unit_of_measure - string, default value "";

#### Accepted field names on import:

- org:hasIdentifier - org:hasIdentifier or hasIdentifier
- schema:codeValue - schema:codeValue or codeValue
- i72:value - i72:value or value
- all fields on i72:Measure object will be accept with or without the i72: prefix

**Note:** All numbers should be represented as strings.
